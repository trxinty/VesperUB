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

  function renderToggle(id, checked) {
    return `
      <label class="toggle-switch">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    `;
  }

  function render() {
    const root = document.getElementById('view-settings');
    if (!root) return;

    const state = window.Vesper.Store.get();
    const s = state.settings;
    const session = state.session;
    const isGuest = !session || session.mode === 'guest';
    const Themes = window.Vesper.Themes;
    const Cloak = window.Vesper.Cloak;
    const Proxy = window.Vesper.Proxy;
    const Icons = window.Vesper.Icons;

    const previewTitle = (s.cloakTitle && s.cloakTitle.trim()) || Cloak.DEFAULT_TITLE;
    const previewIcon = (s.cloakIcon && s.cloakIcon.trim()) || Cloak.DEFAULT_ICON;

    root.innerHTML = `
      <div class="settings-container">
        <div class="settings-header">
          <h1 class="page-title">settings</h1>
        </div>

        <div class="settings-card">
          <!-- Account Row -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">account</span>
              <span class="settings-desc">
                ${isGuest
                  ? 'you are browsing as a guest — sign in to unlock chat & servers'
                  : `signed in as <strong>${escapeHtml(session.displayName || session.username)}</strong> (@${escapeHtml(session.username)})`}
              </span>
            </div>
            ${isGuest
              ? `<button type="button" class="btn-primary" id="settings-signin-btn">sign in</button>`
              : `<div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="btn-primary" id="settings-edit-profile-btn" style="padding:9px 14px;font-size:0.84rem;">edit profile</button>
                  <button type="button" class="btn-secondary" id="settings-signout-btn" style="padding:9px 14px;font-size:0.84rem;">sign out</button>
                </div>`
            }
          </div>

          <!-- =========================================================
               TAB CLOAK SECTION (Presets, Live Tab Preview, Auto-Copy from URL)
               ========================================================= -->
          <div class="settings-row stacked">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div class="settings-label-group">
                <span class="settings-label">tab cloak</span>
                <span class="settings-desc">change your browser tab icon &amp; title, or paste any link to copy its tab preview</span>
              </div>
              <button type="button" class="btn-secondary" id="cloak-about-blank-btn" style="padding:7px 12px;font-size:0.78rem;">
                ${Icons.get('externalLink')} open in about:blank
              </button>
            </div>

            <!-- Live Mini Browser Tab Preview -->
            <div class="cloak-preview-chrome">
              <div class="cloak-preview-tab">
                <img id="cloak-preview-img" src="${escapeHtml(previewIcon)}" alt="" />
                <span id="cloak-preview-title">${escapeHtml(previewTitle)}</span>
                <span class="cloak-preview-x">×</span>
              </div>
              <span class="cloak-preview-badge">${s.cloakWhenAway ? 'active when away' : (s.cloakTitle || s.cloakIcon ? 'cloaked live' : 'default')}</span>
            </div>

            <!-- Built-In Presets -->
            <div class="cloak-preset-row">
              <select id="cloak-preset-select" class="settings-select" style="flex:1;">
                ${Cloak.PRESETS.map((p) => `
                  <option value="${escapeHtml(p.id)}" ${s.cloakPreset === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>
                `).join('')}
                <option value="custom" ${s.cloakPreset === 'custom' ? 'selected' : ''}>Custom</option>
              </select>
              <button type="button" class="btn-ghost" id="cloak-clear-btn" style="border:1px solid var(--border-subtle);padding:8px 13px;font-size:0.82rem;">clear</button>
            </div>

            <!-- Copy Cloak From Any Link -->
            <div class="cloak-link-row">
              <input
                id="cloak-url-copy-input"
                type="text"
                placeholder="Paste any site link (e.g. classroom.google.com, desmos.com)..."
                style="flex:1;"
              />
              <button type="button" class="btn-primary" id="cloak-copy-link-btn" style="padding:9px 14px;font-size:0.82rem;white-space:nowrap;">
                copy tab
              </button>
            </div>

            <!-- Manual Title, Favicon URL & Upload -->
            <div class="cloak-manual-row">
              <input id="cloak-title-input" type="text" value="${escapeHtml(s.cloakTitle || '')}" placeholder="Tab title (e.g. Home)" />
              <input id="cloak-icon-input" type="text" value="${escapeHtml(s.cloakIcon || '')}" placeholder="Favicon URL or uploaded image" />
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
              <input type="file" id="cloak-icon-file" accept="image/*" class="hidden" />
              <button type="button" class="btn-secondary" id="cloak-upload-icon-btn" style="padding:8px 12px;font-size:0.8rem;">
                ${Icons.get('image')} upload icon
              </button>
              <button type="button" class="btn-primary" id="cloak-save-btn" style="padding:8px 16px;font-size:0.82rem;">
                save cloak
              </button>
            </div>
          </div>

          <!-- Cloak When Away Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">cloak only when away</span>
              <span class="settings-desc">show normal Vesper tab while active, switch to cloak when you leave the tab</span>
            </div>
            ${renderToggle('setting-cloak-away', !!s.cloakWhenAway)}
          </div>

          <!-- =========================================================
               BROWSER & ULTRAVIOLET PROXY SETTINGS
               ========================================================= -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">search engine</span>
              <span class="settings-desc">choose Brave Search, DuckDuckGo, Google, Startpage, Bing, or Ecosia</span>
            </div>
            <select id="setting-search-engine" class="settings-select">
              ${Proxy.SEARCH_ENGINES.map((eng) => `
                <option value="${escapeHtml(eng.id)}" ${(s.searchEngine || 'brave') === eng.id ? 'selected' : ''}>${escapeHtml(eng.name)}</option>
              `).join('')}
              <option value="custom" ${s.searchEngine === 'custom' ? 'selected' : ''}>Custom URL</option>
            </select>
          </div>

          ${s.searchEngine === 'custom' ? `
            <div class="settings-row indent stacked">
              <div class="settings-label-group">
                <span class="settings-label">custom search url</span>
                <span class="settings-desc">use <code>%s</code> where the search query goes (e.g. <code>https://search.brave.com/search?q=%s</code>)</span>
              </div>
              <div style="display:flex;gap:8px;">
                <input id="setting-custom-search" type="text" value="${escapeHtml(s.customSearchUrl || '')}" placeholder="https://search.brave.com/search?q=%s" style="flex:1;" />
                <button type="button" class="btn-primary" id="save-custom-search-btn" style="padding:8px 14px;font-size:0.82rem;">save</button>
              </div>
            </div>
          ` : ''}

          <!-- Ultraviolet Wisp Relay Server -->
          <div class="settings-row stacked">
            <div class="settings-label-group">
              <span class="settings-label">ultraviolet relay server (wisp)</span>
              <span class="settings-desc">WebSocket Wisp relay powering the in-site Ultraviolet browser</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input
                id="setting-wisp-url"
                type="text"
                value="${escapeHtml(s.wispUrl || 'wss://wisp.mercurywork.shop/')}"
                placeholder="wss://your-wisp-server.com/wisp/"
                style="flex:1;min-width:210px;font-family:var(--font-mono);font-size:0.82rem;"
              />
              <button type="button" class="btn-secondary" id="test-wisp-btn" style="padding:8px 12px;font-size:0.8rem;">test</button>
              <button type="button" class="btn-primary" id="save-wisp-btn" style="padding:8px 14px;font-size:0.82rem;">save</button>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${Proxy.WISP_PRESETS.map((wp) => `
                  <button type="button" class="filter-chip" data-wisp-preset="${escapeHtml(wp.url)}" style="font-size:0.74rem;padding:4px 10px;">
                    ${escapeHtml(wp.label)}
                  </button>
                `).join('')}
              </div>
              <span id="wisp-test-result" style="font-size:0.76rem;color:var(--text-muted);"></span>
            </div>
          </div>

          <!-- Ultraviolet Transport Engine -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">ultraviolet transport</span>
              <span class="settings-desc">Epoxy is faster; try Libcurl if a specific site acts up</span>
            </div>
            <select id="setting-proxy-transport" class="settings-select">
              <option value="epoxy" ${(s.proxyTransport || 'epoxy') === 'epoxy' ? 'selected' : ''}>Epoxy (Fastest)</option>
              <option value="libcurl" ${s.proxyTransport === 'libcurl' ? 'selected' : ''}>Libcurl (Compat)</option>
            </select>
          </div>

          <!-- =========================================================
               THEME CUSTOMIZER
               ========================================================= -->
          <div class="settings-row stacked">
            <div class="settings-label-group">
              <span class="settings-label">theme presets</span>
              <span class="settings-desc">switch between dark purple &amp; black or any other combo</span>
            </div>
            <div class="theme-presets-grid">
              ${Themes.PRESETS.map((p) => `
                <button
                  type="button"
                  class="theme-preset-btn ${s.themePreset === p.id ? 'active' : ''}"
                  data-preset-id="${p.id}"
                >
                  <span class="preset-swatch-dual">
                    <span style="background:${p.base};"></span>
                    <span style="background:${p.accent};"></span>
                  </span>
                  <span class="preset-name">${escapeHtml(p.name)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Accent Color Dots -->
          <div class="settings-row stacked">
            <div class="settings-label-group">
              <span class="settings-label">accent color</span>
              <span class="settings-desc">quick-pick a highlight color without changing your background</span>
            </div>
            <div class="accent-swatches">
              ${Themes.ACCENT_SWATCHES.map((hex) => `
                <button
                  type="button"
                  class="accent-dot ${s.themeAccent.toLowerCase() === hex.toLowerCase() ? 'active' : ''}"
                  style="background:${hex};"
                  data-accent-hex="${hex}"
                  title="${hex}"
                  aria-label="Accent color ${hex}"
                ></button>
              `).join('')}
            </div>
          </div>

          <!-- Custom Dual Color Pickers -->
          <div class="settings-row stacked">
            <div class="settings-label-group">
              <span class="settings-label">custom theme colors</span>
              <span class="settings-desc">mix any two colors — clean or chaotic, your choice</span>
            </div>
            <div class="custom-color-row">
              <label class="color-picker-card">
                <span class="color-picker-meta">
                  <span>background base</span>
                  <code id="base-hex-label">${escapeHtml(s.themeBase)}</code>
                </span>
                <input type="color" id="custom-base-picker" value="${escapeHtml(s.themeBase)}" />
              </label>
              <label class="color-picker-card">
                <span class="color-picker-meta">
                  <span>accent glow</span>
                  <code id="accent-hex-label">${escapeHtml(s.themeAccent)}</code>
                </span>
                <input type="color" id="custom-accent-picker" value="${escapeHtml(s.themeAccent)}" />
              </label>
            </div>
          </div>

          <!-- Dock Position -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">dock position</span>
              <span class="settings-desc">pin the floating taskbar to the bottom or top</span>
            </div>
            <select id="setting-dock-pos" class="settings-select">
              <option value="bottom" ${s.dockPosition === 'bottom' ? 'selected' : ''}>bottom</option>
              <option value="top" ${s.dockPosition === 'top' ? 'selected' : ''}>top</option>
            </select>
          </div>

          <!-- Ambient Background Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">background glow</span>
              <span class="settings-desc">ambient streaks &amp; radial glow behind vesper</span>
            </div>
            ${renderToggle('setting-ambient', s.ambientBg)}
          </div>

          <!-- Performance Mode Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">performance mode</span>
              <span class="settings-desc">disables heavy blur &amp; animations for smoother fps</span>
            </div>
            ${renderToggle('setting-perf', s.performanceMode)}
          </div>

          <!-- Cursor Dot Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">cursor dot</span>
              <span class="settings-desc">subtle glowing dot that tracks your pointer</span>
            </div>
            ${renderToggle('setting-cursor', s.cursorDot)}
          </div>

          <!-- Compact Chat Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">compact chat</span>
              <span class="settings-desc">tighter message spacing inside servers and DMs</span>
            </div>
            ${renderToggle('setting-compact', s.compactChat)}
          </div>

          <!-- Show Activity -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">show what you're doing</span>
              <span class="settings-desc">people in chat can see your activity bio on the member list</span>
            </div>
            ${renderToggle('setting-activity', s.showActivity)}
          </div>

          <!-- Ask Before Leaving -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">ask before leaving</span>
              <span class="settings-desc">confirm before closing or refreshing the browser tab</span>
            </div>
            ${renderToggle('setting-beforeunload', s.askBeforeLeaving)}
          </div>

          <!-- Credits Section -->
          <div class="settings-row stacked">
            <div class="settings-label">credits &amp; build</div>
            <div class="credits-list">
              <div class="credit-row">
                <span class="credit-name">Vesper</span>
                <span class="credit-role">Ultraviolet Browser, Tab Cloak, 352+ Games &amp; Discord Chat</span>
              </div>
              <div class="credit-row">
                <span class="credit-name">Proxy Stack</span>
                <span class="credit-role">Ultraviolet v3 · BareMux v2 · Epoxy / Libcurl · Wisp</span>
              </div>
              <div class="credit-row">
                <span class="credit-name">Games Library</span>
                <span class="credit-role">trxinty/Html-games- (Single-File HTML Streaming)</span>
              </div>
            </div>
          </div>

          <!-- Reset Settings -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">reset settings</span>
              <span class="settings-desc">restore default dark purple &amp; black theme, cloak, and toggles</span>
            </div>
            <button type="button" class="btn-danger" id="settings-reset-btn">reset</button>
          </div>
        </div>
      </div>
    `;

    // Account Actions
    const signInBtn = document.getElementById('settings-signin-btn');
    if (signInBtn) signInBtn.addEventListener('click', () => window.Vesper.Auth.openGate('signin'));

    const editProfBtn = document.getElementById('settings-edit-profile-btn');
    if (editProfBtn) editProfBtn.addEventListener('click', () => window.Vesper.Chat.openProfileModal());

    const signOutBtn = document.getElementById('settings-signout-btn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => window.Vesper.Auth.signOut());

    // Tab Cloak Bindings
    const titleInput = document.getElementById('cloak-title-input');
    const iconInput = document.getElementById('cloak-icon-input');
    const previewTitleEl = document.getElementById('cloak-preview-title');
    const previewImgEl = document.getElementById('cloak-preview-img');

    function updateCloakPreviewLive() {
      previewTitleEl.textContent = titleInput.value.trim() || Cloak.DEFAULT_TITLE;
      previewImgEl.src = iconInput.value.trim() || Cloak.DEFAULT_ICON;
    }

    titleInput.addEventListener('input', updateCloakPreviewLive);
    iconInput.addEventListener('input', updateCloakPreviewLive);

    document.getElementById('cloak-about-blank-btn').addEventListener('click', () => {
      Cloak.openInAboutBlank();
    });

    document.getElementById('cloak-preset-select').addEventListener('change', (ev) => {
      const id = ev.target.value;
      const preset = Cloak.PRESETS.find((p) => p.id === id);
      if (!preset) return;
      window.Vesper.Store.update((st) => {
        st.settings.cloakPreset = preset.id;
        st.settings.cloakTitle = preset.id === 'none' ? '' : preset.title;
        st.settings.cloakIcon = preset.id === 'none' ? '' : preset.icon;
      }, 'settings');
      window.Vesper.App.toast(preset.id === 'none' ? 'Tab cloak reset to Vesper' : `Tab cloaked as ${preset.name}`);
    });

    document.getElementById('cloak-copy-link-btn').addEventListener('click', () => {
      const urlVal = document.getElementById('cloak-url-copy-input').value.trim();
      try {
        const extracted = Cloak.extractFromUrl(urlVal);
        window.Vesper.Store.update((st) => {
          st.settings.cloakPreset = 'custom';
          st.settings.cloakTitle = extracted.title;
          st.settings.cloakIcon = extracted.icon;
        }, 'settings');
        window.Vesper.App.toast(`Copied tab cloak from ${extracted.host}`);
      } catch (err) {
        window.Vesper.App.toast(err.message || 'Enter a valid website URL');
      }
    });

    const cloakFile = document.getElementById('cloak-icon-file');
    document.getElementById('cloak-upload-icon-btn').addEventListener('click', () => cloakFile.click());
    cloakFile.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const dataUrl = await window.Vesper.Media.compressAvatar(f);
        iconInput.value = dataUrl;
        updateCloakPreviewLive();
        window.Vesper.App.toast('Icon uploaded — click Save Cloak');
      } catch (err) {
        window.Vesper.App.toast(err.message || 'Invalid image');
      }
    });

    document.getElementById('cloak-save-btn').addEventListener('click', () => {
      const nextTitle = titleInput.value.trim();
      const nextIcon = iconInput.value.trim();
      window.Vesper.Store.update((st) => {
        st.settings.cloakPreset = (!nextTitle && !nextIcon) ? 'none' : 'custom';
        st.settings.cloakTitle = nextTitle;
        st.settings.cloakIcon = nextIcon;
      }, 'settings');
      window.Vesper.App.toast('Tab cloak saved!');
    });

    document.getElementById('cloak-clear-btn').addEventListener('click', () => {
      window.Vesper.Store.update((st) => {
        st.settings.cloakPreset = 'none';
        st.settings.cloakTitle = '';
        st.settings.cloakIcon = '';
      }, 'settings');
      window.Vesper.App.toast('Tab cloak cleared');
    });

    // Browser & Ultraviolet Bindings
    document.getElementById('setting-search-engine').addEventListener('change', (ev) => {
      const val = ev.target.value;
      window.Vesper.Store.update((st) => {
        st.settings.searchEngine = val;
      }, 'settings');
      window.Vesper.App.toast(`Search engine set to ${val === 'custom' ? 'Custom URL' : Proxy.getSearchEngine(val).name}`);
    });

    const saveCustomSearchBtn = document.getElementById('save-custom-search-btn');
    if (saveCustomSearchBtn) {
      saveCustomSearchBtn.addEventListener('click', () => {
        const val = document.getElementById('setting-custom-search').value.trim();
        window.Vesper.Store.update((st) => {
          st.settings.customSearchUrl = val;
        }, 'settings');
        window.Vesper.App.toast('Custom search URL saved');
      });
    }

    const wispInput = document.getElementById('setting-wisp-url');
    const wispResEl = document.getElementById('wisp-test-result');

    root.querySelectorAll('[data-wisp-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.wispPreset;
        wispInput.value = url;
        window.Vesper.Store.update((st) => {
          st.settings.wispUrl = url;
        }, 'settings');
        Proxy.ensureUltraviolet(true).catch(() => {});
        window.Vesper.App.toast('Wisp relay updated');
      });
    });

    document.getElementById('save-wisp-btn').addEventListener('click', async () => {
      const url = wispInput.value.trim();
      if (!/^wss?:\/\//i.test(url)) {
        window.Vesper.App.toast('Wisp URL must start with wss:// or ws://');
        return;
      }
      window.Vesper.Store.update((st) => {
        st.settings.wispUrl = url;
      }, 'settings');
      window.Vesper.App.toast('Wisp relay saved — reconnecting Ultraviolet...');
      try {
        await Proxy.ensureUltraviolet(true);
        window.Vesper.App.toast('Ultraviolet connected to Wisp relay!');
      } catch (err) {
        window.Vesper.App.toast(err.message || 'Saved (UV connects on HTTPS)');
      }
    });

    document.getElementById('test-wisp-btn').addEventListener('click', async () => {
      const url = wispInput.value.trim();
      wispResEl.style.color = 'var(--text-secondary)';
      wispResEl.textContent = 'Testing WebSocket...';
      const result = await Proxy.testWispEndpoint(url);
      wispResEl.style.color = result.ok ? '#4ade80' : '#fca5a5';
      wispResEl.textContent = (result.ok ? '✓ ' : '✕ ') + result.reason;
    });

    document.getElementById('setting-proxy-transport').addEventListener('change', (ev) => {
      const nextT = ev.target.value;
      window.Vesper.Store.update((st) => {
        st.settings.proxyTransport = nextT;
      }, 'settings');
      Proxy.ensureUltraviolet(true).catch(() => {});
      window.Vesper.App.toast(`Transport switched to ${nextT}`);
    });

    // Theme Presets
    root.querySelectorAll('[data-preset-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = Themes.PRESETS.find((p) => p.id === btn.dataset.presetId);
        if (!preset) return;
        window.Vesper.Store.update((st) => {
          st.settings.themePreset = preset.id;
          st.settings.themeBase = preset.base;
          st.settings.themeAccent = preset.accent;
        }, 'settings');
        window.Vesper.App.toast(`Theme set to ${preset.name}`);
      });
    });

    // Accent Swatches
    root.querySelectorAll('[data-accent-hex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.accentHex;
        window.Vesper.Store.update((st) => {
          st.settings.themePreset = 'custom';
          st.settings.themeAccent = hex;
        }, 'settings');
      });
    });

    // Custom Color Pickers
    const basePicker = document.getElementById('custom-base-picker');
    const accentPicker = document.getElementById('custom-accent-picker');

    basePicker.addEventListener('input', (ev) => {
      const val = ev.target.value;
      document.getElementById('base-hex-label').textContent = val;
      window.Vesper.Themes.apply({ base: val, accent: accentPicker.value });
    });
    basePicker.addEventListener('change', (ev) => {
      window.Vesper.Store.update((st) => {
        st.settings.themePreset = 'custom';
        st.settings.themeBase = ev.target.value;
      }, 'settings');
    });

    accentPicker.addEventListener('input', (ev) => {
      const val = ev.target.value;
      document.getElementById('accent-hex-label').textContent = val;
      window.Vesper.Themes.apply({ base: basePicker.value, accent: val });
    });
    accentPicker.addEventListener('change', (ev) => {
      window.Vesper.Store.update((st) => {
        st.settings.themePreset = 'custom';
        st.settings.themeAccent = ev.target.value;
      }, 'settings');
    });

    // Dock Position
    document.getElementById('setting-dock-pos').addEventListener('change', (ev) => {
      window.Vesper.Store.update((st) => {
        st.settings.dockPosition = ev.target.value;
      }, 'settings');
    });

    // Toggles
    const toggleBindings = [
      ['setting-cloak-away', 'cloakWhenAway'],
      ['setting-ambient', 'ambientBg'],
      ['setting-perf', 'performanceMode'],
      ['setting-cursor', 'cursorDot'],
      ['setting-compact', 'compactChat'],
      ['setting-activity', 'showActivity'],
      ['setting-beforeunload', 'askBeforeLeaving']
    ];

    toggleBindings.forEach(([elId, key]) => {
      const el = document.getElementById(elId);
      if (el) {
        el.addEventListener('change', () => {
          window.Vesper.Store.update((st) => {
            st.settings[key] = el.checked;
          }, 'settings');
        });
      }
    });

    // Reset Settings
    document.getElementById('settings-reset-btn').addEventListener('click', () => {
      window.Vesper.Store.resetSettings();
      window.Vesper.App.toast('Settings restored to Vesper Purple defaults');
    });
  }

  window.Vesper.Settings = { render };
})();
