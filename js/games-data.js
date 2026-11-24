(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  function makeArt(bg1, bg2, accent, emoji, subtitle) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}"/>
          <stop offset="100%" stop-color="${bg2}"/>
        </linearGradient>
        <radialGradient id="r" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.48"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="240" height="240" rx="28" fill="url(#g)"/>
      <rect width="240" height="240" rx="28" fill="url(#r)"/>
      <circle cx="120" cy="96" r="56" fill="rgba(255,255,255,0.08)" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>
      <text x="120" y="114" text-anchor="middle" font-size="56">${emoji}</text>
      <text x="120" y="196" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="800" font-size="16" letter-spacing="1.2" fill="#ffffff" opacity="0.92">${subtitle}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  window.Vesper.GamesData = [
    {
      id: 'neon-dash',
      title: 'Neon Dash',
      category: 'Platformer',
      controls: 'Space / Up / Tap to jump over laser spikes & blocks',
      url: './games/neon-dash.html',
      builtIn: true,
      thumbnail: makeArt('#140726', '#2e1065', '#c084fc', '⚡', 'NEON DASH')
    },
    {
      id: '2048',
      title: '2048',
      category: 'Puzzle',
      controls: 'Arrow Keys / WASD / Swipe to merge tiles to 2048',
      url: './games/2048.html',
      builtIn: true,
      thumbnail: makeArt('#1e1038', '#4c1d95', '#facc15', '🔢', '2048')
    },
    {
      id: 'void-drift',
      title: 'Void Runner',
      category: 'Racing',
      controls: 'A / D, Arrows, or Mouse/Touch to dodge cubes down the neon slope',
      url: './games/void-drift.html',
      builtIn: true,
      thumbnail: makeArt('#081529', '#1e1b4b', '#38bdf8', '🌀', 'VOID RUNNER')
    },
    {
      id: 'flappy-vesper',
      title: 'Flappy Vesper',
      category: 'Arcade',
      controls: 'Space / Up / Click / Tap to flap through neon pillars',
      url: './games/flappy-vesper.html',
      builtIn: true,
      thumbnail: makeArt('#170b2b', '#3b0764', '#facc15', '🐥', 'FLAPPY VESPER')
    },
    {
      id: 'block-stack',
      title: 'Tetrix',
      category: 'Puzzle',
      controls: 'Arrows / WASD to move & rotate · Space to hard drop',
      url: './games/block-stack.html',
      builtIn: true,
      thumbnail: makeArt('#091326', '#1e293b', '#06b6d4', '🧱', 'TETRIX')
    },
    {
      id: 'star-blaster',
      title: 'Star Blaster',
      category: 'Action',
      controls: 'Mouse / Touch / Arrows to steer · Auto-fire plasma cannons',
      url: './games/star-blaster.html',
      builtIn: true,
      thumbnail: makeArt('#1a0714', '#3b0764', '#f43f5e', '🚀', 'STAR BLASTER')
    },
    {
      id: 'snake-neon',
      title: 'Neon Snake',
      category: 'Retro',
      controls: 'WASD / Arrow Keys / Swipe to collect glowing orbs',
      url: './games/snake-neon.html',
      builtIn: true,
      thumbnail: makeArt('#052018', '#0f172a', '#10b981', '🐍', 'NEON SNAKE')
    },
    {
      id: 'brick-breaker',
      title: 'Brick Breaker',
      category: 'Arcade',
      controls: 'Mouse / Touch / Arrows to bounce the orb & clear bricks',
      url: './games/brick-breaker.html',
      builtIn: true,
      thumbnail: makeArt('#240b1d', '#3b0764', '#f97316', '💥', 'BRICK BREAKER')
    },
    {
      id: 'cookie-forge',
      title: 'Cosmic Clicker',
      category: 'Idle',
      controls: 'Click the Vesper Core & buy upgrades to automate energy',
      url: './games/cookie-forge.html',
      builtIn: true,
      thumbnail: makeArt('#1c1130', '#4a044e', '#e879f9', '✨', 'COSMIC CLICKER')
    },
    {
      id: 'word-pulse',
      title: 'Word Pulse',
      category: 'Puzzle',
      controls: 'Type or tap letters to crack unlimited 5-letter words',
      url: './games/word-pulse.html',
      builtIn: true,
      thumbnail: makeArt('#062418', '#14532d', '#4ade80', '🔤', 'WORD PULSE')
    },
    {
      id: 'aim-lab',
      title: 'Aim Trainer',
      category: 'Action',
      controls: 'Click or tap neon targets as fast as possible in 30 seconds',
      url: './games/aim-lab.html',
      builtIn: true,
      thumbnail: makeArt('#1f0a14', '#4c0519', '#fb7185', '🎯', 'AIM TRAINER')
    },
    {
      id: 'dino-sprint',
      title: 'Cyber Dino',
      category: 'Arcade',
      controls: 'Space / Up to jump · Down to duck under drones',
      url: './games/dino-sprint.html',
      builtIn: true,
      thumbnail: makeArt('#081e1b', '#111827', '#34d399', '🦖', 'CYBER DINO')
    },
    {
      id: 'minesweeper',
      title: 'Minesweeper',
      category: 'Strategy',
      controls: 'Click to reveal · Right-click or Flag Mode to mark mines',
      url: './games/minesweeper.html',
      builtIn: true,
      thumbnail: makeArt('#1b1429', '#312e81', '#818cf8', '💣', 'MINESWEEPER')
    },
    {
      id: 'pong-duel',
      title: 'Neon Pong',
      category: '2 Player',
      controls: 'P1: W/S or Mouse · P2: Up/Down in 2-Player Local Mode',
      url: './games/pong-duel.html',
      builtIn: true,
      thumbnail: makeArt('#0c152e', '#1e1b4b', '#60a5fa', '🏓', 'NEON PONG')
    },
    {
      id: 'memory-flip',
      title: 'Memory Flip',
      category: 'Puzzle',
      controls: 'Flip two tiles at a time to match all 8 neon pairs',
      url: './games/memory-flip.html',
      builtIn: true,
      thumbnail: makeArt('#1f1233', '#4c1d95', '#f472b6', '🃏', 'MEMORY FLIP')
    },
    {
      id: 'reaction-zero',
      title: 'Reaction Zero',
      category: 'Arcade',
      controls: 'Wait for green and tap instantly across 5 reflex rounds',
      url: './games/reaction-zero.html',
      builtIn: true,
      thumbnail: makeArt('#072219', '#064e3b', '#22c55e', '⏱️', 'REACTION ZERO')
    },
    {
      id: 'hextris-os',
      title: 'Hextris (Open Source)',
      category: 'Puzzle',
      controls: 'Left / Right arrows to rotate the hexagon & match 3+ colors (MIT Open Source)',
      url: 'https://hextris.io/',
      builtIn: false,
      thumbnail: makeArt('#10192e', '#1e3a8a', '#38bdf8', '⬡', 'HEXTRIS')
    },
    {
      id: 'a-dark-room-os',
      title: 'A Dark Room (Open Source)',
      category: 'Strategy',
      controls: 'Minimalist text survival & village builder (MPL Open Source)',
      url: 'https://adarkroom.doublespeakgames.com/',
      builtIn: false,
      thumbnail: makeArt('#111116', '#27272a', '#d4d4d8', '🔥', 'A DARK ROOM')
    }
  ];

  window.Vesper.GameCategories = [
    'All',
    'Favorites',
    'Recent',
    'Arcade',
    'Action',
    'Puzzle',
    'Platformer',
    'Racing',
    'Strategy',
    '2 Player',
    'Idle',
    'Retro'
  ];

  window.Vesper.makeGameArt = makeArt;
})();
