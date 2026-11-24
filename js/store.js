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

  function createSeedState() {
    const now = Date.now();
    return {
      accounts: {},
      session: null, // { mode: 'user'|'guest', username, avatarColor, status, bio }
      settings: getDefaultSettings(),
      chat: {
        activeView: 'server', // 'server' | 'dm'
        activeServerId: 'srv_vesper_hub',
        activeChannelId: 'ch_welcome',
        activeDmId: 'dm_vesper_bot',
        servers: [
          {
            id: 'srv_vesper_hub',
            name: 'Vesper Hub',
            icon: 'V',
            color: '#7c3aed',
            inviteCode: 'VSP-PRIME',
            owner: 'Vesper',
            channels: [
              { id: 'ch_welcome', name: 'welcome', topic: 'Welcome to Vesper — customize themes, create servers, and hang out.' },
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
              text: 'Welcome to **Vesper**! Your front-door username is synced directly into chat. Try creating your own server with the `+` button on the left rail, or test real-time tab sync by opening Vesper in a second tab.',
              timestamp: now - 120000,
              reactions: { '🟣': ['Vesper System'], '🔥': ['Vesper System'] }
            }
          ],
          ch_general: [
            {
              id: 'msg_seed_2',
              author: 'Vesper System',
              avatarColor: '#8b5cf6',
              badge: 'SYSTEM',
              text: 'This is `#general`. You can format text with **bold**, *italics*, ~~strikethrough~~, and `inline code`, reply to messages, or add emoji reactions.',
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
              text: '**Phase 1 Live:** Auth gate, Guest confirmation modal, customizable Theme Engine, Floating Dock, Games UI shell, and Discord-style Chat foundation are ready.',
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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSeedState();
      const parsed = JSON.parse(raw);
      const seed = createSeedState();
      return {
        accounts: parsed.accounts || {},
        session: parsed.session || null,
        settings: Object.assign(getDefaultSettings(), parsed.settings || {}),
        chat: {
          activeView: (parsed.chat && parsed.chat.activeView) || seed.chat.activeView,
          activeServerId: (parsed.chat && parsed.chat.activeServerId) || seed.chat.activeServerId,
          activeChannelId: (parsed.chat && parsed.chat.activeChannelId) || seed.chat.activeChannelId,
          activeDmId: (parsed.chat && parsed.chat.activeDmId) || seed.chat.activeDmId,
          servers: (parsed.chat && Array.isArray(parsed.chat.servers) && parsed.chat.servers.length)
            ? parsed.chat.servers
            : seed.chat.servers,
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
    }
  }

  function notify(eventType) {
    listeners.forEach((fn) => {
      try { fn(state, eventType); } catch (e) { console.error(e); }
    });
  }

  // Real-time multi-tab synchronization
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

  window.Vesper.Store = {
    get: getState,
    update,
    subscribe,
    resetSettings,
    getDefaultSettings,
    uid,
    makeInviteCode,
    pickAvatarColor
  };
})();
