/* Server scheduling: NSGA-II (makespan vs energy) */
/* ---------- Servers: NSGA-II ---------- */
const dom=(a,b)=>a.f[0]<=b.f[0]&&a.f[1]<=b.f[1]&&(a.f[0]<b.f[0]||a.f[1]<b.f[1]);
function crowd(f){f.forEach(p=>p.d=0);for(let k=0;k<2;k++){f.sort((a,b)=>a.f[k]-b.f[k]);const lo=f[0].f[k],hi=f[f.length-1].f[k];f[0].d=f[f.length-1].d=Infinity;for(let i=1;i<f.length-1;i++)f[i].d+=(f[i+1].f[k]-f[i-1].f[k])/((hi-lo)||1)}}
function rank(P){const F=[[]];P.forEach(p=>{p.S=[];p.n=0});P.forEach(p=>P.forEach(q=>{if(dom(p,q))p.S.push(q);else if(dom(q,p))p.n++}));
 P.forEach(p=>{if(!p.n){p.r=0;F[0].push(p)}});for(let i=0;F[i].length;i++){const N=[];F[i].forEach(p=>p.S.forEach(q=>{if(--q.n===0){q.r=i+1;N.push(q)}}));F.push(N)}F.pop();F.forEach(crowd);return F}
const PUE=1.6;/* facility overhead: cooling and power conversion */
/* A machine that is off pays boot time and boot energy; always-on machines pay idle power for the whole run */
function evalG(g,tasks){const b=SV.map(()=>0);g.forEach((s,i)=>b[s]+=tasks[i]/SV[s].v);const s0=SV.map((x,j)=>b[j]>0&&!x.ao?x.boot:0),T=Math.max(...b.map((x,j)=>x>0?s0[j]+x:0));let E=0;
 SV.forEach((x,j)=>{if(b[j]>0)E+=x.i*s0[j]+x.a*b[j]+x.i*(T-s0[j]-b[j]);else if(x.ao)E+=x.i*T});return{g,b,f:[T,E/60]}}
function nsga2(tasks,pop=120,gens=250){const n=tasks.length,m=SV.length,mk=g=>evalG(g,tasks);
 const ord=SV.map((_,j)=>j).sort((x,y)=>SV[x].a/SV[x].v-SV[y].a/SV[y].v);let P=Array.from({length:pop},()=>{const k=1+ri(m);return mk(tasks.map(()=>ord[ri(k)]))});
 const tour=()=>{const a=P[ri(pop)],b=P[ri(pop)];return a.r<b.r||(a.r===b.r&&a.d>b.d)?a:b};
 for(let t=0;t<gens;t++){rank(P);const C=[];while(C.length<pop){const a=tour(),b=tour(),g=a.g.map((x,i)=>R()<.5?x:b.g[i]);for(let i=0;i<n;i++)if(R()<1.5/n)g[i]=ri(m);C.push(mk(g))}
  const out=[];for(const f of rank(P.concat(C))){if(out.length+f.length<=pop)out.push(...f);else{f.sort((a,b)=>b.d-a.d);out.push(...f.slice(0,pop-out.length));break}}P=out}
 const seen=new Set();return rank(P)[0].filter(p=>{const k=p.f.map(x=>x.toFixed(1)).join();return!seen.has(k)&&seen.add(k)}).sort((a,b)=>a.f[0]-b.f[0])}
const st={d:'',h:11,n:40,pref:65,front:[],base:null};
function runOpt(){seed=500+st.n;const tasks=TASKS.slice(0,st.n);st.front=nsga2(tasks);st.base=evalG(tasks.map((_,i)=>i%SV.length),tasks)}
const pick=()=>st.front[Math.round(st.pref/100*(st.front.length-1))];
