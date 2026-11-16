/* 順番灯 / JUNBANTO — pure business logic. No network, dependencies, or telemetry. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.JUNBANTO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1;
  const STATUS=['pending','done','blocked','skipped'];
  const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const clip=(v,len=160)=>String(v??'').trim().slice(0,len);
  const iso=()=>new Date().toISOString();
  const clone=x=>JSON.parse(JSON.stringify(x));
  function exampleTemplates(){return [
    {id:'example-event',title:'イベント受付の準備',description:'少人数イベントの受付を開く前の確認例。現場に合わせて変更してください。',updatedAt:iso(),steps:[
      {id:'e1',title:'来場者の導線を確認',criteria:'入口・受付・退出の動線に危険な障害物がない',critical:true},
      {id:'e2',title:'受付リストを用意',criteria:'必要な項目のみ記載されたリストを手元に配置',critical:true},
      {id:'e3',title:'案内表示を設置',criteria:'初めて来場する人が受付を見つけられる',critical:false},
      {id:'e4',title:'問い合わせ時の窓口を決める',criteria:'担当者不在時の連絡・対応方法を共有',critical:true},
      {id:'e5',title:'開始前の最終確認',criteria:'現場の担当者で開始可能か確認',critical:true}
    ]},
    {id:'example-shoot',title:'撮影データを渡す前に',description:'個人制作・小規模チームでファイルを納品する前の確認例。',updatedAt:iso(),steps:[
      {id:'p1',title:'納品点数と形式を突合',criteria:'依頼内容とファイル数・拡張子が一致している',critical:true},
      {id:'p2',title:'不要な位置情報を確認',criteria:'公開範囲に不要なメタデータを除外した',critical:true},
      {id:'p3',title:'閲覧端末で再生・表示',criteria:'納品予定と異なる閲覧環境でも開けた',critical:true},
      {id:'p4',title:'ファイル名を整える',criteria:'相手に伝わる順序と命名にした',critical:false},
      {id:'p5',title:'送付先と共有権限を再確認',criteria:'宛先・閲覧範囲・期限を確認した',critical:true}
    ]}
  ];}
  function initial(){return {version:VERSION,templates:exampleTemplates(),runs:[]};}
  function validateTemplate(t){
    if(!t||typeof t!=='object'||!clip(t.id,100)||!clip(t.title,100)||!Array.isArray(t.steps)||t.steps.length<1||t.steps.length>80)throw Error('手順書の形式が不正です');
    const ids=new Set();
    for(const s of t.steps){if(!s||!clip(s.id,100)||!clip(s.title,160)||typeof s.critical!=='boolean')throw Error('ステップの形式が不正です');if(ids.has(s.id))throw Error('重複したステップIDです');ids.add(s.id);}
    return true;
  }
  function newTemplate(title,desc=''){return {id:uid(),title:clip(title,100)||'新しい手順書',description:clip(desc,600),updatedAt:iso(),steps:[{id:uid(),title:'最初の確認事項',criteria:'完了とみなす条件を書いてください',critical:true}]};}
  function beginRun(t,now=iso()){
    validateTemplate(t);
    return {id:uid(),templateId:t.id,templateTitle:t.title,templateUpdatedAt:t.updatedAt||now,startedAt:now,endedAt:null,status:'active',steps:t.steps.map(s=>({id:s.id,title:s.title,criteria:clip(s.criteria,500),critical:s.critical,status:'pending',note:'',changedAt:null})),events:[]};
  }
  function updateStep(run,stepId,status,note='',now=iso()){
    if(run.status!=='active')throw Error('終了した実行記録は変更できません');
    if(!STATUS.includes(status))throw Error('無効な状態です');
    const target=run.steps.find(x=>x.id===stepId);if(!target)throw Error('項目が見つかりません');
    const clean=clip(note,700);
    if(status==='skipped'&&target.critical)throw Error('必須項目は対象外にできません');
    if(status==='skipped'&&!clean)throw Error('対象外にする理由を書いてください');
    const copy=clone(run),step=copy.steps.find(x=>x.id===stepId);
    const changed=step.status!==status||step.note!==clean;
    step.status=status;step.note=clean;step.changedAt=now;
    if(changed)copy.events.push({stepId,status,at:now});
    return copy;
  }
  function assess(run){
    const counts={pending:0,done:0,blocked:0,skipped:0};
    for(const s of run.steps)counts[s.status]=(counts[s.status]||0)+1;
    const total=run.steps.length;
    const eligible=counts.pending===0&&counts.blocked===0&&run.steps.every(s=>s.status==='done'||(s.status==='skipped'&&!s.critical&&s.note.trim()));
    return {total,...counts,processed:total-counts.pending,eligible,rate:total?Math.round(counts.done/total*100):0,unresolved:counts.pending+counts.blocked};
  }
  function closeRun(run,kind,now=iso()){
    if(run.status!=='active')throw Error('この実行は終了しています');
    if(kind==='completed'&&!assess(run).eligible)throw Error('未対応の項目があり、完了として終了できません');
    if(!['completed','incomplete'].includes(kind))throw Error('終了状態が不正です');
    const copy=clone(run);copy.status=kind;copy.endedAt=now;return copy;
  }
  function validateState(value){
    if(!value||value.version!==VERSION||!Array.isArray(value.templates)||!Array.isArray(value.runs)||value.templates.length>100||value.runs.length>1000)throw Error('このバックアップは読み込めません');
    for(const t of value.templates)validateTemplate(t);
    const ids=new Set();for(const t of value.templates){if(ids.has(t.id))throw Error('手順書IDが重複しています');ids.add(t.id)}
    for(const r of value.runs){if(!r||!clip(r.id,100)||!Array.isArray(r.steps)||r.steps.length>80||!['active','completed','incomplete'].includes(r.status))throw Error('実行記録が不正です');for(const s of r.steps){if(!s||!STATUS.includes(s.status)||typeof s.critical!=='boolean'||!clip(s.id,100))throw Error('実行記録の項目が不正です');}}
    return true;
  }
  const cleanMD=v=>String(v??'').replace(/\\/g,'\\\\').replace(/([`*_\[\]#|])/g,'\\$1').replace(/\r?\n/g,' ').slice(0,700);
  function markdown(run){
    const a=assess(run);const names={pending:'未着手',done:'実施済',blocked:'要対応',skipped:'対象外'};
    const res=[`# ${cleanMD(run.templateTitle)} — 実行記録`,'',`- 開始: ${cleanMD(run.startedAt)}`,`- 終了: ${cleanMD(run.endedAt||'進行中')}`,`- 結果: ${run.status==='completed'?'完了':run.status==='incomplete'?'未完了として終了':'進行中'}`,`- 実施済: ${a.done}/${a.total} / 要対応: ${a.blocked} / 未着手: ${a.pending}`,''];
    run.steps.forEach((s,i)=>{res.push(`## ${i+1}. ${cleanMD(s.title)} — ${names[s.status]}`);res.push(`- 判定条件: ${cleanMD(s.criteria)||'（指定なし）'}`);res.push(`- 区分: ${s.critical?'必須':'通常'}`);if(s.note)res.push(`- メモ: ${cleanMD(s.note)}`);res.push('');});
    res.push('※ この記録は操作者による自己申告です。物的確認や第三者承認を証明しません。');return res.join('\n');
  }
  return {VERSION,STATUS,uid,clip,exampleTemplates,initial,validateTemplate,newTemplate,beginRun,updateStep,assess,closeRun,validateState,markdown};
});
