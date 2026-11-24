(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function formatLiveDate() {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    const day = getOrdinal(now.getDate());
    const year = now.getFullYear();
    return `${weekday}, ${month} ${day}, ${year}`;
  }

  function updateDate(activeView) {
    const el = document.getElementById('dock-date');
    if (!el) return;
    el.textContent = formatLiveDate();
    el.classList.toggle('dimmed', activeView !== 'home');
  }

  function render(activeView) {
    const dock = document.getElementById('floating-dock');
    if (!dock) return;

    const state = window.Vesper.Store.get();
    const isGuest = !state.session || state.session.mode === 'guest';
    const Icons = window.Vesper.Icons;

    const items = [
      { id: 'home', label: 'home', icon: 'home' },
      { id: 'games', label: 'games', icon: 'games' },
      { id: 'chat', label: 'chat', icon: 'chat', locked: isGuest }
    ];

    dock.innerHTML = `
      <button type="button" class="dock-brand" data-nav="home" title="Vesper Home" aria-label="Vesper Home">
        ${Icons.get('vesperLogo')}
      </button>
      ${items.map((item) => `
        <button
          type="button"
          class="dock-item ${activeView === item.id ? 'active' : ''}"
          data-nav="${item.id}"
          aria-current="${activeView === item.id ? 'page' : 'false'}"
          title="${item.locked ? 'Chat (Sign in required)' : item.label}"
        >
          ${Icons.get(item.icon)}
          <span class="dock-label">${item.label}</span>
          ${item.locked ? `<span class="dock-lock-badge" aria-hidden="true">${Icons.get('lock')}</span>` : ''}
        </button>
      `).join('')}
      <div class="dock-divider" aria-hidden="true"></div>
      <button
        type="button"
        class="dock-item ${activeView === 'settings' ? 'active' : ''}"
        data-nav="settings"
        aria-current="${activeView === 'settings' ? 'page' : 'false'}"
        title="Settings"
      >
        ${Icons.get('settings')}
        <span class="dock-label">settings</span>
      </button>
    `;

    dock.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.Vesper.App.navigate(btn.dataset.nav);
      });
    });

    updateDate(activeView);
  }

  setInterval(() => {
    const active = window.Vesper.App ? window.Vesper.App.getActiveView() : 'home';
    updateDate(active);
  }, 30000);

  window.Vesper.Dock = { render, updateDate };
})();
