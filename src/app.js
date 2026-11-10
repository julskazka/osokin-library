import {filters,available,selectEpisodes,destination,treeGeometry} from './domain.js';
import {DemoAccessProvider,NotibotAccessProvider} from './access-provider.js';
const provider=new DemoAccessProvider();
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#c5a7f2','#8ecfe1','#dfb2ba','#e7cd87'];
// One delicate Lucide outline per broadcast topic; crystal styling remains unchanged.
const topicSymbols={
 'взросление':'sprout',
 'ум: жадность':'brain',
 'защита от недоброжелателей':'shield',
 'вебинар «страхи. тревоги. стресс»':'heart-pulse',
 'род':'network',
 'душа женщины':'flower-2',
 'эгрегоры':'custom-pyramid-eye',
 'ангелы-кураторы':'custom-wings',
 'школа':'school',
 'голос души':'audio-lines',
 'права доступа':'key-round',
 'карма':'rotate-ccw',
 'законы':'scale',
 'знаки':'ban',
 'тело для духовного существа':'person-standing',
 'справляться с будущим':'biceps-flexed',
 'как просить, чтобы было дано':'hand-heart',
 'доверие вселенной':'heart-handshake',
 'энергообмен':'repeat-2',
 'другая ветка реальности':'git-fork',
 'места силы (единый канал)':'mountain',
 'места силы (по городам)':'map-pin',
 'школа. реальность':'school',
 'справляться с будущим, часть 1':'biceps-flexed',
 'нет проблем':'sun'
};
const symbolFor=title=>topicSymbols[String(title).trim().toLowerCase()]||'sparkles';
// Thin mirrored wing outlines, matching the existing Lucide crystal linework.
const crystalIcon=title=>{
 const symbol=symbolFor(title);
 // Clear, spread angel wings: feather outlines, without changing the crystal style.
 if(symbol==='custom-wings')return '<svg class="crystal-wings" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 19C8 16 4 15.5 2 10c2 1 3.1.7 3.5-2.6 1.2 1.8 2.5 1.9 3-2.4 2.6 3.8 3.1 8.2 3 14Z"/><path d="M12.5 19C16 16 20 15.5 22 10c-2 1-3.1.7-3.5-2.6-1.2 1.8-2.5 1.9-3-2.4-2.6 3.8-3.1 8.2-3 14Z"/><path d="M3.8 11.2 9.9 16M6.1 8.6l4.6 6.8M20.2 11.2 14.1 16M17.9 8.6l-4.6 6.8"/></svg>';
 // Eye of providence inside a fine triangular pyramid.
 if(symbol==='custom-pyramid-eye')return '<svg class="crystal-pyramid-eye" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"/><path d="M6.8 13.3c3.2-3.3 7.2-3.3 10.4 0-3.2 3.2-7.2 3.2-10.4 0Z"/><circle cx="12" cy="13.3" r="1.65"/></svg>';
 return `<i data-lucide="${symbol}" aria-hidden="true"></i>`;
};
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
 $('#episode-filter').value=filter;
 $('#count').textContent=`Показано ${visible.length} из ${items.length} · Доступно ${items.filter(e=>available(e,purchased)).length}`;
 $('#om-screen').innerHTML=visible.length?`<div class="constellation" aria-label="Дерево эфиров"><svg class="constellation-links" aria-hidden="true"></svg>${visible.map(e=>{const open=available(e,purchased),status=e.is_free?'Бесплатный':open?(embedded?'Куплен':'Куплен · демо'):(embedded&&accessState!=='ready'?'Проверяем доступ':'Не куплен');return `<a class="orbit-node ${open?'purchased':'locked'}" data-order="${e.order}" style="--topic:${colors[(e.order-1)%colors.length]}" href="${escape(destination(e,purchased,embedded))}" aria-label="${escape(e.title)} — ${status}" title="${escape(e.description)}"><span class="orbit-disc">${crystalIcon(e.title)}${!e.is_free&&purchased.has(e.order)?'<span class="owned-mark" aria-hidden="true">✓</span>':''}</span><span class="orbit-title">${escape(e.title)}</span></a>`;}).join('')}</div>`:'<p class="empty">Здесь пока нет эфиров. Выберите другой фильтр.</p>';
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
$('#episode-filter').innerHTML=filters.map(f=>`<option value="${f}">${f}</option>`).join('');
$('#episode-filter').addEventListener('change',event=>{filter=event.target.value;render();});
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
