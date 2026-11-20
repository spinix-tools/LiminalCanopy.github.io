const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./engine.js');
const zlib = require('node:zlib');
const {File} = require('node:buffer');
function jpegExif(endian='II', stamp='2020:09:15 12:34:56', tag=0x9003){
  const le=endian==='II';
  const t=Buffer.alloc(160);t.write(endian,0,'ascii');
  const u16=(p,v)=>le?t.writeUInt16LE(v,p):t.writeUInt16BE(v,p);
  const u32=(p,v)=>le?t.writeUInt32LE(v,p):t.writeUInt32BE(v,p);
  u16(2,42);u32(4,8);
  // IFD0: one Exif SubIFD pointer.
  u16(8,1);u16(10,0x8769);u16(12,4);u32(14,1);u32(18,34);u32(22,0);
  u16(34,1);u16(36,tag);u16(38,2);u32(40,20);u32(44,56);u32(48,0);
  t.write(stamp,56,'ascii');
  const payload=Buffer.concat([Buffer.from('Exif\0\0'),t.subarray(0,90)]);
  const seg=Buffer.alloc(4);seg[0]=0xff;seg[1]=0xe1;seg.writeUInt16BE(payload.length+2,2);
  return Buffer.concat([Buffer.from([0xff,0xd8]),seg,payload,Buffer.from([0xff,0xd9])]);
}
test('valid leap and calendar dates',()=>{
 assert.equal(C.validDate('2024-02-29'),true);assert.equal(C.validDate('2023-02-29'),false);
 assert.equal(C.validDate('2024-04-31'),false);assert.equal(C.validDate('1899-12-31'),false);
 assert.equal(C.validDate('2024-01-01'),true);assert.equal(C.validDate('2024-00-02'),false);
});
test('parse EXIF text rejects invalid times',()=>{
 assert.equal(C.parseExifStamp('2024:12:25 09:08:07').date,'2024-12-25');
 assert.equal(C.parseExifStamp('2024:13:01 09:08:07'),null);
 assert.equal(C.parseExifStamp('2024:01:01 25:08:07'),null);
});
test('JPEG APP1 EXIF little endian',()=>{
 const r=C.exifDate(jpegExif('II'));assert.equal(r.date,'2020-09-15');assert.equal(r.source,'exif-original');assert.equal(r.time,'12:34:56');
});
test('JPEG APP1 EXIF big endian fallback digitized',()=>{
 const r=C.exifDate(jpegExif('MM','2002:03:10 07:08:09',0x9004));assert.equal(r.date,'2002-03-10');assert.equal(r.source,'exif-digitized');
});
test('rejects corrupt EXIF and non-JPEG',()=>{
 assert.equal(C.exifDate(new Uint8Array([1,2,3])),null);
 assert.equal(C.exifDate(new Uint8Array([255,216,255,225,255,255])),null);
 assert.equal(C.exifDate(jpegExif('II','2023:02:29 09:00:00')),null);
});
test('filename inference is not user approval',()=>{
 const r=C.normalizeEntry({name:'IMG_20240105_120201.jpg',size:12},0);
 assert.equal(r.guess.date,'2024-01-05');assert.equal(r.date,'');assert.equal(r.source,'unknown');
 C.acceptFilename(r);assert.equal(r.source,'filename-approved');assert.equal(r.date,'2024-01-05');
});
test('filename date separators and invalid date',()=>{
 assert.equal(C.filenameDate('PXL_2024-05-06_121212.jpg').date,'2024-05-06');
 assert.equal(C.filenameDate('scan20231201.png').date,'2023-12-01');
 assert.equal(C.filenameDate('20230230.jpg'),null);
 assert.equal(C.filenameDate('DSC_1004.jpg'),null);
});
test('manual date can clear but cannot accept invalid day',()=>{
 const r=C.normalizeEntry({name:'abc.png',size:1},0);
 assert.equal(C.setManualDate(r,'2024-12-15'),true);assert.equal(r.source,'manual');
 assert.equal(C.setManualDate(r,'2024-13-15'),false);assert.equal(r.date,'2024-12-15');
 assert.equal(C.setManualDate(r,''),true);assert.equal(r.source,'unknown');
});
test('plan has unverified folder, labels and stable sequence',()=>{
 const a=C.normalizeEntry({name:'hello.jpg',size:3},0);
 const b=C.normalizeEntry({name:'DSC_20210506.jpg',size:2},1);C.acceptFilename(b);
 const c=C.normalizeEntry({name:'clone.jpg',size:4},2);c.duplicateOf=1;
 const p=C.planRows([a,b,c],{prefix:'family',omitDuplicates:true});
 assert.equal(p[0].path,'unverified/family_undated_0001__hello.jpg');
 assert.equal(p[1].path,'2021/05/family_2021-05-06_0002__DSC_20210506.jpg');
 assert.equal(p[2].path,'');assert.equal(p[2].skipped,true);
});
test('path sanitation blocks traversal, controls, markup',()=>{
 const r=C.normalizeEntry({name:'../evil<bad>.jpg',size:1},0);
 const p=C.planRows([r],{prefix:'../../x'});
 assert.ok(!p[0].path.includes('../'));assert.ok(!p[0].path.includes('<'));
});
test('manifest CSV quotes commas and formulas as data fields',()=>{
 const r=C.normalizeEntry({name:'a,"b".jpg',size:1},0);
 const c=C.manifestCSV(C.planRows([r]));assert.ok(c.startsWith('\ufefforiginal,path'));assert.ok(c.includes('"a,""b"".jpg"'));
});
test('CSV neutralizes formula-leading user text',()=>{const r=C.normalizeEntry({name:'=WEBSERVICE("https://evil")',size:1},0);assert.ok(C.manifestCSV(C.planRows([r])).includes("'=WEBSERVICE"));});
test('CRC32 known vector',()=>assert.equal(C.crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('ZIP32 valid structures, no compression, content bytes preserved',async()=>{
 const blob=C.makeZIP([{name:'2024/05/a.txt',bytes:new TextEncoder().encode('hello')},{name:'unverified/写真.txt',bytes:new TextEncoder().encode('あ')}]);
 const buf=Buffer.from(await blob.arrayBuffer());assert.equal(buf.readUInt32LE(0),0x04034b50);assert.equal(buf.readUInt32LE(buf.length-22),0x06054b50);assert.equal(buf.readUInt16LE(buf.length-12),2);
 const local=buf.subarray(30+Buffer.byteLength('2024/05/a.txt'),30+Buffer.byteLength('2024/05/a.txt')+5).toString();assert.equal(local,'hello');
});
test('duplicate comparison compares actual bytes, not same size',async()=>{
 const a=new File(['abc'],'first.txt'),b=new File(['abc'],'again.txt'),c=new File(['abd'],'third.txt');
 assert.equal(await C.identicalFiles(a,b,1),true);assert.equal(await C.identicalFiles(a,c,1),false);
 const rows=[a,b,c].map((f,i)=>C.normalizeEntry({name:f.name,size:f.size,file:f},i));
 await C.findDuplicates(rows);assert.equal(rows[1].duplicateOf,1);assert.equal(rows[2].duplicateOf,null);
});
test('randomized archive plans keep unique paths and accepted date source',()=>{
 let seed=77131;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let iteration=0;iteration<400;iteration++){
  const rows=Array.from({length:1+Math.floor(rand()*25)},(_,i)=>C.normalizeEntry({name:`copy${i}.jpg`,size:Math.floor(rand()*10000)},i));
  for(let i=0;i<rows.length;i++){
   if(rand()>.5)C.setManualDate(rows[i],`2024-${String(1+Math.floor(rand()*12)).padStart(2,'0')}-15`);
   if(i&&rand()<.2)rows[i].duplicateOf=1+Math.floor(rand()*i);
  }
  const p=C.planRows(rows,{prefix:'memories',omitDuplicates:rand()>.5});
  const names=p.filter(r=>!r.skipped).map(r=>r.path);assert.equal(new Set(names).size,names.length);
  for(const r of p){if(r.date)assert.equal(C.validDate(r.date),true);else if(!r.skipped)assert.ok(r.path.startsWith('unverified/'));}
 }
});