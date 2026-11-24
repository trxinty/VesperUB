(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let showMembers = true;
  let mobileDrawerOpen = false;
  let replyTarget = null; // { id, author, text }
  let emojiPickerOpen = false;
  let editingMsgId = null;
  let channelSearchOpen = false;
  let channelSearchQuery = '';

  const QUICK_EMOJIS = ['🟣', '🔥', '😂', '💀', '👀', '🚀', '❤️', '👍', '✨', '🎮', '⚡', '👑'];
  const ROLE_SWATCHES = ['#c084fc', '#8b5cf6', '#38bdf8', '#34d399', '#facc15', '#fb923c', '#f87171', '#f472b6'];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(raw) {
    let text = escapeHtml(raw);
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    text = text.replace(/(^|\s)(@[a-zA-Z0-9_.\-]+)/g, '$1<span class="msg-mention">$2</span>');
    return text;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function getActiveThreadId(chat) {
    return chat.activeView === 'dm' ? chat.activeDmId : chat.activeChannelId;
  }

  function renderAvatarInner(profile) {
    if (profile.avatarUrl) {
      return `<img class="avatar-img" src="${escapeHtml(profile.avatarUrl)}" alt="${escapeHtml(profile.displayName)}" />`;
    }
    const initial = (profile.displayName || profile.username || '?').slice(0, 1).toUpperCase();
    return escapeHtml(initial);
  }

  function openModal(html, onBind) {
    const root = document.getElementById('app-modal-root');
    root.innerHTML = html;
    root.classList.remove('hidden');
    const close = () => {
      root.classList.add('hidden');
      root.innerHTML = '';
    };
    root.onclick = (ev) => {
      if (ev.target === root) close();
    };
    root.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', close);
    });
    if (onBind) onBind(root, close);
  }

  /* ========================================================================
     1. DISCORD USER PROFILE POPOUT (Click any avatar or name in Chat/Members)
     ======================================================================== */
  function openUserPopout(targetUsername) {
    const state = window.Vesper.Store.get();
    const session = state.session;
    const profile = window.Vesper.Store.getUserProfile(targetUsername);
    const activeServer = state.chat.servers.find((s) => s.id === state.chat.activeServerId) || state.chat.servers[0];
    const roles = state.chat.activeView === 'server'
      ? window.Vesper.Store.getMemberRoles(activeServer, profile.username)
      : [];
    const isSelf = session && session.username.toLowerCase() === profile.username.toLowerCase();
    const Icons = window.Vesper.Icons;

    const bannerStyle = profile.bannerUrl
      ? `background-image:url('${escapeHtml(profile.bannerUrl)}');`
      : `background:linear-gradient(135deg, ${escapeHtml(profile.bannerColor || '#4c1d95')}, #09060e);`;

    openModal(`
      <div class="modal-card" style="padding:0;overflow:hidden;max-width:390px;">
        <div class="discord-profile-card" style="border:none;border-radius:0;">
          <div class="profile-card-banner" style="${bannerStyle}">
            <button type="button" class="icon-btn sidebar-banner-btn" data-close-modal style="position:absolute;top:10px;right:10px;" title="Close">
              ${Icons.get('x')}
            </button>
          </div>
          <div class="profile-card-body">
            <div class="profile-card-avatar-row">
              <div class="profile-card-avatar" style="background:${escapeHtml(profile.avatarColor)};">
                ${renderAvatarInner(profile)}
                <span class="presence-dot ${escapeHtml(profile.status || 'online')}"></span>
              </div>
              ${isSelf ? `
                <button type="button" class="btn-secondary" id="popout-edit-profile" style="padding:7px 12px;font-size:0.8rem;">
                  ${Icons.get('edit')} edit profile
                </button>
              ` : `
                <button type="button" class="btn-primary" id="popout-dm-user" style="padding:7px 13px;font-size:0.8rem;">
                  ${Icons.get('chat')} message
                </button>
              `}
            </div>

            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <div class="profile-card-display-name">${escapeHtml(profile.displayName)}</div>
              ${profile.badge ? `<span class="msg-badge">${escapeHtml(profile.badge)}</span>` : ''}
            </div>
            <div class="profile-card-username">@${escapeHtml(profile.username)}</div>

            ${profile.bio ? `
              <div class="profile-card-section">
                <div class="profile-card-section-label">About Me</div>
                <div class="profile-card-bio">${escapeHtml(profile.bio)}</div>
              </div>
            ` : ''}

            ${roles.length ? `
              <div class="profile-card-section">
                <div class="profile-card-section-label">Roles in ${escapeHtml(activeServer.name)}</div>
                <div class="role-pills-wrap">
                  ${roles.map((r) => `
                    <span class="role-pill">
                      <span class="role-dot" style="background:${escapeHtml(r.color)};"></span>
                      <span>${escapeHtml(r.name)}</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `, (modal, close) => {
      const editBtn = modal.querySelector('#popout-edit-profile');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          close();
          openProfileModal();
        });
      }
      const dmBtn = modal.querySelector('#popout-dm-user');
      if (dmBtn) {
        dmBtn.addEventListener('click', () => {
          close();
          startOrOpenDm(profile.username);
        });
      }
    });
  }

  function startOrOpenDm(peerName) {
    const clean = (peerName || '').trim();
    if (!clean) return;
    const state = window.Vesper.Store.get();
    const existing = state.chat.dms.find((d) => d.peerName.toLowerCase() === clean.toLowerCase());
    if (existing) {
      window.Vesper.Store.update((s) => {
        s.chat.activeView = 'dm';
        s.chat.activeDmId = existing.id;
      }, 'chat');
      return;
    }
    const dmId = window.Vesper.Store.uid('dm');
    const peerProf = window.Vesper.Store.getUserProfile(clean);
    window.Vesper.Store.update((s) => {
      s.chat.dms.push({
        id: dmId,
        peerName: peerProf.username,
        peerColor: peerProf.avatarColor,
        peerStatus: peerProf.status || 'online'
      });
      s.chat.messages[dmId] = [];
      s.chat.activeView = 'dm';
      s.chat.activeDmId = dmId;
    }, 'chat');
    window.Vesper.App.toast(`Opened DM with ${peerProf.displayName}`);
  }

  /* ========================================================================
     2. FULL USER PROFILE CUSTOMIZATION MODAL
        (Display Name, Locked @Username, PFP Upload, Profile Banner Upload, Bio)
     ======================================================================== */
  function openProfileModal() {
    const state = window.Vesper.Store.get();
    const session = state.session;
    if (!session || session.mode === 'guest') {
      window.Vesper.Auth.openGate('signin');
      return;
    }

    const Icons = window.Vesper.Icons;
    const activeServer = state.chat.servers.find((s) => s.id === state.chat.activeServerId) || state.chat.servers[0];
    const myRoles = window.Vesper.Store.getMemberRoles(activeServer, session.username);

    let draftDisplayName = session.displayName || session.username;
    let draftAvatarUrl = session.avatarUrl || null;
    let draftAvatarColor = session.avatarColor || '#8b5cf6';
    let draftBannerUrl = session.bannerUrl || null;
    let draftBannerColor = session.bannerColor || '#4c1d95';
    let draftStatus = session.status || 'online';
    let draftBio = session.bio || '';

    function renderPreviewHtml() {
      const bannerStyle = draftBannerUrl
        ? `background-image:url('${escapeHtml(draftBannerUrl)}');`
        : `background:linear-gradient(135deg, ${escapeHtml(draftBannerColor)}, #09060e);`;
      const avatarContent = draftAvatarUrl
        ? `<img class="avatar-img" src="${escapeHtml(draftAvatarUrl)}" alt="Preview" />`
        : escapeHtml((draftDisplayName || session.username).slice(0, 1).toUpperCase());

      return `
        <div class="discord-profile-card" style="margin-bottom:16px;">
          <div class="profile-card-banner" style="${bannerStyle}"></div>
          <div class="profile-card-body">
            <div class="profile-card-avatar-row">
              <div class="profile-card-avatar" style="background:${escapeHtml(draftAvatarColor)};">
                ${avatarContent}
                <span class="presence-dot ${escapeHtml(draftStatus)}"></span>
              </div>
              <span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">LIVE PREVIEW</span>
            </div>
            <div class="profile-card-display-name">${escapeHtml(draftDisplayName || session.username)}</div>
            <div class="profile-card-username">@${escapeHtml(session.username)}</div>
            ${draftBio ? `
              <div class="profile-card-section">
                <div class="profile-card-section-label">About Me</div>
                <div class="profile-card-bio">${escapeHtml(draftBio)}</div>
              </div>
            ` : ''}
            ${myRoles.length ? `
              <div class="profile-card-section">
                <div class="profile-card-section-label">Server Roles</div>
                <div class="role-pills-wrap">
                  ${myRoles.map((r) => `
                    <span class="role-pill">
                      <span class="role-dot" style="background:${escapeHtml(r.color)};"></span>
                      <span>${escapeHtml(r.name)}</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    openModal(`
      <div class="modal-card wide">
        <div class="modal-header">
          <h2 class="modal-title">customize profile</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>

        <div id="profile-live-preview">${renderPreviewHtml()}</div>

        <form id="profile-form" class="auth-form">
          <div class="media-upload-grid">
            <div class="media-upload-box">
              <span class="media-upload-label">profile picture</span>
              <div class="media-upload-actions">
                <input type="file" id="prof-avatar-file" accept="image/*" class="hidden" />
                <button type="button" class="btn-secondary" id="trigger-avatar-upload" style="padding:7px 11px;font-size:0.78rem;">
                  ${Icons.get('camera')} upload pfp
                </button>
                <button type="button" class="btn-ghost" id="remove-avatar-btn" style="padding:7px 9px;font-size:0.76rem;">
                  remove
                </button>
              </div>
            </div>

            <div class="media-upload-box">
              <span class="media-upload-label">profile banner</span>
              <div class="media-upload-actions">
                <input type="file" id="prof-banner-file" accept="image/*" class="hidden" />
                <button type="button" class="btn-secondary" id="trigger-banner-upload" style="padding:7px 11px;font-size:0.78rem;">
                  ${Icons.get('image')} upload banner
                </button>
                <button type="button" class="btn-ghost" id="remove-banner-btn" style="padding:7px 9px;font-size:0.76rem;">
                  remove
                </button>
              </div>
            </div>
          </div>

          <div class="custom-color-row">
            <div class="input-group">
              <label for="prof-display-name">display name</label>
              <input id="prof-display-name" type="text" value="${escapeHtml(draftDisplayName)}" placeholder="Your visible nickname" maxlength="32" required />
            </div>
            <div class="input-group">
              <label for="prof-username-locked">username (permanent)</label>
              <input id="prof-username-locked" type="text" value="@${escapeHtml(session.username)}" disabled style="opacity:0.65;cursor:not-allowed;font-family:var(--font-mono);" />
            </div>
          </div>

          <div class="custom-color-row">
            <div class="input-group">
              <label for="prof-status">status</label>
              <select id="prof-status">
                <option value="online" ${draftStatus === 'online' ? 'selected' : ''}>Online</option>
                <option value="idle" ${draftStatus === 'idle' ? 'selected' : ''}>Idle</option>
                <option value="dnd" ${draftStatus === 'dnd' ? 'selected' : ''}>Do Not Disturb</option>
                <option value="offline" ${draftStatus === 'offline' ? 'selected' : ''}>Invisible</option>
              </select>
            </div>
            <div class="input-group">
              <label for="prof-bio">about me / bio</label>
              <input id="prof-bio" type="text" value="${escapeHtml(draftBio)}" placeholder="Tell people about yourself..." maxlength="110" />
            </div>
          </div>

          <div class="custom-color-row">
            <label class="color-picker-card">
              <span class="color-picker-meta">
                <span>avatar fallback color</span>
                <code id="prof-avatar-hex">${escapeHtml(draftAvatarColor)}</code>
              </span>
              <input type="color" id="prof-color" value="${escapeHtml(draftAvatarColor)}" />
            </label>
            <label class="color-picker-card">
              <span class="color-picker-meta">
                <span>banner fallback color</span>
                <code id="prof-banner-hex">${escapeHtml(draftBannerColor)}</code>
              </span>
              <input type="color" id="prof-banner-color" value="${escapeHtml(draftBannerColor)}" />
            </label>
          </div>

          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">save profile</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      const previewEl = modal.querySelector('#profile-live-preview');
      const refreshPreview = () => { previewEl.innerHTML = renderPreviewHtml(); };

      modal.querySelector('#prof-display-name').addEventListener('input', (ev) => {
        draftDisplayName = ev.target.value;
        refreshPreview();
      });

      modal.querySelector('#prof-status').addEventListener('change', (ev) => {
        draftStatus = ev.target.value;
        refreshPreview();
      });

      modal.querySelector('#prof-bio').addEventListener('input', (ev) => {
        draftBio = ev.target.value;
        refreshPreview();
      });

      modal.querySelector('#prof-color').addEventListener('input', (ev) => {
        draftAvatarColor = ev.target.value;
        modal.querySelector('#prof-avatar-hex').textContent = draftAvatarColor;
        refreshPreview();
      });

      modal.querySelector('#prof-banner-color').addEventListener('input', (ev) => {
        draftBannerColor = ev.target.value;
        modal.querySelector('#prof-banner-hex').textContent = draftBannerColor;
        refreshPreview();
      });

      // Avatar upload
      const avatarInput = modal.querySelector('#prof-avatar-file');
      modal.querySelector('#trigger-avatar-upload').addEventListener('click', () => avatarInput.click());
      avatarInput.addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          draftAvatarUrl = await window.Vesper.Media.compressAvatar(file);
          refreshPreview();
          window.Vesper.App.toast('Profile picture ready — click Save Profile');
        } catch (err) {
          window.Vesper.App.toast(err.message || 'Could not load image');
        }
      });
      modal.querySelector('#remove-avatar-btn').addEventListener('click', () => {
        draftAvatarUrl = null;
        avatarInput.value = '';
        refreshPreview();
      });

      // Banner upload
      const bannerInput = modal.querySelector('#prof-banner-file');
      modal.querySelector('#trigger-banner-upload').addEventListener('click', () => bannerInput.click());
      bannerInput.addEventListener('change', async (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          draftBannerUrl = await window.Vesper.Media.compressBanner(file);
          refreshPreview();
          window.Vesper.App.toast('Profile banner ready — click Save Profile');
        } catch (err) {
          window.Vesper.App.toast(err.message || 'Could not load banner');
        }
      });
      modal.querySelector('#remove-banner-btn').addEventListener('click', () => {
        draftBannerUrl = null;
        bannerInput.value = '';
        refreshPreview();
      });

      modal.querySelector('#profile-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const finalDisplay = draftDisplayName.trim() || session.username;
        window.Vesper.Store.update((s) => {
          s.session.displayName = finalDisplay;
          s.session.avatarUrl = draftAvatarUrl;
          s.session.avatarColor = draftAvatarColor;
          s.session.bannerUrl = draftBannerUrl;
          s.session.bannerColor = draftBannerColor;
          s.session.status = draftStatus;
          s.session.bio = draftBio.trim();

          if (s.session.accountKey && s.accounts[s.session.accountKey]) {
            const acc = s.accounts[s.session.accountKey];
            acc.displayName = finalDisplay;
            acc.avatarUrl = draftAvatarUrl;
            acc.avatarColor = draftAvatarColor;
            acc.bannerUrl = draftBannerUrl;
            acc.bannerColor = draftBannerColor;
            acc.status = draftStatus;
            acc.bio = draftBio.trim();
          }
        }, 'chat');
        close();
        window.Vesper.App.toast('Profile customizations saved!');
      });
    });
  }

  /* ========================================================================
     3. FULL SERVER SETTINGS MODAL
        (Overview: Icon & Banner Upload | Roles: Create & Assign | Channels | Invites)
     ======================================================================== */
  function openServerSettingsModal(server, initialTab) {
    const Icons = window.Vesper.Icons;
    let currentTab = initialTab || 'overview';

    // Draft overview fields
    let draftName = server.name;
    let draftIcon = server.icon;
    let draftIconUrl = server.iconUrl || null;
    let draftBannerUrl = server.bannerUrl || null;
    let draftBannerColor = server.bannerColor || server.color || '#3b0764';
    let draftColor = server.color || '#8b5cf6';

    // Role assignment target member
    const state = window.Vesper.Store.get();
    const knownUsers = [
      state.session.username,
      'Vesper System',
      ...Object.values(state.accounts || {}).map((a) => a.username)
    ].filter((v, idx, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === idx);

    let selectedMemberForRoles = knownUsers[0] || state.session.username;
    let selectedRoleId = (server.roles && server.roles[0] && server.roles[0].id) || null;
    let newRoleColor = '#c084fc';

    function renderModalContent(modal, close) {
      const liveSrv = window.Vesper.Store.get().chat.servers.find((s) => s.id === server.id) || server;

      const bannerPreviewStyle = draftBannerUrl
        ? `background-image:url('${escapeHtml(draftBannerUrl)}');`
        : `background:linear-gradient(135deg, ${escapeHtml(draftBannerColor)}, #09060e);`;

      const iconPreviewHtml = draftIconUrl
        ? `<img class="avatar-img" src="${escapeHtml(draftIconUrl)}" alt="Server Icon" />`
        : escapeHtml(draftIcon || draftName.slice(0, 2).toUpperCase());

      let tabBody = '';

      if (currentTab === 'overview') {
        tabBody = `
          <div class="discord-profile-card" style="margin-bottom:16px;">
            <div class="profile-card-banner" style="${bannerPreviewStyle}"></div>
            <div class="profile-card-body">
              <div class="profile-card-avatar-row">
                <div class="profile-card-avatar" style="border-radius:22px;background:${escapeHtml(draftColor)};">
                  ${iconPreviewHtml}
                </div>
                <span style="font-size:0.72rem;color:var(--text-muted);font-weight:600;">SERVER PREVIEW</span>
              </div>
              <div class="profile-card-display-name">${escapeHtml(draftName || liveSrv.name)}</div>
              <div class="profile-card-username">Invite: ${escapeHtml(liveSrv.inviteCode)} · ${liveSrv.roles.length} roles</div>
            </div>
          </div>

          <form id="srv-overview-form" class="auth-form">
            <div class="media-upload-grid">
              <div class="media-upload-box">
                <span class="media-upload-label">server icon</span>
                <div class="media-upload-actions">
                  <input type="file" id="srv-icon-file" accept="image/*" class="hidden" />
                  <button type="button" class="btn-secondary" id="trigger-srv-icon" style="padding:7px 11px;font-size:0.78rem;">
                    ${Icons.get('camera')} upload icon
                  </button>
                  <button type="button" class="btn-ghost" id="remove-srv-icon" style="padding:7px 9px;font-size:0.76rem;">
                    remove
                  </button>
                </div>
              </div>

              <div class="media-upload-box">
                <span class="media-upload-label">server banner</span>
                <div class="media-upload-actions">
                  <input type="file" id="srv-banner-file" accept="image/*" class="hidden" />
                  <button type="button" class="btn-secondary" id="trigger-srv-banner" style="padding:7px 11px;font-size:0.78rem;">
                    ${Icons.get('image')} upload banner
                  </button>
                  <button type="button" class="btn-ghost" id="remove-srv-banner" style="padding:7px 9px;font-size:0.76rem;">
                    remove
                  </button>
                </div>
              </div>
            </div>

            <div class="custom-color-row">
              <div class="input-group">
                <label for="srv-edit-name">server name</label>
                <input id="srv-edit-name" type="text" value="${escapeHtml(draftName)}" maxlength="32" required />
              </div>
              <div class="input-group">
                <label for="srv-edit-icon-txt">fallback letters / emoji</label>
                <input id="srv-edit-icon-txt" type="text" value="${escapeHtml(draftIcon)}" maxlength="2" />
              </div>
            </div>

            <div class="custom-color-row">
              <label class="color-picker-card">
                <span class="color-picker-meta">
                  <span>server accent color</span>
                  <code>${escapeHtml(draftColor)}</code>
                </span>
                <input type="color" id="srv-edit-color" value="${escapeHtml(draftColor)}" />
              </label>
              <label class="color-picker-card">
                <span class="color-picker-meta">
                  <span>banner fallback color</span>
                  <code>${escapeHtml(draftBannerColor)}</code>
                </span>
                <input type="color" id="srv-edit-banner-color" value="${escapeHtml(draftBannerColor)}" />
              </label>
            </div>

            <div class="modal-actions" style="margin-top:8px;">
              <button type="button" class="btn-secondary" data-close-modal>close</button>
              <button type="submit" class="btn-primary">save server</button>
            </div>
          </form>
        `;
      } else if (currentTab === 'roles') {
        const assignedIds = (liveSrv.memberRoles && liveSrv.memberRoles[selectedMemberForRoles.toLowerCase()]) || [];
        const editingRole = liveSrv.roles.find((r) => r.id === selectedRoleId) || liveSrv.roles[0] || null;
        if (editingRole && editingRole.id !== selectedRoleId) selectedRoleId = editingRole.id;
        const permDefs = window.Vesper.Store.PERMISSION_DEFS || [];

        tabBody = `
          <form id="create-role-form" class="auth-form" style="padding-bottom:14px;border-bottom:1px solid var(--border-subtle);margin-bottom:14px;">
            <div class="custom-color-row">
              <div class="input-group">
                <label for="new-role-name">create new role</label>
                <input id="new-role-name" type="text" placeholder="e.g. VIP, Admin, Mod" maxlength="24" required />
              </div>
              <div class="input-group">
                <label>role color</label>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:4px;">
                  ${ROLE_SWATCHES.map((hex) => `
                    <button
                      type="button"
                      class="accent-dot ${newRoleColor.toLowerCase() === hex.toLowerCase() ? 'active' : ''}"
                      data-role-swatch="${hex}"
                      style="width:22px;height:22px;background:${hex};"
                    ></button>
                  `).join('')}
                  <input type="color" id="new-role-color-picker" value="${escapeHtml(newRoleColor)}" style="width:26px;height:26px;padding:0;border:none;background:none;cursor:pointer;" />
                </div>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <label style="display:inline-flex;align-items:center;gap:8px;font-size:0.8rem;color:var(--text-secondary);cursor:pointer;">
                <input type="checkbox" id="new-role-hoist" checked style="accent-color:var(--accent);" />
                <span>Display separately (Hoist)</span>
              </label>
              <button type="submit" class="btn-primary" style="padding:8px 14px;font-size:0.82rem;">
                ${Icons.get('plus')} add role
              </button>
            </div>
          </form>

          <div style="margin-bottom:16px;">
            <div class="profile-card-section-label">Server Roles (${liveSrv.roles.length}) — click a role to edit permissions</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${liveSrv.roles.map((r) => {
                const perms = r.permissions || {};
                const enabledCount = permDefs.filter((p) => perms[p.key]).length;
                const isSelected = editingRole && editingRole.id === r.id;
                return `
                  <div class="role-list-item ${isSelected ? 'selected-role' : ''}" data-select-role="${escapeHtml(r.id)}" style="cursor:pointer;">
                    <div style="display:flex;align-items:center;gap:9px;min-width:0;flex:1;">
                      <span class="role-dot" style="width:12px;height:12px;background:${escapeHtml(r.color)};"></span>
                      <span style="font-weight:700;font-size:0.88rem;color:${escapeHtml(r.color)};">${escapeHtml(r.name)}</span>
                      ${perms.administrator ? `<span class="msg-badge" style="background:rgba(239,68,68,0.22);color:#fca5a5;">ADMIN</span>` : `<span class="msg-badge">${enabledCount} perms</span>`}
                      ${r.hoist ? `<span class="msg-badge">HOIST</span>` : ''}
                    </div>
                    <button type="button" class="icon-btn" data-delete-role="${escapeHtml(r.id)}" title="Delete Role" style="width:28px;height:28px;color:#fca5a5;">
                      ${Icons.get('trash')}
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${editingRole ? `
            <div class="role-perm-panel">
              <div class="role-perm-header">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <span class="role-dot" style="width:12px;height:12px;background:${escapeHtml(editingRole.color)};"></span>
                  <span style="font-weight:800;font-size:0.9rem;">Edit Role: <span style="color:${escapeHtml(editingRole.color)};">${escapeHtml(editingRole.name)}</span></span>
                </div>
                <label style="display:inline-flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-secondary);cursor:pointer;">
                  <input type="checkbox" id="edit-role-hoist" ${editingRole.hoist ? 'checked' : ''} style="accent-color:var(--accent);" />
                  <span>Hoist</span>
                </label>
              </div>

              <div class="custom-color-row" style="margin-bottom:12px;">
                <input id="edit-role-name" type="text" value="${escapeHtml(editingRole.name)}" maxlength="24" placeholder="Role name" style="padding:8px 11px;font-size:0.85rem;" />
                <label class="color-picker-card" style="padding:6px 10px;">
                  <span class="color-picker-meta">
                    <span>role color</span>
                    <code>${escapeHtml(editingRole.color)}</code>
                  </span>
                  <input type="color" id="edit-role-color" value="${escapeHtml(editingRole.color)}" style="width:28px;height:28px;" />
                </label>
              </div>

              <div class="profile-card-section-label">Permissions</div>
              <div class="role-perm-list">
                ${permDefs.map((p) => {
                  const isOn = !!(editingRole.permissions && editingRole.permissions[p.key]);
                  return `
                    <div class="role-perm-row">
                      <div style="min-width:0;">
                        <div class="role-perm-name ${p.danger ? 'danger' : ''}">${escapeHtml(p.label)}</div>
                        <div class="role-perm-desc">${escapeHtml(p.desc)}</div>
                      </div>
                      <label class="toggle-switch">
                        <input type="checkbox" data-role-perm="${escapeHtml(p.key)}" ${isOn ? 'checked' : ''} />
                        <span class="toggle-slider"></span>
                      </label>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <div style="margin-top:16px;">
            <div class="profile-card-section-label">Assign Roles to Member</div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
              <select id="role-member-select" style="flex:1;padding:8px 12px;">
                ${knownUsers.map((u) => {
                  const prof = window.Vesper.Store.getUserProfile(u);
                  return `<option value="${escapeHtml(u)}" ${u.toLowerCase() === selectedMemberForRoles.toLowerCase() ? 'selected' : ''}>${escapeHtml(prof.displayName)} (@${escapeHtml(prof.username)})</option>`;
                }).join('')}
              </select>
            </div>
            <div class="role-pills-wrap">
              ${liveSrv.roles.length === 0 ? `<span style="font-size:0.82rem;color:var(--text-muted);">Create a role above first!</span>` : liveSrv.roles.map((r) => {
                const has = assignedIds.includes(r.id);
                return `
                  <button type="button" class="role-assign-chip ${has ? 'assigned' : ''}" data-toggle-member-role="${escapeHtml(r.id)}">
                    <span class="role-dot" style="background:${escapeHtml(r.color)};"></span>
                    <span>${escapeHtml(r.name)}</span>
                    <span style="font-size:0.72rem;opacity:0.8;">${has ? '✓' : '+'}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else if (currentTab === 'channels') {
        tabBody = `
          <form id="srv-add-channel-form" class="auth-form" style="margin-bottom:16px;">
            <div style="display:flex;gap:8px;">
              <input id="srv-new-ch-name" type="text" placeholder="new-channel-name" maxlength="24" style="flex:1;" required />
              <button type="submit" class="btn-primary" style="padding:9px 14px;">${Icons.get('plus')} add</button>
            </div>
          </form>
          <div style="display:flex;flex-direction:column;gap:7px;">
            ${liveSrv.channels.map((ch) => `
              <div class="role-list-item">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="color:var(--text-muted);display:flex;">${Icons.get('hash')}</span>
                  <span style="font-weight:600;font-size:0.88rem;">${escapeHtml(ch.name)}</span>
                </div>
                ${liveSrv.channels.length > 1 ? `
                  <button type="button" class="icon-btn" data-delete-channel="${escapeHtml(ch.id)}" title="Delete Channel" style="width:28px;height:28px;color:#fca5a5;">
                    ${Icons.get('trash')}
                  </button>
                ` : `<span style="font-size:0.72rem;color:var(--text-muted);">default</span>`}
              </div>
            `).join('')}
          </div>
        `;
      } else if (currentTab === 'invite') {
        tabBody = `
          <p class="modal-body" style="margin-bottom:8px;">Share this code so friends can join <strong>${escapeHtml(liveSrv.name)}</strong>:</p>
          <div class="invite-code-box">
            <span>${escapeHtml(liveSrv.inviteCode)}</span>
            <button type="button" class="btn-secondary" id="srv-copy-invite" style="padding:6px 12px;font-size:0.8rem;">
              ${Icons.get('copy')} copy
            </button>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="srv-regen-invite">new code</button>
            <button type="button" class="btn-primary" data-close-modal>done</button>
          </div>
        `;
      }

      modal.innerHTML = `
        <div class="modal-card wide">
          <div class="modal-header">
            <h2 class="modal-title">${escapeHtml(liveSrv.name)} — settings</h2>
            <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
          </div>

          <div class="modal-tabs" role="tablist">
            <button type="button" class="modal-tab-btn ${currentTab === 'overview' ? 'active' : ''}" data-srv-tab="overview">overview</button>
            <button type="button" class="modal-tab-btn ${currentTab === 'roles' ? 'active' : ''}" data-srv-tab="roles">roles</button>
            <button type="button" class="modal-tab-btn ${currentTab === 'channels' ? 'active' : ''}" data-srv-tab="channels">channels</button>
            <button type="button" class="modal-tab-btn ${currentTab === 'invite' ? 'active' : ''}" data-srv-tab="invite">invite</button>
          </div>

          ${tabBody}
        </div>
      `;

      modal.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', close));
      modal.querySelectorAll('[data-srv-tab]').forEach((b) => {
        b.addEventListener('click', () => {
          currentTab = b.dataset.srvTab;
          renderModalContent(modal, close);
        });
      });

      if (currentTab === 'overview') {
        modal.querySelector('#srv-edit-name').addEventListener('input', (ev) => {
          draftName = ev.target.value;
        });
        modal.querySelector('#srv-edit-icon-txt').addEventListener('input', (ev) => {
          draftIcon = ev.target.value;
        });
        modal.querySelector('#srv-edit-color').addEventListener('input', (ev) => {
          draftColor = ev.target.value;
        });
        modal.querySelector('#srv-edit-banner-color').addEventListener('input', (ev) => {
          draftBannerColor = ev.target.value;
        });

        const iconFile = modal.querySelector('#srv-icon-file');
        modal.querySelector('#trigger-srv-icon').addEventListener('click', () => iconFile.click());
        iconFile.addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          try {
            draftIconUrl = await window.Vesper.Media.compressAvatar(f);
            renderModalContent(modal, close);
            window.Vesper.App.toast('Server icon ready — click Save Server');
          } catch (err) {
            window.Vesper.App.toast(err.message || 'Invalid image');
          }
        });
        modal.querySelector('#remove-srv-icon').addEventListener('click', () => {
          draftIconUrl = null;
          renderModalContent(modal, close);
        });

        const bannerFile = modal.querySelector('#srv-banner-file');
        modal.querySelector('#trigger-srv-banner').addEventListener('click', () => bannerFile.click());
        bannerFile.addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0];
          if (!f) return;
          try {
            draftBannerUrl = await window.Vesper.Media.compressBanner(f);
            renderModalContent(modal, close);
            window.Vesper.App.toast('Server banner ready — click Save Server');
          } catch (err) {
            window.Vesper.App.toast(err.message || 'Invalid banner image');
          }
        });
        modal.querySelector('#remove-srv-banner').addEventListener('click', () => {
          draftBannerUrl = null;
          renderModalContent(modal, close);
        });

        modal.querySelector('#srv-overview-form').addEventListener('submit', (ev) => {
          ev.preventDefault();
          const finalName = draftName.trim() || liveSrv.name;
          const finalIcon = draftIcon.trim() || finalName.slice(0, 2).toUpperCase();
          window.Vesper.Store.update((s) => {
            const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
            if (!target) return;
            target.name = finalName;
            target.icon = finalIcon;
            target.iconUrl = draftIconUrl;
            target.bannerUrl = draftBannerUrl;
            target.bannerColor = draftBannerColor;
            target.color = draftColor;
          }, 'chat');
          close();
          window.Vesper.App.toast(`Updated ${finalName}`);
        });
      }

      if (currentTab === 'roles') {
        modal.querySelectorAll('[data-role-swatch]').forEach((sw) => {
          sw.addEventListener('click', () => {
            newRoleColor = sw.dataset.roleSwatch;
            renderModalContent(modal, close);
          });
        });
        modal.querySelector('#new-role-color-picker').addEventListener('input', (ev) => {
          newRoleColor = ev.target.value;
        });

        modal.querySelector('#create-role-form').addEventListener('submit', (ev) => {
          ev.preventDefault();
          const rName = modal.querySelector('#new-role-name').value.trim();
          if (!rName) return;
          const hoist = modal.querySelector('#new-role-hoist').checked;
          const roleId = window.Vesper.Store.uid('role');
          window.Vesper.Store.update((s) => {
            const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
            if (target) {
              target.roles.push({
                id: roleId,
                name: rName,
                color: newRoleColor,
                hoist,
                permissions: window.Vesper.Store.createPermissions()
              });
            }
          }, 'chat');
          selectedRoleId = roleId;
          renderModalContent(modal, close);
          window.Vesper.App.toast(`Created role "${rName}" — toggle its permissions below`);
        });

        modal.querySelectorAll('[data-select-role]').forEach((row) => {
          row.addEventListener('click', (ev) => {
            if (ev.target.closest('[data-delete-role]')) return;
            selectedRoleId = row.dataset.selectRole;
            renderModalContent(modal, close);
          });
        });

        modal.querySelectorAll('[data-delete-role]').forEach((btn) => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const delId = btn.dataset.deleteRole;
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              if (!target) return;
              target.roles = target.roles.filter((r) => r.id !== delId);
              Object.keys(target.memberRoles || {}).forEach((uKey) => {
                target.memberRoles[uKey] = target.memberRoles[uKey].filter((id) => id !== delId);
              });
            }, 'chat');
            if (selectedRoleId === delId) selectedRoleId = null;
            renderModalContent(modal, close);
          });
        });

        // Live Edit Selected Role Name, Color, Hoist & Permissions
        const editNameEl = modal.querySelector('#edit-role-name');
        if (editNameEl) {
          editNameEl.addEventListener('change', (ev) => {
            const val = ev.target.value.trim();
            if (!val) return;
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              const r = target && target.roles.find((x) => x.id === selectedRoleId);
              if (r) r.name = val;
            }, 'chat');
            renderModalContent(modal, close);
          });
        }

        const editColorEl = modal.querySelector('#edit-role-color');
        if (editColorEl) {
          editColorEl.addEventListener('change', (ev) => {
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              const r = target && target.roles.find((x) => x.id === selectedRoleId);
              if (r) r.color = ev.target.value;
            }, 'chat');
            renderModalContent(modal, close);
          });
        }

        const editHoistEl = modal.querySelector('#edit-role-hoist');
        if (editHoistEl) {
          editHoistEl.addEventListener('change', (ev) => {
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              const r = target && target.roles.find((x) => x.id === selectedRoleId);
              if (r) r.hoist = ev.target.checked;
            }, 'chat');
            renderModalContent(modal, close);
          });
        }

        modal.querySelectorAll('[data-role-perm]').forEach((chk) => {
          chk.addEventListener('change', () => {
            const permKey = chk.dataset.rolePerm;
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              const r = target && target.roles.find((x) => x.id === selectedRoleId);
              if (r) {
                r.permissions = r.permissions || window.Vesper.Store.createPermissions();
                r.permissions[permKey] = chk.checked;
              }
            }, 'chat');
            renderModalContent(modal, close);
          });
        });

        modal.querySelector('#role-member-select').addEventListener('change', (ev) => {
          selectedMemberForRoles = ev.target.value;
          renderModalContent(modal, close);
        });

        modal.querySelectorAll('[data-toggle-member-role]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const rId = btn.dataset.toggleMemberRole;
            const uKey = selectedMemberForRoles.toLowerCase();
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              if (!target) return;
              target.memberRoles = target.memberRoles || {};
              const list = target.memberRoles[uKey] || [];
              const idx = list.indexOf(rId);
              if (idx >= 0) list.splice(idx, 1);
              else list.push(rId);
              target.memberRoles[uKey] = list;
            }, 'chat');
            renderModalContent(modal, close);
          });
        });
      }

      if (currentTab === 'channels') {
        modal.querySelector('#srv-add-channel-form').addEventListener('submit', (ev) => {
          ev.preventDefault();
          const rawName = modal.querySelector('#srv-new-ch-name').value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
          if (!rawName) return;
          const chId = window.Vesper.Store.uid('ch');
          window.Vesper.Store.update((s) => {
            const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
            if (target) {
              target.channels.push({ id: chId, name: rawName, topic: '' });
              s.chat.messages[chId] = [];
              s.chat.activeChannelId = chId;
            }
          }, 'chat');
          renderModalContent(modal, close);
          window.Vesper.App.toast(`Created #${rawName}`);
        });

        modal.querySelectorAll('[data-delete-channel]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const chId = btn.dataset.deleteChannel;
            window.Vesper.Store.update((s) => {
              const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
              if (!target || target.channels.length <= 1) return;
              target.channels = target.channels.filter((c) => c.id !== chId);
              if (s.chat.activeChannelId === chId) {
                s.chat.activeChannelId = target.channels[0].id;
              }
            }, 'chat');
            renderModalContent(modal, close);
          });
        });
      }

      if (currentTab === 'invite') {
        modal.querySelector('#srv-copy-invite').addEventListener('click', () => {
          if (navigator.clipboard) navigator.clipboard.writeText(liveSrv.inviteCode).catch(() => {});
          window.Vesper.App.toast(`Copied invite code ${liveSrv.inviteCode}`);
        });
        modal.querySelector('#srv-regen-invite').addEventListener('click', () => {
          const fresh = window.Vesper.Store.makeInviteCode();
          window.Vesper.Store.update((s) => {
            const target = s.chat.servers.find((sv) => sv.id === liveSrv.id);
            if (target) target.inviteCode = fresh;
          }, 'chat');
          renderModalContent(modal, close);
          window.Vesper.App.toast(`Generated new invite code ${fresh}`);
        });
      }
    }

    openModal('<div class="modal-card wide"></div>', (modal, close) => {
      renderModalContent(modal, close);
    });
  }

  /* ========================================================================
     4. CREATE SERVER / JOIN SERVER / CREATE CHANNEL / NEW DM / PINS MODALS
     ======================================================================== */
  function openCreateServerModal() {
    const Icons = window.Vesper.Icons;
    let draftIconUrl = null;
    let draftBannerUrl = null;

    openModal(`
      <div class="modal-card wide">
        <div class="modal-header">
          <h2 class="modal-title">create a server</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <form id="create-server-form" class="auth-form">
          <div class="media-upload-grid">
            <div class="media-upload-box">
              <span class="media-upload-label" id="new-srv-icon-lbl">server icon (optional)</span>
              <div class="media-upload-actions">
                <input type="file" id="new-srv-icon-file" accept="image/*" class="hidden" />
                <button type="button" class="btn-secondary" id="new-srv-icon-btn" style="padding:7px 11px;font-size:0.78rem;">
                  ${Icons.get('camera')} upload icon
                </button>
              </div>
            </div>
            <div class="media-upload-box">
              <span class="media-upload-label" id="new-srv-banner-lbl">server banner (optional)</span>
              <div class="media-upload-actions">
                <input type="file" id="new-srv-banner-file" accept="image/*" class="hidden" />
                <button type="button" class="btn-secondary" id="new-srv-banner-btn" style="padding:7px 11px;font-size:0.78rem;">
                  ${Icons.get('image')} upload banner
                </button>
              </div>
            </div>
          </div>

          <div class="custom-color-row">
            <div class="input-group">
              <label for="srv-name">server name</label>
              <input id="srv-name" type="text" placeholder="e.g. Squad Lounge" maxlength="32" required />
            </div>
            <div class="input-group">
              <label for="srv-icon">fallback letters or emoji</label>
              <input id="srv-icon" type="text" placeholder="e.g. SL or 🟣" maxlength="2" />
            </div>
          </div>

          <div class="input-group">
            <label for="srv-color">server accent color</label>
            <input id="srv-color" type="color" value="#8b5cf6" style="width:100%;height:40px;cursor:pointer;" />
          </div>

          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">create server</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      modal.querySelector('#srv-name').focus();

      const iconIn = modal.querySelector('#new-srv-icon-file');
      modal.querySelector('#new-srv-icon-btn').addEventListener('click', () => iconIn.click());
      iconIn.addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          draftIconUrl = await window.Vesper.Media.compressAvatar(f);
          modal.querySelector('#new-srv-icon-lbl').textContent = 'server icon (uploaded ✓)';
        } catch (err) {
          window.Vesper.App.toast(err.message || 'Invalid image');
        }
      });

      const bannerIn = modal.querySelector('#new-srv-banner-file');
      modal.querySelector('#new-srv-banner-btn').addEventListener('click', () => bannerIn.click());
      bannerIn.addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          draftBannerUrl = await window.Vesper.Media.compressBanner(f);
          modal.querySelector('#new-srv-banner-lbl').textContent = 'server banner (uploaded ✓)';
        } catch (err) {
          window.Vesper.App.toast(err.message || 'Invalid image');
        }
      });

      modal.querySelector('#create-server-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = modal.querySelector('#srv-name').value.trim();
        if (!name) return;
        const iconInput = modal.querySelector('#srv-icon').value.trim();
        const icon = iconInput || name.slice(0, 2).toUpperCase();
        const color = modal.querySelector('#srv-color').value || '#8b5cf6';
        const state = window.Vesper.Store.get();
        const srvId = window.Vesper.Store.uid('srv');
        const chId = window.Vesper.Store.uid('ch');
        const ownerRoleId = window.Vesper.Store.uid('role');
        const inviteCode = window.Vesper.Store.makeInviteCode();
        const creatorKey = state.session.username.toLowerCase();

        window.Vesper.Store.update((s) => {
          s.chat.servers.push({
            id: srvId,
            name,
            icon,
            iconUrl: draftIconUrl,
            bannerUrl: draftBannerUrl,
            bannerColor: color,
            color,
            inviteCode,
            owner: state.session.username,
            roles: [
              {
                id: ownerRoleId,
                name: 'Owner',
                color: '#c084fc',
                hoist: true,
                permissions: window.Vesper.Store.createPermissions({
                  administrator: true,
                  manageServer: true,
                  manageRoles: true,
                  manageChannels: true,
                  manageMessages: true
                })
              },
              {
                id: window.Vesper.Store.uid('role'),
                name: 'Member',
                color: '#a78bfa',
                hoist: false,
                permissions: window.Vesper.Store.createPermissions()
              }
            ],
            memberRoles: {
              [creatorKey]: [ownerRoleId]
            },
            channels: [
              { id: chId, name: 'general', topic: `Welcome to ${name}! Invite code: ${inviteCode}` }
            ]
          });
          s.chat.messages[chId] = [{
            id: window.Vesper.Store.uid('msg'),
            author: 'Vesper System',
            avatarColor: color,
            badge: 'SYSTEM',
            text: `**${state.session.displayName || state.session.username}** created **${name}**! Share invite code \`${inviteCode}\` or open Server Settings to customize banners & roles.`,
            timestamp: Date.now(),
            reactions: { '🎉': ['Vesper System'] }
          }];
          s.chat.activeView = 'server';
          s.chat.activeServerId = srvId;
          s.chat.activeChannelId = chId;
        }, 'chat');

        close();
        window.Vesper.App.toast(`Server "${name}" created`);
      });
    });
  }

  function openJoinServerModal() {
    const Icons = window.Vesper.Icons;
    openModal(`
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">join a server</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <p class="modal-body" style="margin-bottom:14px;">Enter a Vesper invite code (like <strong>VSP-PRIME</strong>) to jump into a server.</p>
        <form id="join-server-form" class="auth-form">
          <div class="input-group">
            <label for="invite-input">invite code</label>
            <input id="invite-input" type="text" placeholder="VSP-XXXXX" required />
          </div>
          <div id="join-error" class="auth-error hidden"></div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">join server</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      modal.querySelector('#invite-input').focus();
      modal.querySelector('#join-server-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const code = modal.querySelector('#invite-input').value.trim().toUpperCase();
        const err = modal.querySelector('#join-error');
        const state = window.Vesper.Store.get();
        const match = state.chat.servers.find((s) => s.inviteCode.toUpperCase() === code);
        if (!match) {
          err.textContent = 'No server matched that invite code. Try VSP-PRIME or create a new server!';
          err.classList.remove('hidden');
          return;
        }
        window.Vesper.Store.update((s) => {
          s.chat.activeView = 'server';
          s.chat.activeServerId = match.id;
          s.chat.activeChannelId = match.channels[0].id;
        }, 'chat');
        close();
        window.Vesper.App.toast(`Switched to ${match.name}`);
      });
    });
  }

  function openCreateChannelModal(server) {
    const Icons = window.Vesper.Icons;
    openModal(`
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">create text channel</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <form id="create-channel-form" class="auth-form">
          <div class="input-group">
            <label for="ch-name">channel name</label>
            <input id="ch-name" type="text" placeholder="e.g. memes" maxlength="24" required />
          </div>
          <div class="input-group">
            <label for="ch-topic">topic (optional)</label>
            <input id="ch-topic" type="text" placeholder="What is this channel about?" maxlength="100" />
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">create channel</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      modal.querySelector('#ch-name').focus();
      modal.querySelector('#create-channel-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const rawName = modal.querySelector('#ch-name').value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
        if (!rawName) return;
        const topic = modal.querySelector('#ch-topic').value.trim();
        const chId = window.Vesper.Store.uid('ch');
        window.Vesper.Store.update((s) => {
          const target = s.chat.servers.find((sv) => sv.id === server.id);
          if (target) {
            target.channels.push({ id: chId, name: rawName, topic });
            s.chat.messages[chId] = [];
            s.chat.activeChannelId = chId;
          }
        }, 'chat');
        close();
        window.Vesper.App.toast(`Created #${rawName}`);
      });
    });
  }

  function openNewDmModal() {
    const Icons = window.Vesper.Icons;
    openModal(`
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">new direct message</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <form id="new-dm-form" class="auth-form">
          <div class="input-group">
            <label for="dm-peer-name">username</label>
            <input id="dm-peer-name" type="text" placeholder="Enter a username to message" maxlength="24" required />
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">start dm</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      modal.querySelector('#dm-peer-name').focus();
      modal.querySelector('#new-dm-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const peerName = modal.querySelector('#dm-peer-name').value.trim();
        if (!peerName) return;
        close();
        startOrOpenDm(peerName);
      });
    });
  }

  function openPinnedModal(threadId, threadTitle) {
    const Icons = window.Vesper.Icons;
    const state = window.Vesper.Store.get();
    const pinIds = (state.chat.pins && state.chat.pins[threadId]) || [];
    const threadMsgs = state.chat.messages[threadId] || [];
    const pinnedMsgs = threadMsgs.filter((m) => pinIds.includes(m.id));

    openModal(`
      <div class="modal-card wide">
        <div class="modal-header">
          <h2 class="modal-title">pinned messages · ${escapeHtml(threadTitle)}</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        ${pinnedMsgs.length === 0 ? `
          <p class="modal-body" style="text-align:center;padding:24px 0;">
            No pinned messages here yet. Hover any message and click the pin icon to save important posts!
          </p>
        ` : `
          <div style="display:flex;flex-direction:column;gap:10px;max-height:55vh;overflow-y:auto;">
            ${pinnedMsgs.map((m) => {
              const prof = window.Vesper.Store.getUserProfile(m.author);
              return `
                <div class="role-list-item" style="align-items:flex-start;flex-direction:column;gap:6px;">
                  <div style="width:100%;display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-weight:700;font-size:0.86rem;">${escapeHtml(prof.displayName)} <span style="color:var(--text-muted);font-weight:400;font-size:0.75rem;">${formatTime(m.timestamp)}</span></span>
                    <button type="button" class="btn-ghost" data-unpin-id="${escapeHtml(m.id)}" style="padding:3px 8px;font-size:0.74rem;color:#fca5a5;">unpin</button>
                  </div>
                  <div class="msg-text" style="font-size:0.86rem;">${renderMarkdown(m.text)}</div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `, (modal, close) => {
      modal.querySelectorAll('[data-unpin-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          togglePinMessage(threadId, btn.dataset.unpinId);
          close();
          openPinnedModal(threadId, threadTitle);
        });
      });
    });
  }

  /* ========================================================================
     5. MESSAGE OPERATIONS (Send, React, Edit, Delete, Pin)
     ======================================================================== */
  function sendMessage(text) {
    const clean = text.trim();
    if (!clean) return;

    const state = window.Vesper.Store.get();
    const session = state.session;
    const threadId = getActiveThreadId(state.chat);

    if (editingMsgId) {
      window.Vesper.Store.update((s) => {
        const list = s.chat.messages[threadId] || [];
        const target = list.find((m) => m.id === editingMsgId);
        if (target && target.author === session.username) {
          target.text = clean;
          target.edited = true;
        }
      }, 'chat');
      editingMsgId = null;
      return;
    }

    const msgObj = {
      id: window.Vesper.Store.uid('msg'),
      author: session.username,
      avatarColor: session.avatarColor || '#8b5cf6',
      text: clean,
      timestamp: Date.now(),
      reactions: {},
      replyTo: replyTarget ? { author: replyTarget.author, text: replyTarget.text.slice(0, 70) } : null
    };

    replyTarget = null;
    window.Vesper.Store.update((s) => {
      if (!s.chat.messages[threadId]) s.chat.messages[threadId] = [];
      s.chat.messages[threadId].push(msgObj);
    }, 'chat');
  }

  function toggleReaction(threadId, msgId, emoji) {
    const username = window.Vesper.Store.get().session.username;
    window.Vesper.Store.update((s) => {
      const msg = (s.chat.messages[threadId] || []).find((m) => m.id === msgId);
      if (!msg) return;
      msg.reactions = msg.reactions || {};
      const users = msg.reactions[emoji] || [];
      const idx = users.indexOf(username);
      if (idx >= 0) {
        users.splice(idx, 1);
        if (!users.length) delete msg.reactions[emoji];
      } else {
        users.push(username);
        msg.reactions[emoji] = users;
      }
    }, 'chat');
  }

  function togglePinMessage(threadId, msgId) {
    let wasPinned = false;
    window.Vesper.Store.update((s) => {
      s.chat.pins = s.chat.pins || {};
      const list = s.chat.pins[threadId] || [];
      const idx = list.indexOf(msgId);
      if (idx >= 0) {
        list.splice(idx, 1);
        wasPinned = false;
      } else {
        list.push(msgId);
        wasPinned = true;
      }
      s.chat.pins[threadId] = list;
    }, 'chat');
    window.Vesper.App.toast(wasPinned ? 'Message pinned' : 'Message unpinned');
  }

  function deleteMessage(threadId, msgId) {
    window.Vesper.Store.update((s) => {
      if (s.chat.messages[threadId]) {
        s.chat.messages[threadId] = s.chat.messages[threadId].filter((m) => m.id !== msgId);
      }
      if (s.chat.pins && s.chat.pins[threadId]) {
        s.chat.pins[threadId] = s.chat.pins[threadId].filter((id) => id !== msgId);
      }
    }, 'chat');
  }

  function renderLockedView(root) {
    const Icons = window.Vesper.Icons;
    root.innerHTML = `
      <div class="chat-locked-screen">
        <div class="chat-locked-card">
          <div class="chat-locked-icon">${Icons.get('lock')}</div>
          <h2>chat is locked in guest mode</h2>
          <p>
            Create a free Vesper account or sign in to unlock real-time servers, custom profile pictures & banners, roles, and direct messages.
          </p>
          <div style="display:flex;gap:10px;justify-content:center;">
            <button type="button" class="btn-secondary" id="locked-signin-btn">sign in</button>
            <button type="button" class="btn-primary" id="locked-signup-btn">create account</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('locked-signin-btn').addEventListener('click', () => window.Vesper.Auth.openGate('signin'));
    document.getElementById('locked-signup-btn').addEventListener('click', () => window.Vesper.Auth.openGate('signup'));
  }

  /* ========================================================================
     6. MAIN CHAT RENDER
     ======================================================================== */
  function render() {
    const root = document.getElementById('view-chat');
    if (!root) return;

    const state = window.Vesper.Store.get();
    const session = state.session;
    if (!session || session.mode === 'guest') {
      renderLockedView(root);
      return;
    }

    const Icons = window.Vesper.Icons;
    const chat = state.chat;
    const isDm = chat.activeView === 'dm';
    const activeServer = chat.servers.find((s) => s.id === chat.activeServerId) || chat.servers[0];
    const activeChannel = activeServer.channels.find((c) => c.id === chat.activeChannelId) || activeServer.channels[0];
    const activeDm = chat.dms.find((d) => d.id === chat.activeDmId) || chat.dms[0];
    const threadId = isDm ? activeDm.id : activeChannel.id;
    const rawMessages = chat.messages[threadId] || [];
    const pinIds = (chat.pins && chat.pins[threadId]) || [];

    const visibleMessages = channelSearchOpen && channelSearchQuery.trim()
      ? rawMessages.filter((m) =>
          m.text.toLowerCase().includes(channelSearchQuery.toLowerCase()) ||
          m.author.toLowerCase().includes(channelSearchQuery.toLowerCase())
        )
      : rawMessages;

    const myProfile = window.Vesper.Store.getUserProfile(session.username);
    const canSend = isDm || window.Vesper.Store.hasPermission(activeServer, session.username, 'sendMessages');
    const canReact = isDm || window.Vesper.Store.hasPermission(activeServer, session.username, 'addReactions');
    const canManageMsgs = isDm || window.Vesper.Store.hasPermission(activeServer, session.username, 'manageMessages');
    const canManageChannels = !isDm && window.Vesper.Store.hasPermission(activeServer, session.username, 'manageChannels');

    // Build member list with live profiles & server roles
    const registeredAccounts = Object.values(state.accounts || {});
    const rawMembers = [
      myProfile,
      window.Vesper.Store.getUserProfile('Vesper System'),
      ...registeredAccounts
        .filter((acc) => acc.username.toLowerCase() !== session.username.toLowerCase())
        .map((acc) => window.Vesper.Store.getUserProfile(acc.username))
    ];

    const enrichedMembers = rawMembers.map((prof) => {
      const roles = window.Vesper.Store.getMemberRoles(activeServer, prof.username);
      const topRole = roles.length ? roles[0] : null;
      const hoistedRole = roles.find((r) => r.hoist) || null;
      return {
        ...prof,
        roles,
        nameColor: topRole ? topRole.color : '',
        hoistedRole
      };
    });

    // Group members by Hoisted Roles (Discord-style)
    const memberGroups = [];
    const placedUsernames = new Set();

    (activeServer.roles || []).filter((r) => r.hoist).forEach((role) => {
      const groupMembers = enrichedMembers.filter((m) => !placedUsernames.has(m.username.toLowerCase()) && m.hoistedRole && m.hoistedRole.id === role.id);
      if (groupMembers.length) {
        groupMembers.forEach((m) => placedUsernames.add(m.username.toLowerCase()));
        memberGroups.push({ title: `${role.name} — ${groupMembers.length}`, members: groupMembers });
      }
    });

    const unhoistedMembers = enrichedMembers.filter((m) => !placedUsernames.has(m.username.toLowerCase()));
    if (unhoistedMembers.length) {
      memberGroups.push({ title: `Members — ${unhoistedMembers.length}`, members: unhoistedMembers });
    }

    root.innerHTML = `
      <div class="chat-shell">
        <div id="chat-frame" class="chat-frame ${mobileDrawerOpen ? 'drawer-open' : ''}">
          <div id="chat-nav-drawer" class="chat-nav-drawer">
            <!-- Column 1: Server Rail -->
            <aside class="server-rail" aria-label="Servers">
              <div class="server-pill-wrap ${isDm ? 'active' : ''}">
                <span class="server-pill-indicator"></span>
                <button type="button" class="server-icon-btn" id="rail-dm-btn" title="Direct Messages">
                  ${Icons.get('chat')}
                </button>
              </div>
              <div class="rail-divider"></div>
              ${chat.servers.map((srv) => {
                const isActive = !isDm && activeServer.id === srv.id;
                return `
                  <div class="server-pill-wrap ${isActive ? 'active' : ''}">
                    <span class="server-pill-indicator"></span>
                    <button
                      type="button"
                      class="server-icon-btn ${srv.iconUrl ? 'has-img' : ''}"
                      data-server-id="${escapeHtml(srv.id)}"
                      title="${escapeHtml(srv.name)}"
                      style="${isActive && !srv.iconUrl ? `background:${escapeHtml(srv.color)};` : ''}"
                    >${srv.iconUrl
                      ? `<img class="server-icon-img" src="${escapeHtml(srv.iconUrl)}" alt="${escapeHtml(srv.name)}" />`
                      : escapeHtml(srv.icon)
                    }</button>
                  </div>
                `;
              }).join('')}
              <div class="rail-divider"></div>
              <div class="server-pill-wrap">
                <button type="button" class="server-icon-btn action-btn" id="rail-create-server" title="Create Server">
                  ${Icons.get('plus')}
                </button>
              </div>
              <div class="server-pill-wrap">
                <button type="button" class="server-icon-btn" id="rail-join-server" title="Join Server by Code">
                  ${Icons.get('compass')}
                </button>
              </div>
            </aside>

            <!-- Column 2: Channels / DMs Sidebar -->
            <aside class="channels-sidebar" aria-label="Channels and Direct Messages">
              ${!isDm && activeServer.bannerUrl ? `
                <div class="sidebar-banner-wrap" style="background-image:url('${escapeHtml(activeServer.bannerUrl)}');">
                  <div class="sidebar-banner-overlay"></div>
                  <div class="sidebar-banner-top">
                    <button type="button" class="icon-btn sidebar-banner-btn" id="server-invite-btn" title="Invite People">${Icons.get('userPlus')}</button>
                    <button type="button" class="icon-btn sidebar-banner-btn" id="server-settings-btn" title="Server Settings">${Icons.get('sliders')}</button>
                    <button type="button" class="icon-btn sidebar-banner-btn mobile-back-to-chat-btn" id="mobile-close-drawer-btn" title="Back to Chat">
                      ${Icons.get('arrowRight')}
                    </button>
                  </div>
                  <div class="sidebar-banner-bottom">
                    <button type="button" class="sidebar-title-btn" id="server-header-title-btn" title="Server Settings">
                      <span class="sidebar-title" style="color:#ffffff;text-shadow:0 2px 8px rgba(0,0,0,0.8);">${escapeHtml(activeServer.name)}</span>
                    </button>
                  </div>
                </div>
              ` : `
                <div class="sidebar-header" style="${!isDm && activeServer.bannerColor ? `background:linear-gradient(90deg, ${escapeHtml(activeServer.bannerColor)}33, transparent);` : ''}">
                  ${isDm ? `
                    <span class="sidebar-title">Direct Messages</span>
                  ` : `
                    <button type="button" class="sidebar-title-btn" id="server-header-title-btn" title="Server Settings & Roles">
                      <span class="sidebar-title">${escapeHtml(activeServer.name)}</span>
                    </button>
                  `}
                  <div style="display:flex;align-items:center;gap:3px;">
                    ${isDm ? `
                      <button type="button" class="icon-btn" id="new-dm-btn" title="Start New DM">${Icons.get('plus')}</button>
                    ` : `
                      <button type="button" class="icon-btn" id="server-invite-btn" title="Invite People">${Icons.get('userPlus')}</button>
                      <button type="button" class="icon-btn" id="server-settings-btn" title="Server Settings & Roles">${Icons.get('sliders')}</button>
                    `}
                    <button type="button" class="icon-btn mobile-back-to-chat-btn" id="mobile-close-drawer-btn" title="Back to Chat">
                      ${Icons.get('arrowRight')}
                    </button>
                  </div>
                </div>
              `}

              <div class="sidebar-scroll">
                ${isDm ? `
                  <div class="sidebar-section-header">
                    <span>Conversations</span>
                  </div>
                  ${chat.dms.map((dm) => {
                    const peerProf = window.Vesper.Store.getUserProfile(dm.peerName);
                    return `
                      <button type="button" class="channel-item ${activeDm.id === dm.id ? 'active' : ''}" data-dm-id="${escapeHtml(dm.id)}">
                        <span class="dm-avatar-sm" style="background:${escapeHtml(peerProf.avatarColor)};">
                          ${renderAvatarInner(peerProf)}
                          <span class="presence-dot ${escapeHtml(peerProf.status || 'online')}"></span>
                        </span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(peerProf.displayName)}</span>
                        ${dm.peerBadge ? `<span class="msg-badge">${escapeHtml(dm.peerBadge)}</span>` : ''}
                      </button>
                    `;
                  }).join('')}
                ` : `
                  <div class="sidebar-section-header">
                    <span>Text Channels</span>
                    ${canManageChannels ? `<button type="button" class="icon-btn" id="create-channel-btn" style="width:22px;height:22px;" title="Create Channel">${Icons.get('plus')}</button>` : ''}
                  </div>
                  ${activeServer.channels.map((ch) => `
                    <button type="button" class="channel-item ${activeChannel.id === ch.id ? 'active' : ''}" data-channel-id="${escapeHtml(ch.id)}">
                      ${Icons.get('hash')}
                      <span>${escapeHtml(ch.name)}</span>
                    </button>
                  `).join('')}
                `}
              </div>

              <div class="user-panel">
                <button type="button" class="user-panel-profile" id="open-profile-btn" title="Customize Profile (PFP, Banner, Display Name)">
                  <span class="dm-avatar-sm" style="background:${escapeHtml(myProfile.avatarColor)};">
                    ${renderAvatarInner(myProfile)}
                    <span class="presence-dot ${escapeHtml(myProfile.status || 'online')}"></span>
                  </span>
                  <span class="user-panel-info">
                    <span class="user-panel-name">${escapeHtml(myProfile.displayName)}</span>
                    <span class="user-panel-status">@${escapeHtml(myProfile.username)}</span>
                  </span>
                </button>
                <button type="button" class="icon-btn" id="chat-settings-shortcut" title="App Settings">
                  ${Icons.get('settings')}
                </button>
              </div>
            </aside>
          </div>

          <!-- Column 3: Main Chat Feed -->
          <div id="chat-main" class="chat-main">
            <header class="chat-topbar">
              <div class="chat-topbar-left">
                <button type="button" class="icon-btn mobile-menu-btn" id="mobile-drawer-toggle" title="Toggle Channels">
                  ${Icons.get('menu')}
                </button>
                <span class="chat-topbar-icon">${Icons.get(isDm ? 'chat' : 'hash')}</span>
                <span class="chat-channel-name">${isDm ? escapeHtml(window.Vesper.Store.getUserProfile(activeDm.peerName).displayName) : escapeHtml(activeChannel.name)}</span>
                ${!isDm && activeChannel.topic ? `<span class="chat-channel-topic">${escapeHtml(activeChannel.topic)}</span>` : ''}
              </div>
              <div class="chat-topbar-actions">
                <button type="button" class="icon-btn ${pinIds.length ? 'active-toggle' : ''}" id="open-pins-btn" title="Pinned Messages (${pinIds.length})">
                  ${Icons.get('pin')}
                </button>
                <button type="button" class="icon-btn ${channelSearchOpen ? 'active-toggle' : ''}" id="toggle-search-btn" title="Search Messages">
                  ${Icons.get('search')}
                </button>
                ${!isDm ? `
                  <button type="button" class="icon-btn" id="toggle-members-btn" title="Toggle Member List">
                    ${Icons.get('users')}
                  </button>
                ` : ''}
              </div>
            </header>

            ${channelSearchOpen ? `
              <div class="chat-search-bar">
                <input id="channel-search-input" type="search" placeholder="Search messages in this chat..." value="${escapeHtml(channelSearchQuery)}" />
                <button type="button" class="icon-btn" id="close-search-btn" title="Close Search">${Icons.get('x')}</button>
              </div>
            ` : ''}

            <div class="chat-body-split">
              <div class="chat-messages-col">
                <div class="messages-feed" id="messages-feed">
                  <div class="channel-welcome-banner">
                    <div class="welcome-hash-circle">${Icons.get(isDm ? 'chat' : 'hash')}</div>
                    <h3>${isDm ? escapeHtml(window.Vesper.Store.getUserProfile(activeDm.peerName).displayName) : `Welcome to #${escapeHtml(activeChannel.name)}!`}</h3>
                    <p>${isDm
                      ? `This is the beginning of your direct message history with @${escapeHtml(activeDm.peerName)}.`
                      : escapeHtml(activeChannel.topic || `Start chatting in #${activeChannel.name}.`)
                    }</p>
                  </div>

                  ${visibleMessages.map((msg, idx) => {
                    const prev = visibleMessages[idx - 1];
                    const grouped = prev && prev.author === msg.author && (msg.timestamp - prev.timestamp < 300000) && !msg.replyTo;
                    const isMine = msg.author.toLowerCase() === session.username.toLowerCase();
                    const isPinned = pinIds.includes(msg.id);
                    const reactionEntries = Object.entries(msg.reactions || {});
                    const authorProf = window.Vesper.Store.getUserProfile(msg.author);
                    const authorRole = !isDm ? window.Vesper.Store.getHighestRole(activeServer, msg.author) : null;
                    const authorColorStyle = authorRole ? `color:${escapeHtml(authorRole.color)};` : '';
                    const replyProf = msg.replyTo ? window.Vesper.Store.getUserProfile(msg.replyTo.author) : null;

                    return `
                      <div class="msg-row ${grouped ? 'grouped' : ''} ${isPinned ? 'pinned-msg' : ''}" data-msg-id="${escapeHtml(msg.id)}">
                        ${grouped
                          ? `<div class="msg-avatar-spacer">${formatTime(msg.timestamp)}</div>`
                          : `<div class="msg-avatar" data-inspect-user="${escapeHtml(msg.author)}" style="background:${escapeHtml(authorProf.avatarColor)};">${renderAvatarInner(authorProf)}</div>`
                        }
                        <div class="msg-content-col">
                          ${msg.replyTo ? `
                            <div class="msg-reply-preview">
                              <span>Replying to <strong>${escapeHtml(replyProf.displayName)}</strong>: ${escapeHtml(msg.replyTo.text)}</span>
                            </div>
                          ` : ''}
                          ${!grouped ? `
                            <div class="msg-header">
                              <span class="msg-author" data-inspect-user="${escapeHtml(msg.author)}" style="${authorColorStyle}">${escapeHtml(authorProf.displayName)}</span>
                              ${(msg.badge || authorProf.badge) ? `<span class="msg-badge">${escapeHtml(msg.badge || authorProf.badge)}</span>` : ''}
                              ${isPinned ? `<span class="msg-pin-tag">📌 pinned</span>` : ''}
                              <span class="msg-time">${formatTime(msg.timestamp)}</span>
                            </div>
                          ` : ''}
                          <div class="msg-text">${renderMarkdown(msg.text)}${msg.edited ? '<span class="msg-edited">(edited)</span>' : ''}</div>
                          ${reactionEntries.length ? `
                            <div class="msg-reactions">
                              ${reactionEntries.map(([emoji, users]) => `
                                <button
                                  type="button"
                                  class="reaction-pill ${users.includes(session.username) ? 'active' : ''}"
                                  data-react-msg="${escapeHtml(msg.id)}"
                                  data-react-emoji="${escapeHtml(emoji)}"
                                >
                                  <span>${emoji}</span>
                                  <span>${users.length}</span>
                                </button>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>

                        <div class="msg-actions">
                          ${canReact ? `<button type="button" class="msg-action-btn" data-quick-react="${escapeHtml(msg.id)}" data-emoji="🔥" title="React 🔥">🔥</button>` : ''}
                          ${canReact ? `<button type="button" class="msg-action-btn" data-quick-react="${escapeHtml(msg.id)}" data-emoji="🟣" title="React 🟣">🟣</button>` : ''}
                          ${canSend ? `<button type="button" class="msg-action-btn" data-reply-msg="${escapeHtml(msg.id)}" title="Reply">${Icons.get('reply')}</button>` : ''}
                          ${canManageMsgs ? `<button type="button" class="msg-action-btn" data-pin-msg="${escapeHtml(msg.id)}" title="${isPinned ? 'Unpin' : 'Pin'}">${Icons.get('pin')}</button>` : ''}
                          ${isMine ? `<button type="button" class="msg-action-btn" data-edit-msg="${escapeHtml(msg.id)}" title="Edit">${Icons.get('edit')}</button>` : ''}
                          ${(isMine || canManageMsgs) ? `<button type="button" class="msg-action-btn danger" data-delete-msg="${escapeHtml(msg.id)}" title="Delete">${Icons.get('trash')}</button>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="chat-composer-wrap">
                  ${replyTarget ? `
                    <div class="reply-banner">
                      <span>Replying to <strong>${escapeHtml(window.Vesper.Store.getUserProfile(replyTarget.author).displayName)}</strong></span>
                      <button type="button" class="icon-btn" id="cancel-reply-btn" style="width:24px;height:24px;">${Icons.get('x')}</button>
                    </div>
                  ` : ''}
                  ${editingMsgId ? `
                    <div class="reply-banner">
                      <span>Editing message — press Enter to save</span>
                      <button type="button" class="icon-btn" id="cancel-edit-btn" style="width:24px;height:24px;">${Icons.get('x')}</button>
                    </div>
                  ` : ''}

                  ${emojiPickerOpen ? `
                    <div class="emoji-popover" id="emoji-popover">
                      ${QUICK_EMOJIS.map((em) => `<button type="button" class="emoji-btn" data-insert-emoji="${em}">${em}</button>`).join('')}
                    </div>
                  ` : ''}

                  ${canSend ? `
                    <form id="chat-composer-form" class="chat-composer">
                      <textarea
                        id="chat-input"
                        rows="1"
                        placeholder="${isDm ? `Message ${escapeHtml(window.Vesper.Store.getUserProfile(activeDm.peerName).displayName)}` : `Message #${escapeHtml(activeChannel.name)}`}"
                      ></textarea>
                      <button type="button" class="icon-btn" id="emoji-toggle-btn" title="Emojis">${Icons.get('smile')}</button>
                      <button type="submit" class="icon-btn" style="color:var(--accent-soft);" title="Send">${Icons.get('send')}</button>
                    </form>
                  ` : `
                    <div class="chat-composer" style="opacity:0.7;justify-content:center;padding:12px;color:var(--text-muted);font-size:0.84rem;">
                      ${Icons.get('lock')} &nbsp; You do not have permission to send messages in this server.
                    </div>
                  `}
                </div>
              </div>

              ${showMembers && !isDm ? `
                <aside class="members-drawer" aria-label="Members">
                  ${memberGroups.map((grp) => `
                    <div>
                      <div class="members-group-title">${escapeHtml(grp.title)}</div>
                      ${grp.members.map((m) => `
                        <button type="button" class="member-item" data-inspect-user="${escapeHtml(m.username)}">
                          <span class="dm-avatar-sm" style="background:${escapeHtml(m.avatarColor)};">
                            ${renderAvatarInner(m)}
                            <span class="presence-dot ${escapeHtml(m.status || 'online')}"></span>
                          </span>
                          <span class="member-meta">
                            <span class="member-name" style="${m.nameColor ? `color:${escapeHtml(m.nameColor)};` : ''}">
                              ${escapeHtml(m.displayName)} ${m.badge ? `<span class="msg-badge">${escapeHtml(m.badge)}</span>` : ''}
                            </span>
                            ${state.settings.showActivity && m.bio ? `<span class="member-activity">${escapeHtml(m.bio)}</span>` : ''}
                          </span>
                        </button>
                      `).join('')}
                    </div>
                  `).join('')}
                </aside>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    // Scroll to bottom of message feed
    const feed = document.getElementById('messages-feed');
    if (feed) feed.scrollTop = feed.scrollHeight;

    // Bind Rail events
    document.getElementById('rail-dm-btn').addEventListener('click', () => {
      channelSearchOpen = false;
      channelSearchQuery = '';
      window.Vesper.Store.update((s) => { s.chat.activeView = 'dm'; }, 'chat');
    });
    document.getElementById('rail-create-server').addEventListener('click', openCreateServerModal);
    document.getElementById('rail-join-server').addEventListener('click', openJoinServerModal);

    root.querySelectorAll('[data-server-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srv = chat.servers.find((s) => s.id === btn.dataset.serverId);
        if (!srv) return;
        channelSearchOpen = false;
        channelSearchQuery = '';
        window.Vesper.Store.update((s) => {
          s.chat.activeView = 'server';
          s.chat.activeServerId = srv.id;
          s.chat.activeChannelId = srv.channels[0].id;
        }, 'chat');
      });
    });

    // Sidebar events
    root.querySelectorAll('[data-channel-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileDrawerOpen = false;
        replyTarget = null;
        editingMsgId = null;
        channelSearchOpen = false;
        channelSearchQuery = '';
        window.Vesper.Store.update((s) => {
          s.chat.activeChannelId = btn.dataset.channelId;
        }, 'chat');
      });
    });

    root.querySelectorAll('[data-dm-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileDrawerOpen = false;
        replyTarget = null;
        editingMsgId = null;
        channelSearchOpen = false;
        channelSearchQuery = '';
        window.Vesper.Store.update((s) => {
          s.chat.activeDmId = btn.dataset.dmId;
        }, 'chat');
      });
    });

    const createChBtn = document.getElementById('create-channel-btn');
    if (createChBtn) createChBtn.addEventListener('click', () => openCreateChannelModal(activeServer));

    const inviteBtn = document.getElementById('server-invite-btn');
    if (inviteBtn) inviteBtn.addEventListener('click', () => openServerSettingsModal(activeServer, 'invite'));

    const srvSettingsBtn = document.getElementById('server-settings-btn');
    if (srvSettingsBtn) srvSettingsBtn.addEventListener('click', () => openServerSettingsModal(activeServer, 'overview'));

    const srvHeaderTitleBtn = document.getElementById('server-header-title-btn');
    if (srvHeaderTitleBtn) srvHeaderTitleBtn.addEventListener('click', () => openServerSettingsModal(activeServer, 'overview'));

    const newDmBtn = document.getElementById('new-dm-btn');
    if (newDmBtn) newDmBtn.addEventListener('click', openNewDmModal);

    document.getElementById('open-profile-btn').addEventListener('click', openProfileModal);
    document.getElementById('chat-settings-shortcut').addEventListener('click', () => window.Vesper.App.navigate('settings'));

    const toggleMembersBtn = document.getElementById('toggle-members-btn');
    if (toggleMembersBtn) {
      toggleMembersBtn.addEventListener('click', () => {
        showMembers = !showMembers;
        render();
      });
    }

    // Pins & Search topbar controls
    document.getElementById('open-pins-btn').addEventListener('click', () => {
      const title = isDm ? window.Vesper.Store.getUserProfile(activeDm.peerName).displayName : `#${activeChannel.name}`;
      openPinnedModal(threadId, title);
    });

    document.getElementById('toggle-search-btn').addEventListener('click', () => {
      channelSearchOpen = !channelSearchOpen;
      if (!channelSearchOpen) channelSearchQuery = '';
      render();
      if (channelSearchOpen) {
        const sInput = document.getElementById('channel-search-input');
        if (sInput) sInput.focus();
      }
    });

    const closeSearchBtn = document.getElementById('close-search-btn');
    if (closeSearchBtn) {
      closeSearchBtn.addEventListener('click', () => {
        channelSearchOpen = false;
        channelSearchQuery = '';
        render();
      });
    }

    const chSearchInput = document.getElementById('channel-search-input');
    if (chSearchInput) {
      chSearchInput.addEventListener('input', (ev) => {
        channelSearchQuery = ev.target.value;
        render();
        const next = document.getElementById('channel-search-input');
        if (next) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
    }

    // Click any avatar or username to open Discord Profile Popout
    root.querySelectorAll('[data-inspect-user]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openUserPopout(el.dataset.inspectUser);
      });
    });

    // Mobile Drawer Toggle & Swipe Gestures
    const chatFrame = document.getElementById('chat-frame');
    const navDrawer = document.getElementById('chat-nav-drawer');
    const chatMainEl = document.getElementById('chat-main');

    function setMobileDrawer(open) {
      mobileDrawerOpen = !!open;
      if (chatFrame) {
        chatFrame.classList.toggle('drawer-open', mobileDrawerOpen);
      }
      if (mobileDrawerOpen && document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }

    const mobileBtn = document.getElementById('mobile-drawer-toggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => setMobileDrawer(!mobileDrawerOpen));
    }

    const mobileCloseBtn = document.getElementById('mobile-close-drawer-btn');
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', () => setMobileDrawer(false));
    }

    if (chatFrame && navDrawer && chatMainEl) {
      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let lastX = 0;
      let lockedAxis = null;
      let isTracking = false;

      chatFrame.addEventListener('touchstart', (ev) => {
        if (window.innerWidth > 720 || ev.touches.length !== 1) return;
        if (ev.target && ev.target.closest('input, textarea, select')) return;
        const t = ev.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        lastX = t.clientX;
        startTime = Date.now();
        lockedAxis = null;
        isTracking = true;
      }, { passive: true });

      chatFrame.addEventListener('touchmove', (ev) => {
        if (!isTracking || window.innerWidth > 720 || ev.touches.length !== 1) return;
        const t = ev.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        lastX = t.clientX;

        if (!lockedAxis) {
          if (Math.hypot(dx, dy) < 10) return;
          if (Math.abs(dx) > Math.abs(dy) * 1.15) {
            if ((!mobileDrawerOpen && dx > 0) || (mobileDrawerOpen && dx < 0)) {
              lockedAxis = 'x';
              chatFrame.classList.add('is-dragging');
            } else {
              lockedAxis = 'y';
              return;
            }
          } else {
            lockedAxis = 'y';
            return;
          }
        }

        if (lockedAxis !== 'x') return;

        const width = Math.max(1, chatFrame.clientWidth);
        const progress = !mobileDrawerOpen
          ? Math.max(0, Math.min(1, dx / width))
          : Math.max(0, Math.min(1, 1 + dx / width));

        navDrawer.style.transform = `translateX(${(progress - 1) * 100}%)`;
        chatMainEl.style.transform = `translateX(${progress * 100}%)`;
      }, { passive: true });

      function finishSwipe() {
        if (!isTracking) return;
        isTracking = false;

        if (lockedAxis === 'x') {
          const width = Math.max(1, chatFrame.clientWidth);
          const dx = lastX - startX;
          const elapsed = Math.max(1, Date.now() - startTime);
          const velocity = dx / elapsed;

          chatFrame.classList.remove('is-dragging');
          navDrawer.style.transform = '';
          chatMainEl.style.transform = '';

          if (!mobileDrawerOpen) {
            setMobileDrawer(dx > width * 0.24 || velocity > 0.35);
          } else {
            setMobileDrawer(!(dx < -width * 0.24 || velocity < -0.35));
          }
        }
        lockedAxis = null;
      }

      chatFrame.addEventListener('touchend', finishSwipe, { passive: true });
      chatFrame.addEventListener('touchcancel', finishSwipe, { passive: true });
    }

    // Message actions
    root.querySelectorAll('[data-react-msg]').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(threadId, btn.dataset.reactMsg, btn.dataset.reactEmoji));
    });
    root.querySelectorAll('[data-quick-react]').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(threadId, btn.dataset.quickReact, btn.dataset.emoji));
    });
    root.querySelectorAll('[data-reply-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = rawMessages.find((m) => m.id === btn.dataset.replyMsg);
        if (target) {
          replyTarget = { id: target.id, author: target.author, text: target.text };
          editingMsgId = null;
          render();
          document.getElementById('chat-input').focus();
        }
      });
    });
    root.querySelectorAll('[data-pin-msg]').forEach((btn) => {
      btn.addEventListener('click', () => togglePinMessage(threadId, btn.dataset.pinMsg));
    });
    root.querySelectorAll('[data-edit-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = rawMessages.find((m) => m.id === btn.dataset.editMsg);
        if (target) {
          editingMsgId = target.id;
          replyTarget = null;
          render();
          const input = document.getElementById('chat-input');
          input.value = target.text;
          input.focus();
        }
      });
    });
    root.querySelectorAll('[data-delete-msg]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMessage(threadId, btn.dataset.deleteMsg));
    });

    const cancelReply = document.getElementById('cancel-reply-btn');
    if (cancelReply) cancelReply.addEventListener('click', () => { replyTarget = null; render(); });

    const cancelEdit = document.getElementById('cancel-edit-btn');
    if (cancelEdit) cancelEdit.addEventListener('click', () => { editingMsgId = null; render(); });

    // Composer & Emoji Picker
    const chatInput = document.getElementById('chat-input');
    const composerForm = document.getElementById('chat-composer-form');
    const emojiToggleBtn = document.getElementById('emoji-toggle-btn');

    if (composerForm && chatInput) {
      composerForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (!chatInput.value.trim()) return;
        emojiPickerOpen = false;
        sendMessage(chatInput.value);
      });

      chatInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          if (!chatInput.value.trim()) return;
          emojiPickerOpen = false;
          sendMessage(chatInput.value);
        }
      });
    }

    if (emojiToggleBtn) {
      emojiToggleBtn.addEventListener('click', () => {
        emojiPickerOpen = !emojiPickerOpen;
        render();
      });
    }

    root.querySelectorAll('[data-insert-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.insertEmoji;
        emojiPickerOpen = false;
        render();
        const nextInput = document.getElementById('chat-input');
        if (nextInput) {
          nextInput.value += val;
          nextInput.focus();
        }
      });
    });
  }

  window.Vesper.Chat = {
    render,
    openProfileModal
  };
})();
