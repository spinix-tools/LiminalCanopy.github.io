const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/index.html','utf8').split('<script>')[1].split('const $=id')[0];
const ctx=vm.createContext({});vm.runInContext(src,ctx);assert.equal(ctx.selfTest(),16);
let seed=12345;const rnd=n=>(((seed=(Math.imul(seed,1664525)+1013904223)>>>0)>>>8)%n);const str=(alphabet,n)=>Array.from({length:n},()=>alphabet[rnd(alphabet.length)]).join('');
for(let i=0;i<2000;i++){const p='/'+str('ab.*',rnd(15))+(rnd(2)?'$':'');const s='/'+str('ab.',rnd(20));const end=p.endsWith('$');const body=end?p.slice(0,-1):p;const regex=new RegExp('^'+body.split('*').map(x=>x.replace(/\./g,'\\.')).join('.*')+(end?'$':''));assert.equal(ctx.matches(p,s),regex.test(s),JSON.stringify({p,s}));}
const rules='User-agent: *\n'+Array.from({length:300},(_,i)=>'Disallow: /p'+i+'/$').join('\n');const cases=Array.from({length:500},(_,i)=>'Bot\t/p'+i+'/\t'+(i<300?'block':'allow')).join('\n');assert.equal(ctx.audit(rules,rules,cases).fail,0);console.log('16 built-in + 2000 wildcard reference checks + 500-case capacity check passed');
