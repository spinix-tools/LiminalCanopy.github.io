// Lightweight GitHub HTML smoke checks. Run: node --test smoke.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline app code present');
function el(id) {
  return {id, value:'', textContent:'', innerHTML:'', children:[], attrs:{},dataset:{},
    classList:{toggle(){}}, append(...e){this.children.push(...e)},
    replaceChildren(...e){this.children=e}, setAttribute(k,v){this.attrs[k]=v},
    click(){this.onclick?.()}};
}
function setup(){
 const ids='csv title xt yt values line bar series palette error chart count audit table status apply svg csvDownload settings'.split(' ');
 const els=Object.fromEntries(ids.map(k=>[k,el(k)]));
 const modes='normal protan deutan tritan gray'.split(' ').map(m=>Object.assign(el(m),{dataset:{mode:m}}));
 const document={getElementById:k=>els[k],createElement:el,querySelectorAll:q=>q==='[data-mode]'?modes:[]};
 const store={getItem:()=>null,setItem(k,v){this[k]=v}};
 vm.runInNewContext(script,{document,localStorage:store,console,Blob:class{},URL:{createObjectURL(){return 'mock:'},revokeObjectURL(){}},setTimeout(){}},{timeout:2000});
 return {els,modes,store};
}
test('sample chart and data table render',()=>{
 const {els}=setup(); assert.match(els.chart.innerHTML,/<svg /);
 assert.equal(els.series.children.length,4); assert.equal(els.table.children[0].children.length,2);
});
test('bar chart uses patterns',()=>{const {els}=setup();els.bar.click();assert.match(els.chart.innerHTML,/<pattern /);});
test('deutan approximate preview',()=>{const {els,modes}=setup();modes[2].click();assert.match(els.chart.innerHTML,/D型/);});
test('valid and invalid CSV have distinct outcomes',()=>{
 const {els}=setup();els.csv.value='年,A,B\n2025,12,19\n2026,11,24';els.apply.click();
 assert.equal(els.series.children.length,2);assert.equal(els.error.textContent,'');
 els.csv.value='x,A\n2025,bad\n2026,3';els.apply.click();assert.match(els.error.textContent,/数値/);
});
test('state uses only local browser storage',()=>{const {store}=setup();assert.equal(typeof store['miwake-sen-lite'],'string');});
