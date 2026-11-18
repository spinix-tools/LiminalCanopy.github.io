/* TODOKUJI: pure, dependency-free poster layout and audit engine (MIT) */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.Todokuji=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PAPERS={A4:[210,297],A3:[297,420]};
const PALETTES={navy:{background:'#f5f6f2',text:'#122a42',accent:'#176567',accentText:'#ffffff'},yellow:{background:'#fff6d5',text:'#262113',accent:'#442c04',accentText:'#ffffff'},night:{background:'#102636',text:'#ffffff',accent:'#f5d777',accentText:'#1f2230'}};
const BASE={paper:'A4',orientation:'portrait',distance:2.5,label:'ご案内',title:'受付はこちら',body:'矢印の方向へお進みください',foot:'ご不明な点はスタッフへお声がけください',arrow:'right',titleSize:30,bodySize:15,footSize:6.5,colors:{...PALETTES.navy}};
const PRESETS={reception:{...BASE},event:{...BASE,paper:'A3',label:'イベント案内',title:'会場は2階です',body:'階段・エレベーターをご利用ください',foot:'足元にお気をつけください',arrow:'up',titleSize:37,bodySize:20,footSize:8,colors:{...PALETTES.night}},queue:{...BASE,label:'順番のご案内',title:'こちらでお待ちください',body:'最後尾は案内表示に沿ってお並びください',foot:'列から離れる際はスタッフにお声がけください',arrow:'none',titleSize:25,bodySize:13,footSize:6,colors:{...PALETTES.yellow}}};
function clone(x){return JSON.parse(JSON.stringify(x));}
function num(x,min,max,fallback){let n=Number(x);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function clean(s,max){return String(s??'').replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max);}
function color(s,fallback){const a=String(s||'').trim();return /^#[0-9a-fA-F]{6}$/.test(a)?a.toLowerCase():fallback;}
function normalize(raw={}){const b=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};const c=b.colors&&typeof b.colors==='object'?b.colors:{};return {paper:PAPERS[b.paper]?b.paper:BASE.paper,orientation:b.orientation==='landscape'?'landscape':'portrait',distance:num(b.distance,0.3,25,BASE.distance),label:clean(b.label??BASE.label,42),title:clean(b.title??BASE.title,150),body:clean(b.body??BASE.body,300),foot:clean(b.foot??BASE.foot,250),arrow:['right','left','up','down','none'].includes(b.arrow)?b.arrow:BASE.arrow,titleSize:num(b.titleSize,8,95,BASE.titleSize),bodySize:num(b.bodySize,4,60,BASE.bodySize),footSize:num(b.footSize,3,30,BASE.footSize),colors:{background:color(c.background,BASE.colors.background),text:color(c.text,BASE.colors.text),accent:color(c.accent,BASE.colors.accent),accentText:color(c.accentText,BASE.colors.accentText)}};}
function rgb(hex){const s=color(hex,'#000000').slice(1);return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));}
function linear(v){v=v/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}
function luminance(hex){const [r,g,b]=rgb(hex).map(linear);return .2126*r+.7152*g+.0722*b;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function bestTextColor(bg){return contrast('#ffffff',bg)>=contrast('#000000',bg)?'#ffffff':'#000000';}
function xml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
// In mm: approximate Japanese full-width glyph as 1 em, Latin as 0.54 em.
function glyphUnits(ch){if(/\s/.test(ch))return .35;if(/[\u0000-\u007f]/.test(ch))return /[MW@%]/.test(ch)?.86:.55;return 1;}
function textWidth(str,size){return Array.from(String(str)).reduce((s,c)=>s+glyphUnits(c)*size,0);}
function wrap(text,size,maxWidth){const src=String(text).split(/\n/),res=[];for(const para of src){if(!para){res.push('');continue;}let current='';for(const ch of Array.from(para)){if(current&&textWidth(current+ch,size)>maxWidth){res.push(current);current='';}current+=ch;}if(current)res.push(current);if(res.length>1&&Array.from(res[res.length-1]).length===1&&Array.from(res[res.length-2]).length>2){const last=res.pop();const prev=res.pop();const chars=Array.from(prev);res.push(chars.slice(0,-1).join(''),chars[chars.length-1]+last);}}return res;}
function paperSize(doc){const d=PAPERS[doc.paper];return doc.orientation==='landscape'?[d[1],d[0]]:d.slice();}
// Estimated visible glyph height: 0.7em (conservative approximation, not measured font metrics).
function effectiveHeight(size){return size*.70;}
// Sign-trade heuristic: salient text 25mm capital height at 3m; secondary text 12.5mm at 3m.
function readingReach(size,role){return effectiveHeight(size)/(role==='title'?(25/3):(12.5/3));}
function arrowPath(dir,cx,cy,r){const pts={right:[[cx-r,cy-r*.4],[cx+r*.1,cy-r*.4],[cx+r*.1,cy-r],[cx+r,cy],[cx+r*.1,cy+r],[cx+r*.1,cy+r*.4],[cx-r,cy+r*.4]],left:[[cx+r,cy-r*.4],[cx-r*.1,cy-r*.4],[cx-r*.1,cy-r],[cx-r,cy],[cx-r*.1,cy+r],[cx-r*.1,cy+r*.4],[cx+r,cy+r*.4]],up:[[cx-r*.4,cy+r],[cx-r*.4,cy-r*.1],[cx-r,cy-r*.1],[cx,cy-r],[cx+r,cy-r*.1],[cx+r*.4,cy-r*.1],[cx+r*.4,cy+r]],down:[[cx-r*.4,cy-r],[cx-r*.4,cy+r*.1],[cx-r,cy+r*.1],[cx,cy+r],[cx+r,cy+r*.1],[cx+r*.4,cy+r*.1],[cx+r*.4,cy-r]]};return pts[dir]?'<polygon points="'+pts[dir].map(p=>p.map(x=>x.toFixed(2)).join(',')).join(' ')+'"/>':'';}
function layout(input){const d=normalize(input),[width,height]=paperSize(d),margin=Math.min(16,width*.065),available=width-margin*2;
const labelSize=Math.min(8,Math.max(5,width*.025)),top=margin+7,tagHeight=labelSize+7,headY=top+tagHeight+Math.max(14,d.titleSize*1.08);
const titles=wrap(d.title,d.titleSize,available),titleStep=d.titleSize*1.18;
const headingEnd=headY+Math.max(0,titles.length-1)*titleStep;
const bodyY=headingEnd+Math.max(17,d.titleSize*.78),bodies=wrap(d.body,d.bodySize,available),bodyStep=d.bodySize*1.4;
const bodyEnd=bodyY+Math.max(0,bodies.length-1)*bodyStep;
const footerLines=wrap(d.foot,d.footSize,available),footerStart=height-margin-4-(footerLines.length-1)*d.footSize*1.36;
const arrowSize=Math.min(width*.20,height*.10,35),arrowY=Math.max(bodyEnd+d.bodySize*.8+arrowSize*.65, (bodyEnd+footerStart)/2);
const notes=[];if(!d.title)notes.push({level:'error',code:'EMPTY_TITLE',text:'見出しが空白です'});
if(!d.body)notes.push({level:'info',code:'EMPTY_BODY',text:'補足文は空白です'});
if(titles.length>3)notes.push({level:'warn',code:'TITLE_WRAP',text:'見出しが'+titles.length+'行に折り返されています'});
if(d.arrow!=='none'&&arrowY+arrowSize*.8>footerStart-8)notes.push({level:'error',code:'OVERFLOW_ARROW',text:'矢印とフッターが重なる可能性があります'});
if(bodyEnd+d.bodySize*.38>footerStart-8)notes.push({level:'error',code:'OVERFLOW_TEXT',text:'本文とフッターが重なる可能性があります'});
if(d.titleSize>available)notes.push({level:'warn',code:'OVERSIZE_TITLE',text:'見出し文字が紙面幅より大きくなっています'});
const normalContrast=contrast(d.colors.text,d.colors.background),tagContrast=contrast(d.colors.accentText,d.colors.accent);
if(normalContrast<4.5)notes.push({level:'warn',code:'LOW_CONTRAST',text:'本文色のコントラストが4.5:1未満です'});
if(tagContrast<4.5)notes.push({level:'warn',code:'TAG_CONTRAST',text:'ラベルのコントラストが4.5:1未満です'});
if(d.arrow!=='none'&&contrast(d.colors.accent,d.colors.background)<3)notes.push({level:'warn',code:'ICON_CONTRAST',text:'矢印と背景の色差が3:1未満です'});
const titleReach=readingReach(d.titleSize,'title'),bodyReach=readingReach(d.bodySize,'body');
if(titleReach<d.distance)notes.push({level:'warn',code:'DISTANCE_TITLE',text:'見出しが設定した視距離に対して小さめです'});
if(bodyReach<d.distance)notes.push({level:'warn',code:'DISTANCE_BODY',text:'補足文が設定した視距離に対して小さめです'});
if(d.titleSize>width*.24)notes.push({level:'info',code:'SIZE_BIG',text:'大きい字は短い文章で利用してください'});
return {doc:d,width,height,margin,available,labelSize,top,tagHeight,headY,titles,titleStep,headingEnd,bodyY,bodies,bodyStep,bodyEnd,footerLines,footerStart,arrowY,arrowSize,notes,normalContrast,tagContrast,titleReach,bodyReach};}
function svg(input){const l=layout(input),d=l.doc,c=d.colors,items=[];const add=(s)=>items.push(s);add('<?xml version="1.0" encoding="UTF-8"?>');add('<svg xmlns="http://www.w3.org/2000/svg" width="'+l.width+'mm" height="'+l.height+'mm" viewBox="0 0 '+l.width+' '+l.height+'" role="img" aria-label="'+xml(d.title)+'">');add('<rect width="100%" height="100%" fill="'+c.background+'"/>');add('<rect x="'+l.margin+'" y="'+l.top+'" width="'+Math.min(l.available,Math.max(40,textWidth(d.label,l.labelSize)+14)).toFixed(2)+'" height="'+l.tagHeight+'" rx="2.8" fill="'+c.accent+'"/>');add('<text x="'+(l.margin+7)+'" y="'+(l.top+4+l.labelSize)+'" font-size="'+l.labelSize+'" font-weight="700" fill="'+c.accentText+'" font-family="sans-serif">'+xml(d.label)+'</text>');
for(let i=0;i<l.titles.length;i++)add('<text x="'+l.margin+'" y="'+(l.headY+i*l.titleStep).toFixed(2)+'" font-size="'+d.titleSize+'" font-weight="800" fill="'+c.text+'" font-family="sans-serif">'+xml(l.titles[i])+'</text>');
for(let i=0;i<l.bodies.length;i++)add('<text x="'+l.margin+'" y="'+(l.bodyY+i*l.bodyStep).toFixed(2)+'" font-size="'+d.bodySize+'" font-weight="600" fill="'+c.text+'" font-family="sans-serif">'+xml(l.bodies[i])+'</text>');
if(d.arrow!=='none')add('<g fill="'+c.accent+'">'+arrowPath(d.arrow,l.width/2,l.arrowY,l.arrowSize)+'</g>');
add('<path d="M '+l.margin+' '+(l.footerStart-d.footSize*2).toFixed(2)+' H '+(l.width-l.margin)+'" stroke="'+c.accent+'" stroke-width="1.4"/>');
for(let i=0;i<l.footerLines.length;i++)add('<text x="'+l.margin+'" y="'+(l.footerStart+i*d.footSize*1.36).toFixed(2)+'" font-size="'+d.footSize+'" fill="'+c.text+'" font-family="sans-serif">'+xml(l.footerLines[i])+'</text>');
add('</svg>');return items.join('');}
function auditText(input){const l=layout(input);const a=['とどく字｜掲示物セルフ点検','用紙: '+l.doc.paper+' '+(l.doc.orientation==='landscape'?'横':'縦')+' ('+l.width+'×'+l.height+'mm)','想定距離: '+l.doc.distance+'m','見出し: '+l.doc.title,'タイトル想定距離: '+l.titleReach.toFixed(2)+'m','補足文想定距離: '+l.bodyReach.toFixed(2)+'m','本文色コントラスト: '+l.normalContrast.toFixed(2)+':1','ラベルコントラスト: '+l.tagContrast.toFixed(2)+':1','診断件数: '+l.notes.length,...l.notes.map(n=>'['+n.level.toUpperCase()+'] '+n.text),'※視距離は25mm/3m等の経験則と字高0.7emの仮定。WCAGはWeb向けで、印刷物の認証ではありません。','※フォント、印刷縮尺、照明、視力、紙色等で見え方は変わります。原寸試し刷りが必要です。'];return a.join('\n');}
return {BASE,PRESETS,PALETTES,PAPERS,clone,normalize,rgb,luminance,contrast,bestTextColor,xml,textWidth,wrap,paperSize,effectiveHeight,readingReach,layout,svg,auditText};
});