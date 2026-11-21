/* The golden featured broadcast is staged only on the permanent design-2 page.
   No paid access is inferred from a click or locally stored data. */
(() => {
  const feature = document.getElementById('osokin-featured-preview');
  if (!feature) return;
  const link = feature.querySelector('.osokin-featured-link');
  const status = feature.querySelector('.osokin-featured-access-note');
  if (!link || !status) return;
  const sdk = window.notibot;
  const embedded = window.parent !== window;
  const beforeUrl = link.getAttribute('href');
  const afterUrl = link.dataset.accessUrl;
  const pendingKey = 'osokin-pending-episode-v1';
  const order = Number(link.dataset.order);
  let userId = null, owned = false, checked = false, checkInFlight = null, generation = 0, lastCheck = 0, timers = [];
  const message = text => { status.textContent = text; status.hidden = !text; };
  const pending = () => {
    try {
      const record = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
      return record?.order === order && Number.isFinite(record.at) &&
        Date.now() >= record.at && Date.now() - record.at < 15 * 60 * 1000;
    } catch (_) { return false; }
  };
  const remember = () => {
    try { sessionStorage.setItem(pendingKey, JSON.stringify({order, at: Date.now()})); } catch (_) {}
  };
  const forget = () => {
    try {
      const record = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
      if (record?.order === order) sessionStorage.removeItem(pendingKey);
    } catch (_) {}
  };
  const clearRechecks = () => { timers.forEach(clearTimeout); timers = []; };
  const update = value => {
    owned = value;
    link.href = value ? afterUrl : beforeUrl;
    link.setAttribute('aria-label', value ?
      'Небесная Канцелярия — открыть купленный эфир' :
      'Небесная Канцелярия — перейти к описанию эфира');
    if (value) { forget(); clearRechecks(); message(''); }
  };
  async function verify(forceRefresh = true) {
    if (!userId || typeof sdk?.getPurchasedProducts !== 'function') return false;
    if (checkInFlight) return checkInFlight;
    const current = generation;
    const task = (async () => {
      let timeout;
      try {
        const ids = await Promise.race([
          sdk.getPurchasedProducts(forceRefresh ? {forceRefresh: true} : {}),
          new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('ACCESS_TIMEOUT')), 9000); })
        ]);
        if (current !== generation) return false;
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw Error('INVALID_PURCHASES');
        checked = true;
        lastCheck = Date.now();
        update(ids.includes(link.dataset.productId));
        if (!owned) message(pending() ?
          'Если эфир уже оплачен, не оплачивайте повторно. Проверяем подтверждение покупки.' : '');
        return true;
      } catch (_) {
        if (current === generation) {
          checked = false;
          message('Не удалось проверить доступ. Если эфир уже оплачен, не оплачивайте повторно — обратитесь в поддержку.');
        }
        return false;
      } finally { clearTimeout(timeout); }
    })();
    checkInFlight = task;
    try { return await task; } finally { if (checkInFlight === task) checkInFlight = null; }
  }
  function recheckAfterReturn() {
    if (!embedded || !userId || document.hidden) return;
    clearRechecks();
    const current = generation;
    const delays = pending() ? [200, 3200, 8200, 15200, 30200, 60200, 120200] : [200];
    for (const ms of delays) {
      timers.push(setTimeout(() => {
        if (current === generation && !owned && !document.hidden) void verify(true);
      }, ms));
    }
  }
  if (embedded && sdk && typeof sdk.onUpdate === 'function') {
    sdk.onUpdate(user => {
      const nextId = user?.id != null ? String(user.id) : null;
      if (!nextId) return;
      if (userId !== nextId) {
        if (userId !== null) forget();
        generation += 1;
        userId = nextId;
        checked = false;
        lastCheck = 0;
        checkInFlight = null;
        update(false);
      }
      recheckAfterReturn();
    });
    window.addEventListener('focus', recheckAfterReturn);
    window.addEventListener('pageshow', event => { if (event.persisted) recheckAfterReturn(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearRechecks();
      else recheckAfterReturn();
    });
  }
  link.addEventListener('click', async event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !embedded) return;
    event.preventDefault();
    if (!userId || typeof sdk?.openLink !== 'function') {
      message('Подключаем Notibot. Откройте эфир внутри приложения и попробуйте ещё раз.');
      return;
    }
    if (!checked || Date.now() - lastCheck > 5000) {
      message('Проверяем доступ…');
      if (!await verify(true)) return;
    }
    if (!owned && pending() && !window.confirm(
      'Вы уже переходили к оплате. Если эфир оплачен, НЕ оплачивайте повторно: дождитесь подтверждения или обратитесь в поддержку. Вы уверены, что оплаты ещё не было?'
    )) { recheckAfterReturn(); return; }
    try {
      if (!owned) remember();
      sdk.openLink('https://t.me/post#' +
        encodeURIComponent(owned ? link.dataset.accessPageId : link.dataset.purchasePageId));
      if (!owned) recheckAfterReturn();
    } catch (_) { message('Не удалось открыть эфир. Попробуйте ещё раз.'); }
  });
})();
