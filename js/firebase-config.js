(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  /**
   * Optional Firebase Real-Time Sync Adapter (Phase 2 Upgrade)
   * ----------------------------------------------------------
   * Right now, Vesper runs 100% locally with instant cross-tab live sync
   * via localStorage + BroadcastChannel so you can test and deploy on
   * GitHub Pages immediately with zero backend setup.
   *
   * When you want cross-device global chat across friends' laptops/phones:
   * 1. Create a free Firebase project at https://console.firebase.google.com
   * 2. Enable Firestore Database & Email/Password Auth
   * 3. Paste your firebaseConfig object below and set enabled: true
   */
  window.Vesper.FirebaseConfig = {
    enabled: false,
    config: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: ''
    }
  };
})();
