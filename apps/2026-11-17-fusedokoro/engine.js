/* FUSEDOKORO geometry and export-inspection engine. MIT. No dependencies. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FuseEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const integer = (x, fallback = 0) => Number.isFinite(Number(x)) ? Math.round(Number(x)) : fallback;
  function clampRect(rect, width, height) {
    const W = Math.max(0, integer(width)), H = Math.max(0, integer(height));
    const x0 = clamp(integer(rect.x), 0, W), y0 = clamp(integer(rect.y), 0, H);
    const x1 = clamp(integer(rect.x) + Math.max(0, integer(rect.w)), 0, W);
    const y1 = clamp(integer(rect.y) + Math.max(0, integer(rect.h)), 0, H);
    return { x:x0, y:y0, w:Math.max(0,x1-x0), h:Math.max(0,y1-y0) };
  }
  function fromDrag(x0, y0, x1, y1, width, height, padding = 0) {
    const pad = clamp(integer(padding), 0, 100);
    const left = Math.floor(Math.min(x0,x1)) - pad, top = Math.floor(Math.min(y0,y1)) - pad;
    const right = Math.ceil(Math.max(x0,x1)) + pad, bottom = Math.ceil(Math.max(y0,y1)) + pad;
    const sx = clamp(left, 0, width), sy = clamp(top, 0, height);
    return {x:sx, y:sy, w:Math.max(0,clamp(right,0,width)-sx), h:Math.max(0,clamp(bottom,0,height)-sy)};
  }
  function coveredPixels(rects, width, height) {
    const rs = rects.map(r=>clampRect(r,width,height)).filter(r=>r.w>0 && r.h>0);
    const ys = [...new Set(rs.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
    let area = 0;
    for(let i=0; i<ys.length-1; i++) {
      const mid=(ys[i]+ys[i+1])/2;
      const spans=rs.filter(r=>r.y<=mid && r.y+r.h>=mid).map(r=>[r.x,r.x+r.w]).sort((a,b)=>a[0]-b[0]);
      let total=0, a=-1, b=-1;
      for(const [start,end] of spans){
        if(a===-1){a=start;b=end;}
        else if(start<=b)b=Math.max(b,end);
        else {total+=b-a;a=start;b=end;}
      }
      if(a!==-1)total+=b-a;
      area+=total*(ys[i+1]-ys[i]);
    }
    return area;
  }
  function checkSolidPixels(imageData, expected=[20,30,42,255]) {
    const {data,width,height}=imageData;
    let wrong=0; let first=-1;
    if (!data || data.length !== width*height*4) throw new Error('Invalid image data');
    for(let i=0;i<data.length;i+=4){
      if(data[i]!==expected[0] || data[i+1]!==expected[1] || data[i+2]!==expected[2] || data[i+3]!==expected[3]) {wrong++;if(first<0)first=i/4;}
    }
    return { inspected:width*height, mismatches:wrong, firstMismatch:first };
  }
  function pngChunkTypes(bytes) {
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    if(b.length<20 || [137,80,78,71,13,10,26,10].some((v,i)=>b[i]!==v)) throw new Error('PNG signature missing');
    const view = new DataView(b.buffer,b.byteOffset,b.byteLength);
    let at=8, finished=false; const chunks=[];
    while(at+12<=b.length){
      const len=view.getUint32(at), type=String.fromCharCode(...b.subarray(at+4,at+8));
      if(len > b.length-at-12) throw new Error('Truncated PNG chunk');
      chunks.push(type); at+=12+len;
      if(type==='IEND'){finished=true;break;}
    }
    if(!finished || chunks[0]!=='IHDR') throw new Error('Invalid PNG structure');
    return chunks;
  }
  const privateChunks=['eXIf','tEXt','iTXt','zTXt'];
  function auditMetadata(bytes){
    const chunks=pngChunkTypes(bytes);
    return {chunks, suspect:chunks.filter(x=>privateChunks.includes(x)), clean:!chunks.some(x=>privateChunks.includes(x))};
  }
  return {clamp, clampRect, fromDrag, coveredPixels, checkSolidPixels, pngChunkTypes, auditMetadata};
});
