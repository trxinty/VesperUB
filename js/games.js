(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let activeCategory = 'All';
  let searchQuery = '';
  let sortBy = 'az'; // 'az' | 'za' | 'size-asc' | 'size-desc'
  let catalogState = { loading: false, loaded: false, error: null };
  let localImportedGames = []; // In-memory imported .html files for current session

  // Active Theater Player state
  let activeGame = null;
  let activeBlobUrl = null;
  let playerLoading = false;
  let playerError = null;
  let loadRequestId = 0;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function revokeActiveBlob() {
    if (activeBlobUrl && activeBlobUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(activeBlobUrl); } catch (e) {}
    }
    activeBlobUrl = null;
  }

  function getAllGames() {
    const repoGames = window.Vesper.GamesData || [];
    const custom = (window.Vesper.Store.get().games && window.Vesper.Store.get().games.customGames) || [];
    return [...localImportedGames, ...custom, ...repoGames];
  }

  async function ensureCatalog(forceRefresh) {
    if (catalogState.loading) return;
    if (catalogState.loaded && !forceRefresh && (window.Vesper.GamesData || []).length > 0) return;

    catalogState = { loading: true, loaded: catalogState.loaded, error: null };
    if (window.Vesper.App && window.Vesper.App.getActiveView() === 'games') {
      render();
    }

    try {
      const res = await window.Vesper.GamesRepo.fetchCatalog(!!forceRefresh);
      catalogState = { loading: false, loaded: true, error: null };
      if (forceRefresh && window.Vesper.App) {
        window.Vesper.App.toast(`Synced ${res.games.length} games from trxinty/Html-games-`);
      }
    } catch (err) {
      catalogState = {
        loading: false,
        loaded: false,
        error: err && err.message ? err.message : 'Unable to reach GitHub / jsDelivr API.'
      };
    }

    if (window.Vesper.App) {
      if (window.Vesper.App.getActiveView() === 'games') render();
      if (window.Vesper.App.getActiveView() === 'home') window.Vesper.Home.render();
    }
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

  async function launchGame(game) {
    revokeActiveBlob();
    activeGame = game;
    playerLoading = true;
    playerError = null;
    const reqId = ++loadRequestId;

    window.Vesper.Store.update((s) => {
      const rec = (s.games.recent || []).filter((id) => id !== game.id);
      rec.unshift(game.id);
      s.games.recent = rec.slice(0, 20);
    }, 'games');

    render();

    try {
      const blobOrUrl = await window.Vesper.GamesRepo.loadGameBlobUrl(game, (loaded, total) => {
        if (reqId !== loadRequestId) return;
        const bar = document.getElementById('gp-progress-fill');
        const txt = document.getElementById('gp-progress-text');
        const loadedMb = (loaded / (1024 * 1024)).toFixed(2);
        const targetTotal = total || game.size || 0;
        if (txt) {
          txt.textContent = targetTotal > 0
            ? `Downloading ${loadedMb} MB / ${(targetTotal / (1024 * 1024)).toFixed(2)} MB...`
            : `Downloading ${loadedMb} MB...`;
        }
        if (bar && targetTotal > 0) {
          const pct = Math.min(100, Math.round((loaded / targetTotal) * 100));
          bar.style.width = pct + '%';
        }
      });

      if (reqId !== loadRequestId) {
        if (blobOrUrl && blobOrUrl.startsWith('blob:')) URL.revokeObjectURL(blobOrUrl);
        return;
      }

      activeBlobUrl = blobOrUrl;
      playerLoading = false;
      render();
    } catch (err) {
      if (reqId !== loadRequestId) return;
      playerLoading = false;
      playerError = (err && err.message) || 'Failed to load this HTML game file.';
      render();
    }
  }

  function closeGame() {
    loadRequestId++;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    revokeActiveBlob();
    activeGame = null;
    playerLoading = false;
    playerError = null;
    render();
  }

  async function handleLocalFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => /\.html?$/i.test(f.name));
    if (!files.length) {
      window.Vesper.App.toast('No .html game files found in selection');
      return;
    }

    let addedCount = 0;
    for (const file of files) {
      try {
        const html = await file.text();
        const title = window.Vesper.GamesRepo.cleanGameTitle(file.name);
        const category = window.Vesper.GamesRepo.inferCategory(title, file.name);
        const id = 'local_' + file.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        localImportedGames = localImportedGames.filter((g) => g.id !== id);
        localImportedGames.unshift({
          id,
          title,
          category,
          path: file.name,
          size: file.size,
          sizeLabel: window.Vesper.GamesRepo.formatBytes(file.size),
          source: 'local',
          localHtml: html,
          palette: window.Vesper.GamesRepo.getPalette(category, title)
        });
        addedCount++;
      } catch (e) {}
    }

    window.Vesper.App.toast(`Imported ${addedCount} local HTML ${addedCount === 1 ? 'game' : 'games'}`);
    render();
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
              ${Icons.get('arrowLeft')} library
            </button>
            <div style="min-width:0;">
              <div class="game-player-title">${escapeHtml(activeGame.title)}</div>
              <div class="game-player-meta">
                ${escapeHtml(activeGame.category)}
                ${activeGame.sizeLabel ? ` · ${escapeHtml(activeGame.sizeLabel)}` : ''}
                · ${activeGame.source === 'local' ? 'Local HTML File' : 'trxinty/Html-games-'}
              </div>
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
          </div>
        </div>

        <div class="game-stage" id="game-stage">
          ${playerLoading ? `
            <div class="game-loader-overlay">
              <div class="game-loader-card">
                <div class="games-empty-icon" style="margin:0 auto 14px;">${Icons.get('games')}</div>
                <h3>Loading ${escapeHtml(activeGame.title)}</h3>
                <p id="gp-progress-text">Fetching single-file HTML from GitHub...</p>
                <div class="gp-progress-track">
                  <div class="gp-progress-fill" id="gp-progress-fill" style="width:12%;"></div>
                </div>
              </div>
            </div>
          ` : playerError ? `
            <div class="game-loader-overlay">
              <div class="game-loader-card">
                <h3 style="color:#fca5a5;">Failed to load game</h3>
                <p>${escapeHtml(playerError)}</p>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:14px;">
                  <button type="button" class="btn-secondary" id="gp-err-back">back</button>
                  <button type="button" class="btn-primary" id="gp-err-retry">retry</button>
                </div>
              </div>
            </div>
          ` : `
            <iframe
              id="game-iframe"
              src="${escapeHtml(activeBlobUrl || '')}"
              title="${escapeHtml(activeGame.title)}"
              allow="fullscreen; autoplay; gamepad; pointer-lock"
              allowfullscreen
            ></iframe>
          `}
        </div>

        <div class="game-controls-strip">
          <span>Running single-file HTML directly inside Vesper — no extra tabs</span>
          <span>Click inside the game viewport if keyboard keys aren't focused yet</span>
        </div>
      </div>
    `;

    document.getElementById('gp-back-btn').addEventListener('click', closeGame);
    document.getElementById('gp-fav-btn').addEventListener('click', () => toggleFavorite(activeGame.id));
    document.getElementById('gp-reload-btn').addEventListener('click', () => launchGame(activeGame));
    document.getElementById('gp-fullscreen-btn').addEventListener('click', () => {
      const stage = document.getElementById('game-stage');
      if (stage && stage.requestFullscreen) {
        stage.requestFullscreen().catch(() => {});
      }
    });

    const errBack = document.getElementById('gp-err-back');
    if (errBack) errBack.addEventListener('click', closeGame);
    const errRetry = document.getElementById('gp-err-retry');
    if (errRetry) errRetry.addEventListener('click', () => launchGame(activeGame));
  }

  function render() {
    const root = document.getElementById('view-games');
    if (!root) return;

    if (activeGame) {
      renderPlayer(root);
      return;
    }

    if (!catalogState.loaded && !catalogState.loading && !catalogState.error) {
      ensureCatalog(false);
    }

    const Icons = window.Vesper.Icons;
    const stateGames = window.Vesper.Store.get().games || { favorites: [], recent: [] };
    const favs = stateGames.favorites || [];
    const recent = stateGames.recent || [];
    const allGames = getAllGames();

    // Only show categories that have at least 1 game (plus All, Favorites, Recent)
    const presentCats = new Set(allGames.map((g) => g.category));
    const categories = (window.Vesper.GameCategories || ['All']).filter(
      (c) => c === 'All' || c === 'Favorites' || c === 'Recent' || presentCats.has(c)
    );

    let filtered = allGames.filter((g) => {
      const queryMatch = !searchQuery ||
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (g.path && g.path.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!queryMatch) return false;
      if (activeCategory === 'All') return true;
      if (activeCategory === 'Favorites') return favs.includes(g.id);
      if (activeCategory === 'Recent') return recent.includes(g.id);
      return g.category === activeCategory;
    });

    if (activeCategory === 'Recent') {
      filtered.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
    } else if (sortBy === 'az') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'za') {
      filtered.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'size-asc') {
      filtered.sort((a, b) => (a.size || 0) - (b.size || 0));
    } else if (sortBy === 'size-desc') {
      filtered.sort((a, b) => (b.size || 0) - (a.size || 0));
    }

    root.innerHTML = `
      <div class="page-container">
        <div class="games-header">
          <div>
            <h1 class="page-title">games</h1>
            <p class="page-count">
              ${catalogState.loading && allGames.length === 0
                ? 'Loading 352+ games from trxinty/Html-games-...'
                : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} · trxinty/Html-games-`}
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="games-search-box">
              <span class="search-icon">${Icons.get('search')}</span>
              <input
                id="games-search-input"
                type="search"
                placeholder="search ${allGames.length || '352+'} games..."
                value="${escapeHtml(searchQuery)}"
                aria-label="Search games"
              />
            </div>
            <select id="games-sort-select" class="settings-select" style="min-width:118px;padding:10px 10px;" aria-label="Sort games">
              <option value="az" ${sortBy === 'az' ? 'selected' : ''}>A → Z</option>
              <option value="za" ${sortBy === 'za' ? 'selected' : ''}>Z → A</option>
              <option value="size-asc" ${sortBy === 'size-asc' ? 'selected' : ''}>Smallest</option>
              <option value="size-desc" ${sortBy === 'size-desc' ? 'selected' : ''}>Largest</option>
            </select>
            <input type="file" id="import-local-html-input" accept=".html,.htm" multiple class="hidden" />
            <button type="button" class="btn-secondary" id="import-local-btn" style="padding:10px 12px;font-size:0.82rem;" title="Import local .html files from downloaded trxinty/Html-games-">
              ${Icons.get('plus')} local html
            </button>
            <button type="button" class="icon-btn" id="refresh-catalog-btn" title="Refresh GitHub Pack" style="border:1px solid var(--border-subtle);background:var(--bg-elevated);">
              ${Icons.get('refresh')}
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

        ${catalogState.loading && allGames.length === 0 ? `
          <div class="games-empty-state">
            <div class="games-empty-icon">${Icons.get('games')}</div>
            <h2 class="games-empty-title">Loading 352+ Games Pack...</h2>
            <p class="games-empty-desc">
              Fetching the live catalog from <code>trxinty/Html-games-/offline</code>.
            </p>
          </div>
        ` : catalogState.error && allGames.length === 0 ? `
          <div class="games-empty-state">
            <div class="games-empty-icon">${Icons.get('shield')}</div>
            <h2 class="games-empty-title">Couldn't reach GitHub catalog</h2>
            <p class="games-empty-desc">
              ${escapeHtml(catalogState.error)} — You can retry or click <strong>+ local html</strong> to load any downloaded <code>.html</code> files from the pack directly.
            </p>
            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" class="btn-primary" id="retry-catalog-btn">Retry Sync</button>
            </div>
          </div>
        ` : filtered.length === 0 ? `
          <div class="games-empty-state">
            <div class="games-empty-icon">${Icons.get('games')}</div>
            <h2 class="games-empty-title">No matching games</h2>
            <p class="games-empty-desc">
              ${activeCategory === 'Favorites'
                ? 'Star any game card to pin it to your Favorites shelf.'
                : activeCategory === 'Recent'
                  ? 'Launch any game from the pack and it will show up here.'
                  : `No games matched "${escapeHtml(searchQuery)}" in ${escapeHtml(activeCategory)}.`}
            </p>
          </div>
        ` : `
          <div class="games-grid">
            ${filtered.map((game) => {
              const isFav = favs.includes(game.id);
              const pal = game.palette || { bg1: '#140a24', bg2: '#2e1065', accent: '#8b5cf6', emoji: '🎮', angle: 135 };
              return `
                <div
                  class="game-card pack-card"
                  data-game-id="${escapeHtml(game.id)}"
                  role="button"
                  tabindex="0"
                  aria-label="Play ${escapeHtml(game.title)}"
                  style="background:linear-gradient(${pal.angle}deg, ${pal.bg1}, ${pal.bg2});"
                >
                  <div class="pack-card-glow" style="background:radial-gradient(circle at 50% 35%, ${pal.accent}55, transparent 68%);"></div>
                  ${game.sizeLabel ? `<span class="game-size-pill">${escapeHtml(game.sizeLabel)}</span>` : ''}
                  <button
                    type="button"
                    class="game-fav-btn ${isFav ? 'fav' : ''}"
                    data-fav-id="${escapeHtml(game.id)}"
                    title="${isFav ? 'Unfavorite' : 'Favorite'}"
                  >${Icons.get(isFav ? 'starFilled' : 'star')}</button>
                  <div class="pack-card-emblem" style="border-color:${pal.accent}66;">
                    <span>${pal.emoji}</span>
                  </div>
                  <div class="game-card-overlay">
                    <span class="game-card-title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</span>
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

    const sortSel = document.getElementById('games-sort-select');
    if (sortSel) {
      sortSel.addEventListener('change', (ev) => {
        sortBy = ev.target.value;
        render();
      });
    }

    const localInput = document.getElementById('import-local-html-input');
    const localBtn = document.getElementById('import-local-btn');
    if (localBtn && localInput) {
      localBtn.addEventListener('click', () => localInput.click());
      localInput.addEventListener('change', (ev) => handleLocalFiles(ev.target.files));
    }

    const refreshBtn = document.getElementById('refresh-catalog-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => ensureCatalog(true));

    const retryBtn = document.getElementById('retry-catalog-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => ensureCatalog(true));

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

  window.Vesper.Games = {
    render,
    ensureCatalog,
    launchById: (id) => {
      const g = getAllGames().find((x) => x.id === id);
      if (g) launchGame(g);
    }
  };
})();
