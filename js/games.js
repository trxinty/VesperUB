(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let activeCategory = 'All';
  let searchQuery = '';
  let activeGame = null;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAllGames() {
    const base = window.Vesper.GamesData || [];
    const custom = (window.Vesper.Store.get().games && window.Vesper.Store.get().games.customGames) || [];
    return [...custom, ...base];
  }

  function toggleFavorite(gameId) {
    let added = false;
    window.Vesper.Store.update((s) => {
      const favs = s.games.favorites || [];
      const idx = favs.indexOf(gameId);
      if (idx >= 0) {
        favs.splice(idx, 1);
        added = false;
      } else {
        favs.unshift(gameId);
        added = true;
      }
      s.games.favorites = favs;
    }, 'games');
    window.Vesper.App.toast(added ? 'Added to Favorites' : 'Removed from Favorites');
    render();
  }

  function launchGame(game) {
    activeGame = game;
    window.Vesper.Store.update((s) => {
      const rec = (s.games.recent || []).filter((id) => id !== game.id);
      rec.unshift(game.id);
      s.games.recent = rec.slice(0, 12);
    }, 'games');
    render();
  }

  function closeGame() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    activeGame = null;
    render();
  }

  function openAddGameModal() {
    const root = document.getElementById('app-modal-root');
    const Icons = window.Vesper.Icons;
    const cats = (window.Vesper.GameCategories || []).filter((c) => !['All', 'Favorites', 'Recent'].includes(c));

    root.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">add custom html5 game</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <p class="modal-body" style="margin-bottom:14px;">
          Add any HTML5 game URL (or local <code>./games/mygame/index.html</code>) to your personal Vesper Games Hub.
        </p>
        <form id="add-game-form" class="auth-form">
          <div class="input-group">
            <label for="cg-title">game title</label>
            <input id="cg-title" type="text" placeholder="e.g. Slope WebGL" maxlength="32" required />
          </div>
          <div class="input-group">
            <label for="cg-url">game url or local path</label>
            <input id="cg-url" type="text" placeholder="https://... or ./games/mygame.html" required />
          </div>
          <div class="custom-color-row">
            <div class="input-group">
              <label for="cg-cat">category</label>
              <select id="cg-cat">
                ${cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label for="cg-emoji">cover emoji</label>
              <input id="cg-emoji" type="text" value="🎮" maxlength="2" />
            </div>
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">add to library</button>
          </div>
        </form>
      </div>
    `;
    root.classList.remove('hidden');

    const close = () => { root.classList.add('hidden'); root.innerHTML = ''; };
    root.onclick = (ev) => { if (ev.target === root) close(); };
    root.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', close));
    root.querySelector('#cg-title').focus();

    root.querySelector('#add-game-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const title = root.querySelector('#cg-title').value.trim();
      const url = root.querySelector('#cg-url').value.trim();
      const category = root.querySelector('#cg-cat').value || 'Arcade';
      const emoji = root.querySelector('#cg-emoji').value.trim() || '🎮';
      if (!title || !url) return;

      const gameObj = {
        id: window.Vesper.Store.uid('cg'),
        title,
        category,
        url,
        controls: 'Custom HTML5 game added by you',
        custom: true,
        thumbnail: window.Vesper.makeGameArt('#190d2e', '#3b0764', '#a855f7', emoji, title.toUpperCase().slice(0, 12))
      };

      window.Vesper.Store.update((s) => {
        s.games.customGames = s.games.customGames || [];
        s.games.customGames.unshift(gameObj);
      }, 'games');

      close();
      render();
      window.Vesper.App.toast(`Added "${title}" to Games Hub`);
    });
  }

  function renderPlayer(root) {
    const Icons = window.Vesper.Icons;
    const favs = (window.Vesper.Store.get().games && window.Vesper.Store.get().games.favorites) || [];
    const isFav = favs.includes(activeGame.id);

    root.innerHTML = `
      <div class="game-player-shell">
        <div class="game-player-bar">
          <div class="game-player-left">
            <button type="button" class="btn-secondary" id="gp-back-btn" style="padding:7px 12px;font-size:0.82rem;">
              ${Icons.get('arrowLeft')} back
            </button>
            <div style="min-width:0;">
              <div class="game-player-title">${escapeHtml(activeGame.title)}</div>
              <div class="game-player-meta">${escapeHtml(activeGame.category)}${activeGame.builtIn ? ' · Built-In HTML5' : ' · Web Embed'}</div>
            </div>
          </div>
          <div class="game-player-actions">
            <button type="button" class="icon-btn ${isFav ? 'active-toggle' : ''}" id="gp-fav-btn" title="${isFav ? 'Remove Favorite' : 'Favorite'}">
              ${Icons.get(isFav ? 'starFilled' : 'star')}
            </button>
            <button type="button" class="icon-btn" id="gp-reload-btn" title="Restart Game">
              ${Icons.get('refresh')}
            </button>
            <button type="button" class="icon-btn" id="gp-fullscreen-btn" title="Fullscreen">
              ${Icons.get('maximize')}
            </button>
            <a class="icon-btn" href="${escapeHtml(activeGame.url)}" target="_blank" rel="noopener noreferrer" title="Open Standalone">
              ${Icons.get('externalLink')}
            </a>
          </div>
        </div>

        <div class="game-stage" id="game-stage">
          <iframe
            id="game-iframe"
            src="${escapeHtml(activeGame.url)}"
            title="${escapeHtml(activeGame.title)}"
            allow="fullscreen; autoplay; gamepad"
            allowfullscreen
          ></iframe>
        </div>

        <div class="game-controls-strip">
          <span><strong>Controls:</strong> ${escapeHtml(activeGame.controls || 'Keyboard / Mouse / Touch')}</span>
          ${!activeGame.builtIn ? `<span>If external embed is blocked on your network, click the top-right pop-out icon.</span>` : `<span>Runs 100% locally inside Vesper</span>`}
        </div>
      </div>
    `;

    document.getElementById('gp-back-btn').addEventListener('click', closeGame);
    document.getElementById('gp-fav-btn').addEventListener('click', () => toggleFavorite(activeGame.id));
    document.getElementById('gp-reload-btn').addEventListener('click', () => {
      const frame = document.getElementById('game-iframe');
      if (frame) frame.src = activeGame.url;
    });
    document.getElementById('gp-fullscreen-btn').addEventListener('click', () => {
      const stage = document.getElementById('game-stage');
      if (stage && stage.requestFullscreen) {
        stage.requestFullscreen().catch(() => {});
      }
    });
  }

  function render() {
    const root = document.getElementById('view-games');
    if (!root) return;

    if (activeGame) {
      renderPlayer(root);
      return;
    }

    const Icons = window.Vesper.Icons;
    const stateGames = window.Vesper.Store.get().games || { favorites: [], recent: [] };
    const favs = stateGames.favorites || [];
    const recent = stateGames.recent || [];
    const allGames = getAllGames();
    const categories = window.Vesper.GameCategories || ['All'];

    let filtered = allGames.filter((g) => {
      const queryMatch = !searchQuery ||
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.category.toLowerCase().includes(searchQuery.toLowerCase());
      if (!queryMatch) return false;
      if (activeCategory === 'All') return true;
      if (activeCategory === 'Favorites') return favs.includes(g.id);
      if (activeCategory === 'Recent') return recent.includes(g.id);
      return g.category === activeCategory;
    });

    if (activeCategory === 'Recent') {
      filtered.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    }

    root.innerHTML = `
      <div class="page-container">
        <div class="games-header">
          <div>
            <h1 class="page-title">games</h1>
            <p class="page-count">${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}</p>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div class="games-search-box">
              <span class="search-icon">${Icons.get('search')}</span>
              <input
                id="games-search-input"
                type="search"
                placeholder="search games..."
                value="${escapeHtml(searchQuery)}"
                aria-label="Search games"
              />
            </div>
            <button type="button" class="btn-secondary" id="add-custom-game-btn" style="padding:10px 14px;font-size:0.84rem;">
              ${Icons.get('plus')} add game
            </button>
          </div>
        </div>

        <div class="games-filters" role="tablist" aria-label="Game categories">
          ${categories.map((cat) => `
            <button
              type="button"
              class="filter-chip ${activeCategory === cat ? 'active' : ''}"
              data-category="${escapeHtml(cat)}"
            >${escapeHtml(cat)}</button>
          `).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div class="games-empty-state">
            <div class="games-empty-icon">${Icons.get('games')}</div>
            <h2 class="games-empty-title">No matching games</h2>
            <p class="games-empty-desc">
              ${activeCategory === 'Favorites'
                ? 'Star any game card to pin it to your Favorites shelf.'
                : activeCategory === 'Recent'
                  ? 'Launch any game from the library and it will appear here.'
                  : `No games matched "${escapeHtml(searchQuery)}" in ${escapeHtml(activeCategory)}.`}
            </p>
          </div>
        ` : `
          <div class="games-grid">
            ${filtered.map((game) => {
              const isFav = favs.includes(game.id);
              return `
                <div class="game-card" data-game-id="${escapeHtml(game.id)}" role="button" tabindex="0" aria-label="Play ${escapeHtml(game.title)}">
                  <img class="game-card-img" src="${escapeHtml(game.thumbnail)}" alt="${escapeHtml(game.title)}" loading="lazy" />
                  <button
                    type="button"
                    class="game-fav-btn ${isFav ? 'fav' : ''}"
                    data-fav-id="${escapeHtml(game.id)}"
                    title="${isFav ? 'Unfavorite' : 'Favorite'}"
                  >${Icons.get(isFav ? 'starFilled' : 'star')}</button>
                  <div class="game-card-overlay">
                    <span class="game-card-title">${escapeHtml(game.title)}</span>
                    <span class="game-card-cat">${escapeHtml(game.category)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    const searchInput = document.getElementById('games-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (ev) => {
        searchQuery = ev.target.value;
        render();
        const nextInput = document.getElementById('games-search-input');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });
    }

    document.getElementById('add-custom-game-btn').addEventListener('click', openAddGameModal);

    root.querySelectorAll('[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.category;
        render();
      });
    });

    root.querySelectorAll('[data-fav-id]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleFavorite(btn.dataset.favId);
      });
    });

    root.querySelectorAll('[data-game-id]').forEach((card) => {
      const open = () => {
        const g = allGames.find((x) => x.id === card.dataset.gameId);
        if (g) launchGame(g);
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
      });
    });
  }

  window.Vesper.Games = { render, launchById: (id) => {
    const g = getAllGames().find((x) => x.id === id);
    if (g) launchGame(g);
  }};
})();
