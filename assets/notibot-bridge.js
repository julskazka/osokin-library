/**
 * notibot-bridge.js — переносимая интеграция для уже готовых HTML-проектов.
 * Версия: 1.1.0
 * Поддерживает режимы Notibot: Встроено (Inline), На новой странице (App),
 * Во всплывающем окне (Portal). Режим выбирается в интерфейсе Notibot.
 *
 * Подключение:
 *   <script src="./notibot-bridge.js"></script>
 *
 * После подключения доступен объект:
 *   window.NotibotIntegration
 *
 * Основные возможности:
 * - автоматически определяет запуск внутри Notibot;
 * - получает пользователя и данные приложения;
 * - получает доступные Notibot / Telegram / MAX ID и username;
 * - прикрепляет идентификаторы к отправляемым через Notibot формам;
 * - открывает товары, статьи, витрину и ссылки;
 * - передаёт высоту страницы родительскому окну;
 * - поддерживает виброотклик и блокировку прокрутки;
 * - не навязывает проекту цвета, фон, шрифты и другие стили;
 * - вне Notibot не ломает сайт и работает в автономном режиме.
 *
 * ВАЖНО:
 * Telegram/MAX ID и username относятся к персональным данным.
 * Если они собираются или отправляются вместе с формой, в интерфейсе проекта
 * должны быть размещены реальные ссылки на необходимые документы и согласия.
 *
 * Настройки можно задать ДО подключения файла:
 *   window.NOTIBOT_INTEGRATION_CONFIG = {
 *     autoAttachIdentityToForms: true,
 *     persistIdentity: 'session', // 'none', 'session' или 'local'
 *     requestTimeoutMs: 12000
 *   };
 */
