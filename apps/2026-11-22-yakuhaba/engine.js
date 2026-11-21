/* 訳幅ものさし — dependency-free layout audit core (MIT) */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Yakuhaba = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LANGS = ['ja','en','zh','ko','de','fr'];
  const NAMES = {ja:'日本語',en:'English',zh:'简体中文',ko:'한국어',de:'Deutsch',fr:'Français'};
  const HEADERS = ['id','label','width','height','fontSize','lineHeight','padding','maxLines',...LANGS];
  const SAMPLE = [
    { id:'sign-01',label:'入口の方向案内',width:170,height:54,fontSize:19,lineHeight:1.35,padding:9,maxLines:2,ja:'こちらが入口です',en:'Entrance this way',zh:'入口在这边',ko:'입구는 이쪽입니다',de:'Eingang in diese Richtung',fr:'Entrée par ici' },
    { id:'sign-02',label:'予約に関する案内',width:200,height:63,fontSize:17,lineHeight:1.35,padding:9,maxLines:2,ja:'事前予約が必要です',en:'Advance reservation required',zh:'需要提前预约',ko:'사전 예약이 필요합니다',de:'Eine vorherige Reservierung ist erforderlich',fr:'Réservation préalable obligatoire' },
    { id:'sign-03',label:'バリアフリー経路',width:180,height:56,fontSize:17,lineHeight:1.3,padding:9,maxLines:2,ja:'段差のない経路はこちら',en:'Step-free access is available via the side entrance',zh:'无障碍通道请走这边',ko:'계단 없는 경로는 이쪽입니다',de:'Barrierefreier Zugang über den Seiteneingang',fr:'Accès sans marches par l’entrée latérale' },
    { id:'sign-04',label:'営業時間',width:145,height:44,fontSize:17,lineHeight:1.28,padding:8,maxLines:1,ja:'営業時間 9–18時',en:'Open 9 am–6 pm',zh:'营业时间 9–18点',ko:'영업시간 9~18시',de:'Öffnungszeiten 9–18 Uhr',fr:'Ouvert de 9 h à 18 h' },
    { id:'sign-05',label:'注意事項',width:195,height:82,fontSize:16,lineHeight:1.35,padding:11,maxLines:3,ja:'館内ではお静かにお願いいたします。',en:'Please keep your voice down inside the building.',zh:'请在馆内保持安静。',ko:'건물 안에서는 조용히 해 주세요.',de:'Bitte verhalten Sie sich im Gebäude ruhig.',fr:'Merci de parler doucement dans le bâtiment.' }
  ];
  const clamp = (v,lo,hi,fallback=lo) => { const n=Number(v); return Number.isFinite(n) ? Math.min(hi,Math.max(lo,n)) : fallback; };
  const safeText = (v,limit=3000) => String(v == null ? '' : v).slice(0,limit);
  const normalize = (item,idx=0) => {
    const i=item||{};
    const texts={}; for(const lang of LANGS) texts[lang]=safeText(i[lang] ?? (i.texts && i.texts[lang]));
    return {id:safeText(i.id||`item-${idx+1}`,60),label:safeText(i.label||`要素 ${idx+1}`,100),
      width:clamp(i.width,40,1200,200),height:clamp(i.height,20,600,60),
      fontSize:clamp(i.fontSize,9,64,17),lineHeight:clamp(i.lineHeight,1,2.5,1.35),
      padding:clamp(i.padding,0,120,8),maxLines:clamp(i.maxLines,1,12,2),texts};
  };
  const graphemes = text => {
    if(typeof Intl !== 'undefined' && typeof Intl.Segmenter==='function')
      return [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(i=>i.segment);
    return Array.from(text);
  };
  function wrap(text,limit,measure) {
    if (limit<=0) return {lines:[String(text)], widest:Infinity};
    const lines=[]; let widest=0;
    for(const paragraph of String(text).replace(/\r\n?/g,'\n').split('\n')) {
      let buffer='';
      for(const g of graphemes(paragraph)) {
        const candidate=buffer+g;
        if(buffer && measure(candidate)>limit+0.001){lines.push(buffer);widest=Math.max(widest,measure(buffer));buffer=g;}
        else buffer=candidate;
      }
      lines.push(buffer);widest=Math.max(widest,measure(buffer));
    }
    return {lines,widest};
  }
  function audit(item,lang,measure) {
    const it=normalize(item);
    const text=it.texts[lang]||'';
    const innerWidth=it.width-2*it.padding;
    const availableHeight=it.height-2*it.padding;
    const linePx=it.fontSize*it.lineHeight;
    const physicalLines=Math.max(0,Math.floor((availableHeight+0.01)/linePx));
    const allowedLines=Math.min(it.maxLines,physicalLines);
    if(!text.trim()) return {status:'missing',reason:'翻訳未入力',lines:[],count:0,allowedLines,requiredHeight:0,requiredWidth:null,usage:0,physicalLines};
    const words=wrap(text,innerWidth,measure);
    const count=words.lines.length;
    const overflow=count>allowedLines || !Number.isFinite(words.widest) || innerWidth<=0;
    const usage=allowedLines>0 ? count/allowedLines : Infinity;
    const requiredHeight=Math.ceil(count*linePx+2*it.padding);
    const status=overflow?'overflow':usage>=0.95?'tight':'ok';
    let requiredWidth=null;
    if(overflow&&allowedLines>=1) {
      let low=Math.max(1,innerWidth),high=2400;
      if(wrap(text,high,measure).lines.length<=allowedLines) {
        for(let k=0;k<13;k++) {const mid=(low+high)/2;
          if(wrap(text,mid,measure).lines.length<=allowedLines)high=mid; else low=mid;}
        requiredWidth=Math.ceil(high+2*it.padding);
      }
    }
    const reason=overflow?`必要 ${count} 行・許容 ${allowedLines} 行`:status==='tight'?`余裕が小さい（${count}/${allowedLines}行）`:'収まる見込み';
    return {status,reason,lines:words.lines,count,allowedLines,requiredHeight,requiredWidth,usage,physicalLines};
  }
  function report(rows,langs,measureFactory){
    const result=[];
    for(const row of rows){ const item=normalize(row);
      const measure=measureFactory(item);
      for(const lang of langs) result.push({id:item.id,label:item.label,lang,...audit(item,lang,measure)});
    }
    return result;
  }
  function parseCSV(text){
    const src=String(text).replace(/^\uFEFF/,''); const cells=[];let row=[],buf='',quoted=false;
    for(let i=0;i<src.length;i++){
      const c=src[i];if(quoted){if(c==='"'&&src[i+1]==='"'){buf+='"';i++;}else if(c==='"')quoted=false;else buf+=c;}
      else if(c==='"')quoted=true;
      else if(c===','){row.push(buf);buf='';}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&src[i+1]==='\n')i++;row.push(buf);buf='';if(row.some(v=>v!==''))cells.push(row);row=[];}
      else buf+=c;
    }
    if(quoted)throw Error('CSV の引用符が閉じられていません');
    row.push(buf);if(row.some(v=>v!==''))cells.push(row);
    if(!cells.length)return [];
    const head=cells.shift().map(x=>x.trim());
    if(!head.includes('id')||!head.some(x=>LANGS.includes(x)))throw Error('CSV ヘッダーには id と言語列が必要です');
    return cells.map((r,i)=>normalize(Object.fromEntries(head.map((h,k)=>[h,r[k]||''])),i));
  }
  function csvQuote(value){
    let s=String(value??'');
    // Prevent spreadsheet formula injection when opening CSV in Excel-like tools.
    if(/^[\t\r\n ]*[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function serializeCSV(rows){
    return '\uFEFF'+[HEADERS.join(','),...rows.map((v,i)=>{
      const r=normalize(v,i);
      return [r.id,r.label,r.width,r.height,r.fontSize,r.lineHeight,r.padding,r.maxLines,...LANGS.map(l=>r.texts[l])].map(csvQuote).join(',');
    })].join('\r\n')+'\r\n';
  }
  function auditCSV(entries){
    const heads=['id','label','lang','status','reason','lines','allowed','min_height_px','min_width_px'];
    return '\uFEFF'+[heads.join(','),...entries.map(e=>[e.id,e.label,e.lang,e.status,e.reason,e.count,e.allowedLines,e.requiredHeight,e.requiredWidth??''].map(csvQuote).join(','))].join('\r\n')+'\r\n';
  }
  function loadProject(src){
    const data=typeof src==='string'?JSON.parse(src):src;
    if(!data||!Array.isArray(data.items))throw Error('JSON 内に items 配列がありません');
    if(data.items.length>100)throw Error('要素は最大100件です');
    return {title:safeText(data.title||'無題プロジェクト',120),items:data.items.map(normalize)};
  }
  function sampleProject(){return {title:'観光施設の案内表示｜サンプル',items:SAMPLE.map(normalize)};}
  return {LANGS,NAMES,HEADERS,normalize,wrap,audit,report,parseCSV,serializeCSV,auditCSV,loadProject,sampleProject};
});
