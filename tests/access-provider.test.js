import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NotibotAccessProvider} from '../src/access-provider.js';
const catalog=[{order:1,is_free:true,product_id:''},{order:2,is_free:false,product_id:'paid-a'},{order:3,is_free:false,product_id:'paid-b'}];
test('await paid IDs, map products rather than user/page IDs, refresh cache explicitly',async()=>{
 const calls=[];
 const sdk={async getPurchasedProducts(options){calls.push(options);await Promise.resolve();return ['paid-b','unknown','2'];}};
 const provider=new NotibotAccessProvider(sdk);
 assert.deepEqual([...(await provider.refresh(catalog)).purchased],[3]);
 await provider.refresh(catalog,{forceRefresh:true});
 assert.deepEqual(calls,[{},{forceRefresh:true}]);
});
test('missing SDK, malformed response, API rejection and timeout never grant access',async()=>{
 await assert.rejects(new NotibotAccessProvider(null).refresh(catalog));
 for(const answer of [null,{},[true]])await assert.rejects(new NotibotAccessProvider({async getPurchasedProducts(){return answer;}}).refresh(catalog));
 await assert.rejects(new NotibotAccessProvider({async getPurchasedProducts(){throw Error('offline');}}).refresh(catalog));
 await assert.rejects(new NotibotAccessProvider({getPurchasedProducts(){return new Promise(()=>{});}},10).refresh(catalog),/ACCESS_TIMEOUT/);
 assert.equal((await new NotibotAccessProvider({async getPurchasedProducts(){return [];}}).refresh(catalog)).purchased.size,0);
});
