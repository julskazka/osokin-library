// Bounded, serial access rechecks. Never treats a visit to checkout as proof of payment.
export const RECHECK_DELAYS_MS = [3000, 5000, 7000, 15000, 30000, 60000];
export function createPurchaseRecheck({check, canRun=()=>true, delays=RECHECK_DELAYS_MS, schedule=setTimeout, clear=clearTimeout}){
 let token=0, timer=null, running=false;
 function stop(){
  ++token;
  if(timer!==null){clear(timer);timer=null;}
  running=false;
 }
 function start(initialDelay=0){
  stop();
  running=true;
  const ownToken=token;
  async function attempt(index){
   if(ownToken!==token||!canRun()){if(ownToken===token)stop();return;}
   let confirmed=false;
   try{confirmed=Boolean(await check());}catch(error){/* retry temporary SDK failures */}
   if(ownToken!==token)return;
   if(confirmed||index>=delays.length||!canRun()){stop();return;}
   timer=schedule(()=>{timer=null;void attempt(index+1);},delays[index]);
  }
  timer=schedule(()=>{timer=null;void attempt(0);},initialDelay);
 }
 return {start,stop,isRunning:()=>running};
}
