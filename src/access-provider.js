// Demo adapter only. A future server must validate Telegram/MAX signed context,
// then read confirmed paid orders from the officially supported integration.
export class DemoAccessProvider {
  constructor(){this.purchased=new Set([6,8,10,14]);}
  async refresh(){return {mode:'demo',profile:null,purchased:new Set(this.purchased)};}
  setScenario(value,items){this.purchased=new Set(value==='all'?items.filter(e=>!e.is_free).map(e=>e.order):value==='some'?[6,8,10,14]:[]);}
}
