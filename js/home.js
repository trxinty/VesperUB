(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let activeSearchQuery = '';
  let searchViewMode = 'instant'; // 'instant' | 'frame'
  let searchResultsState = { loading: false, ddg: null, wiki: [], error: null };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, '');
  }

  function buildQuickIndex() {
    const state = window.Vesper.Store.get();
    const isGuest = !state.session || state.session.mode === 'guest';
    const entries = [
      { label: 'Games Hub', meta: 'Page', keywords: 'games play library arcade', action: () => window.Vesper.App.navigate('games') },
      { label: 'Vesper Chat', meta: isGuest ? 'Locked (Guest)' : 'Page', keywords: 'chat discord servers dm messages', action: () => window.Vesper.App.navigate('chat') },
      { label: 'Theme Customizer', meta: 'Settings', keywords: 'theme colors purple black blue yellow accent', action: () => window.Vesper.App.navigate('settings') }
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
        action: () => {
          window.Vesper.App.navigate('games');
          window.Vesper.Games.launchById(g.id);
        }
      });
    });

    return entries;
  }

  async function runDuckDuckGoSearch(query) {
    const clean = (query || '').trim();
    if (!clean) return;
    activeSearchQuery = clean;
    searchResultsState = { loading: true, ddg: null, wiki: [], error: null };
    render();

    const encoded = encodeURIComponent(clean);
    const ddgPromise = fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const wikiPromise = fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&origin=*&srlimit=7`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    try {
      const [ddgData, wikiData] = await Promise.all([ddgPromise, wikiPromise]);
      if (activeSearchQuery !== clean) return;
      searchResultsState = {
        loading: false,
        ddg: ddgData,
        wiki: (wikiData && wikiData.query && wikiData.query.search) || [],
        error: null
      };
    } catch (err) {
      if (activeSearchQuery !== clean) return;
      searchResultsState = { loading: false, ddg: null, wiki: [], error: 'Could not reach search APIs on this connection.' };
    }
    render();
  }

  function renderSearchViewer(root) {
    const Icons = window.Vesper.Icons;
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(activeSearchQuery)}`;
    const ddgLiteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(activeSearchQuery)}`;
    const { loading, ddg, wiki } = searchResultsState;

    const related = [];
    if (ddg && Array.isArray(ddg.RelatedTopics)) {
      ddg.RelatedTopics.forEach((item) => {
        if (item.Text && item.FirstURL) {
          related.push({ text: item.Text, url: item.FirstURL });
        } else if (Array.isArray(item.Topics)) {
          item.Topics.forEach((sub) => {
            if (sub.Text && sub.FirstURL) related.push({ text: sub.Text, url: sub.FirstURL });
          });
        }
      });
    }

    root.innerHTML = `
      <div class="search-viewer-shell">
        <div class="search-viewer-bar">
          <button type="button" class="btn-secondary" id="sv-back-btn" style="padding:7px 11px;font-size:0.82rem;">
            ${Icons.get('arrowLeft')} home
          </button>

          <form id="sv-bar-form" class="search-viewer-address">
            <span class="sv-badge">duckduckgo.com</span>
            <input id="sv-bar-input" type="search" value="${escapeHtml(activeSearchQuery)}" placeholder="Search DuckDuckGo..." />
            <button type="submit" class="icon-btn" style="width:30px;height:30px;" title="Search">${Icons.get('search')}</button>
          </form>

          <div class="sv-mode-group">
            <button type="button" class="sv-mode-btn ${searchViewMode === 'instant' ? 'active' : ''}" id="sv-mode-instant">Results</button>
            <button type="button" class="sv-mode-btn ${searchViewMode === 'frame' ? 'active' : ''}" id="sv-mode-frame">Frame</button>
          </div>

          <a class="btn-primary" href="${escapeHtml(ddgUrl)}" target="_blank" rel="noopener noreferrer" style="padding:8px 13px;font-size:0.8rem;text-decoration:none;white-space:nowrap;">
            ${Icons.get('externalLink')} open ddg
          </a>
        </div>

        ${searchViewMode === 'frame' ? `
          <div class="search-frame-wrap">
            <div class="search-frame-notice">
              <span>Loading <code>${escapeHtml(ddgUrl)}</code> directly inside Vesper. (Note: DuckDuckGo sends browser anti-embed headers on some browsers — switch to <strong>Results</strong> mode or click <strong>Open DDG</strong> if blank.)</span>
              <a href="${escapeHtml(ddgLiteUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-soft);font-weight:600;white-space:nowrap;">Open Lite ↗</a>
            </div>
            <iframe
              class="search-embed-iframe"
              src="${escapeHtml(ddgUrl)}"
              title="DuckDuckGo Search"
              referrerpolicy="no-referrer"
            ></iframe>
          </div>
        ` : `
          <div class="search-results-page">
            <div class="search-results-inner">
              <div class="search-query-banner">
                <span>Showing in-page DuckDuckGo results for <strong>"${escapeHtml(activeSearchQuery)}"</strong></span>
                <a href="${escapeHtml(ddgUrl)}" target="_blank" rel="noopener noreferrer">View full results on duckduckgo.com ↗</a>
              </div>

              ${loading ? `
                <div class="search-loading-card">Searching DuckDuckGo for "${escapeHtml(activeSearchQuery)}"...</div>
              ` : `
                ${ddg && (ddg.AbstractText || ddg.Answer) ? `
                  <div class="ddg-instant-card">
                    <div class="ddg-instant-head">
                      <span class="ddg-tag">DuckDuckGo Instant Answer</span>
                      ${ddg.AbstractSource ? `<span style="color:var(--text-muted);font-size:0.78rem;">Source: ${escapeHtml(ddg.AbstractSource)}</span>` : ''}
                    </div>
                    ${ddg.Heading ? `<h2>${escapeHtml(ddg.Heading)}</h2>` : ''}
                    <p>${escapeHtml(ddg.Answer || ddg.AbstractText)}</p>
                    ${ddg.AbstractURL ? `<a href="${escapeHtml(ddg.AbstractURL)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ddg.AbstractURL)} ↗</a>` : ''}
                  </div>
                ` : ''}

                ${related.length ? `
                  <div class="search-section-label">DuckDuckGo Topics</div>
                  <div class="search-cards-list">
                    ${related.slice(0, 6).map((item) => `
                      <a class="web-result-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
                        <div class="web-result-url">${escapeHtml(item.url)}</div>
                        <div class="web-result-snippet">${escapeHtml(item.text)}</div>
                      </a>
                    `).join('')}
                  </div>
                ` : ''}

                ${wiki.length ? `
                  <div class="search-section-label">Web &amp; Knowledge Results</div>
                  <div class="search-cards-list">
                    ${wiki.map((w) => {
                      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;
                      return `
                        <a class="web-result-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
                          <div class="web-result-title">${escapeHtml(w.title)}</div>
                          <div class="web-result-url">${escapeHtml(url)}</div>
                          <div class="web-result-snippet">${escapeHtml(stripTags(w.snippet))}...</div>
                        </a>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                ${!(ddg && (ddg.AbstractText || ddg.Answer)) && !related.length && !wiki.length ? `
                  <div class="ddg-instant-card" style="text-align:center;">
                    <h2 style="margin-bottom:8px;">Open Full DuckDuckGo Web Search</h2>
                    <p style="margin-bottom:14px;">No instant summary was returned for "${escapeHtml(activeSearchQuery)}". Launch the full DuckDuckGo search page directly:</p>
                    <a class="btn-primary" href="${escapeHtml(ddgUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                      Search "${escapeHtml(activeSearchQuery)}" on duckduckgo.com
                    </a>
                  </div>
                ` : ''}
              `}
            </div>
          </div>
        `}
      </div>
    `;

    document.getElementById('sv-back-btn').addEventListener('click', () => {
      activeSearchQuery = '';
      render();
    });

    document.getElementById('sv-mode-instant').addEventListener('click', () => {
      searchViewMode = 'instant';
      render();
    });

    document.getElementById('sv-mode-frame').addEventListener('click', () => {
      searchViewMode = 'frame';
      render();
    });

    document.getElementById('sv-bar-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const val = document.getElementById('sv-bar-input').value.trim();
      if (val) runDuckDuckGoSearch(val);
    });
  }

  function render() {
    const root = document.getElementById('view-home');
    if (!root) return;

    if (activeSearchQuery) {
      renderSearchViewer(root);
      return;
    }

    const state = window.Vesper.Store.get();
    const session = state.session;
    const isGuest = !session || session.mode === 'guest';
    const Icons = window.Vesper.Icons;
    const labelName = session ? (session.displayName || session.username) : 'Guest';

    root.innerHTML = `
      <div class="home-container">
        <div class="home-user-pill ${isGuest ? 'guest' : ''}">
          <span class="status-dot"></span>
          <span>${isGuest ? 'browsing as guest · chat locked' : `signed in as <strong>${escapeHtml(labelName)}</strong>`}</span>
        </div>

        <h1 class="home-brand-title">
          <span class="vesper-mark lg">${Icons.get('vesperLogo')}</span>
          <span>vesper</span>
        </h1>
        <p class="home-tagline">search duckduckgo // games · chat · themes</p>

        <div class="home-search-wrap">
          <form id="home-search-form" class="home-search-bar" autocomplete="off">
            <input
              id="home-search-input"
              type="search"
              placeholder="Search DuckDuckGo or jump to a game / channel..."
              aria-label="Search DuckDuckGo"
            />
            <button type="submit" class="home-search-go" aria-label="Search">
              ${Icons.get('arrowRight')}
            </button>
          </form>
          <div id="home-search-results" class="home-search-results hidden"></div>
        </div>

        <div class="home-shortcuts">
          <button type="button" class="shortcut-pill" data-shortcut="games">
            ${Icons.get('games')}
            <span>Games (${(window.Vesper.GamesData || []).length})</span>
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

    function updateSuggestions() {
      const q = input.value.trim();
      if (!q) {
        resultsBox.classList.add('hidden');
        resultsBox.innerHTML = '';
        currentMatches = [];
        return;
      }
      const ql = q.toLowerCase();
      const index = buildQuickIndex();
      currentMatches = index.filter((item) =>
        item.label.toLowerCase().includes(ql) || item.keywords.toLowerCase().includes(ql)
      ).slice(0, 4);

      const ddgRow = `
        <button type="button" class="search-result-item" id="ddg-dropdown-go" style="border-bottom:1px solid var(--border-subtle);margin-bottom:4px;">
          <span><strong>Search DuckDuckGo:</strong> "${escapeHtml(q)}"</span>
          <span class="search-result-meta">duckduckgo.com</span>
        </button>
      `;

      resultsBox.innerHTML = ddgRow + currentMatches.map((m, idx) => `
        <button type="button" class="search-result-item" data-match-idx="${idx}">
          <span>${escapeHtml(m.label)}</span>
          <span class="search-result-meta">${escapeHtml(m.meta)}</span>
        </button>
      `).join('');

      document.getElementById('ddg-dropdown-go').addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        runDuckDuckGoSearch(q);
      });

      resultsBox.querySelectorAll('[data-match-idx]').forEach((btn) => {
        btn.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const match = currentMatches[Number(btn.dataset.matchIdx)];
          input.value = '';
          resultsBox.classList.add('hidden');
          if (match && match.action) match.action();
        });
      });

      resultsBox.classList.remove('hidden');
    }

    input.addEventListener('input', updateSuggestions);
    input.addEventListener('blur', () => {
      setTimeout(() => resultsBox.classList.add('hidden'), 150);
    });
    input.addEventListener('focus', updateSuggestions);

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      resultsBox.classList.add('hidden');
      runDuckDuckGoSearch(q);
    });
  }

  window.Vesper.Home = { render };
})();
