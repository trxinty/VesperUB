(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let activeCategory = 'All';
  let searchQuery = '';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    const root = document.getElementById('view-games');
    if (!root) return;

    const Icons = window.Vesper.Icons;
    const allGames = window.Vesper.GamesData || [];
    const categories = window.Vesper.GameCategories || ['All'];

    const filtered = allGames.filter((g) => {
      const catMatch = activeCategory === 'All' || g.category === activeCategory;
      const queryMatch = !searchQuery || g.title.toLowerCase().includes(searchQuery.toLowerCase());
      return catMatch && queryMatch;
    });

    root.innerHTML = `
      <div class="page-container">
        <div class="games-header">
          <div>
            <h1 class="page-title">games</h1>
            <p class="page-count">${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}</p>
          </div>
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
            <div class="games-empty-icon">
              ${Icons.get('games')}
            </div>
            <h2 class="games-empty-title">No games yet</h2>
            <p class="games-empty-desc">
              ${allGames.length === 0
                ? 'Vesper’s core UI, themes, and chat foundation are up first. Games will be added right into this library in the next phase.'
                : `No games matched "${escapeHtml(searchQuery)}" in ${escapeHtml(activeCategory)}.`}
            </p>
            <div class="games-empty-badge">
              ${Icons.get('sparkles')}
              <span>Library shell ready · Phase 2 upcoming</span>
            </div>
          </div>
        ` : `
          <div class="games-grid">
            ${filtered.map((game) => `
              <div class="game-card" data-game-id="${escapeHtml(game.id)}" title="${escapeHtml(game.title)}">
                <img src="${escapeHtml(game.thumbnail)}" alt="${escapeHtml(game.title)}" style="width:100%;height:100%;object-fit:cover;" />
              </div>
            `).join('')}
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

    root.querySelectorAll('[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeCategory = chip.dataset.category;
        render();
      });
    });
  }

  window.Vesper.Games = { render };
})();
