/* Router, sidebar toggle and boot */
function go(){try{const h=(location.hash||'#overview').slice(1),k=V[h]?h:'overview';
 document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v==k));
 $('#main').innerHTML=(LIVE?'':'<p class="demo">Showing built-in demo data. Run <code>python server.py</code> to load or upload your own CSVs.</p>')+V[k].html();V[k].init&&V[k].init()}
 catch(e){console.error(e);$('#main').innerHTML='<h1>Something went wrong</h1><p class="sub">'+e.message+'</p>'}}
$('#tg').onclick=()=>$('#side').classList.toggle('min');
/* Only a failed data load counts as "no data"; a rendering error is reported as itself */
load().then(()=>{try{runOpt()}catch(e){console.error(e)}addEventListener('hashchange',go);go()},
 ()=>{$('#main').innerHTML='<h1>No data available</h1><p class="sub">The backend did not respond and no demo data was found. Start it with <code>python server.py</code> and open http://localhost:5000.</p>'});
