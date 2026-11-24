(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let activeView = 'home';

  function toast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast accent';
    el.innerHTML = `<span class="toast-dot"></span><span></span>`;
    el.querySelector('span:last-child').textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(16px)';
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  function applySettingsToDom() {
    const s = window.Vesper.Store.get().settings;
    window.Vesper.Themes.apply({ base: s.themeBase, accent: s.themeAccent });
    if (window.Vesper.Cloak) window.Vesper.Cloak.sync();
    document.documentElement.setAttribute('data-dock', s.dockPosition || 'bottom');
    document.body.classList.toggle('no-ambient', !s.ambientBg);
    document.body.classList.toggle('perf-mode', !!s.performanceMode);
    document.body.classList.toggle('compact-chat', !!s.compactChat);

    const dot = document.getElementById('cursor-dot');
    if (dot) {
      dot.classList.toggle('hidden', !s.cursorDot);
    }
  }

  function navigate(viewId) {
    const valid = ['home', 'games', 'chat', 'settings'];
    if (!valid.includes(viewId)) return;
    activeView = viewId;

    document.querySelectorAll('.app-view').forEach((sec) => {
      sec.classList.toggle('active', sec.dataset.view === activeView);
    });

    if (activeView === 'home') window.Vesper.Home.render();
    if (activeView === 'games') window.Vesper.Games.render();
    if (activeView === 'chat') window.Vesper.Chat.render();
    if (activeView === 'settings') window.Vesper.Settings.render();

    window.Vesper.Dock.render(activeView);
  }

  function refreshAll() {
    applySettingsToDom();
    window.Vesper.Home.render();
    window.Vesper.Games.render();
    window.Vesper.Chat.render();
    window.Vesper.Settings.render();
    window.Vesper.Dock.render(activeView);
  }

  function initCursorDot() {
    const dot = document.getElementById('cursor-dot');
    if (!dot) return;
    window.addEventListener('pointermove', (ev) => {
      if (!window.Vesper.Store.get().settings.cursorDot) return;
      dot.style.left = ev.clientX + 'px';
      dot.style.top = ev.clientY + 'px';
    }, { passive: true });
  }

  function initBeforeUnload() {
    window.addEventListener('beforeunload', (ev) => {
      if (window.Vesper.Store.get().settings.askBeforeLeaving) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });
  }

  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const modalRoot = document.getElementById('app-modal-root');
        if (modalRoot && !modalRoot.classList.contains('hidden')) {
          modalRoot.classList.add('hidden');
          modalRoot.innerHTML = '';
        }
        const guestModal = document.getElementById('guest-modal');
        if (guestModal && !guestModal.classList.contains('hidden')) {
          guestModal.classList.add('hidden');
        }
      }
      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        if (ev.key === '1') navigate('home');
        if (ev.key === '2') navigate('games');
        if (ev.key === '3') navigate('chat');
        if (ev.key === '4') navigate('settings');
      }
    });
  }

  function boot() {
    try {
      window.Vesper.Icons.hydrate(document);
      window.Vesper.Auth.init();
      if (window.Vesper.Cloak) window.Vesper.Cloak.init();
      applySettingsToDom();
      initCursorDot();
      initBeforeUnload();
      initKeyboardShortcuts();

      window.Vesper.Store.subscribe((_state, eventType) => {
        applySettingsToDom();
        if (eventType === 'settings') {
          window.Vesper.Settings.render();
          window.Vesper.Dock.render(activeView);
        } else if (eventType === 'chat' || eventType === 'external-sync') {
          window.Vesper.Chat.render();
          if (eventType === 'external-sync') {
            window.Vesper.Settings.render();
            window.Vesper.Dock.render(activeView);
          }
        }
      });

      const session = window.Vesper.Store.get().session;
      if (!session) {
        // Immediate front-door auth gate on first visit
        window.Vesper.Auth.openGate('signin');
      } else {
        window.Vesper.Auth.closeGate();
        refreshAll();
        navigate('home');
      }

      if (window.Vesper.Games && window.Vesper.Games.ensureCatalog) {
        window.Vesper.Games.ensureCatalog(false);
      }
    } catch (err) {
      console.error('Vesper boot recovery:', err);
      const gate = document.getElementById('auth-gate');
      if (gate) gate.classList.remove('hidden');
    }
  }

  window.Vesper.App = {
    navigate,
    refreshAll,
    toast,
    getActiveView: () => activeView
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
