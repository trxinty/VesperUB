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

  const PERMISSION_DEFS = [
    {
      key: 'administrator',
      label: 'Administrator',
      desc: 'Members with this permission have every permission and bypass all restrictions.',
      danger: true
    },
    {
      key: 'manageServer',
      label: 'Manage Server',
      desc: 'Allows editing server name, icon, banner, and overview settings.'
    },
    {
      key: 'manageRoles',
      label: 'Manage Roles',
      desc: 'Allows creating, editing, deleting, and assigning roles & permissions.'
    },
    {
      key: 'manageChannels',
      label: 'Manage Channels',
      desc: 'Allows creating and deleting text channels in this server.'
    },
    {
      key: 'manageMessages',
      label: 'Manage Messages',
      desc: 'Allows pinning/unpinning messages and deleting messages from other members.'
    },
    {
      key: 'sendMessages',
      label: 'Send Messages',
      desc: 'Allows sending messages inside text channels.'
    },
    {
      key: 'addReactions',
      label: 'Add Reactions',
      desc: 'Allows adding emoji reactions to messages.'
    },
    {
      key: 'createInvites',
      label: 'Create Invites',
      desc: 'Allows viewing, copying, and regenerating server invite codes.'
    }
  ];

  function createPermissions(overrides) {
    return Object.assign({
      administrator: false,
      manageServer: false,
      manageRoles: false,
      manageChannels: false,
      manageMessages: false,
      sendMessages: true,
      addReactions: true,
      createInvites: true
    }, overrides || {});
  }

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
      showCurrentTab: true,
      searchEngine: 'brave',
      customSearchUrl: '',
      wispUrl: 'wss://wisp.mercurywork.shop/',
      proxyTransport: 'epoxy',
      cloakPreset: 'none',
      cloakTitle: '',
      cloakIcon: '',
      cloakWhenAway: false
    };
  }

  function defaultRoles() {
    return [
      {
        id: 'role_owner',
        name: 'Owner',
        color: '#c084fc',
        hoist: true,
        permissions: createPermissions({
          administrator: true,
          manageServer: true,
          manageRoles: true,
          manageChannels: true,
          manageMessages: true
        })
      },
      {
        id: 'role_mod',
        name: 'Moderator',
        color: '#38bdf8',
        hoist: true,
        permissions: createPermissions({
          manageChannels: true,
          manageMessages: true,
          createInvites: true
        })
      },
      {
        id: 'role_member',
        name: 'Member',
        color: '#a78bfa',
        hoist: false,
        permissions: createPermissions()
      }
    ];
  }

  function createSeedState() {
    const now = Date.now();
    return {
      accounts: {},
      session: null,
      settings: getDefaultSettings(),
      games: {
        favorites: [],
        recent: [],
        customGames: []
      },
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
              { id: 'ch_welcome', name: 'welcome', topic: 'Welcome to Vesper — customize your profile, roles & permissions, or launch Games.' },
              { id: 'ch_general', name: 'general', topic: 'Main lounge chat. Markdown (**bold**, *italic*, `code`) is supported!' },
              { id: 'ch_offtopic', name: 'off-topic', topic: 'Anything and everything.' },
              { id: 'ch_announcements', name: 'announcements', topic: 'Vesper updates & new Games Hub releases.' }
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
              text: 'Welcome to **Vesper**! Open the **Games Hub** to browse and launch all 352+ games directly from `trxinty/Html-games-`, or open **Server Settings → Roles** to configure full Discord-style role permissions!',
              timestamp: now - 120000,
              reactions: { '🟣': ['Vesper System'], '🎮': ['Vesper System'] }
            }
          ],
          ch_general: [
            {
              id: 'msg_seed_2',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'SYSTEM',
              text: 'Tip: Click any role inside **Server Settings → Roles** to customize granular permissions like Administrator, Manage Server, Manage Roles, Manage Channels, Manage Messages, and Send Messages.',
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
              text: '**Games Pack Live:** All 352+ single-file HTML games from `trxinty/Html-games-` stream right inside Vesper\'s Fullscreen Theater Player, plus full Discord Role Permissions in Chat.',
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

  function migrateRole(role) {
    if (role.permissions && typeof role.permissions === 'object') {
      return { ...role, permissions: createPermissions(role.permissions) };
    }
    const lower = (role.name || '').toLowerCase();
    if (lower === 'owner' || lower === 'admin' || lower === 'administrator') {
      return {
        ...role,
        permissions: createPermissions({
          administrator: true,
          manageServer: true,
          manageRoles: true,
          manageChannels: true,
          manageMessages: true
        })
      };
    }
    if (lower === 'moderator' || lower === 'mod') {
      return {
        ...role,
        permissions: createPermissions({
          manageChannels: true,
          manageMessages: true
        })
      };
    }
    return { ...role, permissions: createPermissions() };
  }

  function migrateServer(srv) {
    const roles = (Array.isArray(srv.roles) && srv.roles.length ? srv.roles : defaultRoles()).map(migrateRole);
    return {
      iconUrl: null,
      bannerUrl: null,
      bannerColor: srv.color || '#3b0764',
      memberRoles: {},
      ...srv,
      roles
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
        games: {
          favorites: (parsed.games && Array.isArray(parsed.games.favorites)) ? parsed.games.favorites : seed.games.favorites,
          recent: (parsed.games && Array.isArray(parsed.games.recent)) ? parsed.games.recent : [],
          customGames: (parsed.games && Array.isArray(parsed.games.customGames)) ? parsed.games.customGames : []
        },
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
      console.warn('Vesper failed to persist state:', err);
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

  /**
   * Checks Discord-style permissions for a member in a server.
   * - Server owners always have all permissions.
   * - If the user has assigned roles, permissions are OR'd across their roles (Administrator grants all).
   * - If the user has no explicitly assigned roles yet in the default local hub, they receive baseline Member permissions
   *   (and Owner-level management in Vesper Hub so you can always test role permissions locally).
   */
  function hasPermission(server, username, permKey) {
    if (!server || !username) return false;
    const key = username.toLowerCase();
    const isOwner = server.owner && server.owner.toLowerCase() === key;
    const roles = getMemberRoles(server, username);

    // If user explicitly has assigned roles, evaluate those roles strictly
    if (roles.length > 0) {
      if (roles.some((r) => r.permissions && r.permissions.administrator)) return true;
      return roles.some((r) => r.permissions && !!r.permissions[permKey]);
    }

    // Server creator / owner always has full permissions
    if (isOwner) return true;

    // In the built-in local starter hub ('srv_vesper_hub'), allow full access until roles are explicitly assigned
    if (server.id === 'srv_vesper_hub') return true;

    // Default @everyone baseline
    return ['sendMessages', 'addReactions', 'createInvites'].includes(permKey);
  }

  window.Vesper.Store = {
    PERMISSION_DEFS,
    createPermissions,
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
    getHighestRole,
    hasPermission
  };
})();
