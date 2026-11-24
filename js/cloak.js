(function () {
  'use strict';
  window.Vesper = window.Vesper || {};

  const DEFAULT_TITLE = 'Vesper';
  const DEFAULT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2309060e'/%3E%3Cpath d='M16 18L32 48L48 18H39L32 32.5L25 18H16Z' fill='%239333ea'/%3E%3Ccircle cx='32' cy='16' r='3.5' fill='%23d8b4fe'/%3E%3C/svg%3E";

  const PRESETS = [
    {
      id: 'none',
      name: 'Vesper (Default)',
      title: DEFAULT_TITLE,
      icon: DEFAULT_ICON
    },
    {
      id: 'classroom',
      name: 'Google Classroom',
      title: 'Home',
      icon: 'https://www.google.com/s2/favicons?domain=classroom.google.com&sz=64'
    },
    {
      id: 'canvas',
      name: 'Canvas',
      title: 'Dashboard',
      icon: 'https://www.google.com/s2/favicons?domain=instructure.com&sz=64'
    },
    {
      id: 'google',
      name: 'Google',
      title: 'Google',
      icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64'
    },
    {
      id: 'drive',
      name: 'Google Drive',
      title: 'My Drive - Google Drive',
      icon: 'https://www.google.com/s2/favicons?domain=drive.google.com&sz=64'
    },
    {
      id: 'docs',
      name: 'Google Docs',
      title: 'Untitled document - Google Docs',
      icon: 'https://www.google.com/s2/favicons?domain=docs.google.com&sz=64'
    },
    {
      id: 'khan',
      name: 'Khan Academy',
      title: 'Dashboard | Khan Academy',
      icon: 'https://www.google.com/s2/favicons?domain=khanacademy.org&sz=64'
    },
    {
      id: 'clever',
      name: 'Clever',
      title: 'Clever | Portal',
      icon: 'https://www.google.com/s2/favicons?domain=clever.com&sz=64'
    },
    {
      id: 'wikipedia',
      name: 'Wikipedia',
      title: 'Wikipedia, the free encyclopedia',
      icon: 'https://www.google.com/s2/favicons?domain=en.wikipedia.org&sz=64'
    }
  ];

  const KNOWN_TITLES = {
    'classroom.google.com': 'Home',
    'drive.google.com': 'My Drive - Google Drive',
    'docs.google.com': 'Untitled document - Google Docs',
    'slides.google.com': 'Untitled presentation - Google Slides',
    'sheets.google.com': 'Untitled spreadsheet - Google Sheets',
    'mail.google.com': 'Inbox - Gmail',
    'google.com': 'Google',
    'desmos.com': 'Desmos | Graphing Calculator',
    'khanacademy.org': 'Dashboard | Khan Academy',
    'clever.com': 'Clever | Portal',
    'ixl.com': 'IXL | Math, Language Arts, Science, Social Studies',
    'quizlet.com': 'Quizlet: Study Tools & Learning Resources',
    'kahoot.it': 'Enter Game PIN - Kahoot!',
    'schoology.com': 'Home | Schoology',
    'instructure.com': 'Dashboard',
    'canvas.instructure.com': 'Dashboard',
    'wikipedia.org': 'Wikipedia, the free encyclopedia',
    'en.wikipedia.org': 'Wikipedia, the free encyclopedia',
    'youtube.com': 'YouTube',
    'search.brave.com': 'Brave Search',
    'brave.com': 'Brave Search',
    'duckduckgo.com': 'DuckDuckGo — Privacy, simplified.'
  };

  function setFavicon(href) {
    const target = href || DEFAULT_ICON;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = target;
  }

  function applyNow(title, icon) {
    document.title = (title && title.trim()) ? title.trim() : DEFAULT_TITLE;
    setFavicon((icon && icon.trim()) ? icon.trim() : DEFAULT_ICON);
  }

  function syncFromSettings() {
    const s = window.Vesper.Store.get().settings || {};
    const cloakTitle = s.cloakTitle || '';
    const cloakIcon = s.cloakIcon || '';
    const onlyWhenAway = !!s.cloakWhenAway;
    const isAway = document.visibilityState === 'hidden';

    if (!cloakTitle && !cloakIcon) {
      applyNow(DEFAULT_TITLE, DEFAULT_ICON);
      return;
    }

    if (onlyWhenAway) {
      if (isAway) {
        applyNow(cloakTitle || 'Home', cloakIcon || PRESETS[1].icon);
      } else {
        applyNow(DEFAULT_TITLE, DEFAULT_ICON);
      }
    } else {
      applyNow(cloakTitle || DEFAULT_TITLE, cloakIcon || DEFAULT_ICON);
    }
  }

  /**
   * Takes any URL (e.g. "classroom.google.com" or "https://desmos.com/calculator"),
   * builds the real site favicon URL, and derives a clean matching browser tab title.
   */
  function extractFromUrl(rawUrl) {
    const cleaned = (rawUrl || '').trim();
    if (!cleaned) throw new Error('Enter a website link first.');
    const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : 'https://' + cleaned;
    let parsed;
    try {
      parsed = new URL(withProto);
    } catch (e) {
      throw new Error('That does not look like a valid website URL.');
    }

    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const rootDomain = host.split('.').slice(-2).join('.');
    let title = KNOWN_TITLES[host] || KNOWN_TITLES[rootDomain];

    if (!title) {
      const brand = host.split('.')[0] || host;
      title = brand.charAt(0).toUpperCase() + brand.slice(1);
    }

    const icon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    return { host, title, icon };
  }

  function openInAboutBlank() {
    const s = window.Vesper.Store.get().settings || {};
    const win = window.open('about:blank', '_blank');
    if (!win) {
      window.Vesper.App.toast('Pop-up blocked — allow pop-ups to use about:blank cloak');
      return;
    }

    const cloakTitle = (s.cloakTitle || 'Home').replace(/</g, '&lt;');
    const cloakIcon = s.cloakIcon || PRESETS[1].icon;
    const currentUrl = window.location.href;

    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${cloakTitle}</title>
  <link rel="icon" href="${cloakIcon}" />
  <style>html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:none;overflow:hidden;background:#060409;}</style>
</head>
<body>
  <iframe src="${currentUrl}" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe>
</body>
</html>`);
    doc.close();
  }

  function init() {
    syncFromSettings();
    document.addEventListener('visibilitychange', syncFromSettings);
  }

  window.Vesper.Cloak = {
    DEFAULT_TITLE,
    DEFAULT_ICON,
    PRESETS,
    init,
    sync: syncFromSettings,
    extractFromUrl,
    openInAboutBlank
  };
})();
