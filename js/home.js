(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildSearchIndex() {
    const state = window.Vesper.Store.get();
    const isGuest = !state.session || state.session.mode === 'guest';
    const entries = [
      { label: 'Games Hub', meta: 'Page', keywords: 'games play library arcade', action: () => window.Vesper.App.navigate('games') },
      { label: 'Vesper Chat', meta: isGuest ? 'Locked (Guest)' : 'Page', keywords: 'chat discord servers dm messages', action: () => window.Vesper.App.navigate('chat') },
      { label: 'Theme Customizer', meta: 'Settings', keywords: 'theme colors purple black blue yellow accent', action: () => window.Vesper.App.navigate('settings') },
      { label: 'Dock Position & Performance', meta: 'Settings', keywords: 'settings dock top bottom performance cursor', action: () => window.Vesper.App.navigate('settings') }
    ];

    if (!isGuest) {
      state.chat.servers.forEach((srv) => {
        srv.channels.forEach((ch) => {
          entries.push({
            label: `#${ch.name}`,
            meta: srv.name,
            keywords: `${ch.name} ${srv.name} channel chat`,
            action: () => {
              window.Vesper.Store.update((s) => {
                s.chat.activeView = 'server';
                s.chat.activeServerId = srv.id;
                s.chat.activeChannelId = ch.id;
              }, 'chat-nav');
              window.Vesper.App.navigate('chat');
            }
          });
        });
      });
    }

    (window.Vesper.GamesData || []).forEach((g) => {
      entries.push({
        label: g.title,
        meta: `Game · ${g.category}`,
        keywords: `${g.title} ${g.category} game`,
        action: () => window.Vesper.App.navigate('games')
      });
    });

    return entries;
  }

  function render() {
    const root = document.getElementById('view-home');
    if (!root) return;

    const state = window.Vesper.Store.get();
    const session = state.session;
    const isGuest = !session || session.mode === 'guest';
    const Icons = window.Vesper.Icons;

    root.innerHTML = `
      <div class="home-container">
        <div class="home-user-pill ${isGuest ? 'guest' : ''}">
          <span class="status-dot"></span>
          <span>${isGuest ? 'browsing as guest · chat locked' : `signed in as <strong>${escapeHtml(session.username)}</strong>`}</span>
        </div>

        <h1 class="home-brand-title">
          <span class="vesper-mark lg">${Icons.get('vesperLogo')}</span>
          <span>vesper</span>
        </h1>
        <p class="home-tagline">dark purple workspace // games · chat · themes</p>

        <div class="home-search-wrap">
          <form id="home-search-form" class="home-search-bar" autocomplete="off">
            <input
              id="home-search-input"
              type="search"
              placeholder="Jump to channels, themes, games, or settings..."
              aria-label="Search Vesper"
            />
            <button type="submit" class="home-search-go" aria-label="Go">
              ${Icons.get('arrowRight')}
            </button>
          </form>
          <div id="home-search-results" class="home-search-results hidden"></div>
        </div>

        <div class="home-shortcuts">
          <button type="button" class="shortcut-pill" data-shortcut="games">
            ${Icons.get('games')}
            <span>Games</span>
          </button>
          <button type="button" class="shortcut-pill" data-shortcut="chat">
            ${Icons.get(isGuest ? 'lock' : 'chat')}
            <span>${isGuest ? 'Chat (Locked)' : 'Chat'}</span>
          </button>
          <button type="button" class="shortcut-pill" data-shortcut="settings">
            ${Icons.get('palette')}
            <span>Themes</span>
          </button>
          <button type="button" class="shortcut-pill" data-shortcut="${isGuest ? 'signin' : 'settings'}">
            ${Icons.get(isGuest ? 'sparkles' : 'settings')}
            <span>${isGuest ? 'Sign In' : 'Settings'}</span>
          </button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-shortcut]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.shortcut;
        if (target === 'signin') {
          window.Vesper.Auth.openGate('signin');
        } else {
          window.Vesper.App.navigate(target);
        }
      });
    });

    const input = document.getElementById('home-search-input');
    const resultsBox = document.getElementById('home-search-results');
    const form = document.getElementById('home-search-form');
    let currentMatches = [];

    function updateResults() {
      const q = input.value.trim().toLowerCase();
      if (!q) {
        resultsBox.classList.add('hidden');
        resultsBox.innerHTML = '';
        currentMatches = [];
        return;
      }
      const index = buildSearchIndex();
      currentMatches = index.filter((item) =>
        item.label.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q)
      ).slice(0, 6);

      if (!currentMatches.length) {
        resultsBox.innerHTML = `<div class="search-result-item" style="color:var(--text-muted);cursor:default;">No matches inside Vesper for "${escapeHtml(q)}"</div>`;
      } else {
        resultsBox.innerHTML = currentMatches.map((m, idx) => `
          <button type="button" class="search-result-item" data-match-idx="${idx}">
            <span>${escapeHtml(m.label)}</span>
            <span class="search-result-meta">${escapeHtml(m.meta)}</span>
          </button>
        `).join('');
        resultsBox.querySelectorAll('[data-match-idx]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const match = currentMatches[Number(btn.dataset.matchIdx)];
            input.value = '';
            resultsBox.classList.add('hidden');
            if (match && match.action) match.action();
          });
        });
      }
      resultsBox.classList.remove('hidden');
    }

    input.addEventListener('input', updateResults);
    input.addEventListener('blur', () => {
      setTimeout(() => resultsBox.classList.add('hidden'), 160);
    });
    input.addEventListener('focus', updateResults);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (currentMatches.length) {
        const first = currentMatches[0];
        input.value = '';
        resultsBox.classList.add('hidden');
        first.action();
      }
    });
  }

  window.Vesper.Home = { render };
})();
