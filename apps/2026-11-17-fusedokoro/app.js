'use strict';
(() => {
  const E = window.FuseEngine;
  const $ = id => document.getElementById(id);
  const C = $('canvas'), ctx=C.getContext('2d', {willReadFrequently:false});
  const PAPER=[20,30,42,255], MAX_PIXELS=24000000, MAX_BYTES=20*1024*1024;
  const state={source:null, name:'画像', masks:[], history:[], future:[], selected:-1, drag:null, lastAudit:null};
  function message(text, type='') { $('audit').textContent=text; $('audit').className='audit'+(type?' '+type:''); }
  function sanitize(name) { return (name||'image').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,54)||'image'; }
  function noticeError(err){message(`エラー: ${err?.message||err}`,'fail');}
  function invalidate(){state.lastAudit=null;$('auditDownload').disabled=true;$('review1').checked=false;$('review2').checked=false;message('変更されています。公開前の目視チェックを行ってから書き出してください。');updateButtons();}
  function updateButtons(){
    $('undo').disabled=!state.history.length;$('redo').disabled=!state.future.length;
    $('clear').disabled=!state.masks.length;
    $('export').disabled=!state.source || !state.masks.length || !$('review1').checked || !$('review2').checked;
  }
  function takeSnapshot(){state.history.push(structuredClone(state.masks));if(state.history.length>80)state.history.shift();state.future=[];}
  function changeMasks(change){takeSnapshot();change();state.selected=Math.min(state.selected,state.masks.length-1);invalidate();refresh();}
  function refresh(){draw();renderList();const s=state.source;const px=s?E.coveredPixels(state.masks,s.width,s.height):0;
    $('maskCount').textContent=state.masks.length;$('pixelCount').textContent=px.toLocaleString('ja-JP');
    $('covered').textContent=s?(100*px/(s.width*s.height)).toFixed(2)+'%':'0%';updateButtons();}
  function draw(){
    if(!state.source)return;
    ctx.clearRect(0,0,C.width,C.height);ctx.drawImage(state.source,0,0);
    for(let i=0;i<state.masks.length;i++){
      const r=state.masks[i];ctx.fillStyle='rgb(20 30 42)';ctx.fillRect(r.x,r.y,r.w,r.h);
      if($('view').value==='edit'){
        ctx.save();ctx.strokeStyle=i===state.selected?'#fa9f59':'#e6f0dd';ctx.lineWidth=Math.max(1,Math.min(C.width/900,3));ctx.setLineDash([10,6]);ctx.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.w-1),Math.max(0,r.h-1));ctx.restore();
      }
    }
    if(state.drag && $('view').value==='edit'){
      const d=state.drag, r=E.fromDrag(d.x0,d.y0,d.x1,d.y1,C.width,C.height,Number($('padding').value)||0);
      ctx.save();ctx.fillStyle='rgba(20,30,42,.7)';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#f49b61';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.restore();
    }
  }
  function renderList(){
    const list=$('masklist');list.replaceChildren();
    if(!state.masks.length){const n=document.createElement('span');n.className='micro';n.textContent='まだマスクがありません。';list.append(n);}
    state.masks.forEach((r,i)=>{
      const item=document.createElement('div');item.className='mask-item'+(i===state.selected?' active':'');
      const info=document.createElement('div');const n=document.createElement('div');n.className='name';n.textContent=`${i+1}. ${r.label||'その他'}`;
      const small=document.createElement('small');small.textContent=`(${r.x}, ${r.y})  ${r.w} × ${r.h} px`;
      info.append(n,small);const pick=document.createElement('button');pick.textContent=i===state.selected?'選択中':'編集';pick.setAttribute('aria-label',`${i+1}番目のマスクを編集`);
      pick.addEventListener('click',()=>{state.selected=i;refresh();});item.append(info,pick);list.append(item);
    });
    const r=state.masks[state.selected];$('geometry').hidden=!r;
    if(r){for(const [id,key] of [['gx','x'],['gy','y'],['gw','w'],['gh','h']]) $(id).value=r[key];}
  }
  function point(ev){const b=C.getBoundingClientRect();return {x:E.clamp((ev.clientX-b.left)/b.width*C.width,0,C.width),y:E.clamp((ev.clientY-b.top)/b.height*C.height,0,C.height)};}
  C.addEventListener('pointerdown',ev=>{
    if(!state.source||$('view').value!=='edit'||ev.button!==0)return;
    const p=point(ev);state.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y,id:ev.pointerId};C.setPointerCapture(ev.pointerId);draw();
  });
  C.addEventListener('pointermove',ev=>{if(!state.drag||ev.pointerId!==state.drag.id)return;const p=point(ev);state.drag.x1=p.x;state.drag.y1=p.y;draw();});
  C.addEventListener('pointerup',ev=>{
    if(!state.drag||ev.pointerId!==state.drag.id)return;
    const p=point(ev), d=state.drag;state.drag=null;
    if(Math.abs(d.x0-p.x)<3 || Math.abs(d.y0-p.y)<3){draw();return;}
    if(state.masks.length>=120){message('マスク上限は120件です。','fail');draw();return;}
    const r=E.fromDrag(d.x0,d.y0,p.x,p.y,C.width,C.height,Number($('padding').value)||0);
    if(r.w && r.h)changeMasks(()=>{state.masks.push({...r,label:$('kind').value});state.selected=state.masks.length-1;}); else draw();
  });
  C.addEventListener('pointercancel',()=>{state.drag=null;draw();});
  $('view').addEventListener('change',draw);
  $('zoom').addEventListener('change',()=>{const actual=$('zoom').value==='actual';C.classList.toggle('actual-zoom',actual);$('board').classList.toggle('actual-zoom',actual);});
  $('undo').addEventListener('click',()=>{if(!state.history.length)return;state.future.push(structuredClone(state.masks));state.masks=state.history.pop();state.selected=-1;invalidate();refresh();});
  $('redo').addEventListener('click',()=>{if(!state.future.length)return;state.history.push(structuredClone(state.masks));state.masks=state.future.pop();state.selected=-1;invalidate();refresh();});
  $('clear').addEventListener('click',()=>{if(!state.masks.length)return;changeMasks(()=>{state.masks=[];state.selected=-1;});});
  $('applyGeo').addEventListener('click',()=>{
    const i=state.selected;if(i<0)return;const current=state.masks[i];
    const raw={x:Number($('gx').value),y:Number($('gy').value),w:Number($('gw').value),h:Number($('gh').value)};
    if(Object.values(raw).some(x=>!Number.isFinite(x))||raw.w<1||raw.h<1){message('幅・高さは1px以上の数値を指定してください。','fail');return;}
    const r=E.clampRect(raw,C.width,C.height);
    if(!r.w||!r.h){message('画像の内側に範囲を指定してください。','fail');return;}
    changeMasks(()=>{state.masks[i]={...r,label:current.label};state.selected=i;});
  });
  $('deleteMask').addEventListener('click',()=>{const i=state.selected;if(i<0)return;changeMasks(()=>{state.masks.splice(i,1);state.selected=-1;});});
  ['review1','review2'].forEach(id=>$(id).addEventListener('change',updateButtons));
  async function loadFile(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('PNG / JPEG / WebP のみ対応しています。');
    if(file.size>MAX_BYTES)throw new Error('20MB以下の画像を選択してください。');
    const image=await createImageBitmap(file);
    if(image.width*image.height>MAX_PIXELS || !image.width || !image.height){image.close();throw new Error('画像が大きすぎます（上限2,400万画素）。');}
    const source=document.createElement('canvas');source.width=image.width;source.height=image.height;source.getContext('2d').drawImage(image,0,0);image.close();
    loadSource(source, sanitize(file.name));
  }
  function loadSource(source,name){
    state.source=source;state.name=name;state.masks=[];state.history=[];state.future=[];state.selected=-1;state.drag=null;
    C.width=source.width;C.height=source.height;C.hidden=false;$('placeholder').hidden=true;
    $('dimension').textContent=`${source.width.toLocaleString()} × ${source.height.toLocaleString()} px · ${name}`;
    $('view').value='edit';$('zoom').value='fit';C.classList.remove('actual-zoom');$('board').classList.remove('actual-zoom');invalidate();refresh();
  }
  $('file').addEventListener('change',async ev=>{try{await loadFile(ev.target.files[0]);ev.target.value='';}catch(e){noticeError(e);}});
  const drop=$('drop');
  ['dragenter','dragover'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove('dragover');}));
  drop.addEventListener('drop',async e=>{try{await loadFile(e.dataTransfer.files[0]);}catch(err){noticeError(err);}});
  document.addEventListener('paste',async e=>{const file=Array.from(e.clipboardData?.files||[]).find(f=>f.type.startsWith('image/'));if(file){e.preventDefault();try{await loadFile(file);}catch(err){noticeError(err);}}});
  $('demo').addEventListener('click',()=>{
    const c=document.createElement('canvas');c.width=1160;c.height=720;const g=c.getContext('2d');
    g.fillStyle='#eaf0ef';g.fillRect(0,0,1160,720);g.fillStyle='#fff';g.fillRect(76,47,1008,629);
    g.fillStyle='#1b3340';g.fillRect(76,47,1008,77);g.font='bold 26px system-ui';g.fillStyle='#fff';g.fillText('Sample / 社内ヘルプデスク',115,95);
    g.font='17px system-ui';g.fillStyle='#597078';g.fillText('⚑ テスト用の架空画面です。実在の個人情報は含みません。',115,166);
    g.fillStyle='#eef5f1';g.fillRect(112,199,936,114);g.fillStyle='#263c48';g.font='bold 19px system-ui';g.fillText('問い合わせ履歴 # DEMO-001',137,239);
    g.font='17px system-ui';g.fillText('担当：サンプル 太郎   /   メール：sample@example.invalid',137,276);
    g.fillStyle='#f5f2e7';g.fillRect(112,340,936,239);g.fillStyle='#263c48';g.font='bold 19px system-ui';g.fillText('テスト画面の共有前チェック',137,382);
    g.font='17px system-ui';g.fillText('仮の住所：テスト県 サンプル市 0-0-0',137,422);
    g.fillText('確認コード：DEMO-XXXX-XXXX（無効）',137,465);
    g.fillText('画面の左端と右端にも情報が残っていないかを確認してください。',137,520);
    g.fillStyle='#27756d';g.fillRect(137,600,220,39);g.fillStyle='white';g.font='bold 16px system-ui';g.fillText('テスト画面を確認',157,625);
    loadSource(c,'架空サンプル');
  });
  function blobFromCanvas(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG生成に失敗しました')),'image/png'));}
  function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  function pad2(n){return String(n).padStart(2,'0');}
  async function exportPng(){
    if($('export').disabled||!state.source)return;
    $('export').disabled=true;message('PNGを書き出し、再読込して全マスク画素を検査しています…');
    try{
      const output=document.createElement('canvas');output.width=C.width;output.height=C.height;
      const g=output.getContext('2d',{willReadFrequently:true});
      g.fillStyle='#ffffff';g.fillRect(0,0,C.width,C.height);g.drawImage(state.source,0,0);
      g.fillStyle='rgb(20,30,42)';for(const r of state.masks)g.fillRect(r.x,r.y,r.w,r.h);
      const blob=await blobFromCanvas(output);const bytes=await blob.arrayBuffer();const meta=E.auditMetadata(bytes);
      // Verify the bytes that will be downloaded, not just the source canvas.
      const img=await createImageBitmap(blob);if(img.width!==C.width||img.height!==C.height)throw new Error('PNG寸法が一致しません。');
      const verification=document.createElement('canvas');verification.width=img.width;verification.height=img.height;
      const v=verification.getContext('2d',{willReadFrequently:true});v.drawImage(img,0,0);img.close();
      let checked=0, mismatches=0;
      for(const r of state.masks){for(let y=r.y;y<r.y+r.h;y+=96){
        const h=Math.min(96,r.y+r.h-y);const result=E.checkSolidPixels(v.getImageData(r.x,y,r.w,h),PAPER);
        checked+=result.inspected;mismatches+=result.mismatches;
      }}
      if(mismatches || !meta.clean)throw new Error(`検証NG: 画素不一致 ${mismatches}、メタデータ候補 ${meta.suspect.join(',')||'なし'}`);
      const union=E.coveredPixels(state.masks,C.width,C.height), stamp=new Date();
      const id=`${stamp.getFullYear()}${pad2(stamp.getMonth()+1)}${pad2(stamp.getDate())}-${pad2(stamp.getHours())}${pad2(stamp.getMinutes())}`;
      state.lastAudit={app:'FUSEDOKORO',schema:1,verified_at:stamp.toISOString(),file:`${state.name}-redacted-${id}.png`,width:C.width,height:C.height,
        masks:state.masks.length,covered_unique_pixels:union,verified_mask_pixels:checked,mismatched_pixels:mismatches,metadata_chunks_found:meta.suspect,
        note:'This audit proves only specified rectangles contain the solid replacement pixels and no known PNG textual/EXIF chunks were found. It does not detect missed sensitive data or guarantee complete privacy.'};
      message(`検証OK｜書き出したPNGを再読込\n塗りつぶし ${state.masks.length}件・検査 ${checked.toLocaleString()}画素（不一致 0）\n既知のEXIF・テキストメタデータチャンク 0件\n※画像全体の情報漏えい安全性を保証するものではありません。`,'ok');
      $('auditDownload').disabled=false;download(blob,state.lastAudit.file);
    }catch(err){state.lastAudit=null;$('auditDownload').disabled=true;noticeError(err);}
    finally{updateButtons();}
  }
  $('export').addEventListener('click',exportPng);
  $('auditDownload').addEventListener('click',()=>{if(!state.lastAudit)return;download(new Blob([JSON.stringify(state.lastAudit,null,2)],{type:'application/json'}),`${state.name}-audit.json`);});
  updateButtons();
  window.__fusedokoroTest={getState:()=>({masks:structuredClone(state.masks),width:C.width,height:C.height,lastAudit:state.lastAudit})};
})();
