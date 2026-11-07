export class DemoAccessProvider {
  constructor(){this.purchased=new Set([6,8,10,14]);}
  async refresh(){return {mode:'demo',profile:null,purchased:new Set(this.purchased)};}
  setScenario(value,items){this.purchased=new Set(value==='all'?items.filter(e=>!e.is_free).map(e=>e.order):value==='some'?[6,8,10,14]:[]);}
}


// Only the official bridge determines the current user and paid product IDs.
export class NotibotAccessProvider {
  constructor(sdk, timeoutMs = 10000) { this.sdk = sdk; this.timeoutMs = timeoutMs; }
  async refresh(items, {forceRefresh = false} = {}) {
    if (!this.sdk || typeof this.sdk.getPurchasedProducts !== 'function') throw Error('SDK_UNAVAILABLE');
    let timer;
    try {
      const products = await Promise.race([
        (async () => await this.sdk.getPurchasedProducts(forceRefresh ? {forceRefresh:true} : {}))(),
        new Promise((_, reject) => {timer = setTimeout(() => reject(Error('ACCESS_TIMEOUT')), this.timeoutMs);})
      ]);
      if (!Array.isArray(products) || products.some(id => typeof id !== 'string')) throw Error('INVALID_PURCHASES');
      const ids = new Set(products);
      return {mode:'notibot', purchased:new Set(items.filter(e => !e.is_free && e.product_id && ids.has(e.product_id)).map(e => e.order))};
    } finally { clearTimeout(timer); }
  }
}
