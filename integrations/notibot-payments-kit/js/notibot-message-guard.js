// SDK v2.27 listens to messages globally. Accept its protocol only from this iframe's parent.
window.addEventListener('message', event => {
  if (event.data?.type !== 'NOTIBOT_INIT' && event.data?.source !== 'vibe-parent') return;
  if (window.parent === window || event.source !== window.parent) event.stopImmediatePropagation();
}, true);
