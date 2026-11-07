import {filters,available,selectEpisodes,destination,treeGeometry} from './domain.js';
import {DemoAccessProvider,NotibotAccessProvider} from './access-provider.js';
const provider=new DemoAccessProvider();
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#c5a7f2','#8ecfe1','#dfb2ba','#e7cd87'];
const symbols=['sparkles','compass','sun','key-round','hand-heart','tree-pine','orbit','network'];
let items=[],purchased=new Set(),filter=filters[0],frame;
const demoProvider=provider;
const sdk=window.notibot;
const accessProvider=new NotibotAccessProvider(sdk);
let embedded=window.parent!==window,connected=false,accessState='waiting',refreshVersion=0;
function updateEnvironment(){
 $('.demo').hidden=embedded;
 $('.profile').hidden=embedded;
 $('.access-tools').hidden=!embedded;
 $('.footer').hidden=embedded;
 $('.footer').textContent='Демонстрация интерфейса. Тестовые покупки не являются настоящими.';
}
function showMessage(message=''){
 const notice=$('#integration-status');
 notice.textContent=message;notice.hidden=!message;
}
function updateStatus(){
 showMessage(embedded&&(!sdk||accessState==='error')?'Не удалось обновить доступ. Попробуйте ещё раз.':'');
}
function syncEnvironment(){
 connected=true;embedded=true;
 // Clear previous user's entitlements before any asynchronous work.
 refreshVersion++;purchased=new Set();accessState='waiting';
 updateEnvironment();
 if(items.length)void refresh(true);else updateStatus();
}
updateEnvironment();updateStatus();
sdk?.onUpdate(syncEnvironment);
function layout(){
 const map=$('.constellation');if(!map)return;
 const nodes=[...map.querySelectorAll('.orbit-node')];
 const geometry=treeGeometry(nodes.length,map.clientWidth,nodes.map(n=>n.offsetHeight));
 map.style.height=geometry.height+'px';
 nodes.forEach((n,i)=>{n.style.setProperty('--x',geometry.positions[i][0]+'px');n.style.setProperty('--y',geometry.positions[i][1]+'px');});
 const svg=map.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${map.clientWidth} ${geometry.height}`);
 svg.innerHTML=geometry.links.map(([a,b])=>{const p=geometry.positions[a],q=geometry.positions[b],oa=nodes[a].classList.contains('purchased'),ob=nodes[b].classList.contains('purchased');return `<line data-a="${a}" data-b="${b}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" class="${oa&&ob?'owned-link':'next-link'}" style="--link:#b9c3e6"/>`;}).join('');
}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
function render(){
 const visible=selectEpisodes(items,filter,purchased);
 $('.chips').innerHTML=filters.map(f=>`<button data-filter="${f}" aria-pressed="${f===filter}">${f}</button>`).join('');
 $('#count').textContent=`Показано ${visible.length} из ${items.length} · Доступно ${items.filter(e=>available(e,purchased)).length}`;
 $('#om-screen').innerHTML=visible.length?`<div class="constellation" aria-label="Дерево эфиров"><svg class="constellation-links" aria-hidden="true"></svg>${visible.map(e=>{const open=available(e,purchased),status=e.is_free?'Бесплатный':open?(embedded?'Куплен':'Куплен · демо'):(embedded&&accessState!=='ready'?'Проверяем доступ':'Не куплен');return `<a class="orbit-node ${open?'purchased':'locked'}" data-order="${e.order}" style="--topic:${colors[(e.order-1)%colors.length]}" href="${escape(destination(e,purchased,embedded))}" aria-label="${escape(e.title)} — ${status}" title="${escape(e.description)}"><span class="orbit-disc"><i data-lucide="${symbols[(e.order-1)%symbols.length]}" aria-hidden="true"></i>${open?'<span class="owned-mark" aria-hidden="true">✓</span>':''}</span><span class="orbit-title">${escape(e.title)}</span><span class="episode-status">${status}</span></a>`;}).join('')}</div>`:'<p class="empty">Здесь пока нет эфиров. Выберите другой фильтр или тестовый сценарий.</p>';
 globalThis.lucide?.createIcons();
 schedule();
}
function controls(){
 $('#purchases').innerHTML=items.filter(e=>!e.is_free).map(e=>`<label><input type="checkbox" data-purchase="${e.order}" ${purchased.has(e.order)?'checked':''}>${escape(e.title)}</label>`).join('');
}
async function refresh(forceRefresh=false){
 const version=++refreshVersion;
 if(!embedded){const state=await demoProvider.refresh();if(version!==refreshVersion)return;purchased=state.purchased;controls();render();updateStatus();return;}
 purchased=new Set();
 if(!connected){accessState='waiting';updateStatus();render();return;}
 accessState='loading';updateStatus();render();
 try{
  const state=await accessProvider.refresh(items,{forceRefresh});
  if(version!==refreshVersion)return;
  purchased=state.purchased;accessState='ready';
 }catch(error){if(version!==refreshVersion)return;purchased=new Set();accessState='error';}
 updateStatus();render();
}
let refreshTimer;
function refreshAfterReturn(){
 if(!items.length)return;
 clearTimeout(refreshTimer);
 refreshTimer=setTimeout(()=>{void refresh(true);},200);
}
$('.chips').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){filter=b.dataset.filter;render();}});
$('#scenario').addEventListener('change',async e=>{if(embedded)return;provider.setScenario(e.target.value,items);await refresh();});
$('#purchases').addEventListener('change',async e=>{if(embedded||!e.target.matches('[data-purchase]'))return;const id=Number(e.target.dataset.purchase);e.target.checked?provider.purchased.add(id):provider.purchased.delete(id);await refresh();});
$('#refresh').addEventListener('click',()=>{void refresh(true);});
$('#refresh-access').addEventListener('click',()=>{void refresh(true);});
window.addEventListener('focus',refreshAfterReturn);
window.addEventListener('pageshow',event=>{if(event.persisted)refreshAfterReturn();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAfterReturn();});
$('#om-screen').addEventListener('click',event=>{
 const link=event.target.closest('a.orbit-node');
 if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
 event.preventDefault();
 if(embedded&&!connected){showMessage('Попробуйте ещё раз через несколько секунд.');return;}
 const episode=items.find(e=>e.order===Number(link.dataset.order));
 if(embedded&&!episode.is_free&&accessState!=='ready'){updateStatus();return;}
 try{if(embedded&&sdk){sdk.openLink(destination(episode,purchased,true));}else{window.location.assign(link.href);}}catch(error){showMessage('Не удалось открыть эфир. Попробуйте ещё раз.');}
});
new ResizeObserver(schedule).observe($('#om-screen'));
document.fonts.ready.then(schedule);
try{if(window.OSOKIN_CATALOG){items=window.OSOKIN_CATALOG;}else{const response=await fetch('data/episodes.json');if(!response.ok)throw Error('catalog');items=await response.json();}await refresh();}catch(error){$('#om-screen').textContent='Не удалось загрузить каталог. Обновите страницу или проверьте локальный сервер.';console.error(error);}
