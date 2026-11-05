// Front-end checks for the controller and optimiser, run with plain Node: node tests/smoke.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const mk = v => ({ value: v, textContent: '', innerHTML: '', classList: { toggle() {} }, style: {} });
const M = {};
global.el = mk; global.M = M; global.window = {}; global.assert = assert;
global.document = { querySelector: s => M[s] = M[s] || mk('11'), querySelectorAll: () => [] };
global.addEventListener = () => {}; global.location = { hash: '' };
global.fetch = async () => { throw new Error('offline'); };   // forces the built-in demo data path
const dir = path.join(__dirname, '..', 'static', 'js');
const src = ['sample', 'data', 'ac', 'scheduler', 'views', 'main'].map(f => fs.readFileSync(path.join(dir, f + '.js'), 'utf8')).join('\n;');
const checks = `;setTimeout(()=>{try{
 M['#d']=el(DATES[4]);
 assert.strictEqual(LIVE,false,'falls back to demo data when backend is offline');
 const w=week(22),O=w.reduce((a,x)=>a+x.o,0),B=w.reduce((a,x)=>a+x.b,0),B24=week(24).reduce((a,x)=>a+x.b,0);
 assert(O<B&&O<B24,'optimised AC uses less than both always-on baselines');
 DATES.forEach(d=>rooms.forEach(rm=>{const p=plan(rm,d);for(let h=8;h<=17;h++){assert(p[h],'hour planned');if(p[h].set!==null)assert(p[h].set>=24&&p[h].set<=28,'setpoint within 24-28 C')}}));
 const kinds=new Set();DATES.forEach(d=>rooms.forEach(rm=>{const p=plan(rm,d);for(let h=8;h<=17;h++)kinds.add(p[h].st)}));
 ['Cooling','Off'].forEach(k=>assert(kinds.has(k),'planner produces '+k));
 const f=st.front;assert(f.length>=3,'Pareto front has several solutions');
 assert(f[0].f[0]<f[f.length-1].f[0]&&f[0].f[1]>f[f.length-1].f[1],'fast end is faster but costs more energy');
 assert(pick().f[1]<st.base.f[1],'chosen plan beats round-robin on energy');
 const ao=SV.map((s,j)=>s.ao?j:-1).filter(j=>j>=0);assert(ao.length>=1,'an always-on server exists');
 for(const k in V){V[k].html();V[k].init&&V[k].init()}
 console.log('front tests passed: AC saves '+((1-O/B)*100).toFixed(1)+'% vs 22C and '+((1-O/B24)*100).toFixed(1)+'% vs 24C; front size '+f.length);
 }catch(e){console.error('FAILED:',e.message);process.exit(1)}},100)`;
(0, eval)(src + checks);
