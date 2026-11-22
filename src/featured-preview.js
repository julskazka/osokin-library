/* The featured broadcast uses the same verified purchase data as the crystal library.
 * The main page and permanent preview use this one controller.
 * Never infer paid access from opening checkout or from sessionStorage. */
(() => {
 const feature = document.getElementById('osokin-featured-preview');
 if (!feature) return;
 let initialized = false;
 function initialize() {
  if (initialized || feature.hidden) return;
  initialized = true;

  const link = feature.querySelector('.osokin-featured-link');
  const note = feature.querySelector('.osokin-featured-access-note');
  const checkmark = feature.querySelector('.osokin-featured-owned-mark');
  if (!link || !note || !checkmark) return;

  const sdk = window.notibot;
  const embedded = window.parent !== window;
  const order = Number(link.dataset.order);
  const purchaseUrl = link.getAttribute('href');
  const accessUrl = link.dataset.accessUrl;
  const paymentMemoryKey = 'osokin-pending-episode-v1';
  const waitingMessage = 'Ожидаем подтверждение оплаты. Доступ проверяется автоматически. Если он не появился, обновите страницу через несколько минут. Не оплачивайте повторно.';
  let connected = false, verified = false, owned = false, generation = 0;
  let request = null, repeatClickUntil = 0;

  function show(message = '') {
   note.textContent = message;
   note.hidden = !message;
  }
  function pending() {
   try {
    const record = JSON.parse(sessionStorage.getItem(paymentMemoryKey) || 'null');
    return record?.order === order && Number.isFinite(record.at)
     && Date.now() >= record.at && Date.now() - record.at < 15 * 60 * 1000;
   } catch (_) { return false; }
  }
  function remember() {
   try { sessionStorage.setItem(paymentMemoryKey, JSON.stringify({order, at: Date.now()})); } catch (_) {}
  }
  function forget() {
   try {
    const record = JSON.parse(sessionStorage.getItem(paymentMemoryKey) || 'null');
    if (record?.order === order) sessionStorage.removeItem(paymentMemoryKey);
   } catch (_) {}
  }
  function setPurchased(value) {
   owned = Boolean(value);
   checkmark.hidden = !owned;
   link.classList.toggle('purchased', owned);
   link.href = owned ? accessUrl : purchaseUrl;
   link.setAttribute('aria-label', owned ?
    'Небесная Канцелярия — куплен, открыть эфир' :
    'Небесная Канцелярия — открыть страницу эфира');
   if (owned) {
    repeatClickUntil = 0;
    forget();
    show('');
   } else if (pending()) {
    show(waitingMessage);
   } else {
    show('');
   }
  }

  // The primary library already calls the official Notibot bridge.
  // Reuse its verified response instead of simultaneously polling the SDK twice.
  function onAccessUpdated(event) {
   const orders = event.detail?.purchasedOrders;
   if (!Array.isArray(orders)) return;
   connected = true;
   verified = true;
   setPurchased(orders.includes(order));
  }
  function onAccessReset() {
   generation += 1;
   connected = true;
   verified = false;
   request = null;
   repeatClickUntil = 0;
   setPurchased(false);
  }
  if (embedded) {
   document.addEventListener('osokin:entitlements-updated', onAccessUpdated);
   document.addEventListener('osokin:entitlements-reset', onAccessReset);
  }

  // Fallback only if an early click occurs before the main library's first response.
  async function verifyOnce() {
   if (!connected || typeof sdk?.getPurchasedProducts !== 'function') return false;
   if (request) return request;
   const currentGeneration = generation;
   const task = (async () => {
    let timeout;
    try {
     const ids = await Promise.race([
      sdk.getPurchasedProducts({forceRefresh: true}),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('ACCESS_TIMEOUT')), 9000); })
     ]);
     if (currentGeneration !== generation) return false;
     if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw Error('INVALID_PURCHASES');
     verified = true;
     setPurchased(ids.includes(link.dataset.productId));
     return true;
    } catch (_) {
     if (currentGeneration === generation) {
      verified = false;
      show('Не удалось проверить доступ. Если уже оплатили эфир, не оплачивайте повторно — обратитесь в поддержку.');
     }
     return false;
    } finally {
     clearTimeout(timeout);
    }
   })();
   request = task;
   try { return await task; } finally { if (request === task) request = null; }
  }

  link.addEventListener('click', async event => {
   if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !embedded) return;
   event.preventDefault();
   if (!connected || typeof sdk?.openLink !== 'function') {
    show('Проверяем доступ. Попробуйте нажать ещё раз через несколько секунд.');
    return;
   }
   if (!verified) {
    show('Проверяем доступ…');
    if (!await verifyOnce()) return;
   }
   if (!owned && pending()) {
    if (Date.now() >= repeatClickUntil) {
     repeatClickUntil = Date.now() + 30000;
     show(waitingMessage + ' Если оплаты не было, нажмите ещё раз для перехода.');
     return;
    }
    repeatClickUntil = 0;
   }
   try {
    if (!owned) {
     remember();
     show(waitingMessage);
    }
    sdk.openLink('https://t.me/post#' +
     encodeURIComponent(owned ? link.dataset.accessPageId : link.dataset.purchasePageId));
   } catch (_) {
    show('Не удалось открыть эфир. Попробуйте ещё раз.');
   }
  });
 }
 feature.addEventListener('osokin-feature-release', initialize);
 initialize();
})();
