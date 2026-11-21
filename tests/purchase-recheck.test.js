import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseRecheck,RECHECK_DELAYS_MS} from '../src/purchase-recheck.js';

function fakeTimers(){
 const pending=new Map(),durations=[];
 let nextId=0;
 const schedule=(fn,ms)=>{const id=++nextId;pending.set(id,fn);durations.push(ms);return id;};
 const clear=id=>pending.delete(id);
 const step=async()=>{
  assert.ok(pending.size,'Expected a scheduled check');
  const [id,fn]=pending.entries().next().value;
  pending.delete(id);
  fn();
  await Promise.resolve();
  await Promise.resolve();
 };
 return {schedule,clear,step,pending,durations};
}

test('rechecks serially with bounded delays and stops as soon as purchase appears',async()=>{
 const clock=fakeTimers();
 let calls=0;
 const retry=createPurchaseRecheck({
  check:async()=>++calls===3,
  delays:[3,5,7],
  schedule:clock.schedule,clear:clock.clear
 });
 retry.start();
 await clock.step();
 assert.equal(calls,1);
 assert.equal(clock.durations[1],3);
 await clock.step();
 assert.equal(calls,2);
 assert.equal(clock.durations[2],5);
 await clock.step();
 assert.equal(calls,3);
 assert.equal(retry.isRunning(),false);
 assert.equal(clock.pending.size,0);
});
test('does not overlap requests and cancels stale checks after user change',async()=>{
 const clock=fakeTimers();
 let resolveCheck,calls=0;
 const retry=createPurchaseRecheck({
  check:()=>{calls++;return new Promise(resolve=>{resolveCheck=resolve;});},
  delays:[10],
  schedule:clock.schedule,clear:clock.clear
 });
 retry.start();
 await clock.step();
 assert.equal(calls,1);
 assert.equal(clock.pending.size,0);
 retry.stop();
 resolveCheck(false);
 await Promise.resolve();
 await Promise.resolve();
 assert.equal(retry.isRunning(),false);
 assert.equal(clock.pending.size,0);
});
test('temporary failures retry but the schedule ends without granting access',async()=>{
 const clock=fakeTimers();
 let calls=0;
 const retry=createPurchaseRecheck({
  check:async()=>{calls++;throw Error('Temporary SDK error');},
  delays:[2],
  schedule:clock.schedule,clear:clock.clear
 });
 retry.start();
 await clock.step();
 await clock.step();
 assert.equal(calls,2);
 assert.equal(retry.isRunning(),false);
 assert.equal(clock.pending.size,0);
});
test('default retry delays span roughly two minutes without unlimited polling',()=>{
 assert.deepEqual(RECHECK_DELAYS_MS,[3000,5000,7000,15000,30000,60000]);
 assert.equal(RECHECK_DELAYS_MS.reduce((a,b)=>a+b,0),120000);
});
