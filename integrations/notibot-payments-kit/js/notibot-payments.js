/* Reusable helper for the official Notibot SDK v2.27+. It does not install another bridge. */
(function(global){
  'use strict';
  if(global.NotibotPayments)return;
  global.NotibotPayments={create({onChange=()=>{},timeoutMs=10000}={}){
    const sdk=global.notibot;
    let connected=false,disposed=false,version=0,timer;
    let state={status:global.parent!==global?'waiting':'standalone',purchasedProductIds:[]};
    function snapshot(){return {...state,purchasedProductIds:[...state.purchasedProductIds]};}
    function emit(status,ids=[]){
      if(disposed)return;
      state={status,purchasedProductIds:[...ids]};
      onChange(snapshot());
    }
    async function refresh({forceRefresh=true}={}){
      if(disposed)return snapshot();
      const current=++version;
      if(!connected){emit(global.parent!==global?(sdk?'waiting':'unavailable'):'standalone');return snapshot();}
      emit('loading');
      let timeout;
      try{
        if(!sdk||typeof sdk.getPurchasedProducts!=='function')throw Error('SDK_UNAVAILABLE');
        const ids=await Promise.race([
          (async()=>await sdk.getPurchasedProducts(forceRefresh?{forceRefresh:true}:{}))(),
          new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('TIMEOUT')),timeoutMs);})
        ]);
        if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('INVALID_PURCHASES');
        if(current===version)emit('ready',[...new Set(ids)]);
      }catch(error){if(current===version)emit('error');}
      finally{clearTimeout(timeout);}
      return snapshot();
    }
    function afterReturn(){
      if(disposed||!connected)return;
      clearTimeout(timer);timer=setTimeout(()=>{void refresh({forceRefresh:true});},200);
    }
    function visible(){if(!global.document.hidden)afterReturn();}
    function pageshow(event){if(event.persisted)afterReturn();}
    emit(state.status);
    sdk?.onUpdate(()=>{
      if(disposed)return;
      connected=true;version++;emit('waiting');
      void refresh({forceRefresh:true});
    });
    global.addEventListener('focus',afterReturn);
    global.addEventListener('pageshow',pageshow);
    global.document.addEventListener('visibilitychange',visible);
    return {refresh,getState:snapshot,dispose(){
      disposed=true;version++;clearTimeout(timer);
      global.removeEventListener('focus',afterReturn);
      global.removeEventListener('pageshow',pageshow);
      global.document.removeEventListener('visibilitychange',visible);
    }};
  }};
})(window);