(function installNotibotIntegration(global) {
  'use strict';

  if (!global || global.NotibotIntegration) return;

  const userConfig = global.NOTIBOT_INTEGRATION_CONFIG || {};
  const config = {
    enabled: userConfig.enabled !== false,
    autoAttachIdentityToForms: userConfig.autoAttachIdentityToForms !== false,
    persistIdentity: normalizePersistence(userConfig.persistIdentity || 'session'),
    requestTimeoutMs: positiveNumber(userConfig.requestTimeoutMs, 12000),
    initTimeoutMs: positiveNumber(userConfig.initTimeoutMs, 2500),
    heightOffsetPx: positiveNumber(userConfig.heightOffsetPx, 16),
    exposeThemeVariables: userConfig.exposeThemeVariables === true,
    identityAnswerTitles: {
      notibotUserId: 'Notibot User ID',
      telegramId: 'Telegram ID',
      telegramUsername: 'Telegram username',
      maxId: 'MAX ID',
      maxUsername: 'MAX username',
      ...(userConfig.identityAnswerTitles || {}),
    },
  };

  const listeners = new Set();
  const isEmbedded = global.parent !== global;
  const parentOrigin = getParentOrigin();
  const targetOrigin = parentOrigin || '*';
  const storageKey = 'notibot_identity_v1';

  const state = {
    available: false,
    connected: false,
    mode: 'standalone',
    user: {},
    app: {},
    identity: loadStoredIdentity(),
  };

  let initialized = false;
  let initTimerId = 0;
  let sdk = null;

  class NotibotBridgeError extends Error {
    constructor(errorData) {
      const normalized = typeof errorData === 'string'
        ? { message: errorData }
        : (errorData || {});

      super(normalized.message || 'Ошибка обращения к Notibot');
      this.name = 'NotibotBridgeError';
      this.code = normalized.code || 'ERR_UNKNOWN';
      this.origin = normalized.origin || 'unknown';
      this.details = normalized.details || null;
    }
  }

  class EmbeddedNotibotBridge {
    constructor() {
      this.user = {};
      this.app = {};
      this.connected = false;
      this.updateHandlers = new Set();
      this.responseHandlers = new Map();
      this.lastActionTimes = new Map();
      this.resizeObserver = null;
      this.handleMessage = this.handleMessage.bind(this);
      this.start();
    }

    start() {
      global.addEventListener('message', this.handleMessage);
      this.sendAction('READY_FOR_INIT', {}, 0);
      this.watchHeight();
    }

    handleMessage(event) {
      if (event.source !== global.parent) return;
      if (parentOrigin && event.origin !== parentOrigin && event.origin !== 'null') return;

      const message = event.data;
      if (!message || typeof message !== 'object') return;

      if (message.type === 'NOTIBOT_INIT' && message.data) {
        this.user = message.data.user || {};
        this.app = message.data.app || {};
        this.connected = true;
        this.notifyUpdate();
        return;
      }

      if (message.source !== 'vibe-parent' || !message.requestId) return;

      const pending = this.responseHandlers.get(message.requestId);
      if (!pending) return;

      global.clearTimeout(pending.timerId);
      this.responseHandlers.delete(message.requestId);
      pending.handler(message);
    }

    onUpdate(callback) {
      if (typeof callback !== 'function') return function noop() {};
      this.updateHandlers.add(callback);
      if (this.connected) callback(this.user, this.app);
      return () => this.updateHandlers.delete(callback);
    }

    notifyUpdate() {
      this.updateHandlers.forEach((callback) => {
        try {
          callback(this.user, this.app);
        } catch (error) {
          console.error('Ошибка обработчика Notibot:', error);
        }
      });
    }

    submitForm(formId, answers, options) {
      if (!formId) {
        return Promise.reject(new NotibotBridgeError({
          origin: 'client',
          code: 'ERR_INVALID_PAYLOAD',
          message: 'Не указан ID формы Notibot',
        }));
      }

      if (!isEmbedded) {
        return Promise.reject(new NotibotBridgeError({
          origin: 'client',
          code: 'ERR_NOTIBOT_UNAVAILABLE',
          message: 'Страница открыта не внутри Notibot',
        }));
      }

      const requestId = createRequestId();
      const timeoutMs = positiveNumber(options && options.timeoutMs, config.requestTimeoutMs);

      return new Promise((resolve, reject) => {
        const timerId = global.setTimeout(() => {
          this.responseHandlers.delete(requestId);
          reject(new NotibotBridgeError({
            origin: 'client',
            code: 'ERR_TIMEOUT',
            message: 'Notibot не ответил за отведённое время',
          }));
        }, timeoutMs);

        this.responseHandlers.set(requestId, {
          timerId,
          handler: (response) => {
            if (response.success) resolve(response.data);
            else reject(new NotibotBridgeError(response.error));
          },
        });

        this.post({
          source: 'vibe-sandbox',
          type: 'submit_form',
          payload: { formId, answers, requestId },
        });
      });
    }

    openPortal(options) {
      return this.sendAction('open_portal', options || {});
    }

    setScrollLock(locked) {
      return this.sendAction('set_scroll_lock', { locked: Boolean(locked) });
    }

    openLink(url) {
      return this.sendAction('open_link', { url });
    }

    openStorefront() {
      return this.openLink('/vitrina');
    }

    openArticle(id) {
      return this.openLink('/page/' + encodeURIComponent(String(id)));
    }

    openProduct(id) {
      return this.openLink('/product/' + encodeURIComponent(String(id)));
    }

    openUserCard() {
      return this.openLink('/usercard');
    }

    hapticImpact(style, fallback) {
      return this.sendAction('haptic_feedback', {
        feedbackType: 'impact',
        style: style || 'light',
        fallback: Boolean(fallback),
      }, 50);
    }

    hapticNotification(type, fallback) {
      return this.sendAction('haptic_feedback', {
        feedbackType: 'notification',
        style: type || 'success',
        fallback: Boolean(fallback),
      }, 50);
    }

    hapticSelection(fallback) {
      return this.sendAction('haptic_feedback', {
        feedbackType: 'selection',
        fallback: Boolean(fallback),
      }, 50);
    }

    sendAction(type, payload, debounceMs) {
      if (!isEmbedded) return false;

      const delay = typeof debounceMs === 'number' ? debounceMs : 400;
      const now = Date.now();
      const lastTime = this.lastActionTimes.get(type) || 0;
      if (now - lastTime < delay) return false;

      this.lastActionTimes.set(type, now);
      return this.post({ source: 'vibe-sandbox', type, payload: payload || {} });
    }

    post(message) {
      if (!isEmbedded) return false;
      global.parent.postMessage(message, targetOrigin);
      return true;
    }

    watchHeight() {
      if (!isEmbedded || typeof global.ResizeObserver === 'undefined') return;

      let frameId = 0;
      let previousHeight = 0;
      const reportHeight = () => {
        global.cancelAnimationFrame(frameId);
        frameId = global.requestAnimationFrame(() => {
          const root = global.document.documentElement;
          const body = global.document.body;
          const height = Math.ceil(Math.max(
            root ? root.scrollHeight : 0,
            body ? body.scrollHeight : 0
          ));

          if (height <= 0 || height === previousHeight) return;
          previousHeight = height;
          this.sendAction('set_height', {
            height: height + config.heightOffsetPx,
          }, 80);
        });
      };

      this.resizeObserver = new global.ResizeObserver(reportHeight);
      const start = () => {
        if (global.document.documentElement) {
          this.resizeObserver.observe(global.document.documentElement);
        }
        if (global.document.body) {
          this.resizeObserver.observe(global.document.body);
        }
        reportHeight();
      };

      if (global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }
    }
  }

  const api = {
    version: '1.1.0',
    config: Object.freeze({ ...config }),
    initialize,
    onUpdate,
    getState: cloneState,
    getUser: () => ({ ...state.user }),
    getApp: () => ({ ...state.app }),
    getIdentity: () => ({ ...state.identity }),
    getIdentityAnswers: () => identityToAnswers(state.identity),
    submitForm,
    openLink,
    openStorefront: () => runNotibotAction('openStorefront'),
    openArticle: (id) => runNotibotAction('openArticle', id),
    openProduct: (id) => runNotibotAction('openProduct', id),
    openUserCard: () => runNotibotAction('openUserCard'),
    openPortal: (options) => runNotibotAction('openPortal', options || {}),
    setScrollLock,
    hapticImpact: (style) => haptic('hapticImpact', style || 'light'),
    hapticNotification: (type) => haptic('hapticNotification', type || 'success'),
    hapticSelection: () => haptic('hapticSelection'),
    clearSavedIdentity,
  };

  global.NotibotBridgeError = global.NotibotBridgeError || NotibotBridgeError;
  global.NotibotIntegration = api;

  initialize();

  function initialize() {
    if (initialized) return api;
    initialized = true;

    setPlatformMode('standalone');

    if (!config.enabled) {
      notify();
      return api;
    }

    sdk = resolveSdk();
    state.available = Boolean(sdk && isEmbedded);

    if (!sdk || typeof sdk.onUpdate !== 'function') {
      notify();
      return api;
    }

    sdk.onUpdate((user, app) => {
      global.clearTimeout(initTimerId);
      state.available = true;
      state.connected = true;
      state.mode = 'notibot';
      state.user = user || {};
      state.app = app || {};
      state.identity = normalizeIdentity(state.user, state.app);
      saveIdentity(state.identity);
      exposeThemeVariables(state.app);
      setPlatformMode('notibot');
      notify();
    });

    initTimerId = global.setTimeout(() => {
      if (!state.connected) notify();
    }, config.initTimeoutMs);

    return api;
  }

  function resolveSdk() {
    if (global.notibot && typeof global.notibot.onUpdate === 'function') {
      return global.notibot;
    }

    const bridge = new EmbeddedNotibotBridge();
    global.notibot = bridge;
    return bridge;
  }

  function onUpdate(callback) {
    if (typeof callback !== 'function') return function noop() {};
    listeners.add(callback);
    callback(cloneState());
    return () => listeners.delete(callback);
  }

  function notify() {
    const snapshot = cloneState();
    listeners.forEach((callback) => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('Ошибка подписчика NotibotIntegration:', error);
      }
    });

    dispatch('notibot:update', snapshot);
    if (snapshot.connected) dispatch('notibot:connected', snapshot);
  }

  function cloneState() {
    return {
      available: state.available,
      connected: state.connected,
      mode: state.mode,
      user: { ...state.user },
      app: { ...state.app },
      identity: { ...state.identity },
    };
  }

  async function submitForm(formId, answers, options) {
    ensureConnected('Отправка формы доступна только внутри Notibot.');

    const submitOptions = options || {};
    const attachIdentity = submitOptions.attachIdentity !== undefined
      ? Boolean(submitOptions.attachIdentity)
      : config.autoAttachIdentityToForms;

    const preparedAnswers = attachIdentity
      ? appendIdentityAnswers(answers, state.identity)
      : copyAnswers(answers);

    return sdk.submitForm(formId, preparedAnswers, {
      timeoutMs: positiveNumber(submitOptions.timeoutMs, config.requestTimeoutMs),
    });
  }

  function appendIdentityAnswers(answers, identity) {
    const result = copyAnswers(answers);
    const existingTitles = new Set(
      result.map((item) => String(item && item.title || '').trim())
    );

    identityToAnswers(identity).forEach((item) => {
      if (!existingTitles.has(item.title)) {
        result.push(item);
        existingTitles.add(item.title);
      }
    });

    return result;
  }

  function identityToAnswers(identity) {
    const result = [];
    Object.keys(config.identityAnswerTitles).forEach((key) => {
      const title = String(config.identityAnswerTitles[key] || '').trim();
      const value = identity && identity[key];
      if (!title || value === '' || value === null || value === undefined) return;
      result.push({ title, answers: [String(value)] });
    });
    return result;
  }

  function normalizeIdentity(user, app) {
    const source = { user: user || {}, app: app || {} };
    const messenger = String(pick(source, [
      'user.platform', 'user.messenger', 'user.source', 'user.channel',
      'app.platform', 'app.messenger', 'app.source',
    ]) || '').toLowerCase();

    const identity = {
      notibotUserId: pick(source, [
        'user.notibotUserId', 'user.notibot_user_id',
        'user.userId', 'user.user_id', 'user.id',
      ]),
      telegramId: pick(source, [
        'user.telegramId', 'user.telegram_id', 'user.tgId', 'user.tg_id',
        'user.telegram.id', 'user.telegram.userId', 'user.telegram.user_id',
        'user.social.telegram.id', 'user.messengers.telegram.id',
      ]),
      telegramUsername: pick(source, [
        'user.telegramUsername', 'user.telegram_username',
        'user.tgUsername', 'user.tg_username',
        'user.telegram.username', 'user.telegram.nickname',
        'user.social.telegram.username', 'user.messengers.telegram.username',
      ]),
      maxId: pick(source, [
        'user.maxId', 'user.max_id', 'user.max.id',
        'user.max.userId', 'user.max.user_id',
        'user.social.max.id', 'user.messengers.max.id',
      ]),
      maxUsername: pick(source, [
        'user.maxUsername', 'user.max_username',
        'user.max.username', 'user.max.nickname',
        'user.social.max.username', 'user.messengers.max.username',
      ]),
    };

    const genericExternalId = pick(source, [
      'user.externalId', 'user.external_id',
      'user.messengerId', 'user.messenger_id',
    ]);
    const genericUsername = pick(source, [
      'user.username', 'user.nickname', 'user.nick',
    ]);

    if (messenger.includes('telegram') || messenger === 'tg') {
      identity.telegramId = identity.telegramId || genericExternalId;
      identity.telegramUsername = identity.telegramUsername || genericUsername;
    }

    if (messenger === 'max' || messenger.includes('max')) {
      identity.maxId = identity.maxId || genericExternalId;
      identity.maxUsername = identity.maxUsername || genericUsername;
    }

    return cleanIdentity(identity);
  }

  function cleanIdentity(identity) {
    const clean = emptyIdentity();
    Object.keys(clean).forEach((key) => {
      const value = identity && identity[key];
      clean[key] = value === undefined || value === null ? '' : value;
    });
    return clean;
  }

  function emptyIdentity() {
    return {
      notibotUserId: '',
      telegramId: '',
      telegramUsername: '',
      maxId: '',
      maxUsername: '',
    };
  }

  function pick(source, paths) {
    for (let index = 0; index < paths.length; index += 1) {
      const value = paths[index].split('.').reduce((current, key) => {
        return current === undefined || current === null ? undefined : current[key];
      }, source);

      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return '';
  }

  function openLink(url) {
    if (!url) return false;
    if (state.connected && sdk && typeof sdk.openLink === 'function') {
      sdk.openLink(url);
      return true;
    }
    global.location.assign(url);
    return true;
  }

  function setScrollLock(locked) {
    const value = Boolean(locked);
    const root = global.document.documentElement;
    const body = global.document.body;

    if (root) root.style.overflow = value ? 'hidden' : '';
    if (body) body.style.overflow = value ? 'hidden' : '';

    if (state.connected && sdk && typeof sdk.setScrollLock === 'function') {
      sdk.setScrollLock(value);
    }
  }

  function runNotibotAction(method) {
    const args = Array.prototype.slice.call(arguments, 1);
    ensureConnected('Команда ' + method + ' доступна только внутри Notibot.');
    if (typeof sdk[method] !== 'function') {
      throw new NotibotBridgeError({
        origin: 'client',
        code: 'ERR_METHOD_UNAVAILABLE',
        message: 'Notibot не поддерживает команду ' + method,
      });
    }
    return sdk[method].apply(sdk, args);
  }

  function haptic(method, value) {
    if (state.connected && sdk && typeof sdk[method] === 'function') {
      return value === undefined ? sdk[method]() : sdk[method](value);
    }

    if (global.navigator && typeof global.navigator.vibrate === 'function') {
      global.navigator.vibrate(12);
    }
    return undefined;
  }

  function ensureConnected(message) {
    if (!state.connected || !sdk) {
      throw new NotibotBridgeError({
        origin: 'client',
        code: 'ERR_NOTIBOT_UNAVAILABLE',
        message,
      });
    }
  }

  function exposeThemeVariables(app) {
    if (!config.exposeThemeVariables) return;
    const colors = app && (app.colors || (app.theme && app.theme.colors));
    if (!colors || typeof colors !== 'object') return;

    Object.keys(colors).forEach((key) => {
      const value = colors[key];
      if (typeof value !== 'string' || !value.trim()) return;
      const safeKey = key
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase();
      global.document.documentElement.style.setProperty('--notibot-' + safeKey, value);
    });
  }

  function setPlatformMode(mode) {
    if (global.document && global.document.documentElement) {
      global.document.documentElement.dataset.platform = mode;
    }
  }

  function saveIdentity(identity) {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKey, JSON.stringify(cleanIdentity(identity)));
    } catch (error) {
      console.warn('Не удалось сохранить идентификаторы Notibot:', error);
    }
  }

  function loadStoredIdentity() {
    const storage = getStorage();
    if (!storage) return emptyIdentity();
    try {
      const value = storage.getItem(storageKey);
      return value ? cleanIdentity(JSON.parse(value)) : emptyIdentity();
    } catch {
      return emptyIdentity();
    }
  }

  function clearSavedIdentity() {
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ничего не делаем: очистка локального хранилища необязательна.
      }
    }
    state.identity = emptyIdentity();
    notify();
  }

  function getStorage() {
    try {
      if (config.persistIdentity === 'local') return global.localStorage;
      if (config.persistIdentity === 'session') return global.sessionStorage;
    } catch {
      return null;
    }
    return null;
  }

  function getParentOrigin() {
    if (!isEmbedded || !global.document.referrer) return null;
    try {
      return new URL(global.document.referrer).origin;
    } catch {
      return null;
    }
  }

  function createRequestId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  function copyAnswers(answers) {
    return Array.isArray(answers)
      ? answers.map((item) => ({ ...item }))
      : [];
  }

  function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function normalizePersistence(value) {
    return value === 'local' || value === 'none' ? value : 'session';
  }

  function dispatch(name, detail) {
    if (typeof global.CustomEvent !== 'function') return;
    global.dispatchEvent(new global.CustomEvent(name, { detail }));
  }
})(window);
