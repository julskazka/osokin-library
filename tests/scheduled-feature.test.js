import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {destination} from '../src/domain.js';

const main = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const duplicate = readFileSync(new URL('../design-2.html', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/featured-preview.js', import.meta.url), 'utf8');
const episodes = JSON.parse(readFileSync(new URL('../data/episodes.json', import.meta.url), 'utf8'));
const featured = episodes.find(e => e.title === 'Небесная Канцелярия');

test('main shows feature only after the agreed Moscow date and keeps URL unchanged', () => {
  const release = '2026-11-22T16:30:00+03:00';
  assert.equal(Date.parse(release), Date.parse('2026-11-22T13:30:00Z'));
  assert.ok(main.includes('id="osokin-featured-preview" hidden data-release-at="' + release + '"'));
  assert.equal((main.match(/id="osokin-featured-preview"/g)||[]).length, 1);
  assert.ok(main.includes("feature.hidden = !ready;"));
  assert.ok(main.includes("feature.dispatchEvent(new Event('osokin-feature-release'))"));
  assert.ok(main.includes("window.addEventListener('focus', sync)"));
  assert.ok(main.includes('src="src/featured-preview.js?v=20261122-checkmark"'));
});
test('main and duplicate share the same feature and genuine Notibot product ID', () => {
  assert.ok(featured);
  assert.equal(featured.hidden, true);
  assert.equal(featured.product_id, '1TnkPJ4HQ6TT0vJXzLT3Mw');
  assert.equal(featured.purchase_page_id, '38iscsQh91iXT76FEtcLhS');
  assert.equal(featured.access_page_id, '3xBocyoJp7lCRrHxrz0EbX');
  for (const source of [main, duplicate]) {
    assert.ok(source.includes('class="osokin-featured-owned-mark" aria-hidden="true" hidden>✓</span>'));
    assert.ok(source.includes('src="src/app.js?v=20261122-purchase-ui"'));
    assert.ok(source.includes('src="src/featured-preview.js?v=20261122-checkmark"'));
    assert.ok(source.includes('data-product-id="' + featured.product_id + '"'));
    assert.ok(source.includes('data-purchase-page-id="' + featured.purchase_page_id + '"'));
    assert.ok(source.includes('data-access-page-id="' + featured.access_page_id + '"'));
    assert.ok(source.includes('href="' + featured.purchase_url + '"'));
    assert.ok(source.includes('data-access-url="' + featured.access_url + '"'));
  }
  assert.equal(destination(featured,new Set(),true),'https://t.me/post#'+featured.purchase_page_id);
  assert.equal(destination(featured,new Set([featured.order]),true),'https://t.me/post#'+featured.access_page_id);
});
test('feature script defers requests while hidden and only gives paid access from SDK', () => {
  assert.ok(controller.includes('if (started || feature.hidden) return;'));
  assert.ok(controller.includes("feature.addEventListener('osokin-feature-release', initializeFeaturedLink)"));
  assert.ok(controller.includes('ids.includes(link.dataset.productId)'));
  assert.ok(controller.includes('sdk.getPurchasedProducts'));
  assert.ok(!controller.includes('owned = true;'));
  assert.ok(!controller.includes('window.confirm('));
  assert.ok(controller.includes("checkmark.hidden = !owned;"));
  assert.ok(controller.includes("document.addEventListener('osokin:entitlements-updated', onAccessUpdated)"));
  assert.ok(controller.includes("document.addEventListener('osokin:entitlements-reset', onAccessReset)"));
  assert.ok(controller.includes("ids.includes(link.dataset.productId)"));
  assert.ok(controller.includes('Ожидаем подтверждение оплаты.'));
});


test('main library sends one verified purchase result to the featured crystal', () => {
 const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
 assert.ok(app.includes("new CustomEvent('osokin:entitlements-updated'"));
 assert.ok(app.includes("new Event('osokin:entitlements-reset')"));
 assert.ok(!app.includes('window.confirm('));
 assert.ok(!controller.includes('window.confirm('));
 assert.ok(app.includes('Ожидаем подтверждение оплаты.'));
});
