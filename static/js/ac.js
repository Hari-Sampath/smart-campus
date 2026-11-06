/* Classroom AC: fuzzy setpoints + a physics-based planner that decides, for every empty gap,
   whether leaving the AC on, setting it back, or switching it off uses the least energy. */
const cl=x=>Math.max(0,Math.min(1,x));
/* Fuzzy setpoint kept inside 24-28 C: 24 C is the BEE default, higher values assume ceiling fans */
function fuzzy(r,T){const o=[cl((.5-r)/.4),0,cl((r-.5)/.4)];o[1]=Math.max(0,1-o[0]-o[2]);const t=[cl((30-T)/6),0,cl((T-30)/6)];t[1]=Math.max(0,1-t[0]-t[2]);
 const S=[[28,27,26],[27,26,25],[26,25,24]];let n=0,d=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const w=t[i]*o[j];n+=w*S[i][j];d+=w}return Math.round(n/d*2)/2}
/* Assumed model constants; see RESEARCH_AND_DEMO.md for limits and sensitivity ranges. */
const AC={ua:1.5,cm:45,pw:.075,eq:.006,cap:.18,cop:3.2,pl:.3,back:28,tol:.5,minSave:.05};
/* Sensitivity controls for the assumed room model; all remain projections until calibrated. */
const SCEN={fanW:50,thermalMass:1,cop:3.2};
const PL=new Map(),BL=new Map();
const Te=(d,t)=>{const h=Math.floor(t),a=W[d][h],b=W[d][Math.min(18,h+1)],x=t-h;return a.t+a.s+(b.t+b.s-a.t-a.s)*x};
const cop=(te,set)=>Math.max(1.5,AC.cop*(1-.025*(te-35))*(1+.03*(set-24)));
/* Single-zone room, 5-minute steps. ctl(t) -> {on,set,k}. Returns end temperature, kWh and the step trace. */
function sim(rm,d,Ti,t0,t1,ctl,ppl,since){const dt=1/12,C=rm.area*AC.cm*SCEN.thermalMass,Qm=rm.area*AC.cap,n=Math.round((t1-t0)*12),out=[];let kwh=0;
 for(let i=0;i<n;i++){const t=t0+i*dt,te=Te(d,t),p=ppl(t),q=rm.area*AC.ua*(te-Ti)/1000+p*AC.pw+(p?rm.area*AC.eq:0),c=ctl(t);let e=0,Qc=0;
  if(c.on){Qc=Math.max(0,Math.min(Qm,q+C*(Ti-c.set)/(dt*3600)));const x=Qc/Qm,k=cop(te,c.set)*(SCEN.cop/AC.cop)*(1+AC.pl*(1-x))*(since<.25?.8:1);e=(Qc/k+SCEN.fanW/1000+rm.area*.0006)*dt;since+=dt}else since=0;
  Ti+=(q-Qc)*dt*3600/C;kwh+=e;out.push({t,e,on:c.on,set:c.set,k:c.k})}
 return{Ti,kwh,out,since}}
/* Best way to spend an empty gap before a class: keep on, set back to 28 C, or switch off, then pre-cool just long enough */
function gap(rm,d,Ti,t0,t1,set,since,ppl){const len=t1-t0,rh=W[d][Math.floor(t1)].rh||60;
 const run=(L,pre)=>{const tl=t1-L;let s=sim(rm,d,Ti,t0,tl,()=>pre,ppl,since),o=s.out,Tm=s.Ti,sn=s.since;
  if(L>0){const s2=sim(rm,d,Tm,tl,t1,()=>({on:true,set,k:'precool'}),ppl,sn);o=o.concat(s2.out);Tm=s2.Ti;sn=s2.since}
  const f=pre.k=='off'&&rh>70?1+.3*(rh-70)/30:1;if(f>1)o.forEach(x=>{if(x.k=='precool')x.e*=f});
  return{Ti:Tm,since:sn,out:o,kwh:o.reduce((a,x)=>a+x.e,0),L}};
 const hold=run(0,{on:true,set,k:'hold'});hold.name='kept on';const cands=[hold];
 [['setback',{on:true,set:AC.back,k:'setback'}],['off',{on:false,k:'off'}]].forEach(([nm,pre])=>{
  if(nm=='off'&&rh>80&&len>2)return;
  for(let L=0;L<len-1e-9;L+=1/6){const r=run(L,pre);if(r.Ti<=set+AC.tol){r.name=nm=='off'?'switched off':'setback to '+AC.back+'°C';cands.push(r);break}}});
 let best=hold;cands.forEach(c=>{if(c.kwh<best.kwh)best=c});if(best!==hold&&best.kwh>hold.kwh*(1-AC.minSave))best=hold;
 const m=Math.round(len*60);best.why=best===hold?`${m}-min gap: kept on, switching off would save under 5%`+(rh>80&&len>2?' (humid: full shutoff avoided)':''):`${m}-min gap: ${best.name} ${best.kwh.toFixed(1)} vs ${hold.kwh.toFixed(1)} kWh kept on, pre-cool ${Math.round(best.L*60)} min`;
 best.hold=hold.kwh;return best}
