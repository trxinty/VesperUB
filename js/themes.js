(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  const PRESETS = [
    {
      id: 'vesper-purple',
      name: 'Vesper Purple',
      base: '#060409',
      accent: '#8b5cf6'
    },
    {
      id: 'deep-ocean',
      name: 'Blue & Dark Blue',
      base: '#040916',
      accent: '#3b82f6'
    },
    {
      id: 'blue-yellow',
      name: 'Blue & Yellow',
      base: '#0a1938',
      accent: '#facc15'
    },
    {
      id: 'crimson-night',
      name: 'Crimson Black',
      base: '#0a0406',
      accent: '#ef4444'
    },
    {
      id: 'emerald-void',
      name: 'Emerald Void',
      base: '#040a07',
      accent: '#10b981'
    },
    {
      id: 'sakura-obsidian',
      name: 'Pink & Black',
      base: '#0a0409',
      accent: '#ec4899'
    },
    {
      id: 'amber-stealth',
      name: 'Amber Stealth',
      base: '#090704',
      accent: '#f59e0b'
    },
    {
      id: 'monochrome',
      name: 'Pure Dark',
      base: '#050505',
      accent: '#e4e4e7'
    }
  ];

  const ACCENT_SWATCHES = [
    '#8b5cf6', // Vesper Purple (default)
    '#a855f7', // Bright Violet
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#facc15', // Yellow
    '#f97316', // Orange
    '#ef4444', // Red
    '#ec4899', // Pink
    '#f4f4f5'  // Crisp White
  ];

  function hexToRgb(hex) {
    const clean = (hex || '#8b5cf6').replace('#', '').trim();
    const full = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6);
    const num = parseInt(full, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return '#' + [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
  }

  function mix(hexA, hexB, weightB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const w = Math.max(0, Math.min(1, weightB));
    return rgbToHex(
      a.r * (1 - w) + b.r * w,
      a.g * (1 - w) + b.g * w,
      a.b * (1 - w) + b.b * w
    );
  }

  function getLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function applyTheme(themeConfig) {
    const base = themeConfig.base || '#060409';
    const accent = themeConfig.accent || '#8b5cf6';
    const root = document.documentElement;
    const baseRgb = hexToRgb(base);
    const accentRgb = hexToRgb(accent);
    const baseIsLight = getLuminance(base) > 0.55;
    const accentIsLight = getLuminance(accent) > 0.65;

    const elevated = baseIsLight ? mix(base, '#000000', 0.06) : mix(base, '#ffffff', 0.045);
    const surface = baseIsLight ? mix(base, '#000000', 0.1) : mix(base, accent, 0.09);
    const surfaceHover = baseIsLight ? mix(base, '#000000', 0.15) : mix(base, accent, 0.16);
    const surfaceActive = baseIsLight ? mix(base, '#000000', 0.2) : mix(base, accent, 0.24);
    const inputBg = baseIsLight ? mix(base, '#ffffff', 0.3) : mix(base, '#000000', 0.35);

    const accentStrong = mix(accent, '#000000', 0.16);
    const accentSoft = mix(accent, '#ffffff', 0.42);
    const accentDeep = mix(accent, '#000000', 0.58);

    root.style.setProperty('--bg-base', base);
    root.style.setProperty('--bg-elevated', elevated);
    root.style.setProperty('--bg-surface', surface);
    root.style.setProperty('--bg-surface-hover', surfaceHover);
    root.style.setProperty('--bg-surface-active', surfaceActive);
    root.style.setProperty('--bg-input', inputBg);
    root.style.setProperty('--bg-glass', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.82)`);
    root.style.setProperty('--bg-dock', `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.88)`);

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    root.style.setProperty('--accent-strong', accentStrong);
    root.style.setProperty('--accent-soft', accentSoft);
    root.style.setProperty('--accent-deep', accentDeep);
    root.style.setProperty('--accent-glow-1', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.3)`);
    root.style.setProperty('--accent-glow-2', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.18)`);

    root.style.setProperty('--text-on-accent', accentIsLight ? '#09090b' : '#ffffff');
    root.style.setProperty('--text-primary', baseIsLight ? '#0f172a' : '#f5f3ff');
    root.style.setProperty('--text-secondary', baseIsLight ? '#334155' : mix('#a79ec0', '#ffffff', 0.1));
    root.style.setProperty('--text-muted', baseIsLight ? '#64748b' : '#7a7094');
    root.style.setProperty('--border-subtle', baseIsLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)');
    root.style.setProperty('--border-medium', baseIsLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)');
  }

  window.Vesper.Themes = {
    PRESETS,
    ACCENT_SWATCHES,
    apply: applyTheme
  };
})();
