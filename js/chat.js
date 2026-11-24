(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let showMembers = true;
  let mobileDrawerOpen = false;
  let replyTarget = null; // { id, author, text }
  let emojiPickerOpen = false;
  let editingMsgId = null;

  const QUICK_EMOJIS = ['🟣', '🔥', '😂', '💀', '👀', '🚀', '❤️', '👍', '✨', '🎮', '⚡', '👑'];

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
    return text;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function getActiveThreadId(chat) {
    return chat.activeView === 'dm' ? chat.activeDmId : chat.activeChannelId;
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

  function openCreateServerModal() {
    const Icons = window.Vesper.Icons;
    openModal(`
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">create a server</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <form id="create-server-form" class="auth-form">
          <div class="input-group">
            <label for="srv-name">server name</label>
            <input id="srv-name" type="text" placeholder="e.g. Squad Lounge" maxlength="32" required />
          </div>
          <div class="input-group">
            <label for="srv-icon">server icon (1-2 letters or emoji)</label>
            <input id="srv-icon" type="text" placeholder="e.g. SL or 🟣" maxlength="2" />
          </div>
          <div class="input-group">
            <label for="srv-color">server accent color</label>
            <input id="srv-color" type="color" value="#8b5cf6" style="width:100%;height:42px;cursor:pointer;" />
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">create server</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      const form = modal.querySelector('#create-server-form');
      modal.querySelector('#srv-name').focus();
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = modal.querySelector('#srv-name').value.trim();
        if (!name) return;
        const iconInput = modal.querySelector('#srv-icon').value.trim();
        const icon = iconInput || name.slice(0, 2).toUpperCase();
        const color = modal.querySelector('#srv-color').value || '#8b5cf6';
        const state = window.Vesper.Store.get();
        const srvId = window.Vesper.Store.uid('srv');
        const chId = window.Vesper.Store.uid('ch');
        const inviteCode = window.Vesper.Store.makeInviteCode();

        window.Vesper.Store.update((s) => {
          s.chat.servers.push({
            id: srvId,
            name,
            icon,
            color,
            inviteCode,
            owner: state.session.username,
            channels: [
              { id: chId, name: 'general', topic: `Welcome to ${name}! Invite code: ${inviteCode}` }
            ]
          });
          s.chat.messages[chId] = [{
            id: window.Vesper.Store.uid('msg'),
            author: 'Vesper System',
            avatarColor: color,
            badge: 'SYSTEM',
            text: `**${state.session.username}** created **${name}**! Share invite code \`${inviteCode}\` to invite friends.`,
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
      const form = modal.querySelector('#join-server-form');
      modal.querySelector('#invite-input').focus();
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const code = modal.querySelector('#invite-input').value.trim().toUpperCase();
        const err = modal.querySelector('#join-error');
        const state = window.Vesper.Store.get();
        const match = state.chat.servers.find((s) => s.inviteCode.toUpperCase() === code);
        if (!match) {
          err.textContent = 'No local server matched that invite code. Try VSP-PRIME or create a new server!';
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

  function openInviteModal(server) {
    const Icons = window.Vesper.Icons;
    openModal(`
      <div class="modal-card compact">
        <div class="modal-header">
          <h2 class="modal-title">invite to ${escapeHtml(server.name)}</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <p class="modal-body" style="margin-bottom:8px;">Share this server invite code:</p>
        <div class="invite-code-box">
          <span>${escapeHtml(server.inviteCode)}</span>
          <button type="button" class="btn-secondary" id="copy-invite-btn" style="padding:6px 12px;font-size:0.8rem;">
            ${Icons.get('copy')} copy
          </button>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-primary" data-close-modal>done</button>
        </div>
      </div>
    `, (modal) => {
      modal.querySelector('#copy-invite-btn').addEventListener('click', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(server.inviteCode).catch(() => {});
        }
        window.Vesper.App.toast(`Copied invite code ${server.inviteCode}`);
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
        const state = window.Vesper.Store.get();
        const existing = state.chat.dms.find((d) => d.peerName.toLowerCase() === peerName.toLowerCase());
        if (existing) {
          window.Vesper.Store.update((s) => {
            s.chat.activeView = 'dm';
            s.chat.activeDmId = existing.id;
          }, 'chat');
          close();
          return;
        }
        const dmId = window.Vesper.Store.uid('dm');
        window.Vesper.Store.update((s) => {
          s.chat.dms.push({
            id: dmId,
            peerName,
            peerColor: window.Vesper.Store.pickAvatarColor(peerName),
            peerStatus: 'online'
          });
          s.chat.messages[dmId] = [];
          s.chat.activeView = 'dm';
          s.chat.activeDmId = dmId;
        }, 'chat');
        close();
        window.Vesper.App.toast(`Started DM with ${peerName}`);
      });
    });
  }

  function openProfileModal() {
    const Icons = window.Vesper.Icons;
    const session = window.Vesper.Store.get().session;
    openModal(`
      <div class="modal-card">
        <div class="modal-header">
          <h2 class="modal-title">your chat profile</h2>
          <button type="button" class="icon-btn" data-close-modal>${Icons.get('x')}</button>
        </div>
        <form id="profile-form" class="auth-form">
          <div class="input-group">
            <label>username (synced from login)</label>
            <input type="text" value="${escapeHtml(session.username)}" disabled style="opacity:0.65;cursor:not-allowed;" />
          </div>
          <div class="input-group">
            <label for="prof-status">status</label>
            <select id="prof-status">
              <option value="online" ${session.status === 'online' ? 'selected' : ''}>Online</option>
              <option value="idle" ${session.status === 'idle' ? 'selected' : ''}>Idle</option>
              <option value="dnd" ${session.status === 'dnd' ? 'selected' : ''}>Do Not Disturb</option>
              <option value="offline" ${session.status === 'offline' ? 'selected' : ''}>Invisible</option>
            </select>
          </div>
          <div class="input-group">
            <label for="prof-bio">custom bio</label>
            <input id="prof-bio" type="text" value="${escapeHtml(session.bio || '')}" placeholder="Say something about yourself" maxlength="80" />
          </div>
          <div class="input-group">
            <label for="prof-color">avatar color</label>
            <input id="prof-color" type="color" value="${escapeHtml(session.avatarColor || '#8b5cf6')}" style="width:100%;height:40px;cursor:pointer;" />
          </div>
          <div class="modal-actions" style="margin-top:8px;">
            <button type="button" class="btn-secondary" data-close-modal>cancel</button>
            <button type="submit" class="btn-primary">save profile</button>
          </div>
        </form>
      </div>
    `, (modal, close) => {
      modal.querySelector('#profile-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const status = modal.querySelector('#prof-status').value;
        const bio = modal.querySelector('#prof-bio').value.trim();
        const avatarColor = modal.querySelector('#prof-color').value;
        window.Vesper.Store.update((s) => {
          s.session.status = status;
          s.session.bio = bio;
          s.session.avatarColor = avatarColor;
          if (s.session.accountKey && s.accounts[s.session.accountKey]) {
            s.accounts[s.session.accountKey].status = status;
            s.accounts[s.session.accountKey].bio = bio;
            s.accounts[s.session.accountKey].avatarColor = avatarColor;
          }
        }, 'chat');
        close();
        window.Vesper.App.toast('Profile updated');
      });
    });
  }

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

  function deleteMessage(threadId, msgId) {
    window.Vesper.Store.update((s) => {
      if (!s.chat.messages[threadId]) return;
      s.chat.messages[threadId] = s.chat.messages[threadId].filter((m) => m.id !== msgId);
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
            Create a free Vesper account or sign in to unlock real-time servers, channels, custom profiles, and direct messages.
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
    const messages = chat.messages[threadId] || [];

    const registeredAccounts = Object.values(state.accounts || {});
    const memberList = [
      {
        name: session.username,
        color: session.avatarColor,
        status: session.status || 'online',
        activity: state.settings.showActivity ? (session.bio || 'Using Vesper') : ''
      },
      {
        name: 'Vesper System',
        color: '#8b5cf6',
        status: 'online',
        activity: 'Vesper Core Bot',
        badge: 'BOT'
      },
      ...registeredAccounts
        .filter((acc) => acc.username !== session.username)
        .map((acc) => ({
          name: acc.username,
          color: acc.avatarColor || '#6366f1',
          status: acc.status || 'offline',
          activity: acc.bio || ''
        }))
    ];

    root.innerHTML = `
      <div class="chat-shell">
        <div class="chat-frame ${mobileDrawerOpen ? 'drawer-open' : ''}">
          <!-- Column 1: Server Rail -->
          <aside class="server-rail" aria-label="Servers">
            <div class="server-pill-wrap ${isDm ? 'active' : ''}">
              <span class="server-pill-indicator"></span>
              <button type="button" class="server-icon-btn" id="rail-dm-btn" title="Direct Messages">
                ${Icons.get('chat')}
              </button>
            </div>
            <div class="rail-divider"></div>
            ${chat.servers.map((srv) => `
              <div class="server-pill-wrap ${!isDm && activeServer.id === srv.id ? 'active' : ''}">
                <span class="server-pill-indicator"></span>
                <button
                  type="button"
                  class="server-icon-btn"
                  data-server-id="${escapeHtml(srv.id)}"
                  title="${escapeHtml(srv.name)}"
                  style="${!isDm && activeServer.id === srv.id ? `background:${escapeHtml(srv.color)};` : ''}"
                >${escapeHtml(srv.icon)}</button>
              </div>
            `).join('')}
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
            <div class="sidebar-header">
              <span class="sidebar-title">${isDm ? 'Direct Messages' : escapeHtml(activeServer.name)}</span>
              ${isDm ? `
                <button type="button" class="icon-btn" id="new-dm-btn" title="Start New DM">${Icons.get('plus')}</button>
              ` : `
                <button type="button" class="icon-btn" id="server-invite-btn" title="Invite Code">${Icons.get('userPlus')}</button>
              `}
            </div>

            <div class="sidebar-scroll">
              ${isDm ? `
                <div class="sidebar-section-header">
                  <span>Conversations</span>
                </div>
                ${chat.dms.map((dm) => `
                  <button type="button" class="channel-item ${activeDm.id === dm.id ? 'active' : ''}" data-dm-id="${escapeHtml(dm.id)}">
                    <span class="dm-avatar-sm" style="background:${escapeHtml(dm.peerColor)};">
                      ${escapeHtml(dm.peerName.slice(0, 1).toUpperCase())}
                      <span class="presence-dot ${escapeHtml(dm.peerStatus || 'online')}"></span>
                    </span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(dm.peerName)}</span>
                    ${dm.peerBadge ? `<span class="msg-badge">${escapeHtml(dm.peerBadge)}</span>` : ''}
                  </button>
                `).join('')}
              ` : `
                <div class="sidebar-section-header">
                  <span>Text Channels</span>
                  <button type="button" class="icon-btn" id="create-channel-btn" style="width:22px;height:22px;" title="Create Channel">${Icons.get('plus')}</button>
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
              <button type="button" class="user-panel-profile" id="open-profile-btn" title="Edit Profile">
                <span class="dm-avatar-sm" style="background:${escapeHtml(session.avatarColor)};">
                  ${escapeHtml(session.username.slice(0, 1).toUpperCase())}
                  <span class="presence-dot ${escapeHtml(session.status || 'online')}"></span>
                </span>
                <span class="user-panel-info">
                  <span class="user-panel-name">${escapeHtml(session.username)}</span>
                  <span class="user-panel-status">${escapeHtml(session.status || 'online')}</span>
                </span>
              </button>
              <button type="button" class="icon-btn" id="chat-settings-shortcut" title="Settings">
                ${Icons.get('settings')}
              </button>
            </div>
          </aside>

          <!-- Column 3: Main Chat Feed -->
          <div class="chat-main">
            <header class="chat-topbar">
              <div class="chat-topbar-left">
                <button type="button" class="icon-btn mobile-menu-btn" id="mobile-drawer-toggle" title="Toggle Channels">
                  ${Icons.get('menu')}
                </button>
                <span style="color:var(--accent-soft);display:flex;">${Icons.get(isDm ? 'chat' : 'hash')}</span>
                <span class="chat-channel-name">${isDm ? escapeHtml(activeDm.peerName) : escapeHtml(activeChannel.name)}</span>
                ${!isDm && activeChannel.topic ? `<span class="chat-channel-topic">${escapeHtml(activeChannel.topic)}</span>` : ''}
              </div>
              <div class="chat-topbar-actions">
                <button type="button" class="icon-btn" id="toggle-members-btn" title="Toggle Member List">
                  ${Icons.get('users')}
                </button>
              </div>
            </header>

            <div class="chat-body-split">
              <div class="chat-messages-col">
                <div class="messages-feed" id="messages-feed">
                  <div class="channel-welcome-banner">
                    <div class="welcome-hash-circle">${Icons.get(isDm ? 'chat' : 'hash')}</div>
                    <h3>${isDm ? escapeHtml(activeDm.peerName) : `Welcome to #${escapeHtml(activeChannel.name)}!`}</h3>
                    <p>${isDm
                      ? `This is the beginning of your direct message history with ${escapeHtml(activeDm.peerName)}.`
                      : escapeHtml(activeChannel.topic || `Start chatting in #${activeChannel.name}.`)
                    }</p>
                  </div>

                  ${messages.map((msg, idx) => {
                    const prev = messages[idx - 1];
                    const grouped = prev && prev.author === msg.author && (msg.timestamp - prev.timestamp < 300000) && !msg.replyTo;
                    const isMine = msg.author === session.username;
                    const reactionEntries = Object.entries(msg.reactions || {});

                    return `
                      <div class="msg-row ${grouped ? 'grouped' : ''}" data-msg-id="${escapeHtml(msg.id)}">
                        ${grouped
                          ? `<div class="msg-avatar-spacer">${formatTime(msg.timestamp)}</div>`
                          : `<div class="msg-avatar" style="background:${escapeHtml(msg.avatarColor || '#8b5cf6')};">${escapeHtml(msg.author.slice(0, 1).toUpperCase())}</div>`
                        }
                        <div class="msg-content-col">
                          ${msg.replyTo ? `
                            <div class="msg-reply-preview">
                              <span>Replying to <strong>${escapeHtml(msg.replyTo.author)}</strong>: ${escapeHtml(msg.replyTo.text)}</span>
                            </div>
                          ` : ''}
                          ${!grouped ? `
                            <div class="msg-header">
                              <span class="msg-author">${escapeHtml(msg.author)}</span>
                              ${msg.badge ? `<span class="msg-badge">${escapeHtml(msg.badge)}</span>` : ''}
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
                          <button type="button" class="msg-action-btn" data-quick-react="${escapeHtml(msg.id)}" data-emoji="🔥" title="React 🔥">🔥</button>
                          <button type="button" class="msg-action-btn" data-quick-react="${escapeHtml(msg.id)}" data-emoji="🟣" title="React 🟣">🟣</button>
                          <button type="button" class="msg-action-btn" data-reply-msg="${escapeHtml(msg.id)}" title="Reply">${Icons.get('reply')}</button>
                          ${isMine ? `<button type="button" class="msg-action-btn" data-edit-msg="${escapeHtml(msg.id)}" title="Edit">${Icons.get('edit')}</button>` : ''}
                          ${isMine ? `<button type="button" class="msg-action-btn danger" data-delete-msg="${escapeHtml(msg.id)}" title="Delete">${Icons.get('trash')}</button>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="chat-composer-wrap">
                  ${replyTarget ? `
                    <div class="reply-banner">
                      <span>Replying to <strong>${escapeHtml(replyTarget.author)}</strong></span>
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

                  <form id="chat-composer-form" class="chat-composer">
                    <textarea
                      id="chat-input"
                      rows="1"
                      placeholder="${isDm ? `Message @${escapeHtml(activeDm.peerName)}` : `Message #${escapeHtml(activeChannel.name)}`}"
                    ></textarea>
                    <button type="button" class="icon-btn" id="emoji-toggle-btn" title="Emojis">${Icons.get('smile')}</button>
                    <button type="submit" class="icon-btn" style="color:var(--accent-soft);" title="Send">${Icons.get('send')}</button>
                  </form>
                </div>
              </div>

              ${showMembers && !isDm ? `
                <aside class="members-drawer" aria-label="Members">
                  <div>
                    <div class="members-group-title">Members — ${memberList.length}</div>
                    ${memberList.map((m) => `
                      <div class="member-item">
                        <span class="dm-avatar-sm" style="background:${escapeHtml(m.color)};">
                          ${escapeHtml(m.name.slice(0, 1).toUpperCase())}
                          <span class="presence-dot ${escapeHtml(m.status)}"></span>
                        </span>
                        <span class="member-meta">
                          <span class="member-name">${escapeHtml(m.name)} ${m.badge ? `<span class="msg-badge">${escapeHtml(m.badge)}</span>` : ''}</span>
                          ${m.activity ? `<span class="member-activity">${escapeHtml(m.activity)}</span>` : ''}
                        </span>
                      </div>
                    `).join('')}
                  </div>
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
      window.Vesper.Store.update((s) => { s.chat.activeView = 'dm'; }, 'chat');
    });
    document.getElementById('rail-create-server').addEventListener('click', openCreateServerModal);
    document.getElementById('rail-join-server').addEventListener('click', openJoinServerModal);

    root.querySelectorAll('[data-server-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srv = chat.servers.find((s) => s.id === btn.dataset.serverId);
        if (!srv) return;
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
        window.Vesper.Store.update((s) => {
          s.chat.activeDmId = btn.dataset.dmId;
        }, 'chat');
      });
    });

    const createChBtn = document.getElementById('create-channel-btn');
    if (createChBtn) createChBtn.addEventListener('click', () => openCreateChannelModal(activeServer));

    const inviteBtn = document.getElementById('server-invite-btn');
    if (inviteBtn) inviteBtn.addEventListener('click', () => openInviteModal(activeServer));

    const newDmBtn = document.getElementById('new-dm-btn');
    if (newDmBtn) newDmBtn.addEventListener('click', openNewDmModal);

    document.getElementById('open-profile-btn').addEventListener('click', openProfileModal);
    document.getElementById('chat-settings-shortcut').addEventListener('click', () => window.Vesper.App.navigate('settings'));
    document.getElementById('toggle-members-btn').addEventListener('click', () => {
      showMembers = !showMembers;
      render();
    });

    const mobileBtn = document.getElementById('mobile-drawer-toggle');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        mobileDrawerOpen = !mobileDrawerOpen;
        render();
      });
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
        const target = messages.find((m) => m.id === btn.dataset.replyMsg);
        if (target) {
          replyTarget = { id: target.id, author: target.author, text: target.text };
          editingMsgId = null;
          render();
          document.getElementById('chat-input').focus();
        }
      });
    });
    root.querySelectorAll('[data-edit-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = messages.find((m) => m.id === btn.dataset.editMsg);
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

    document.getElementById('emoji-toggle-btn').addEventListener('click', () => {
      emojiPickerOpen = !emojiPickerOpen;
      render();
    });

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

  window.Vesper.Chat = { render };
})();
