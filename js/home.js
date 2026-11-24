(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let tabCounter = 1;
  let tabs = [];
  let activeTabId = null;

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

  function isLikelyUrl(raw) {
    const s = (raw || '').trim();
    if (!s || /\s/.test(s)) return false;
    if (/^https?:\/\//i.test(s)) return true;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(s);
  }

  function normalizeUrl(raw) {
    const s = (raw || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s;
  }

  function getActiveTab() {
    return tabs.find((t) => t.id === activeTabId) || null;
  }

  function createTab(initialEntry) {
    const id = 'tab_' + (tabCounter++);
    const tab = {
      id,
      history: [initialEntry],
      historyIndex: 0,
      viewMode: 'results', // 'results' | 'frame' (for search entries)
      loading: false,
      data: null,
      error: null
    };
    tabs.push(tab);
    activeTabId = id;
    return tab;
  }

  function currentEntry(tab) {
    if (!tab || !tab.history.length) return null;
    return tab.history[tab.historyIndex] || tab.history[0];
  }

  function pushEntry(tab, entry) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(entry);
    tab.historyIndex = tab.history.length - 1;
    tab.loading = false;
    tab.data = null;
    tab.error = null;
  }

  function closeTab(id) {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      if (tabs.length) {
        activeTabId = tabs[Math.max(0, idx - 1)].id;
      } else {
        activeTabId = null;
      }
    }
    render();
  }

  async function hydrateTab(tab) {
    const entry = currentEntry(tab);
    if (!entry) return;

    if (entry.type === 'search') {
      tab.loading = true;
      tab.data = null;
      tab.error = null;
      render();

      const q = entry.query;
      const encoded = encodeURIComponent(q);

      const ddgPromise = fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const wikiPromise = fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&origin=*&srlimit=8`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      try {
        const [ddg, wikiRes] = await Promise.all([ddgPromise, wikiPromise]);
        if (currentEntry(tab) !== entry) return;
        const ql = q.toLowerCase();
        const gameMatches = (window.Vesper.GamesData || [])
          .filter((g) => g.title.toLowerCase().includes(ql) || g.category.toLowerCase().includes(ql))
          .slice(0, 6);

        tab.data = {
          ddg,
          wiki: (wikiRes && wikiRes.query && wikiRes.query.search) || [],
          gameMatches
        };
        tab.loading = false;
      } catch (err) {
        if (currentEntry(tab) !== entry) return;
        tab.loading = false;
        tab.error = 'Search request failed on this connection.';
      }
      render();
    } else if (entry.type === 'wiki') {
      tab.loading = true;
      tab.data = null;
      tab.error = null;
      render();

      try {
        const titleParam = encodeURIComponent(entry.wikiTitle);
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${titleParam}`);
        const summary = res.ok ? await res.json() : null;
        if (currentEntry(tab) !== entry) return;
        tab.data = { summary };
        tab.loading = false;
      } catch (e) {
        if (currentEntry(tab) !== entry) return;
        tab.loading = false;
      }
      render();
    }
  }

  function navigateInput(rawInput, forceNewTab) {
    const clean = (rawInput || '').trim();
    if (!clean) return;

    let entry;
    if (isLikelyUrl(clean)) {
      const fullUrl = normalizeUrl(clean);
      let host = fullUrl;
      try { host = new URL(fullUrl).hostname.replace(/^www\./, ''); } catch (e) {}
      entry = { type: 'url', url: fullUrl, title: host };
    } else {
      const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(clean)}`;
      entry = { type: 'search', query: clean, url: ddgUrl, title: `${clean} at DuckDuckGo` };
    }

    let tab = !forceNewTab ? getActiveTab() : null;
    if (!tab) {
      tab = createTab(entry);
    } else {
      pushEntry(tab, entry);
    }

    if (entry.type === 'search') {
      hydrateTab(tab);
    } else {
      render();
    }
  }

  function openUrlInTab(url, title) {
    const tab = getActiveTab() || createTab({ type: 'home', url: 'vesper://home', title: 'New Tab' });
    const wikiMatch = url.match(/https?:\/\/en\.wikipedia\.org\/wiki\/(.+)$/i);
    if (wikiMatch) {
      const wikiTitle = decodeURIComponent(wikiMatch[1]).replace(/_/g, ' ');
      const entry = {
        type: 'wiki',
        url,
        wikiTitle,
        title: title || wikiTitle,
        showFrame: true
      };
      pushEntry(tab, entry);
      hydrateTab(tab);
      return;
    }

    let host = title || url;
    try { if (!title) host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
    pushEntry(tab, { type: 'url', url, title: host });
    render();
  }

  function buildQuickIndex() {
    const state = window.Vesper.Store.get();
    const isGuest = !state.session || state.session.mode === 'guest';
    const entries = [
      { label: 'Games Hub', meta: 'Page', keywords: 'games play library pack', action: () => window.Vesper.App.navigate('games') },
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

  function renderHomeLanding(container, isInsideTab) {
    const state = window.Vesper.Store.get();
    const session = state.session;
    const isGuest = !session || session.mode === 'guest';
    const Icons = window.Vesper.Icons;
    const labelName = session ? (session.displayName || session.username) : 'Guest';
    const gamesCount = (window.Vesper.GamesData || []).length;

    container.innerHTML = `
      <div class="home-container">
        <div class="home-user-pill ${isGuest ? 'guest' : ''}">
          <span class="status-dot"></span>
          <span>${isGuest ? 'browsing as guest · chat locked' : `signed in as <strong>${escapeHtml(labelName)}</strong>`}</span>
        </div>

        <h1 class="home-brand-title">
          <span class="vesper-mark lg">${Icons.get('vesperLogo')}</span>
          <span>vesper</span>
        </h1>
        <p class="home-tagline">search inside vesper // ${gamesCount ? `${gamesCount} games` : '352+ games'} · chat · themes</p>

        <div class="home-search-wrap">
          <form id="home-search-form" class="home-search-bar" autocomplete="off">
            <input
              id="home-search-input"
              type="search"
              placeholder="Search DuckDuckGo, enter a URL, or find a game..."
              aria-label="Search DuckDuckGo inside Vesper"
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
            <span>Games${gamesCount ? ` (${gamesCount})` : ''}</span>
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

    container.querySelectorAll('[data-shortcut]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.shortcut;
        if (target === 'signin') {
          window.Vesper.Auth.openGate('signin');
        } else {
          window.Vesper.App.navigate(target);
        }
      });
    });

    const input = container.querySelector('#home-search-input');
    const resultsBox = container.querySelector('#home-search-results');
    const form = container.querySelector('#home-search-form');
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

      const primaryLabel = isLikelyUrl(q)
        ? `<span><strong>Open inside Vesper:</strong> ${escapeHtml(normalizeUrl(q))}</span><span class="search-result-meta">in-site tab</span>`
        : `<span><strong>Search DuckDuckGo:</strong> "${escapeHtml(q)}"</span><span class="search-result-meta">in-site tab</span>`;

      resultsBox.innerHTML = `
        <button type="button" class="search-result-item" id="ddg-dropdown-go" style="border-bottom:1px solid var(--border-subtle);margin-bottom:4px;">
          ${primaryLabel}
        </button>
        ${currentMatches.map((m, idx) => `
          <button type="button" class="search-result-item" data-match-idx="${idx}">
            <span>${escapeHtml(m.label)}</span>
            <span class="search-result-meta">${escapeHtml(m.meta)}</span>
          </button>
        `).join('')}
      `;

      resultsBox.querySelector('#ddg-dropdown-go').addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        navigateInput(q, !isInsideTab);
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
      navigateInput(q, !isInsideTab);
    });
  }

  function renderBrowserShell(root) {
    const Icons = window.Vesper.Icons;
    const tab = getActiveTab();
    if (!tab) return;
    const entry = currentEntry(tab);
    const canBack = tab.historyIndex > 0;
    const canForward = tab.historyIndex < tab.history.length - 1;

    let bodyHtml = '';

    if (entry.type === 'home') {
      bodyHtml = `<div id="browser-home-slot" class="browser-viewport-scroll"></div>`;
    } else if (entry.type === 'url') {
      bodyHtml = `
        <div class="browser-frame-wrap">
          <iframe
            id="browser-iframe"
            class="search-embed-iframe"
            src="${escapeHtml(entry.url)}"
            title="${escapeHtml(entry.title)}"
            allow="fullscreen; autoplay"
            referrerpolicy="no-referrer"
          ></iframe>
        </div>
      `;
    } else if (entry.type === 'wiki') {
      const summary = tab.data && tab.data.summary;
      bodyHtml = `
        <div class="browser-frame-wrap">
          ${entry.showFrame ? `
            <iframe
              id="browser-iframe"
              class="search-embed-iframe"
              src="${escapeHtml(entry.url)}"
              title="${escapeHtml(entry.title)}"
              referrerpolicy="no-referrer"
            ></iframe>
          ` : `
            <div class="search-results-page">
              <div class="search-results-inner">
                <div class="ddg-instant-card">
                  <div class="ddg-instant-head">
                    <span class="ddg-tag">In-Site Reader</span>
                    <button type="button" class="btn-secondary" id="wiki-switch-frame" style="padding:5px 10px;font-size:0.76rem;">Switch to Live Page</button>
                  </div>
                  <h2>${escapeHtml((summary && summary.title) || entry.wikiTitle)}</h2>
                  <p>${escapeHtml((summary && summary.extract) || 'Loading article summary...')}</p>
                </div>
              </div>
            </div>
          `}
        </div>
      `;
    } else if (entry.type === 'search') {
      if (tab.viewMode === 'frame') {
        bodyHtml = `
          <div class="browser-frame-wrap">
            <div class="search-frame-notice">
              <span>Direct frame: <code>${escapeHtml(entry.url)}</code> — if DuckDuckGo blocks raw browser framing on this network, switch back to <strong>Results</strong>.</span>
              <button type="button" class="btn-secondary" id="switch-to-results-inline" style="padding:4px 10px;font-size:0.74rem;">Switch to Results</button>
            </div>
            <iframe
              id="browser-iframe"
              class="search-embed-iframe"
              src="${escapeHtml(entry.url)}"
              title="${escapeHtml(entry.title)}"
              referrerpolicy="no-referrer"
            ></iframe>
          </div>
        `;
      } else {
        const ddg = tab.data && tab.data.ddg;
        const wiki = (tab.data && tab.data.wiki) || [];
        const gameMatches = (tab.data && tab.data.gameMatches) || [];
        const related = [];
        if (ddg && Array.isArray(ddg.RelatedTopics)) {
          ddg.RelatedTopics.forEach((item) => {
            if (item.Text && item.FirstURL) related.push({ text: item.Text, url: item.FirstURL });
            else if (Array.isArray(item.Topics)) {
              item.Topics.forEach((sub) => {
                if (sub.Text && sub.FirstURL) related.push({ text: sub.Text, url: sub.FirstURL });
              });
            }
          });
        }

        bodyHtml = `
          <div class="search-results-page">
            <div class="search-results-inner">
              <div class="search-query-banner">
                <span>In-site DuckDuckGo results for <strong>"${escapeHtml(entry.query)}"</strong></span>
                <span style="font-size:0.76rem;color:var(--text-muted);">Everything opens inside this Vesper tab</span>
              </div>

              ${tab.loading ? `
                <div class="search-loading-card">Searching DuckDuckGo for "${escapeHtml(entry.query)}"...</div>
              ` : `
                ${gameMatches.length ? `
                  <div class="search-section-label">Matching Games in Vesper (${gameMatches.length})</div>
                  <div class="search-games-strip">
                    ${gameMatches.map((g) => `
                      <button type="button" class="shortcut-pill" data-launch-game="${escapeHtml(g.id)}">
                        ${Icons.get('games')}
                        <span>${escapeHtml(g.title)}</span>
                      </button>
                    `).join('')}
                  </div>
                ` : ''}

                ${ddg && (ddg.AbstractText || ddg.Answer) ? `
                  <div class="ddg-instant-card">
                    <div class="ddg-instant-head">
                      <span class="ddg-tag">DuckDuckGo Instant Answer</span>
                      ${ddg.AbstractSource ? `<span style="color:var(--text-muted);font-size:0.78rem;">${escapeHtml(ddg.AbstractSource)}</span>` : ''}
                    </div>
                    ${ddg.Heading ? `<h2>${escapeHtml(ddg.Heading)}</h2>` : ''}
                    <p>${escapeHtml(ddg.Answer || ddg.AbstractText)}</p>
                    ${ddg.AbstractURL ? `
                      <button type="button" class="btn-secondary" data-open-in-tab="${escapeHtml(ddg.AbstractURL)}" data-open-title="${escapeHtml(ddg.Heading || ddg.AbstractSource || 'Article')}" style="padding:7px 12px;font-size:0.8rem;">
                        Read inside Vesper →
                      </button>
                    ` : ''}
                  </div>
                ` : ''}

                ${related.length ? `
                  <div class="search-section-label">DuckDuckGo Topics</div>
                  <div class="search-cards-list">
                    ${related.slice(0, 6).map((item) => `
                      <button type="button" class="web-result-card" data-open-in-tab="${escapeHtml(item.url)}" data-open-title="${escapeHtml(item.text.slice(0, 36))}" style="width:100%;text-align:left;">
                        <div class="web-result-url">${escapeHtml(item.url)}</div>
                        <div class="web-result-snippet">${escapeHtml(item.text)}</div>
                      </button>
                    `).join('')}
                  </div>
                ` : ''}

                ${wiki.length ? `
                  <div class="search-section-label">Web &amp; Knowledge Results</div>
                  <div class="search-cards-list">
                    ${wiki.map((w) => {
                      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;
                      return `
                        <button type="button" class="web-result-card" data-open-in-tab="${escapeHtml(url)}" data-open-title="${escapeHtml(w.title)}" style="width:100%;text-align:left;">
                          <div class="web-result-title">${escapeHtml(w.title)}</div>
                          <div class="web-result-url">${escapeHtml(url)}</div>
                          <div class="web-result-snippet">${escapeHtml(stripTags(w.snippet))}...</div>
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                ${!(ddg && (ddg.AbstractText || ddg.Answer)) && !related.length && !wiki.length && !gameMatches.length ? `
                  <div class="ddg-instant-card" style="text-align:center;">
                    <h2 style="margin-bottom:8px;">No Instant Results for "${escapeHtml(entry.query)}"</h2>
                    <p style="margin-bottom:14px;">Try refining your search or toggle <strong>Frame</strong> mode in the top toolbar to attempt loading DuckDuckGo directly.</p>
                    <button type="button" class="btn-primary" id="empty-switch-frame">Try Frame View</button>
                  </div>
                ` : ''}
              `}
            </div>
          </div>
        `;
      }
    }

    root.innerHTML = `
      <div class="vesper-browser-shell">
        <!-- Top Tab Strip (Matches Screenshot Browser Style) -->
        <div class="vb-tabstrip" role="tablist">
          ${tabs.map((t) => {
            const ent = currentEntry(t);
            const active = t.id === activeTabId;
            return `
              <div class="vb-tab ${active ? 'active' : ''}" data-select-tab="${escapeHtml(t.id)}" role="tab" aria-selected="${active}">
                <span class="vb-tab-dot"></span>
                <span class="vb-tab-title">${escapeHtml(ent ? ent.title : 'Tab')}</span>
                <button type="button" class="vb-tab-close" data-close-tab="${escapeHtml(t.id)}" title="Close Tab" aria-label="Close tab">${Icons.get('x')}</button>
              </div>
            `;
          }).join('')}
          <button type="button" class="vb-new-tab-btn" id="vb-new-tab" title="New In-Site Tab" aria-label="New Tab">${Icons.get('plus')}</button>
        </div>

        <!-- Browser Navigation & Address Bar -->
        <div class="vb-navbar">
          <div class="vb-nav-btns">
            <button type="button" class="icon-btn vb-nav-btn" id="vb-back" ${canBack ? '' : 'disabled'} title="Back">${Icons.get('arrowLeft')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-forward" ${canForward ? '' : 'disabled'} title="Forward">${Icons.get('arrowRight')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-reload" title="Reload">${Icons.get('refresh')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-home" title="Vesper Home">${Icons.get('home')}</button>
          </div>

          <form id="vb-address-form" class="vb-address-form">
            <input
              id="vb-address-input"
              type="text"
              value="${escapeHtml(entry.url || 'vesper://home')}"
              placeholder="Search DuckDuckGo or enter URL..."
              aria-label="Address bar"
            />
          </form>

          ${entry.type === 'search' ? `
            <div class="sv-mode-group">
              <button type="button" class="sv-mode-btn ${tab.viewMode === 'results' ? 'active' : ''}" id="vb-mode-results">Results</button>
              <button type="button" class="sv-mode-btn ${tab.viewMode === 'frame' ? 'active' : ''}" id="vb-mode-frame">Frame</button>
            </div>
          ` : ''}
        </div>

        <!-- In-Site Viewport -->
        <div class="vb-viewport">
          ${bodyHtml}
        </div>
      </div>
    `;

    // If this tab is a "New Tab" home landing, mount landing inside viewport
    const homeSlot = document.getElementById('browser-home-slot');
    if (homeSlot) {
      renderHomeLanding(homeSlot, true);
    }

    // Bind Tab Strip
    root.querySelectorAll('[data-select-tab]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-close-tab]')) return;
        activeTabId = el.dataset.selectTab;
        render();
      });
    });

    root.querySelectorAll('[data-close-tab]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeTab(btn.dataset.closeTab);
      });
    });

    document.getElementById('vb-new-tab').addEventListener('click', () => {
      createTab({ type: 'home', url: 'vesper://home', title: 'New Tab' });
      render();
    });

    // Bind Navigation Controls
    document.getElementById('vb-back').addEventListener('click', () => {
      if (tab.historyIndex > 0) {
        tab.historyIndex--;
        const ent = currentEntry(tab);
        if (ent.type === 'search' || ent.type === 'wiki') hydrateTab(tab);
        else render();
      }
    });

    document.getElementById('vb-forward').addEventListener('click', () => {
      if (tab.historyIndex < tab.history.length - 1) {
        tab.historyIndex++;
        const ent = currentEntry(tab);
        if (ent.type === 'search' || ent.type === 'wiki') hydrateTab(tab);
        else render();
      }
    });

    document.getElementById('vb-reload').addEventListener('click', () => {
      const iframe = document.getElementById('browser-iframe');
      if (iframe) {
        iframe.src = iframe.src;
      } else {
        hydrateTab(tab);
      }
    });

    document.getElementById('vb-home').addEventListener('click', () => {
      tabs = [];
      activeTabId = null;
      render();
    });

    document.getElementById('vb-address-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const val = document.getElementById('vb-address-input').value.trim();
      if (!val || val === 'vesper://home') {
        pushEntry(tab, { type: 'home', url: 'vesper://home', title: 'New Tab' });
        render();
        return;
      }
      navigateInput(val, false);
    });

    const modeRes = document.getElementById('vb-mode-results');
    if (modeRes) modeRes.addEventListener('click', () => { tab.viewMode = 'results'; render(); });

    const modeFrm = document.getElementById('vb-mode-frame');
    if (modeFrm) modeFrm.addEventListener('click', () => { tab.viewMode = 'frame'; render(); });

    const swResInline = document.getElementById('switch-to-results-inline');
    if (swResInline) swResInline.addEventListener('click', () => { tab.viewMode = 'results'; render(); });

    const emptySwFrame = document.getElementById('empty-switch-frame');
    if (emptySwFrame) emptySwFrame.addEventListener('click', () => { tab.viewMode = 'frame'; render(); });

    const wikiSwFrame = document.getElementById('wiki-switch-frame');
    if (wikiSwFrame) wikiSwFrame.addEventListener('click', () => { entry.showFrame = true; render(); });

    // Bind in-site result clicks (NO external browser tabs!)
    root.querySelectorAll('[data-open-in-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openUrlInTab(btn.dataset.openInTab, btn.dataset.openTitle);
      });
    });

    root.querySelectorAll('[data-launch-game]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.Vesper.App.navigate('games');
        window.Vesper.Games.launchById(btn.dataset.launchGame);
      });
    });
  }

  function render() {
    const root = document.getElementById('view-home');
    if (!root) return;

    if (tabs.length > 0 && getActiveTab()) {
      renderBrowserShell(root);
      return;
    }

    renderHomeLanding(root, false);
  }

  window.Vesper.Home = { render };
})();
