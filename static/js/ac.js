/* Classroom AC: fuzzy (Sugeno) controller and load model */
/* ---------- AC: fuzzy (Sugeno) controller ---------- */
const cl=x=>Math.max(0,Math.min(1,x));
function fuzzy(r,T){const o=[cl((.5-r)/.4),0,cl((r-.5)/.4)];o[1]=Math.max(0,1-o[0]-o[2]);const t=[cl((30-T)/6),0,cl((T-30)/6)];t[1]=Math.max(0,1-t[0]-t[2]);
 const S=[[27,26,25],[26,25,24],[25,23.5,22]];let n=0,d=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const w=t[i]*o[j];n+=w*S[i][j];d+=w}return Math.round(n/d*2)/2}
const kw=(rm,T,set,p)=>rm.area*.0045*Math.max(0,T-set)+p*.033;
function decide(rm,d,h){const w=W[d][h],T=w.t+w.s,c=TT[rm.n][d][h],nx=TT[rm.n][d][h+1],r=c?c.att/rm.cap:0;
 if(c){if(r<.3&&T<26)return{st:'Fan only',set:null,kw:0,why:`Light class, mild ${T.toFixed(0)}°C`};const set=fuzzy(r,T);return{st:'Cooling',set,kw:kw(rm,T,set,c.att),why:`${Math.round(r*100)}% full, feels ${T.toFixed(0)}°C`}}
 if(nx){const set=fuzzy(nx.att/rm.cap,T)+1;return{st:'Pre-cool',set,kw:.5*kw(rm,T,set,0),why:'Class starts next hour'}}
 return{st:'Off',set:null,kw:0,why:'No class scheduled'}}
function week(){return DATES.map(d=>{let b=0,o=0;rooms.forEach(rm=>{for(let h=8;h<=17;h++){const w=W[d][h],c=TT[rm.n][d][h];b+=kw(rm,w.t+w.s,22,c?c.att:0);o+=decide(rm,d,h).kw}});return{b,o}})}
