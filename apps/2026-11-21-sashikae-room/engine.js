/* Sashikae Room - offline text-only script revision comparison engine.
   MIT License. No dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SashikaeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_LINES = 600;
  const MAX_CHARS = 90000;
  const DEFAULT_SCENE = '導入（見出しなし）';
  const clean = s => String(s == null ? '' : s).normalize('NFC').trim();
  function parse(text) {
    if (typeof text !== 'string') throw Error('台本はテキストで指定してください');
    if (text.length > MAX_CHARS) throw Error('台本は9万文字以下にしてください');
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const scenes = []; let scene = null; let ordinal = 0;
    const used = new Map(); let lineCount = 0;
    const begin = title => {
      const identity = clean(title) || DEFAULT_SCENE;
      const occurrence = (used.get(identity) || 0) + 1;
      used.set(identity, occurrence);
      scene = { title, key: identity + '\u0000' + occurrence, lines: [], ordinal: ordinal++ };
      scenes.push(scene);
    };
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const sceneMatch = raw.match(/^#{1,3}\s*(.+)$/) || raw.match(/^(?:場面|シーン|Scene)\s*[：:]\s*(.+)$/i);
      if (sceneMatch) { begin(sceneMatch[1].trim()); continue; }
      if (!scene) begin(DEFAULT_SCENE);
      lineCount++;
      if (lineCount > MAX_LINES) throw Error('台詞とト書きは600行以内にしてください');
      const m = raw.match(/^([^:：]{1,24})\s*[：:]\s*(.+)$/);
      if (m) {
        const name = m[1].trim();
        if (name.startsWith('（') || name.startsWith('(')) { scene.lines.push({ kind: 'direction', speaker: '', text: raw, number: i+1 }); continue; }
        scene.lines.push({ kind: 'dialogue', speaker: name, text: m[2].trim(), number: i+1 });
      } else {
        scene.lines.push({ kind: 'direction', speaker: '', text: raw, number: i+1 });
      }
    }
    if (!scenes.length) begin(DEFAULT_SCENE);
    return { scenes, lineCount };
  }
  function similar(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'dialogue' && clean(a.speaker) !== clean(b.speaker)) return false;
    return clean(a.text) === clean(b.text);
  }
  function substitution(a, b) {
    if (similar(a,b)) return 0;
    if (a.kind !== b.kind) return 3;
    if (a.kind === 'dialogue' && clean(a.speaker) !== clean(b.speaker)) return 3;
    const aa = clean(a.text), bb = clean(b.text);
    // Pair replacements by the same speaker, rather than inventing role changes.
    // Very short repeated utterances can be ambiguous: see README.
    if (!aa.length || !bb.length) return 1.9;
    let shared = 0;
    const bigrams = new Set();
    for (let i=0;i<aa.length-1;i++) bigrams.add(aa.slice(i,i+2));
    for (let i=0;i<bb.length-1;i++) if (bigrams.has(bb.slice(i,i+2))) shared++;
    return Math.max(0.78, 1.78 - Math.min(0.7, shared / Math.max(2, Math.min(aa.length, bb.length))));
  }
  function align(a, b) {
    const n=a.length, m=b.length, w=m+1;
    const dp = new Float64Array((n+1)*w);
    const op = new Uint8Array((n+1)*w); // 1 pair, 2 delete, 3 add
    for(let i=1;i<=n;i++){dp[i*w]=i;op[i*w]=2;}
    for(let j=1;j<=m;j++){dp[j]=j;op[j]=3;}
    for(let i=1;i<=n;i++) for(let j=1;j<=m;j++) {
      const k=i*w+j, match=dp[(i-1)*w+j-1]+substitution(a[i-1],b[j-1]);
      const del=dp[(i-1)*w+j]+1, add=dp[i*w+j-1]+1;
      if (match <= del+1e-7 && match <= add+1e-7) {dp[k]=match;op[k]=1;}
      else if (del <= add) {dp[k]=del;op[k]=2;}
      else {dp[k]=add;op[k]=3;}
    }
    const out=[];let i=n,j=m;
    while (i||j) {
      const action=op[i*w+j];
      if(action===1){out.push({type:similar(a[i-1],b[j-1])?'same':'change',old:a[i-1],now:b[j-1],oldIndex:i-1,newIndex:j-1});i--;j--;}
      else if(action===2){out.push({type:'delete',old:a[i-1],now:null,oldIndex:i-1,newIndex:-1});i--;}
      else if(action===3){out.push({type:'add',old:null,now:b[j-1],oldIndex:-1,newIndex:j-1});j--;}
      else throw Error('比較に失敗しました');
    }
    return out.reverse();
  }
  function beforeDialogue(lines,index) {
    if(index < 0) return null;
    for (let i=index-1;i>=0;i--) if(lines[i].kind==='dialogue') return lines[i];
    return null;
  }
  function cueKey(line) { return line ? clean(line.speaker)+'：'+clean(line.text) : ''; }
  function compare(oldText,newText) {
    const old=parse(oldText), now=parse(newText);
    const oldByKey = new Map(old.scenes.map(s=>[s.key,s]));
    const newByKey = new Map(now.scenes.map(s=>[s.key,s]));
    const keys = [...new Set([...now.scenes.map(s=>s.key), ...old.scenes.map(s=>s.key)])];
    const changes=[], cues=[], sceneSummaries=[];
    for(const key of keys) {
      const prev=oldByKey.get(key), next=newByKey.get(key);
      const name=(next || prev).title;
      const rows=align(prev ? prev.lines : [], next ? next.lines : []);
      for (const row of rows) {
        if(row.type!=='same') {
          const target=row.now||row.old;
          changes.push({ ...row, scene:name, role:target.kind==='dialogue'?target.speaker:'舞台指示', id:changes.length });
        }
        if(row.type==='same' && row.now.kind==='dialogue') {
          const formerCue = beforeDialogue(prev.lines,row.oldIndex);
          const currentCue = beforeDialogue(next.lines,row.newIndex);
          if(cueKey(formerCue) !== cueKey(currentCue)
            && ((formerCue && clean(formerCue.speaker)!==clean(row.now.speaker)) || (currentCue && clean(currentCue.speaker)!==clean(row.now.speaker)))) {
            cues.push({scene:name,role:row.now.speaker,response:row.now,oldCue:formerCue,newCue:currentCue,id:cues.length});
          }
        }
      }
      sceneSummaries.push({name,changes:rows.filter(r=>r.type!=='same').length,cues:cues.filter(c=>c.scene===name).length});
    }
    const roles = [...new Set([...changes.map(c=>c.role),...cues.map(c=>c.role)])].sort((a,b)=>a.localeCompare(b,'ja'));
    const counts = { change:0,add:0,delete:0 };
    changes.forEach(x=>counts[x.type]++);
    return {changes,cues,roles,counts,sceneSummaries,oldLines:old.lineCount,newLines:now.lineCount};
  }
  function filter(result, role) {
    const selected = role === 'ALL' ? null : role;
    return {changes:result.changes.filter(x=>!selected||x.role===selected),cues:result.cues.filter(x=>!selected||x.role===selected)};
  }
  function buildCSV(result,role='ALL') {
    const {changes,cues}=filter(result,role);
    const esc=x=>'"'+String(x??'').replace(/"/g,'""').replace(/\r?\n/g,' ')+'"';
    const rows=[['種別','場面','役割','旧行','新行','旧テキスト','新テキスト']];
    for(const x of changes)rows.push([({change:'変更',add:'追加',delete:'削除'})[x.type],x.scene,x.role,x.old?.number??'',x.now?.number??'',x.old?.text??'',x.now?.text??'']);
    for(const x of cues)rows.push(['受け確認',x.scene,x.role,x.oldCue?.number??'',x.newCue?.number??'',x.oldCue?x.oldCue.speaker+'：'+x.oldCue.text:'（なし）',x.newCue?x.newCue.speaker+'：'+x.newCue.text:'（なし）']);
    return '\ufeff'+rows.map(row=>row.map(esc).join(',')).join('\r\n');
  }
  return {parse,align,compare,filter,buildCSV,MAX_LINES,MAX_CHARS};
});
