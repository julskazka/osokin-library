import {filters,available,selectEpisodes,destination,treeGeometry} from './domain.js';
import {DemoAccessProvider,NotibotAccessProvider} from './access-provider.js';
const provider=new DemoAccessProvider();
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#c5a7f2','#8ecfe1','#dfb2ba','#e7cd87'];
// One delicate Lucide outline per broadcast topic; crystal styling remains unchanged.
const topicSymbols={
 'взросление':'custom-up-arrow',
 'ум: жадность':'custom-coins',
 'защита от недоброжелателей':'shield',
 'страхи. тревоги. стресс':'heart-pulse',
 'род':'network',
 'душа женщины':'flower-2',
 'эгрегоры':'custom-pyramid-eye',
 'ангелы-кураторы':'custom-wings',
 'школа':'school',
 'голос души':'audio-lines',
 'права доступа':'key-round',
 'карма':'rotate-ccw',
 'законы':'scale',
 'знаки':'check',
 'тело для духовного существа':'custom-person',
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
 if(symbol==='custom-up-arrow') return `<svg class="crystal-up-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" aria-hidden="true"><defs><linearGradient id="upArrowFace" x1="5" y1="3" x2="24" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity=".98"/><stop offset=".58" stop-color="currentColor" stop-opacity=".91"/><stop offset="1" stop-color="currentColor" stop-opacity=".69"/></linearGradient></defs><path d="M16 2.7 29 15.7h-7.2v13.2H10.2V15.7H3L16 2.7Z" fill="url(#upArrowFace)" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M16 5.6 25.2 14.8h-5.4v12.1h-3.8V5.6Z" fill="#11162e" fill-opacity=".2"/><path d="M9.3 14.4 16 7.7 22.7 14.4M12.7 17.2v9" stroke="#fff4ff" stroke-opacity=".43" stroke-width="1.45" stroke-linecap="round"/></svg>`;
 if(symbol==='custom-coins') return `<svg class="crystal-coins" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 21.5v3c0 2.2 8.5 2.2 8.5 0v-3"/><ellipse cx="6.25" cy="21.5" rx="4.25" ry="1.75"/><path d="M9.5 16.5v8c0 2.6 9 2.6 9 0v-8"/><ellipse cx="14" cy="16.5" rx="4.5" ry="2"/><path d="M17.5 11.5v12c0 2.5 8.5 2.5 8.5 0v-12"/><ellipse cx="21.75" cy="11.5" rx="4.25" ry="2"/><path d="M18 15.5c2.8 1.4 5.5 1.4 8 0M18 19.3c2.8 1.4 5.5 1.4 8 0"/></svg>`;
 if(symbol==='custom-person') return `<svg class="crystal-person" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2.2"/><path d="M3 9.3 12 11l9-1.7M12 11v5.3M12 16.3 6.7 22M12 16.3l5.3 5.7"/></svg>`;
 if(symbol==='custom-wings') return `
  <svg class="crystal-wings" xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
   <ellipse cx="32" cy="13" rx="10" ry="3.5"/>
   <path d="M31 53C22 44 12 43 5 24l13 7C11 23 10 17 11 12c12 7 18 19 20 41Z"/>
   <path d="M33 53c9-9 19-10 26-29l-13 7c7-8 8-14 7-19-12 7-18 19-20 41Z"/>
   <path d="M12 24 28 46M17 32l12 16M52 24 36 46M47 32 35 48"/>
  </svg>`;
 if(symbol==='custom-pyramid-eye') return `
  <svg class="crystal-pyramid-eye" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
   <path d="M12 4 20 18H4L12 4Z"/>
   <path d="M8 12.8c2.2-2.1 5.8-2.1 8 0-2.2 2.1-5.8 2.1-8 0Z"/>
   <circle cx="12" cy="12.8" r="1.2"/>
  </svg>`;
 if(symbol==='custom-no-entry') return `
  <svg class="crystal-no-entry" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
   <circle cx="12" cy="12" r="8"/>
   <path d="M7.2 12h9.6" stroke-width="2.8"/>
  </svg>`;
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
 // Measure the actual outer circles after positioning: links must stop at their rims,
 // never shine through the delicate symbols inside a crystal.
 const mapRect=map.getBoundingClientRect();
 const discs=nodes.map(node=>{
  const rect=node.querySelector('.orbit-disc').getBoundingClientRect();
  return {x:rect.left-mapRect.left+rect.width/2,y:rect.top-mapRect.top+rect.height/2,r:Math.min(rect.width,rect.height)/2+1};
 });
 svg.innerHTML=geometry.links.map(([a,b])=>{
  const p=discs[a],q=discs[b],dx=q.x-p.x,dy=q.y-p.y,distance=Math.hypot(dx,dy);
  if(distance<=p.r+q.r)return '';
  const ux=dx/distance,uy=dy/distance;
  const oa=nodes[a].classList.contains('purchased'),ob=nodes[b].classList.contains('purchased');
  return `<line data-a="${a}" data-b="${b}" x1="${p.x+ux*p.r}" y1="${p.y+uy*p.r}" x2="${q.x-ux*q.r}" y2="${q.y-uy*q.r}" class="${oa&&ob?'owned-link':'next-link'}" style="--link:#b9c3e6"/>`;
 }).join('');
}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
function render(){
 const visible=selectEpisodes(items,filter,purchased);
 $('#episode-filter').value=filter;
 $('#count').textContent=`Показано ${visible.length} из ${items.length} · Доступно ${items.filter(e=>available(e,purchased)).length}`;
 const unlocked=items.filter(e=>available(e,purchased)).length;
 const percent=items.length?Math.round(unlocked/items.length*100):0;
 $('#library-progress-value').textContent=`${percent}%`;
 $('#library-progress-detail').textContent=`${unlocked} из ${items.length} эфиров открыто`;
 $('#library-progress-fill').style.width=`${percent}%`;
 $('#library-progress-bar').setAttribute('aria-valuenow',String(percent));
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
try{if(window.OSOKIN_CATALOG){items=window.OSOKIN_CATALOG;}else{const response=await fetch('data/episodes.json?v=20261113-fears3',{cache:'no-store'});if(!response.ok)throw Error('catalog');items=await response.json();}await refresh();}catch(error){$('#om-screen').textContent='Не удалось загрузить каталог. Обновите страницу или проверьте локальный сервер.';console.error(error);}
