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

  function getActiveTab() {
    return tabs.find((t) => t.id === activeTabId) || null;
  }

  function currentEntry(tab) {
    if (!tab || !tab.history.length) return null;
    return tab.history[tab.historyIndex] || tab.history[0];
  }

  function createTab(initialEntry) {
    const id = 'tab_' + (tabCounter++);
    const tab = {
      id,
      history: [initialEntry],
      historyIndex: 0,
      mode: 'uv', // 'uv' | 'reader'
      loading: false,
      proxiedSrc: '',
      uvError: null,
      readerData: null
    };
    tabs.push(tab);
    activeTabId = id;
    return tab;
  }

  function pushEntry(tab, entry) {
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(entry);
    tab.historyIndex = tab.history.length - 1;
    tab.loading = false;
    tab.proxiedSrc = '';
    tab.uvError = null;
    tab.readerData = null;
  }

  function closeTab(id) {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      activeTabId = tabs.length ? tabs[Math.max(0, idx - 1)].id : null;
    }
    render();
  }

  async function loadReaderFallback(tab, entry) {
    const query = entry.query || entry.title || entry.url;
    const encoded = encodeURIComponent(query);
    tab.loading = true;
    tab.readerData = null;
    render();

    const ddgPromise = fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const wikiPromise = fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json&origin=*&srlimit=8`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    try {
      const [ddg, wikiRes] = await Promise.all([ddgPromise, wikiPromise]);
      if (currentEntry(tab) !== entry) return;
      const ql = query.toLowerCase();
      const gameMatches = (window.Vesper.GamesData || [])
        .filter((g) => g.title.toLowerCase().includes(ql) || g.category.toLowerCase().includes(ql))
        .slice(0, 6);
      tab.readerData = {
        ddg,
        wiki: (wikiRes && wikiRes.query && wikiRes.query.search) || [],
        gameMatches
      };
    } catch (e) {
      if (currentEntry(tab) !== entry) return;
      tab.readerData = { ddg: null, wiki: [], gameMatches: [] };
    }
    tab.loading = false;
    render();
  }

  async function loadTabEntry(tab) {
    const entry = currentEntry(tab);
    if (!entry || entry.type === 'home') {
      render();
      return;
    }

    if (tab.mode === 'reader') {
      await loadReaderFallback(tab, entry);
      return;
    }

    tab.loading = true;
    tab.uvError = null;
    tab.proxiedSrc = '';
    render();

    try {
      const proxied = await window.Vesper.Proxy.buildProxiedUrl(entry.url);
      if (currentEntry(tab) !== entry) return;
      tab.proxiedSrc = proxied;
      tab.loading = false;
      tab.uvError = null;
    } catch (err) {
      if (currentEntry(tab) !== entry) return;
      tab.loading = false;
      tab.proxiedSrc = '';
      tab.uvError = (err && err.message) ? err.message : 'Ultraviolet could not connect to the Wisp relay.';
    }
    render();
  }

  function navigateInput(rawInput, forceNewTab) {
    const clean = (rawInput || '').trim();
    if (!clean) return;

    const Proxy = window.Vesper.Proxy;
    const engine = Proxy.getSearchEngine();
    const isUrl = Proxy.isLikelyUrl(clean);
    const targetUrl = Proxy.normalizeTargetUrl(clean);

    let title = clean;
    if (isUrl) {
      try { title = new URL(targetUrl).hostname.replace(/^www\./, ''); } catch (e) {}
    } else {
      title = `${clean} · ${engine.short}`;
    }

    const entry = {
      type: 'web',
      url: targetUrl,
      query: isUrl ? '' : clean,
      title
    };

    let tab = !forceNewTab ? getActiveTab() : null;
    if (!tab) {
      tab = createTab(entry);
    } else {
      pushEntry(tab, entry);
    }

    loadTabEntry(tab);
  }

  function buildQuickIndex() {
    const state = window.Vesper.Store.get();
    const isGuest = !state.session || state.session.mode === 'guest';
    const entries = [
      { label: 'Games Hub', meta: 'Page', keywords: 'games play library pack', action: () => window.Vesper.App.navigate('games') },
      { label: 'Vesper Chat', meta: isGuest ? 'Locked (Guest)' : 'Page', keywords: 'chat discord servers dm messages', action: () => window.Vesper.App.navigate('chat') },
      { label: 'Tab Cloak & Themes', meta: 'Settings', keywords: 'cloak tab classroom canvas theme colors wisp proxy', action: () => window.Vesper.App.navigate('settings') }
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
    const Proxy = window.Vesper.Proxy;
    const engine = Proxy.getSearchEngine();
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
        <p class="home-tagline">ultraviolet browser (${escapeHtml(engine.short.toLowerCase())}) // ${gamesCount ? `${gamesCount} games` : '352+ games'} · chat · cloak</p>

        <div class="home-search-wrap">
          <form id="home-search-form" class="home-search-bar" autocomplete="off">
            <select id="home-engine-select" class="engine-pill-select" title="Choose Search Engine" aria-label="Search Engine">
              ${Proxy.SEARCH_ENGINES.map((eng) => `
                <option value="${escapeHtml(eng.id)}" ${eng.id === engine.id ? 'selected' : ''}>${escapeHtml(eng.short)}</option>
              `).join('')}
            </select>
            <input
              id="home-search-input"
              type="search"
              placeholder="Search ${escapeHtml(engine.name)} or enter any URL..."
              aria-label="Search web inside Vesper"
            />
            <button type="submit" class="home-search-go" aria-label="Search">
              ${Icons.get('arrowRight')}
            </button>
          </form>
          <div id="home-search-results" class="home-search-results hidden"></div>
        </div>

        <div class="home-shortcuts">
          <button type="button" class="shortcut-pill" data-quick-url="${escapeHtml(engine.home)}">
            <span class="engine-dot" style="background:${escapeHtml(engine.color)};"></span>
            <span>${escapeHtml(engine.short)}</span>
          </button>
          <button type="button" class="shortcut-pill" data-quick-url="https://www.youtube.com/">
            ${Icons.get('compass')}
            <span>YouTube</span>
          </button>
          <button type="button" class="shortcut-pill" data-quick-url="https://en.wikipedia.org/">
            ${Icons.get('home')}
            <span>Wikipedia</span>
          </button>
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
            <span>Cloak &amp; Themes</span>
          </button>
        </div>
      </div>
    `;

    // Engine picker updates stored preference immediately
    const engSelect = container.querySelector('#home-engine-select');
    if (engSelect) {
      engSelect.addEventListener('change', (ev) => {
        const nextId = ev.target.value;
        window.Vesper.Store.update((s) => {
          s.settings.searchEngine = nextId;
        }, 'settings');
        render();
      });
    }

    container.querySelectorAll('[data-quick-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigateInput(btn.dataset.quickUrl, !isInsideTab);
      });
    });

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
      const curEng = Proxy.getSearchEngine();
      const index = buildQuickIndex();
      currentMatches = index.filter((item) =>
        item.label.toLowerCase().includes(ql) || item.keywords.toLowerCase().includes(ql)
      ).slice(0, 4);

      const primaryLabel = Proxy.isLikelyUrl(q)
        ? `<span><strong>Open via Ultraviolet:</strong> ${escapeHtml(Proxy.normalizeTargetUrl(q))}</span><span class="search-result-meta">in-site tab</span>`
        : `<span><strong>Search ${escapeHtml(curEng.short)}:</strong> "${escapeHtml(q)}"</span><span class="search-result-meta">ultraviolet</span>`;

      resultsBox.innerHTML = `
        <button type="button" class="search-result-item" id="uv-dropdown-go" style="border-bottom:1px solid var(--border-subtle);margin-bottom:4px;">
          ${primaryLabel}
        </button>
        ${currentMatches.map((m, idx) => `
          <button type="button" class="search-result-item" data-match-idx="${idx}">
            <span>${escapeHtml(m.label)}</span>
            <span class="search-result-meta">${escapeHtml(m.meta)}</span>
          </button>
        `).join('')}
      `;

      resultsBox.querySelector('#uv-dropdown-go').addEventListener('mousedown', (ev) => {
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

  function renderReaderHtml(tab, entry) {
    const Icons = window.Vesper.Icons;
    const data = tab.readerData || { ddg: null, wiki: [], gameMatches: [] };
    const ddg = data.ddg;
    const wiki = data.wiki || [];
    const gameMatches = data.gameMatches || [];
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

    return `
      <div class="search-results-page">
        <div class="search-results-inner">
          <div class="search-query-banner">
            <span>Reader mode results for <strong>"${escapeHtml(entry.query || entry.url)}"</strong></span>
            <button type="button" class="btn-secondary" id="reader-try-uv" style="padding:5px 10px;font-size:0.75rem;">Switch to Ultraviolet Proxy</button>
          </div>

          ${tab.loading ? `
            <div class="search-loading-card">Fetching Reader results...</div>
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
                  <span class="ddg-tag">Instant Summary</span>
                  ${ddg.AbstractSource ? `<span style="color:var(--text-muted);font-size:0.78rem;">${escapeHtml(ddg.AbstractSource)}</span>` : ''}
                </div>
                ${ddg.Heading ? `<h2>${escapeHtml(ddg.Heading)}</h2>` : ''}
                <p>${escapeHtml(ddg.Answer || ddg.AbstractText)}</p>
                ${ddg.AbstractURL ? `
                  <button type="button" class="btn-secondary" data-open-uv="${escapeHtml(ddg.AbstractURL)}" style="padding:7px 12px;font-size:0.8rem;">
                    Open via Ultraviolet →
                  </button>
                ` : ''}
              </div>
            ` : ''}

            ${related.length ? `
              <div class="search-section-label">Related Topics</div>
              <div class="search-cards-list">
                ${related.slice(0, 6).map((item) => `
                  <button type="button" class="web-result-card" data-open-uv="${escapeHtml(item.url)}" style="width:100%;text-align:left;">
                    <div class="web-result-url">${escapeHtml(item.url)}</div>
                    <div class="web-result-snippet">${escapeHtml(item.text)}</div>
                  </button>
                `).join('')}
              </div>
            ` : ''}

            ${wiki.length ? `
              <div class="search-section-label">Knowledge Results</div>
              <div class="search-cards-list">
                ${wiki.map((w) => {
                  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;
                  return `
                    <button type="button" class="web-result-card" data-open-uv="${escapeHtml(url)}" style="width:100%;text-align:left;">
                      <div class="web-result-title">${escapeHtml(w.title)}</div>
                      <div class="web-result-url">${escapeHtml(url)}</div>
                      <div class="web-result-snippet">${escapeHtml(stripTags(w.snippet))}...</div>
                    </button>
                  `;
                }).join('')}
              </div>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }

  function renderBrowserShell(root) {
    const Icons = window.Vesper.Icons;
    const Proxy = window.Vesper.Proxy;
    const engine = Proxy.getSearchEngine();
    const uvStat = Proxy.getStatus();
    const tab = getActiveTab();
    if (!tab) return;
    const entry = currentEntry(tab);
    const canBack = tab.historyIndex > 0;
    const canForward = tab.historyIndex < tab.history.length - 1;

    let bodyHtml = '';

    if (entry.type === 'home') {
      bodyHtml = `<div id="browser-home-slot" class="browser-viewport-scroll"></div>`;
    } else if (tab.mode === 'reader') {
      bodyHtml = renderReaderHtml(tab, entry);
    } else if (tab.loading) {
      bodyHtml = `
        <div class="game-loader-overlay">
          <div class="game-loader-card">
            <div class="games-empty-icon" style="margin:0 auto 14px;">${Icons.get('compass')}</div>
            <h3>Connecting via Ultraviolet</h3>
            <p>${escapeHtml(uvStat.message || 'Booting Ultraviolet Service Worker & Wisp transport...')}</p>
            <div class="gp-progress-track">
              <div class="gp-progress-fill" style="width:65%;"></div>
            </div>
          </div>
        </div>
      `;
    } else if (tab.uvError) {
      bodyHtml = `
        <div class="game-loader-overlay">
          <div class="game-loader-card" style="max-width:460px;">
            <h3 style="color:#fca5a5;">Ultraviolet Proxy Issue</h3>
            <p>${escapeHtml(tab.uvError)}</p>
            <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;">
              Make sure you are visiting Vesper over <strong>HTTPS (GitHub Pages)</strong> and have a working <strong>Wisp Relay (wss://...)</strong> set in Settings.
            </p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
              <button type="button" class="btn-primary" id="uv-err-retry">Retry UV</button>
              <button type="button" class="btn-secondary" id="uv-err-settings">Wisp Settings</button>
              <button type="button" class="btn-secondary" id="uv-err-reader">Use Reader Mode</button>
            </div>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="browser-frame-wrap">
          <iframe
            id="browser-iframe"
            class="search-embed-iframe"
            src="${escapeHtml(tab.proxiedSrc)}"
            title="${escapeHtml(entry.title)}"
            allow="fullscreen; autoplay; clipboard-read; clipboard-write; gamepad"
            allowfullscreen
          ></iframe>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="vesper-browser-shell">
        <!-- Top Tab Strip -->
        <div class="vb-tabstrip" role="tablist">
          ${tabs.map((t) => {
            const ent = currentEntry(t);
            const active = t.id === activeTabId;
            return `
              <div class="vb-tab ${active ? 'active' : ''}" data-select-tab="${escapeHtml(t.id)}" role="tab" aria-selected="${active}">
                <span class="vb-tab-dot ${uvStat.state === 'ready' ? 'live' : ''}"></span>
                <span class="vb-tab-title">${escapeHtml(ent ? ent.title : 'New Tab')}</span>
                <button type="button" class="vb-tab-close" data-close-tab="${escapeHtml(t.id)}" title="Close Tab" aria-label="Close tab">${Icons.get('x')}</button>
              </div>
            `;
          }).join('')}
          <button type="button" class="vb-new-tab-btn" id="vb-new-tab" title="New In-Site Tab" aria-label="New Tab">${Icons.get('plus')}</button>
        </div>

        <!-- Browser Navigation, Engine Picker & Address Bar -->
        <div class="vb-navbar">
          <div class="vb-nav-btns">
            <button type="button" class="icon-btn vb-nav-btn" id="vb-back" ${canBack ? '' : 'disabled'} title="Back">${Icons.get('arrowLeft')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-forward" ${canForward ? '' : 'disabled'} title="Forward">${Icons.get('arrowRight')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-reload" title="Reload">${Icons.get('refresh')}</button>
            <button type="button" class="icon-btn vb-nav-btn" id="vb-home" title="Vesper Home">${Icons.get('home')}</button>
          </div>

          <select id="vb-engine-select" class="vb-engine-select" title="Search Engine" aria-label="Search Engine">
            ${Proxy.SEARCH_ENGINES.map((eng) => `
              <option value="${escapeHtml(eng.id)}" ${eng.id === engine.id ? 'selected' : ''}>${escapeHtml(eng.short)}</option>
            `).join('')}
          </select>

          <form id="vb-address-form" class="vb-address-form">
            <input
              id="vb-address-input"
              type="text"
              value="${escapeHtml(entry.url || 'vesper://home')}"
              placeholder="Search ${escapeHtml(engine.name)} or enter URL..."
              aria-label="Address bar"
            />
          </form>

          <div class="sv-mode-group" title="Switch between Ultraviolet Proxy & lightweight Reader mode">
            <button type="button" class="sv-mode-btn ${tab.mode === 'uv' ? 'active' : ''}" id="vb-mode-uv">UV</button>
            <button type="button" class="sv-mode-btn ${tab.mode === 'reader' ? 'active' : ''}" id="vb-mode-reader">Reader</button>
          </div>
        </div>

        <!-- In-Site Viewport -->
        <div class="vb-viewport">
          ${bodyHtml}
        </div>
      </div>
    `;

    // Mount home landing if this tab is on vesper://home
    const homeSlot = document.getElementById('browser-home-slot');
    if (homeSlot) {
      renderHomeLanding(homeSlot, true);
    }

    // Track iframe navigation inside UV so the address bar updates when clicking links
    const iframe = document.getElementById('browser-iframe');
    if (iframe) {
      iframe.addEventListener('load', () => {
        try {
          const href = iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href;
          const decoded = Proxy.decodeProxiedHref(href);
          if (decoded && decoded !== entry.url) {
            entry.url = decoded;
            const addr = document.getElementById('vb-address-input');
            if (addr && document.activeElement !== addr) addr.value = decoded;
            try {
              const docTitle = iframe.contentDocument && iframe.contentDocument.title;
              if (docTitle) entry.title = docTitle;
            } catch (e) {}
          }
        } catch (e) {}
      });
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

    // Engine switcher in browser navbar
    document.getElementById('vb-engine-select').addEventListener('change', (ev) => {
      const nextId = ev.target.value;
      window.Vesper.Store.update((s) => {
        s.settings.searchEngine = nextId;
      }, 'settings');
      window.Vesper.App.toast(`Search engine switched to ${Proxy.getSearchEngine(nextId).name}`);
      render();
    });

    // Navigation controls
    document.getElementById('vb-back').addEventListener('click', () => {
      if (tab.historyIndex > 0) {
        tab.historyIndex--;
        loadTabEntry(tab);
      }
    });

    document.getElementById('vb-forward').addEventListener('click', () => {
      if (tab.historyIndex < tab.history.length - 1) {
        tab.historyIndex++;
        loadTabEntry(tab);
      }
    });

    document.getElementById('vb-reload').addEventListener('click', () => {
      const frame = document.getElementById('browser-iframe');
      if (frame && frame.src) {
        frame.src = frame.src;
      } else {
        loadTabEntry(tab);
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

    document.getElementById('vb-mode-uv').addEventListener('click', () => {
      tab.mode = 'uv';
      loadTabEntry(tab);
    });

    document.getElementById('vb-mode-reader').addEventListener('click', () => {
      tab.mode = 'reader';
      loadTabEntry(tab);
    });

    const retryUv = document.getElementById('uv-err-retry');
    if (retryUv) retryUv.addEventListener('click', () => loadTabEntry(tab));

    const openWispSettings = document.getElementById('uv-err-settings');
    if (openWispSettings) openWispSettings.addEventListener('click', () => window.Vesper.App.navigate('settings'));

    const errReader = document.getElementById('uv-err-reader');
    if (errReader) errReader.addEventListener('click', () => { tab.mode = 'reader'; loadTabEntry(tab); });

    const readerTryUv = document.getElementById('reader-try-uv');
    if (readerTryUv) readerTryUv.addEventListener('click', () => { tab.mode = 'uv'; loadTabEntry(tab); });

    root.querySelectorAll('[data-open-uv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab.mode = 'uv';
        navigateInput(btn.dataset.openUv, false);
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
