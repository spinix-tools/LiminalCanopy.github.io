/* ひづけ仕分け — dependency-free core, MIT */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HizukeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const validDate = (s) => {
    if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(s)) return false;
    const [y,m,d] = s.split('-').map(Number);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  };
  const parseExifStamp = (text) => {
    const m = typeof text === 'string' && text.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (!m) return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`;
    if (!validDate(day) || Number(m[4] || 0) > 23 || Number(m[5] || 0) > 59 || Number(m[6] || 0) > 59) return null;
    return { date: day, time: m[4] ? `${m[4]}:${m[5]}:${m[6]}` : '', precision: 'day' };
  };
  // JPEG APP1 / TIFF IFD0->ExifIFD DateTimeOriginal (0x9003), DateTimeDigitized fallback (0x9004)
  function exifDate(bytes) {
    try {
      const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (a.length < 10 || a[0] !== 0xff || a[1] !== 0xd8) return null;
      const view = new DataView(a.buffer, a.byteOffset, a.byteLength);
      let p = 2;
      while (p + 4 <= a.length) {
        if (a[p] !== 0xff) break;
        const marker = a[p + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
        const length = view.getUint16(p + 2, false);
        if (length < 2 || p + 2 + length > a.length) break;
        const base = p + 4;
        if (marker === 0xe1 && length >= 16 && String.fromCharCode(...a.slice(base, base + 6)) === 'Exif\0\0') {
          const start = base + 6;
          const le = a[start] === 0x49 && a[start+1] === 0x49;
          if (!le && !(a[start] === 0x4d && a[start+1] === 0x4d)) return null;
          const get16 = (off) => (start + off + 2 <= a.length && off >= 0) ? view.getUint16(start+off,le) : null;
          const get32 = (off) => (start + off + 4 <= a.length && off >= 0) ? view.getUint32(start+off,le) : null;
          if (get16(2) !== 42) return null;
          function entries(offset) {
            const count = get16(offset);
            if (count === null || count > 512 || start + offset + 2 + count*12 > a.length) return [];
            const out = [];
            for (let i=0;i<count;i++) {
              const pos=offset+2+i*12;
              out.push({ tag:get16(pos), type:get16(pos+2), count:get32(pos+4), offset:get32(pos+8) });
            }
            return out;
          }
          const first=entries(get32(4));
          const ptr=first.find(e=>e.tag===0x8769 && e.count===1 && e.type===4);
          const ex=ptr?entries(ptr.offset):[];
          function readAscii(e) {
            if (!e || e.type !== 2 || !e.count || e.count > 64) return null;
            const pos=start+(e.count<=4 ? 0 : e.offset);
            // TIFF inline ASCII is not needed for dates (20 bytes)
            if (e.count<=4 || pos < start || pos+e.count > a.length) return null;
            return String.fromCharCode(...a.slice(pos,pos+e.count)).replace(/\0.*$/,'');
          }
          for (const tag of [0x9003, 0x9004]) {
            const stamp=parseExifStamp(readAscii(ex.find(e=>e.tag===tag)));
            if (stamp) return { ...stamp, source: tag===0x9003?'exif-original':'exif-digitized' };
          }
          return null;
        }
        p += 2 + length;
      }
    } catch (_) { return null; }
    return null;
  }
  function filenameDate(name) {
    const raw=String(name || '').replace(/\.[^.]+$/,'');
    // YMD with optional separators; avoid matching arbitrary digit runs.
    const m=raw.match(/(?:^|[^\d])((?:19|20)\d{2})[-_.年]?([01]\d)[-_.月]?([0-3]\d)(?:[-_ T]?([0-2]\d)([0-5]\d)([0-5]\d)?)?(?=$|[^\d])/);
    if (!m) return null;
    const date=`${m[1]}-${m[2]}-${m[3]}`;
    if (!validDate(date) || (m[4] && Number(m[4])>23)) return null;
    const time=m[4]&&m[5]?`${m[4]}:${m[5]}:${m[6]||'00'}`:'';
    return {date,time,precision:'day',source:'filename-candidate'};
  }
  function cleanBasename(name) {
    let text=String(name||'photo').normalize('NFKC').replace(/[\\/\x00-\x1f<>:"|?*]+/g,'_').replace(/\.{2,}/g,'.').replace(/^\.+/,'').trim();
    if (!text) text='photo';
    if (text.length>90) text=text.slice(0,90);
    return text;
  }
  function normalizeEntry(entry, idx) {
    const exif=entry.exif || null;
    const guess=filenameDate(entry.name);
    return {
      id: idx+1, name: String(entry.name), size: Number(entry.size)||0,
      exif, guess, date: exif?.date || '', time: exif?.time || '',
      source: exif?.source || 'unknown', duplicateOf: null,
      file: entry.file || null,
    };
  }
  function acceptFilename(row) { if (!row.guess) return false; row.date=row.guess.date; row.time=row.guess.time; row.source='filename-approved'; return true; }
  function setManualDate(row, date) { if (date && !validDate(date)) return false; row.date=date; row.time=''; row.source=date?'manual':'unknown'; return true; }
  function planRows(rows, options={}) {
    const prefix=cleanBasename(options.prefix||'archive').replace(/\.[a-z0-9]{1,8}$/i,'').slice(0,32);
    const omit=!!options.omitDuplicates;
    const result=[]; let sequence=0;
    for (const row of rows) {
      const duplicate=Number.isInteger(row.duplicateOf) && row.duplicateOf>0;
      const skipped=omit && duplicate;
      if (!skipped) sequence++;
      const approved=validDate(row.date) && ['exif-original','exif-digitized','filename-approved','manual'].includes(row.source);
      const date=approved?row.date:'';
      const folder=date?`${date.slice(0,4)}/${date.slice(5,7)}`:'unverified';
      const basename=cleanBasename(row.name);
      const path=`${folder}/${prefix}_${date||'undated'}_${String(sequence||0).padStart(4,'0')}__${basename}`;
      result.push({id:row.id, original:row.name, size:row.size, date, source:approved?row.source:'unverified', duplicateOf:row.duplicateOf||null, skipped, path:skipped?'':path});
    }
    return result;
  }
  function csvEscape(value) { let s=String(value??''); if (/^[\s]*[=+@\-]/.test(s) && typeof value==='string') s="'"+s; return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
  function manifestCSV(plan) {
    const keys=['original','path','date','source','size','duplicateOf','skipped'];
    return '\ufeff'+[keys.map(csvEscape).join(','),...plan.map(r=>keys.map(k=>csvEscape(r[k])).join(','))].join('\r\n')+'\r\n';
  }
  const crcTable=(()=>{let t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  function crc32(data) { let c=0xffffffff;for(const n of data)c=crcTable[(c^n)&0xff]^(c>>>8);return (c^0xffffffff)>>>0; }
  const enc=(s)=>new TextEncoder().encode(s);
  function makeZIP(entries) {
    // ZIP32 STORE, UTF-8 file names; caller enforces size limits.
    let local=[], central=[], cursor=0;
    for (const item of entries) {
      const name=enc(item.name), data=item.bytes instanceof Uint8Array?item.bytes:new Uint8Array(item.bytes);
      if (name.length>65535 || data.length>0xffffffff || cursor>0xffffffff) throw new Error('ZIP32の上限を超えました');
      const crc=crc32(data);
      const lh=new Uint8Array(30+name.length), l=new DataView(lh.buffer);
      l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(6,0x0800,true); l.setUint16(8,0,true);
      l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true);
      lh.set(name,30); local.push(lh,data);
      const ch=new Uint8Array(46+name.length), c=new DataView(ch.buffer);
      c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
      c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);
      c.setUint32(42,cursor,true);ch.set(name,46);central.push(ch);
      cursor+=lh.length+data.length;
    }
    const centralLength=central.reduce((n,v)=>n+v.length,0);
    if (entries.length>65535 || cursor+centralLength>0xffffffff) throw new Error('ZIP32の上限を超えました');
    const end=new Uint8Array(22), v=new DataView(end.buffer);
    v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);
    v.setUint32(12,centralLength,true);v.setUint32(16,cursor,true);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  async function identicalFiles(a,b,chunk=1024*1024) {
    if (a.size!==b.size) return false;
    for(let start=0;start<a.size;start+=chunk){
      const [aa,bb]=await Promise.all([a.slice(start,start+chunk).arrayBuffer(),b.slice(start,start+chunk).arrayBuffer()]);
      const x=new Uint8Array(aa),y=new Uint8Array(bb);
      if(x.length!==y.length)return false;
      for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;
    }
    return true;
  }
  async function findDuplicates(rows) {
    for(let i=0;i<rows.length;i++){
      rows[i].duplicateOf=null;
      for(let j=0;j<i;j++) {
        if(rows[i].size===rows[j].size && rows[i].file && rows[j].file && await identicalFiles(rows[i].file,rows[j].file)){
          rows[i].duplicateOf=rows[j].duplicateOf||rows[j].id;break;
        }
      }
    }
    return rows;
  }
  return {validDate,parseExifStamp,exifDate,filenameDate,cleanBasename,normalizeEntry,acceptFilename,setManualDate,planRows,manifestCSV,crc32,makeZIP,identicalFiles,findDuplicates};
});