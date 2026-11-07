# Быстрые сценарии: товары и оплаты

Все `REAL_...` заменяются реальными ID проекта. Код вызывается после DOM и получения контекста Notibot через onUpdate. Обязательно обрабатывайте ошибку/таймаут и обновляйте доступ после возврата. Не вставляйте примеры целиком поверх существующего приложения.

## Инициализация

SDK подключается в head:

```html
<script src="https://list.notibot.ru/notibot-bridge.js?v=2.27"></script>
```

В конце body:

```js
if (window.notibot) {
  window.notibot.onUpdate(async () => {
    try {
      // Сбросить доступы предыдущего контекста и запустить проверку.
      await checkAccess(); // Это функция вашего проекта, не метод SDK.
    } catch (error) {
      // Оставить платный доступ закрытым и предложить повтор.
    }
  });
}
```

## Один товар

```js
async function checkAccess() {
  if (!window.notibot) return;
  const paid = await window.notibot.hasPurchased('REAL_PRODUCT_ID');
  document.getElementById('buy-section').hidden = paid;
  document.getElementById('paid-section').hidden = !paid;
}
```

Платная секция изначально hidden. Не размещайте секретные материалы прямо в этом скрытом HTML: защищённый ресурс должен проверять доступ на стороне Notibot/сервера.

## Несколько материалов и товаров

```js
// Таблица вашего проекта. Здесь могут быть любые названия материалов.
const materials = [
  {key:'lesson-one', product_id:'REAL_PRODUCT_1'},
  {key:'lesson-two', product_id:'REAL_PRODUCT_2'},
  {key:'lesson-three', product_id:'REAL_PRODUCT_2'}
];

async function getMaterialAccess(forceRefresh = false) {
  if (!window.notibot) return new Map();
  const ids = await window.notibot.getPurchasedProducts(
    forceRefresh ? {forceRefresh:true} : {}
  );
  const paid = new Set(ids);
  return new Map(materials.map(item => [item.key, paid.has(item.product_id)]));
}
```

Два последних материала в примере открываются одним товаром, если такая связь задана владельцем проекта. Ключи материала не отправляются в SDK; сравниваются только product_id.

## Повторный запрос после оплаты

```js
const ids = await window.notibot.getPurchasedProducts({forceRefresh:true});
// Обновить доступы в интерфейсе по новому списку.
```

Вызывайте после возвращения (focus/visibilitychange/pageshow, в зависимости от режима) и по кнопке «Обновить доступ». Несколько близких событий объединяйте, чтобы не отправлять лишние запросы. Не считайте открытие страницы оплаты подтверждением покупки.

## Ограничение ожидания

```js
async function requestPaidProducts(forceRefresh = false) {
  if (!window.notibot) throw Error('SDK_UNAVAILABLE');
  let timer;
  try {
    return await Promise.race([
      (async () => await window.notibot.getPurchasedProducts(
        forceRefresh ? {forceRefresh:true} : {}
      ))(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('TIMEOUT')), 10000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
```

Этот таймаут ограничивает ожидание интерфейса, но не отменяет внутренний запрос SDK. Поздние ответы не должны восстанавливать доступы старого пользователя; используйте номер поколения запроса в слое проекта.

## Внутренняя страница материала/покупки

```js
window.notibot.openLink('https://t.me/post#REAL_ACCESS_PAGE_ID');
window.notibot.openLink('https://t.me/post#REAL_PURCHASE_PAGE_ID');
```

Это два разных назначения. Для оплаченного товара выбирайте страницу материала, для неоплаченного — страницу покупки. Не передавайте ID страницы в hasPurchased.
