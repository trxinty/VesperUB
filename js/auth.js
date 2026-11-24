(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  let mode = 'signin';

  async function hashPassword(plain) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const data = new TextEncoder().encode('vesper_salt_v1::' + plain);
        const buf = await window.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (e) {
      // Fallback for non-HTTPS file:// previews
    }
    let h = 2166136261;
    const str = 'vesper_salt_v1::' + plain;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return 'f_' + (h >>> 0).toString(16);
  }

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function setMode(nextMode) {
    mode = nextMode;
    showError('');

    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const confirmGroup = document.getElementById('confirm-password-group');
    const passwordInput = document.getElementById('auth-password');
    const hint = document.getElementById('username-hint');

    document.querySelectorAll('.auth-tab').forEach((tab) => {
      const active = tab.dataset.authMode === mode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    if (mode === 'signup') {
      title.textContent = 'create account';
      subtitle.textContent = 'pick a username to unlock vesper & chat';
      submitBtn.textContent = 'create account';
      confirmGroup.classList.remove('hidden');
      passwordInput.setAttribute('autocomplete', 'new-password');
      hint.textContent = 'your permanent @username (you can customize your display name inside chat)';
    } else {
      title.textContent = 'welcome back';
      subtitle.textContent = 'sign in to access vesper & real-time chat';
      submitBtn.textContent = 'sign in';
      confirmGroup.classList.add('hidden');
      passwordInput.setAttribute('autocomplete', 'current-password');
      hint.textContent = 'uses your vesper @username across the whole site';
    }
  }

  function openGate(preferredMode) {
    const gate = document.getElementById('auth-gate');
    const shell = document.getElementById('app-shell');
    setMode(preferredMode || 'signin');
    gate.classList.remove('hidden');
    shell.classList.add('hidden');
    const input = document.getElementById('auth-username');
    if (input) setTimeout(() => input.focus(), 60);
  }

  function closeGate() {
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('guest-modal').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
  }

  function openGuestModal() {
    const modal = document.getElementById('guest-modal');
    modal.classList.remove('hidden');
    window.Vesper.Icons.hydrate(modal);
  }

  function closeGuestModal() {
    document.getElementById('guest-modal').classList.add('hidden');
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    showError('');

    const rawUsername = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const confirmPassword = document.getElementById('auth-confirm-password').value;

    if (!rawUsername || rawUsername.length < 2) {
      return showError('Username must be at least 2 characters.');
    }
    if (!/^[a-zA-Z0-9_.\- ]+$/.test(rawUsername)) {
      return showError('Username can only contain letters, numbers, spaces, _, -, or .');
    }
    if (!password || password.length < 4) {
      return showError('Password must be at least 4 characters.');
    }

    const key = rawUsername.toLowerCase();
    const state = window.Vesper.Store.get();
    const passHash = await hashPassword(password);

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        return showError('Passwords do not match.');
      }
      if (state.accounts[key]) {
        return showError('That username already exists. Switch to "sign in" instead.');
      }

      const avatarColor = window.Vesper.Store.pickAvatarColor(rawUsername);
      window.Vesper.Store.update((s) => {
        s.accounts[key] = {
          username: rawUsername,
          displayName: rawUsername,
          passHash,
          avatarUrl: null,
          avatarColor,
          bannerUrl: null,
          bannerColor: '#4c1d95',
          status: 'online',
          bio: 'Exploring Vesper',
          createdAt: Date.now()
        };
        s.session = {
          mode: 'user',
          username: rawUsername,
          displayName: rawUsername,
          accountKey: key,
          avatarUrl: null,
          avatarColor,
          bannerUrl: null,
          bannerColor: '#4c1d95',
          status: 'online',
          bio: 'Exploring Vesper'
        };
      }, 'auth');

      document.getElementById('auth-form').reset();
      closeGate();
      window.Vesper.App.toast(`Account created! Welcome, ${rawUsername}`);
      window.Vesper.App.refreshAll();
    } else {
      const account = state.accounts[key];
      if (!account) {
        return showError('No account found with that username. Try creating one!');
      }
      if (account.passHash !== passHash) {
        return showError('Incorrect password. Please try again.');
      }

      window.Vesper.Store.update((s) => {
        s.session = {
          mode: 'user',
          username: account.username,
          displayName: account.displayName || account.username,
          accountKey: key,
          avatarUrl: account.avatarUrl || null,
          avatarColor: account.avatarColor || window.Vesper.Store.pickAvatarColor(account.username),
          bannerUrl: account.bannerUrl || null,
          bannerColor: account.bannerColor || '#4c1d95',
          status: account.status || 'online',
          bio: account.bio || ''
        };
      }, 'auth');

      document.getElementById('auth-form').reset();
      closeGate();
      window.Vesper.App.toast(`Welcome back, ${account.displayName || account.username}`);
      window.Vesper.App.refreshAll();
    }
  }

  function enterAsGuest() {
    window.Vesper.Store.update((s) => {
      s.session = {
        mode: 'guest',
        username: 'Guest',
        displayName: 'Guest',
        accountKey: null,
        avatarUrl: null,
        avatarColor: '#6b7280',
        bannerUrl: null,
        bannerColor: '#1f2937',
        status: 'idle',
        bio: ''
      };
    }, 'auth');

    closeGuestModal();
    closeGate();
    window.Vesper.App.navigate('home');
    window.Vesper.App.toast('Entered as Guest — Chat is locked until you sign in');
    window.Vesper.App.refreshAll();
  }

  function signOut() {
    window.Vesper.Store.update((s) => {
      s.session = null;
    }, 'auth');
    openGate('signin');
    window.Vesper.App.toast('Signed out of Vesper');
  }

  function init() {
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => setMode(tab.dataset.authMode));
    });

    document.getElementById('auth-form').addEventListener('submit', handleSubmit);
    document.getElementById('guest-trigger-btn').addEventListener('click', openGuestModal);
    document.getElementById('guest-cancel-btn').addEventListener('click', closeGuestModal);
    document.getElementById('guest-confirm-btn').addEventListener('click', enterAsGuest);

    document.getElementById('guest-modal').addEventListener('click', (ev) => {
      if (ev.target.id === 'guest-modal') closeGuestModal();
    });
  }

  window.Vesper.Auth = {
    init,
    openGate,
    closeGate,
    signOut
  };
})();
