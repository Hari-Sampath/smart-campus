/* Router, sidebar toggle and boot */
function go(){const k=V[(location.hash||'#overview').slice(1)]?location.hash.slice(1):'overview';document.querySelectorAll('nav a[data-v]').forEach(a=>a.classList.toggle('on',a.dataset.v==k));$('#main').innerHTML=(LIVE?'':'<p class="demo">Showing built-in demo data. Run <code>python server.py</code> to load or upload your own CSVs.</p>')+V[k].html();V[k].init&&V[k].init()}
$('#tg').onclick=()=>$('#side').classList.toggle('min');
load().then(()=>{runOpt();addEventListener('hashchange',go);go()}).catch(()=>{$('#main').innerHTML='<h1>Backend not reachable</h1><p class="sub">Start it with <code>python server.py</code> and open http://localhost:5000.</p>'});
