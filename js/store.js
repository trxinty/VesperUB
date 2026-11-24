(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  const STORAGE_KEY = 'vesper_app_state_v1';
  const CHANNEL_NAME = 'vesper_live_sync_v1';
  let bc = null;
  const listeners = new Set();

  const AVATAR_PALETTE = [
    '#8b5cf6', '#6366f1', '#ec4899', '#3b82f6',
    '#10b981', '#f59e0b', '#ef4444', '#06b6d4'
  ];

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function makeInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'VSP-';
    for (let i = 0; i < 5; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function getDefaultSettings() {
    return {
      themePreset: 'vesper-purple',
      themeBase: '#060409',
      themeAccent: '#8b5cf6',
      dockPosition: 'bottom',
      ambientBg: true,
      performanceMode: false,
      cursorDot: false,
      compactChat: false,
      askBeforeLeaving: false,
      showActivity: true,
      showCurrentTab: true
    };
  }

  function defaultRoles() {
    return [
      { id: 'role_owner', name: 'Owner', color: '#c084fc', hoist: true },
      { id: 'role_mod', name: 'Moderator', color: '#38bdf8', hoist: true },
      { id: 'role_member', name: 'Member', color: '#a78bfa', hoist: false }
    ];
  }

  function createSeedState() {
    const now = Date.now();
    return {
      accounts: {},
      session: null,
      settings: getDefaultSettings(),
      chat: {
        activeView: 'server',
        activeServerId: 'srv_vesper_hub',
        activeChannelId: 'ch_welcome',
        activeDmId: 'dm_vesper_bot',
        pins: {
          ch_welcome: ['msg_seed_1']
        },
        servers: [
          {
            id: 'srv_vesper_hub',
            name: 'Vesper Hub',
            icon: 'V',
            iconUrl: null,
            bannerUrl: null,
            bannerColor: '#3b0764',
            color: '#7c3aed',
            inviteCode: 'VSP-PRIME',
            owner: 'Vesper',
            roles: defaultRoles(),
            memberRoles: {
              'vesper system': ['role_owner']
            },
            channels: [
              { id: 'ch_welcome', name: 'welcome', topic: 'Welcome to Vesper — customize your profile, server banner, icons & roles.' },
              { id: 'ch_general', name: 'general', topic: 'Main lounge chat. Markdown (**bold**, *italic*, `code`) is supported!' },
              { id: 'ch_offtopic', name: 'off-topic', topic: 'Anything and everything.' },
              { id: 'ch_announcements', name: 'announcements', topic: 'Vesper updates and future Games releases.' }
            ]
          }
        ],
        dms: [
          {
            id: 'dm_vesper_bot',
            peerName: 'Vesper System',
            peerColor: '#8b5cf6',
            peerStatus: 'online',
            peerBadge: 'BOT'
          }
        ],
        messages: {
          ch_welcome: [
            {
              id: 'msg_seed_1',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'SYSTEM',
              text: 'Welcome to **Vesper Phase 2**! Click your profile bar in the bottom-left to set a **Display Name**, **Profile Picture**, and **Profile Banner**, or click the server header to upload a **Server Icon**, **Server Banner**, and create custom **Roles**.',
              timestamp: now - 120000,
              reactions: { '🟣': ['Vesper System'], '👑': ['Vesper System'] }
            }
          ],
          ch_general: [
            {
              id: 'msg_seed_2',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'SYSTEM',
              text: 'Tip: Click any user avatar or name in chat or the member list to open their full Discord-style **Profile Card** with banner, bio, and server roles!',
              timestamp: now - 60000,
              reactions: {}
            }
          ],
          ch_offtopic: [],
          ch_announcements: [
            {
              id: 'msg_seed_3',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'SYSTEM',
              text: '**Phase 2 Live:** Custom Profile Pictures, Profile Banners, Display Names, Server Icons, Server Banners, Server Roles, Profile Popouts, Pinned Messages, and In-Channel Search.',
              timestamp: now - 30000,
              reactions: { '🚀': ['Vesper System'] }
            }
          ],
          dm_vesper_bot: [
            {
              id: 'msg_seed_dm_1',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'BOT',
              text: 'Hey! Direct Messages live here. Click the `+` button next to **Direct Messages** to start a new DM thread with any username.',
              timestamp: now - 45000,
              reactions: {}
            }
          ]
        }
      }
    };
  }

  let state = loadState();

  function migrateServer(srv) {
    return {
      iconUrl: null,
      bannerUrl: null,
      bannerColor: srv.color || '#3b0764',
      roles: defaultRoles(),
      memberRoles: {},
      ...srv
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSeedState();
      const parsed = JSON.parse(raw);
      const seed = createSeedState();
      const rawServers = (parsed.chat && Array.isArray(parsed.chat.servers) && parsed.chat.servers.length)
        ? parsed.chat.servers
        : seed.chat.servers;

      const session = parsed.session
        ? {
            displayName: parsed.session.displayName || parsed.session.username,
            avatarUrl: parsed.session.avatarUrl || null,
            bannerUrl: parsed.session.bannerUrl || null,
            bannerColor: parsed.session.bannerColor || '#4c1d95',
            ...parsed.session
          }
        : null;

      return {
        accounts: parsed.accounts || {},
        session,
        settings: Object.assign(getDefaultSettings(), parsed.settings || {}),
        chat: {
          activeView: (parsed.chat && parsed.chat.activeView) || seed.chat.activeView,
          activeServerId: (parsed.chat && parsed.chat.activeServerId) || seed.chat.activeServerId,
          activeChannelId: (parsed.chat && parsed.chat.activeChannelId) || seed.chat.activeChannelId,
          activeDmId: (parsed.chat && parsed.chat.activeDmId) || seed.chat.activeDmId,
          pins: (parsed.chat && parsed.chat.pins) || seed.chat.pins,
          servers: rawServers.map(migrateServer),
          dms: (parsed.chat && Array.isArray(parsed.chat.dms) && parsed.chat.dms.length)
            ? parsed.chat.dms
            : seed.chat.dms,
          messages: (parsed.chat && parsed.chat.messages) || seed.chat.messages
        }
      };
    } catch (err) {
      console.warn('Vesper store fallback to seed state:', err);
      return createSeedState();
    }
  }

  function saveState(broadcast) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (broadcast !== false && bc) {
        bc.postMessage({ type: 'SYNC_STATE', timestamp: Date.now() });
      }
    } catch (err) {
      console.warn('Vesper failed to persist state (quota or privacy mode):', err);
      if (window.Vesper && window.Vesper.App && window.Vesper.App.toast) {
        window.Vesper.App.toast('Storage warning: image may be too large for browser cache');
      }
    }
  }

  function notify(eventType) {
    listeners.forEach((fn) => {
      try { fn(state, eventType); } catch (e) { console.error(e); }
    });
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'SYNC_STATE') {
          state = loadState();
          notify('external-sync');
        }
      };
    } catch (e) {
      bc = null;
    }
  }

  window.addEventListener('storage', (ev) => {
    if (ev.key === STORAGE_KEY) {
      state = loadState();
      notify('external-sync');
    }
  });

  function getState() {
    return state;
  }

  function update(mutator, eventType) {
    mutator(state);
    saveState(true);
    notify(eventType || 'update');
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function resetSettings() {
    update((s) => {
      s.settings = getDefaultSettings();
    }, 'settings');
  }

  function pickAvatarColor(name) {
    let hash = 0;
    const str = name || 'vesper';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
  }

  function getUserProfile(username) {
    const clean = (username || 'User').trim();
    const key = clean.toLowerCase();

    if (key === 'vesper system') {
      return {
        username: 'Vesper System',
        displayName: 'Vesper System',
        avatarUrl: null,
        avatarColor: '#8b5cf6',
        bannerUrl: null,
        bannerColor: '#4c1d95',
        status: 'online',
        bio: 'Official Vesper core system & server assistant.',
        badge: 'SYSTEM'
      };
    }

    if (state.session && state.session.username && state.session.username.toLowerCase() === key) {
      return {
        username: state.session.username,
        displayName: state.session.displayName || state.session.username,
        avatarUrl: state.session.avatarUrl || null,
        avatarColor: state.session.avatarColor || pickAvatarColor(state.session.username),
        bannerUrl: state.session.bannerUrl || null,
        bannerColor: state.session.bannerColor || '#4c1d95',
        status: state.session.status || 'online',
        bio: state.session.bio || '',
        badge: null
      };
    }

    const acc = state.accounts && state.accounts[key];
    if (acc) {
      return {
        username: acc.username,
        displayName: acc.displayName || acc.username,
        avatarUrl: acc.avatarUrl || null,
        avatarColor: acc.avatarColor || pickAvatarColor(acc.username),
        bannerUrl: acc.bannerUrl || null,
        bannerColor: acc.bannerColor || '#4c1d95',
        status: acc.status || 'offline',
        bio: acc.bio || '',
        badge: null
      };
    }

    return {
      username: clean,
      displayName: clean,
      avatarUrl: null,
      avatarColor: pickAvatarColor(clean),
      bannerUrl: null,
      bannerColor: '#3b0764',
      status: 'online',
      bio: '',
      badge: null
    };
  }

  function getMemberRoles(server, username) {
    if (!server || !username) return [];
    const key = username.toLowerCase();
    const assignedIds = (server.memberRoles && server.memberRoles[key]) || [];
    const roles = Array.isArray(server.roles) ? server.roles : [];
    return roles.filter((r) => assignedIds.includes(r.id));
  }

  function getHighestRole(server, username) {
    const roles = getMemberRoles(server, username);
    return roles.length ? roles[0] : null;
  }

  window.Vesper.Store = {
    get: getState,
    update,
    subscribe,
    resetSettings,
    getDefaultSettings,
    uid,
    makeInviteCode,
    pickAvatarColor,
    getUserProfile,
    getMemberRoles,
    getHighestRole
  };
})();
