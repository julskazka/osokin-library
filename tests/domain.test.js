import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filters,selectEpisodes,destination,treeGeometry} from '../src/domain.js';
const items=JSON.parse(readFileSync(new URL('../data/episodes.json',import.meta.url)));
test('catalog and access routing for every scenario and filter',()=>{
 assert.equal(items.length,21);assert.equal(items.filter(e=>!e.hidden).length,20);assert.equal(items.filter(e=>e.is_free).length,4);
 assert(!items.some(e=>e.title==='Нет проблем'));assert(items.some(e=>e.title==='Энергообмен'));
 for(const purchases of [new Set(),new Set([5,7,9,12]),new Set(items.filter(e=>!e.is_free&&!e.hidden).map(e=>e.order))]){
  for(const f of filters){const visible=selectEpisodes(items,f,purchases);assert.deepEqual(visible.map(e=>e.order),visible.map(e=>e.order).sort((a,b)=>a-b));assert(!visible.some(e=>e.hidden));}
  assert.equal(selectEpisodes(items,filters[2],purchases).length,4+purchases.size);
  assert.equal(selectEpisodes(items,filters[3],purchases).length,16-purchases.size);
  for(const e of items)assert.match(destination(e,purchases),/^https:\/\//);
 }
});
test('tree has valid links, reachable nodes and safe bounds for 0–20 nodes',()=>{
 for(let n=0;n<=20;n++)for(const w of [280,355,572]){
 const g=treeGeometry(n,w,Array(n).fill(105));assert.equal(g.positions.length,n);
 for(const [a,b]of g.links){assert(a>=0&&a<n);assert(b>=0&&b<n);assert.notEqual(a,b);}
 for(let i=1;i<n;i++)assert(g.links.some(([a,b])=>b===i));
 for(const [x,y]of g.positions){assert(x>0&&x<w);assert(y>=0&&y+105<g.height);}
 }
});

test('Notibot uses the exact access/purchase page ID; standalone keeps original URLs',()=>{
 for(const e of items)for(const owned of [new Set(),new Set([e.order])]){
  const open=e.is_free||owned.has(e.order);
  assert.equal(destination(e,owned,true),'https://t.me/post#'+encodeURIComponent(open?e.access_page_id:e.purchase_page_id));
  assert.equal(destination(e,owned),open?e.access_url:e.purchase_url);
 }
});

test('hidden Celestial Chancery is linked by genuine Notibot IDs, never shown in filters',()=>{
 const entry=items.find(e=>e.title==='Небесная Канцелярия');
 assert.ok(entry);
 assert.equal(entry.hidden,true);
 assert.equal(entry.product_id,'1TnkPJ4HQ6TT0vJXzLT3Mw');
 assert.equal(entry.purchase_page_id,'38iscsQh91iXT76FEtcLhS');
 assert.equal(entry.access_page_id,'3xBocyoJp7lCRrHxrz0EbX');
 assert.equal(entry.purchase_url,'https://t.me/Info_aboutyou_bot/aboutme?startapp=a_38iscsQh91iXT76FEtcLhS_lp');
 assert.equal(entry.access_url,'https://t.me/Info_aboutyou_bot/aboutme?startapp=a_3xBocyoJp7lCRrHxrz0EbX_lp');
 for(const f of filters)assert(!selectEpisodes(items,f,new Set([entry.order])).some(e=>e.order===entry.order));
 const nonOwners=new Set();
 const owners=new Set([entry.order]);
 assert.equal(destination(entry,nonOwners,true),'https://t.me/post#38iscsQh91iXT76FEtcLhS');
 assert.equal(destination(entry,owners,true),'https://t.me/post#3xBocyoJp7lCRrHxrz0EbX');
});
