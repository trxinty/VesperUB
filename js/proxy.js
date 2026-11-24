(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  const SEARCH_ENGINES = [
    {
      id: 'brave',
      name: 'Brave Search',
      short: 'Brave',
      template: 'https://search.brave.com/search?q=%s',
      home: 'https://search.brave.com/',
      color: '#fb542b'
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      short: 'DuckDuckGo',
      template: 'https://duckduckgo.com/?q=%s',
      home: 'https://duckduckgo.com/',
      color: '#de5833'
    },
    {
      id: 'google',
      name: 'Google',
      short: 'Google',
      template: 'https://www.google.com/search?q=%s',
      home: 'https://www.google.com/',
      color: '#4285f4'
    },
    {
      id: 'startpage',
      name: 'Startpage',
      short: 'Startpage',
      template: 'https://www.startpage.com/do/dsearch?query=%s',
      home: 'https://www.startpage.com/',
      color: '#6573ff'
    },
    {
      id: 'bing',
      name: 'Bing',
      short: 'Bing',
      template: 'https://www.bing.com/search?q=%s',
      home: 'https://www.bing.com/',
      color: '#008373'
    },
    {
      id: 'ecosia',
      name: 'Ecosia',
      short: 'Ecosia',
      template: 'https://www.ecosia.org/search?q=%s',
      home: 'https://www.ecosia.org/',
      color: '#36a853'
    }
  ];

  const WISP_PRESETS = [
    { label: 'Mercury Workshop Wisp', url: 'wss://wisp.mercurywork.shop/' },
    { label: 'Anura Public Wisp', url: 'wss://anura.pro/' }
  ];

  const TRANSPORT_URLS = {
    epoxy: 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/epoxy-transport@2.1.27/dist/index.mjs',
    libcurl: 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/libcurl-transport@1.3.10/dist/index.mjs'
  };

  const BAREMUX_CDN = 'https://cdn.jsdelivr.net/npm/@mercuryworkshop/bare-mux@2.1.7/dist/index.js';
  const UV_BUNDLE_CDN = 'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.10/dist/uv.bundle.js';

  let uvStatus = {
    state: 'idle', // 'idle' | 'initializing' | 'ready' | 'error'
    message: 'Ultraviolet idle',
    wispUrl: '',
    transport: 'epoxy'
  };

  let initPromise = null;
  let bareMuxConnection = null;
  const statusListeners = new Set();

  function setStatus(patch) {
    uvStatus = Object.assign({}, uvStatus, patch);
    statusListeners.forEach((fn) => {
      try { fn(uvStatus); } catch (e) {}
    });
  }

  function onStatus(fn) {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  }

  function getBasePath() {
    const p = window.location.pathname || '/';
    if (p.endsWith('/')) {
      const t = p.slice(0, -1);
      return t === '/' ? '' : t;
    }
    const lastSeg = p.split('/').pop() || '';
    if (lastSeg.includes('.')) {
      const d = p.replace(/\/[^/]*$/, '');
      return d === '/' ? '' : d;
    }
    return p === '/' ? '' : p;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-vesper-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load ' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.vesperSrc = src;
      s.onload = () => {
        s.dataset.loaded = 'true';
        resolve();
      };
      s.onerror = () => reject(new Error('Failed to load script: ' + src));
      document.head.appendChild(s);
    });
  }

  function getSearchEngine(engineId) {
    const id = engineId || (window.Vesper.Store.get().settings && window.Vesper.Store.get().settings.searchEngine) || 'brave';
    return SEARCH_ENGINES.find((e) => e.id === id) || SEARCH_ENGINES[0];
  }

  function buildSearchUrl(query, engineId) {
    const s = window.Vesper.Store.get().settings || {};
    const id = engineId || s.searchEngine || 'brave';
    if (id === 'custom' && s.customSearchUrl && s.customSearchUrl.includes('%s')) {
      return s.customSearchUrl.replace('%s', encodeURIComponent(query));
    }
    const engine = getSearchEngine(id);
    return engine.template.replace('%s', encodeURIComponent(query));
  }

  function isLikelyUrl(raw) {
    const s = (raw || '').trim();
    if (!s || /\s/.test(s)) return false;
    if (/^https?:\/\//i.test(s)) return true;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(s);
  }

  function normalizeTargetUrl(raw, engineId) {
    const clean = (raw || '').trim();
    if (!clean) return getSearchEngine(engineId).home;
    if (isLikelyUrl(clean)) {
      return /^https?:\/\//i.test(clean) ? clean : 'https://' + clean;
    }
    return buildSearchUrl(clean, engineId);
  }

  function waitForWorkerActive(reg) {
    return new Promise((resolve, reject) => {
      if (reg.active && reg.active.state === 'activated') {
        return resolve(reg);
      }
      const worker = reg.installing || reg.waiting || reg.active;
      if (!worker) return resolve(reg);
      const timer = setTimeout(() => resolve(reg), 6000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          clearTimeout(timer);
          resolve(reg);
        } else if (worker.state === 'redundant') {
          clearTimeout(timer);
          reject(new Error('Ultraviolet Service Worker became redundant.'));
        }
      });
    });
  }

  function testWispEndpoint(wispUrl) {
    return new Promise((resolve) => {
      if (!wispUrl || !/^wss?:\/\//i.test(wispUrl)) {
        return resolve({ ok: false, reason: 'URL must start with wss:// or ws://' });
      }
      let settled = false;
      let ws = null;
      const done = (res) => {
        if (settled) return;
        settled = true;
        try { if (ws) ws.close(); } catch (e) {}
        resolve(res);
      };
      const t = setTimeout(() => done({ ok: false, reason: 'Connection timed out (4s)' }), 4000);
      try {
        ws = new WebSocket(wispUrl);
        ws.onopen = () => {
          clearTimeout(t);
          done({ ok: true, reason: 'Connected to Wisp relay' });
        };
        ws.onerror = () => {
          clearTimeout(t);
          done({ ok: false, reason: 'Relay refused connection or blocked on network' });
        };
      } catch (err) {
        clearTimeout(t);
        done({ ok: false, reason: err.message || 'WebSocket error' });
      }
    });
  }

  async function ensureUltraviolet(forceReconfigure) {
    const settings = window.Vesper.Store.get().settings || {};
    const wispUrl = (settings.wispUrl || WISP_PRESETS[0].url).trim();
    const transportName = settings.proxyTransport || 'epoxy';
    const transportUrl = TRANSPORT_URLS[transportName] || TRANSPORT_URLS.epoxy;

    if (!forceReconfigure && uvStatus.state === 'ready' && uvStatus.wispUrl === wispUrl && uvStatus.transport === transportName) {
      return uvStatus;
    }

    if (initPromise && !forceReconfigure) {
      return initPromise;
    }

    initPromise = (async () => {
      try {
        if (!('serviceWorker' in navigator)) {
          throw new Error('Service Workers are unavailable in this browser.');
        }
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          throw new Error('Ultraviolet requires HTTPS (GitHub Pages) or localhost — file:// cannot register Service Workers.');
        }

        setStatus({ state: 'initializing', message: 'Loading Ultraviolet + BareMux...', wispUrl, transport: transportName });

        const basePath = getBasePath();
        await loadScriptOnce(BAREMUX_CDN);
        await loadScriptOnce(UV_BUNDLE_CDN);
        await loadScriptOnce(basePath + '/uv/uv.config.js');

        if (!window.__uv$config || !window.BareMux) {
          throw new Error('Ultraviolet or BareMux scripts failed to initialize.');
        }

        setStatus({ state: 'initializing', message: 'Registering Ultraviolet Service Worker...', wispUrl, transport: transportName });

        const swUrl = basePath + '/sw.js';
        const swScope = window.__uv$config.prefix;
        const reg = await navigator.serviceWorker.register(swUrl, { scope: swScope });
        await waitForWorkerActive(reg);

        setStatus({ state: 'initializing', message: `Connecting ${transportName} transport to Wisp...`, wispUrl, transport: transportName });

        if (!bareMuxConnection) {
          bareMuxConnection = new window.BareMux.BareMuxConnection(basePath + '/uv/baremux-worker.js');
        }
        await bareMuxConnection.setTransport(transportUrl, [{ wisp: wispUrl }]);

        setStatus({
          state: 'ready',
          message: `Ultraviolet ready (${transportName} · ${wispUrl})`,
          wispUrl,
          transport: transportName
        });
        return uvStatus;
      } catch (err) {
        const msg = (err && err.message) ? err.message : 'Ultraviolet initialization failed.';
        setStatus({ state: 'error', message: msg, wispUrl, transport: transportName });
        throw err;
      } finally {
        initPromise = null;
      }
    })();

    return initPromise;
  }

  async function buildProxiedUrl(targetUrl) {
    await ensureUltraviolet(false);
    if (!window.__uv$config) {
      throw new Error('Ultraviolet config not loaded.');
    }
    return window.__uv$config.prefix + window.__uv$config.encodeUrl(targetUrl);
  }

  function decodeProxiedHref(href) {
    try {
      if (!window.__uv$config || !href) return null;
      const u = new URL(href);
      const prefix = window.__uv$config.prefix;
      if (u.pathname.startsWith(prefix)) {
        const encoded = u.pathname.slice(prefix.length);
        return window.__uv$config.decodeUrl(encoded);
      }
    } catch (e) {}
    return null;
  }

  window.Vesper.Proxy = {
    SEARCH_ENGINES,
    WISP_PRESETS,
    TRANSPORT_URLS,
    getSearchEngine,
    buildSearchUrl,
    isLikelyUrl,
    normalizeTargetUrl,
    ensureUltraviolet,
    buildProxiedUrl,
    decodeProxiedHref,
    testWispEndpoint,
    getStatus: () => uvStatus,
    onStatus
  };
})();