const NAME={precool:'Pre-cool',class:'Cooling',hold:'Kept on',setback:'Setback',fan:'Fan only',off:'Off'},ORD=['precool','class','hold','setback','fan','off'];
function agg(out){const H={};out.forEach(s=>{const h=Math.floor(s.t+1e-6),o=H[h]=H[h]||{kwh:0,k:{},set:0,n:0};o.kwh+=s.e;o.k[s.k]=1;if(s.on&&s.set){o.set+=s.set;o.n++}});return H}
function plan(rm,d){const key=rm.n+d+SCEN.fanW+':'+SCEN.thermalMass+':'+SCEN.cop;if(PL.has(key))return PL.get(key);
 const cls=h=>TT[rm.n][d][h],ppl=t=>{const c=cls(Math.floor(t+1e-6));return c?c.att:0};let Ti=Te(d,7)+1,since=0,t=7,tr=[],why={},any=false,starts=[];
 while(t<18){const c=cls(t);
  if(c){any=true;const te=Te(d,t+.5),r=c.att/rm.cap,fan=r<.3&&te<26,set=fuzzy(r,te),ctl=fan?{on:false,k:'fan'}:{on:true,set,k:'class'};
   if(!cls(t-1))starts.push({hour:t,temperature:Ti,setpoint:set,within:Math.abs(Ti-set)<=AC.tol});
   const s=sim(rm,d,Ti,t,t+1,()=>ctl,ppl,since);Ti=s.Ti;since=s.since;tr=tr.concat(s.out);why[t]=fan?`Light class, mild ${te.toFixed(0)}°C: fans only`:`${Math.round(r*100)}% full, feels ${te.toFixed(0)}°C, setpoint ${set}°C`;t++;continue}
  let b=t;while(b<18&&!cls(b))b++;
  if(b==18){const s=sim(rm,d,Ti,t,18,()=>({on:false,k:'off'}),ppl,since);tr=tr.concat(s.out);for(let h=t;h<18;h++)why[h]=any?'Done for the day':'No classes today';break}
  const nc=cls(b),r=nc.att/rm.cap,te=Te(d,b+.5);
  if(r<.3&&te<26){const s=sim(rm,d,Ti,t,b,()=>({on:false,k:'off'}),ppl,since);Ti=s.Ti;tr=tr.concat(s.out);for(let h=t;h<b;h++)why[h]='Next class needs fans only';t=b;continue}
  const g=gap(rm,d,Ti,t,b,fuzzy(r,te),since,ppl);Ti=g.Ti;since=g.since;tr=tr.concat(g.out);for(let h=t;h<b;h++)why[h]=g.why;t=b}
 const H=agg(tr),P={};for(let h=7;h<=17;h++){const o=H[h];P[h]={st:NAME[ORD.find(k=>o.k[k])],set:o.n?Math.round(o.set/o.n*2)/2:null,kw:o.kwh,why:why[h]||''}}
 P.starts=starts;PL.set(key,P);return P}
/* Baseline: every room held at a fixed setpoint from 8:00 to 18:00, whether or not anyone is in it */
function baseline(rm,d,set=22){const key=rm.n+d+set+SCEN.fanW+':'+SCEN.thermalMass+':'+SCEN.cop;if(BL.has(key))return BL.get(key);
 const ppl=t=>{const c=TT[rm.n][d][Math.floor(t+1e-6)];return c?c.att:0},a=sim(rm,d,Te(d,7)+1,7,8,()=>({on:false,k:'off'}),ppl,0),b=sim(rm,d,a.Ti,8,18,()=>({on:true,set,k:'base'}),ppl,0),H=agg(a.out.concat(b.out)),R={};
 for(let h=7;h<=17;h++)R[h]=H[h].kwh;BL.set(key,R);return R}
const decide=(rm,d,h)=>plan(rm,d)[h];
function week(set=22){return DATES.map(d=>{let b=0,o=0;rooms.forEach(rm=>{const p=plan(rm,d),q=baseline(rm,d,set);for(let h=7;h<=17;h++){b+=q[h];o+=p[h].kw}});return{b,o}})}
function comfortMetric(){const starts=[];DATES.forEach(d=>rooms.forEach(rm=>starts.push(...plan(rm,d).starts)));return{within:starts.filter(x=>x.within).length,total:starts.length,pct:starts.length?starts.filter(x=>x.within).length/starts.length*100:0}}
