(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  const DEFAULT_REPO = {
    owner: 'trxinty',
    repo: 'Html-games-',
    branch: 'master',
    folder: 'offline'
  };

  const CACHE_KEY = 'vesper_github_games_catalog_trxinty_v2';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

  const CATEGORY_RULES = [
    { cat: 'Horror', re: /\b(fnaf|freddy|granny|baldi|horror|scary|zombie|backroom|buckshot|bendy|eyes|slender|nightmare|amanda|poppy|scp|dead|haunt|creepy|kindergarten|imscared|piggy)\b/i },
    { cat: 'Shooter', re: /\b(1v1|gun|shoot|sniper|doom|quake|krunker|shell|combat|war|army|fps|strike|bullet|rifle|pixel ?gun|time ?shooter|getaway|rooftop|superhot|ultrakill|csgo|tactical|masked)\b/i },
    { cat: 'Racing', re: /\b(drift|race|racing|kart|moto|car|drive|driving|hill ?climb|polytrack|slope|turbo|speed|rally|truck|bike|wheelie|parking|traffic|stunt|smash ?kart|eggy ?car|madalin|burnout)\b/i },
    { cat: 'Sports', re: /\b(soccer|football|basket|basketball|baseball|tennis|golf|hockey|boxing|wrestl|volleyball|retro ?bowl|fifa|nba|nfl|pool|billiard|bowling|skate|ski|snowboard|archery|ping ?pong|pong)\b/i },
    { cat: 'Platformer', re: /\b(mario|sonic|vex|ovo|geometry|dash|celeste|hollow|cuphead|run ?\d|fireboy|watergirl|red ?ball|stickman ?hook|fancy ?pants|meat ?boy|parkour|jump|climb|bounce|doodle|obby|getting ?over|only ?up|level ?devil|henry|stealing|fleeing|escaping|breaking|infiltrating)\b/i },
    { cat: 'Fighting', re: /\b(fight|fighter|brawl|smash|mortal|street ?fighter|stick ?fight|sword|ninja|samurai|gladiator|arena|duel|punch|iron ?snout|ragdoll|happy ?wheels|people ?playground)\b/i },
    { cat: 'Puzzle', re: /\b(2048|tetris|sudoku|chess|checkers|minesweeper|wordle|puzzle|cut ?the ?rope|portal|unblock|maze|bloxorz|water ?sort|mahjong|solitaire|connect|match|candy|bubble|pipe|brain|quiz|trivia|impossible ?quiz|google ?feud|hextris|little ?alchemy|infinite ?craft|sandtris)\b/i },
    { cat: 'Idle', re: /\b(clicker|idle|tycoon|cookie|doge ?miner|adventure ?capitalist|bitlife|monkey ?mart|capybara|factory|farm|incremental|simulator|sim|papa'?s|burgeria|pizzeria|freezeria|pancakeria|sushiria|taco|bake|cook|shop|merge)\b/i },
    { cat: 'Strategy', re: /\b(tower|defense|td|bloons|btd|pvz|plants ?vs|kingdom|clash|risk|civ|empire|battle|warfare|age ?of ?war|stick ?war|command|tactics|card|uno|poker|blackjack|papers ?please|plague|bad ?ice ?cream)\b/i },
    { cat: 'Rhythm', re: /\b(fnf|friday ?night|funkin|rhythm|piano|beat|music|dance|osu|tiles|song|melody|guitar|drum|incredibox|sprunki)\b/i },
    { cat: 'IO', re: /(\.io\b|\bio\b|agar|slither|paper\.?io|hole\.?io|diep|territorial|worm|snake|splix|zombs|surviv|moomoo|venge|ev\.?io)/i },
    { cat: 'Sandbox', re: /\b(minecraft|eagler|craft|terraria|roblox|sandbox|powder|falling ?sand|worldbox|poly|block|voxel|build|creator|alchemy)\b/i },
    { cat: 'Retro', re: /\b(pacman|pac-man|galaga|atari|nes|snes|gba|gb|pokemon|zelda|kirby|metroid|contra|castlevania|mega ?man|donkey ?kong|space ?invaders|asteroids|breakout|frogger|dig ?dug|wolfenstein|flappy|dino|chrome ?dino|duck ?life|learn ?to ?fly)\b/i }
  ];

  const PALETTES = {
    Horror:     ['#1b0710', '#450a0a', '#ef4444', '👻'],
    Shooter:    ['#1c0d07', '#431407', '#f97316', '🎯'],
    Racing:     ['#081829', '#1e3a8a', '#38bdf8', '🏎️'],
    Sports:     ['#062116', '#064e3b', '#10b981', '⚽'],
    Platformer: ['#190b2e', '#3b0764', '#a855f7', '⚡'],
    Fighting:   ['#240814', '#4c0519', '#f43f5e', '⚔️'],
    Puzzle:     ['#101530', '#312e81', '#818cf8', '🧩'],
    Idle:       ['#211507', '#451a03', '#facc15', '✨'],
    Strategy:   ['#091b24', '#164e63', '#22d3ee', '♟️'],
    Rhythm:     ['#240924', '#581c87', '#e879f9', '🎵'],
    IO:         ['#071f24', '#134e4a', '#2dd4bf', '🌐'],
    Sandbox:    ['#0b2112', '#14532d', '#4ade80', '🧱'],
    Retro:      ['#1a102b', '#2e1065', '#c084fc', '🕹️'],
    Arcade:     ['#140a24', '#2e1065', '#8b5cf6', '🎮']
  };

  function encodeRepoPath(relPath) {
    return relPath
      .replace(/^\/+/, '')
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }

  function cleanGameTitle(filePath) {
    const base = filePath.split('/').pop().replace(/\.html?$/i, '');
    let name = base;
    try { name = decodeURIComponent(name); } catch (e) {}

    name = name
      .replace(/[_]+/g, ' ')
      .replace(/[-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    name = name.replace(/\b\w/g, (ch) => ch.toUpperCase());
    return name || base;
  }

  function inferCategory(title, filePath) {
    const haystack = `${title} ${filePath}`;
    for (const rule of CATEGORY_RULES) {
      if (rule.re.test(haystack)) return rule.cat;
    }
    return 'Arcade';
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
    return bytes + ' B';
  }

  function getPalette(category, seedStr) {
    const base = PALETTES[category] || PALETTES.Arcade;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hueShift = (Math.abs(hash) % 36) - 18;
    return {
      bg1: base[0],
      bg2: base[1],
      accent: base[2],
      emoji: base[3],
      angle: 115 + hueShift
    };
  }

  function normalizeEntry(relPath, sizeBytes, repoMeta) {
    const cleanPath = relPath.replace(/^\/+/, '');
    const title = cleanGameTitle(cleanPath);
    const category = inferCategory(title, cleanPath);
    const encoded = encodeRepoPath(cleanPath);
    const id = 'gh_' + cleanPath.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    return {
      id,
      title,
      category,
      path: cleanPath,
      size: sizeBytes || 0,
      sizeLabel: formatBytes(sizeBytes || 0),
      source: 'github',
      cdnUrl: `https://cdn.jsdelivr.net/gh/${repoMeta.owner}/${repoMeta.repo}@${repoMeta.branch}/${encoded}`,
      rawUrl: `https://raw.githubusercontent.com/${repoMeta.owner}/${repoMeta.repo}/${repoMeta.branch}/${encoded}`,
      pagesUrl: `https://${repoMeta.owner}.github.io/${repoMeta.repo}/${encoded}`,
      palette: getPalette(category, title)
    };
  }

  function loadCachedCatalog() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.games) || !parsed.games.length) return null;
      if (parsed.repo !== `${DEFAULT_REPO.owner}/${DEFAULT_REPO.repo}`) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveCachedCatalog(games) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        repo: `${DEFAULT_REPO.owner}/${DEFAULT_REPO.repo}`,
        games
      }));
    } catch (e) {
      // Ignore storage quota issues for cache
    }
  }

  async function fetchFromJsDelivr(repoMeta) {
    const url = `https://data.jsdelivr.com/v1/packages/gh/${repoMeta.owner}/${repoMeta.repo}@${repoMeta.branch}/flat`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`jsDelivr API HTTP ${res.status}`);
    const data = await res.json();
    const prefix = `/${repoMeta.folder}/`.toLowerCase();
    const files = (data.files || []).filter((f) => {
      const lower = (f.name || '').toLowerCase();
      return lower.startsWith(prefix) && (lower.endsWith('.html') || lower.endsWith('.htm'));
    });
    return files
      .map((f) => normalizeEntry(f.name, f.size, repoMeta))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async function fetchFromGitHubTree(repoMeta) {
    const url = `https://api.github.com/repos/${repoMeta.owner}/${repoMeta.repo}/git/trees/${repoMeta.branch}?recursive=1`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub Tree API HTTP ${res.status}`);
    const data = await res.json();
    const prefix = `${repoMeta.folder}/`.toLowerCase();
    return (data.tree || [])
      .filter((it) => it.type === 'blob' && (it.path || '').toLowerCase().startsWith(prefix) && /\.html?$/i.test(it.path || ''))
      .map((it) => normalizeEntry(it.path, it.size, repoMeta))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async function fetchFromGitHubContents(repoMeta) {
    const url = `https://api.github.com/repos/${repoMeta.owner}/${repoMeta.repo}/contents/${repoMeta.folder}?ref=${repoMeta.branch}`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub Contents API HTTP ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('Unexpected GitHub API payload');
    return items
      .filter((it) => it.type === 'file' && /\.html?$/i.test(it.name || ''))
      .map((it) => normalizeEntry(it.path, it.size, repoMeta))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async function fetchCatalog(forceRefresh) {
    if (!forceRefresh) {
      const cached = loadCachedCatalog();
      if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        window.Vesper.GamesData = cached.games;
        return { games: cached.games, fromCache: true };
      }
    }

    const fetchers = [fetchFromJsDelivr, fetchFromGitHubTree, fetchFromGitHubContents];
    let lastError = null;

    for (const fn of fetchers) {
      try {
        const games = await fn(DEFAULT_REPO);
        if (games && games.length > 0) {
          window.Vesper.GamesData = games;
          saveCachedCatalog(games);
          return { games, fromCache: false };
        }
      } catch (err) {
        lastError = err;
      }
    }

    const stale = loadCachedCatalog();
    if (stale && stale.games.length) {
      window.Vesper.GamesData = stale.games;
      return { games: stale.games, fromCache: true, stale: true };
    }

    throw lastError || new Error('Could not fetch games list from trxinty/Html-games-.');
  }

  async function downloadWithProgress(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !res.body.getReader) {
      const text = await res.text();
      if (onProgress) onProgress(text.length, text.length);
      return text;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress) onProgress(received, total);
    }

    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder('utf-8').decode(merged);
  }

  /**
   * Streams the single-file HTML game from trxinty/Html-games- into a same-origin
   * Blob URL so it launches directly inside Vesper's Theater Player (no extra tabs).
   */
  async function loadGameBlobUrl(game, onProgress) {
    if (game.localHtml) {
      const blob = new Blob([game.localHtml], { type: 'text/html;charset=utf-8' });
      return URL.createObjectURL(blob);
    }

    if (game.custom && game.url) {
      return game.url;
    }

    const urls = (game.size && game.size > 18 * 1024 * 1024)
      ? [game.rawUrl, game.pagesUrl, game.cdnUrl]
      : [game.cdnUrl, game.rawUrl, game.pagesUrl];

    let lastErr = null;
    for (const url of urls) {
      if (!url) continue;
      try {
        const html = await downloadWithProgress(url, onProgress);
        if (html && html.length > 40) {
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          return URL.createObjectURL(blob);
        }
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr || new Error('Failed to download game file from trxinty/Html-games-.');
  }

  window.Vesper.GamesData = [];
  window.Vesper.GameCategories = [
    'All',
    'Favorites',
    'Recent',
    'Arcade',
    'Action',
    'Shooter',
    'Platformer',
    'Racing',
    'Puzzle',
    'Horror',
    'Idle',
    'Strategy',
    'Sports',
    'Fighting',
    'Rhythm',
    'IO',
    'Sandbox',
    'Retro'
  ];

  window.Vesper.GamesRepo = {
    DEFAULT_REPO,
    fetchCatalog,
    loadGameBlobUrl,
    cleanGameTitle,
    inferCategory,
    getPalette,
    formatBytes
  };
})();
