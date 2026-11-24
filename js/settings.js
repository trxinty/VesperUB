(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

          <!-- Theme Presets -->
          <div class="settings-row stacked">
            <div class="settings-label-group">
              <span class="settings-label">theme presets</span>
              <span class="settings-desc">switch between dark purple & black or any other combo</span>
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

          <!-- Accent Color Dots (Reference Style) -->
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
              <span class="settings-desc">ambient streaks & radial glow behind vesper</span>
            </div>
            ${renderToggle('setting-ambient', s.ambientBg)}
          </div>

          <!-- Performance Mode Toggle -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">performance mode</span>
              <span class="settings-desc">disables heavy blur & animations for smoother fps</span>
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

          <!-- Credits Section (Reference Style) -->
          <div class="settings-row stacked">
            <div class="settings-label">credits & build</div>
            <div class="credits-list">
              <div class="credit-row">
                <span class="credit-name">Vesper</span>
                <span class="credit-role">Vesper · trxinty/Html-games- Hub, In-Site Browser & Discord Chat</span>
              </div>
              <div class="credit-row">
                <span class="credit-name">Architecture</span>
                <span class="credit-role">Zero-build HTML5 / CSS3 / Modular JS</span>
              </div>
              <div class="credit-row">
                <span class="credit-name">Hosting Target</span>
                <span class="credit-role">GitHub Pages & Local Ready</span>
              </div>
            </div>
          </div>

          <!-- Reset Settings -->
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label">reset settings</span>
              <span class="settings-desc">restore default dark purple & black theme and toggles</span>
            </div>
            <button type="button" class="btn-danger" id="settings-reset-btn">reset</button>
          </div>
        </div>
      </div>
    `;

    // Bind Account Actions
    const signInBtn = document.getElementById('settings-signin-btn');
    if (signInBtn) signInBtn.addEventListener('click', () => window.Vesper.Auth.openGate('signin'));

    const editProfBtn = document.getElementById('settings-edit-profile-btn');
    if (editProfBtn) editProfBtn.addEventListener('click', () => window.Vesper.Chat.openProfileModal());

    const signOutBtn = document.getElementById('settings-signout-btn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => window.Vesper.Auth.signOut());

    // Bind Presets
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

    // Bind Accent Swatches
    root.querySelectorAll('[data-accent-hex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.accentHex;
        window.Vesper.Store.update((st) => {
          st.settings.themePreset = 'custom';
          st.settings.themeAccent = hex;
        }, 'settings');
      });
    });

    // Bind Custom Pickers (live update)
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

    // Bind Dock Position
    document.getElementById('setting-dock-pos').addEventListener('change', (ev) => {
      window.Vesper.Store.update((st) => {
        st.settings.dockPosition = ev.target.value;
      }, 'settings');
    });

    // Bind Toggles
    const toggleBindings = [
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
