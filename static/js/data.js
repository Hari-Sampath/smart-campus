/* Shared helpers, seeded RNG and loading from the backend API */
const $=s=>document.querySelector(s);
let seed=11;const R=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const ri=n=>Math.floor(R()*n),rr=(a,b)=>a+R()*(b-a);
let rooms=[],TT={},W={},DATES=[],SV=[],TASKS=[],META={},LIVE=true;
const lab=d=>new Date(d+'T00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
async function load(){let D;try{const r=await fetch('/api/data');if(!r.ok)throw 0;D=await r.json();LIVE=true}catch(e){if(!window.SEVA_SAMPLE)throw e;D=window.SEVA_SAMPLE;LIVE=false}
 META=D.meta;PL.clear();BL.clear();
 rooms=D.classrooms.map(x=>({n:x.room,area:x.area_m2,cap:x.capacity,str:x.enrolled}));
 SV=D.servers.map(x=>({n:x.server,v:x.speed,i:x.idle_w,a:x.active_w,boot:x.boot_min,ao:x.always_on}));TASKS=D.tasks.map(x=>x.size_units);
 W={};D.weather.forEach(w=>{(W[w.date]=W[w.date]||{})[w.hour]={t:w.temp_c,s:w.solar_wm2/900*3-1,cond:w.condition,rh:w.humidity_pct}});
 const wd=d=>(new Date(d+'T00:00').getDay()+6)%7;DATES=Object.keys(W).sort().filter(d=>wd(d)<5).slice(-5);
 const wk={};rooms.forEach(x=>wk[x.n]=[{},{},{},{},{}]);D.timetable.forEach(t=>{const w=wk[t.room];if(w&&w[t.weekday])w[t.weekday][t.hour]={att:t.attendance,c:t.course}});
 TT={};rooms.forEach(x=>{TT[x.n]={};Object.keys(W).forEach(d=>{TT[x.n][d]=wd(d)<5?wk[x.n][wd(d)]:{}})});st.d=DATES[DATES.length-1]}

