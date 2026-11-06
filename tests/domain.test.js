import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filters,selectEpisodes,destination,treeGeometry} from '../src/domain.js';
const items=JSON.parse(readFileSync(new URL('../data/episodes.json',import.meta.url)));
test('catalog and access routing for every scenario and filter',()=>{
 assert.equal(items.length,24);assert.equal(items.filter(e=>e.is_free).length,5);
 assert(!items.some(e=>e.title==='Нет проблем'));assert(items.some(e=>e.title==='Энергообмен'));
 for(const purchases of [new Set(),new Set([6,8,10,14]),new Set(items.filter(e=>!e.is_free).map(e=>e.order))]){
  for(const f of filters){const visible=selectEpisodes(items,f,purchases);assert.deepEqual(visible.map(e=>e.order),visible.map(e=>e.order).sort((a,b)=>a-b));}
  assert.equal(selectEpisodes(items,filters[2],purchases).length,5+purchases.size);
  assert.equal(selectEpisodes(items,filters[3],purchases).length,19-purchases.size);
  for(const e of items)assert.match(destination(e,purchases),/^https:\/\//);
 }
});
test('tree has valid links, reachable nodes and safe bounds for 0–24 nodes',()=>{
 for(let n=0;n<=24;n++)for(const w of [280,355,572]){
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
