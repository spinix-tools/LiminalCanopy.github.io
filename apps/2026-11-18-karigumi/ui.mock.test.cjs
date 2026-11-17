/* DOM mock integration checks | node ui.mock.test.cjs
   This is NOT a browser E2E suite. It verifies UI-controller wiring without external deps.
*/
"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const K=require("./engine.js");
const elements={},listeners={},store=new Map(),downloads=[];
let needs=[],passes=0;
const results=[];
class Element{
  constructor(id){this.id=id;this.value="";this._html="";this.textContent="";this.dataset={};this.style={};this.handlers={};this.className="";this.files=[];this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  get innerHTML(){return this._html;}
  set innerHTML(v){this._html=String(v);}
  addEventListener(type,fn){this.handlers[type]=fn;}
  click(){this.handlers.click?.();}
  scrollIntoView(){}
  before(){}
  remove(){}
  append(){}
}
const get=id=>elements[id]||(elements[id]=new Element(id));
const needNode=get("needsList");
Object.defineProperty(needNode,"innerHTML",{get(){return this._html;},set(text){
  this._html=String(text);
  needs=[...this._html.matchAll(/<input[^>]*value="(\d+)"[^>]*data-need="([^"]+)"[^>]*>/g)].map(m=>({value:m[1],dataset:{need:m[2]}}));
}});
const document={getElementById:get,querySelectorAll:s=>s==="[data-need]"?needs:[],addEventListener:(t,fn)=>listeners[t]=fn,createElement:tag=>new Element(tag),body:{append(){}}};
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
const URL={createObjectURL:blob=>{downloads.push(blob);return "blob:mock"},revokeObjectURL(){}};
class Blob{constructor(parts,opts){this.parts=parts;this.options=opts;}}
const window={KariCore:K,print(){}};
vm.runInNewContext(fs.readFileSync(__dirname+"/app.js","utf8"),{window,document,localStorage,URL,Blob,setTimeout:()=>1,clearTimeout(){},confirm:()=>true,console});
function verify(name,condition){results.push([name,Boolean(condition)]);assert.ok(condition,name);passes++;}
function action(name,id,idx){listeners.click({target:{closest:()=>({dataset:{action:name,id,idx}})}});}
const submit={preventDefault(){}};
async function main(){
  verify("4 initial items",get("statItems").textContent===4);
  verify("3 sample bookings",get("statEvents").textContent===3);
  verify("no sample shortage",get("statShortage").textContent===0);
  verify("initial cards",get("eventList").innerHTML.includes("午前の講座"));
  get("itemName").value="ケーブルリール";get("itemStock").value="4";get("itemBuffer").value="20";
  get("itemForm").handlers.submit(submit);
  verify("add item",get("statItems").textContent===5);
  verify("local storage on write",store.has("karigumi-project-v1"));
  verify("need controls",needs.some(x=>x.dataset.need==="projector"));
  const sample=K.sample();
  get("planTitle").value="追加の講座";get("planStart").value=sample.events[0].start;get("planEnd").value=sample.events[0].end;
  needs.find(x=>x.dataset.need==="projector").value="2";
  get("planForm").handlers.submit(submit);
  verify("prevent oversubscription",get("statEvents").textContent===3);
  verify("shows shortage",get("probeResult").textContent.includes("在庫を超えます"));
  const slots=JSON.parse(get("suggestions").dataset.slots||"[]");
  verify("slots are proposed",slots.length>0);
  action("useSlot",null,"0");
  verify("adopt alternative slot",get("planStart").value===slots[0].start);
  get("planForm").handlers.submit(submit);
  verify("save alternative",get("statEvents").textContent===4);
  const saved=JSON.parse(store.get("karigumi-project-v1"));
  verify("saved state count",saved.events.length===4);
  action("editEvent",saved.events[3].id);
  verify("edit fills form",get("planTitle").value==="追加の講座");
  get("planTitle").value="追加の講座 改";get("planForm").handlers.submit(submit);
  verify("edit without duplication",JSON.parse(store.get("karigumi-project-v1")).events[3].title==="追加の講座 改");
  action("manifest",saved.events[3].id);
  verify("picking sheet",get("manifest").innerHTML.includes("追加の講座 改"));
  get("exportCsv").handlers.click();
  verify("CSV Blob export",downloads.length===1&&downloads[0].parts[0].includes("追加の講座 改"));
  get("exportJson").handlers.click();
  verify("JSON Blob export",downloads.length===2&&downloads[1].parts[0].includes("追加の講座 改"));
  get("dayFilter").value="2030-01-01";
  get("dayFilter").handlers.change({target:get("dayFilter")});
  verify("day filter",get("eventList").innerHTML.includes("表示できる予定がありません"));
  get("showAll").handlers.click();
  verify("clear day filter",get("eventList").innerHTML.includes("追加の講座 改"));
  get("importFile").files=[{size:400,text:async()=>JSON.stringify(K.sample())}];
  await get("importFile").handlers.change({target:get("importFile")});
  verify("JSON restore",get("statEvents").textContent===3);
  get("importFile").files=[{size:400,text:async()=>JSON.stringify({items:[],events:[]})}];
  await get("importFile").handlers.change({target:get("importFile")});
  verify("invalid import rejected",get("statEvents").textContent===3);
  get("resetData").handlers.click();
  verify("demo reset",get("statItems").textContent===4&&get("statEvents").textContent===3);
  console.log("DOM mock checks:",passes,"/",results.length,"PASS");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
