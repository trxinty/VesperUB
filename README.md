# Vesper

A sleek, customizable web portal featuring a **dark purple & black** default aesthetic, an immediate front-door account gate (with Guest mode), an **In-Site Ultraviolet Tabbed Browser** (supporting Brave Search, DuckDuckGo, Google, Startpage, Bing, Ecosia, or custom search URLs), a **Tab Cloak** engine with auto-copy from any URL, a **352+ Game Hub** powered by `trxinty/Html-games-`, and an account-gated Discord-style Chat with full customizations and Role Permissions.

## What's Included
- **In-Site Ultraviolet v3 Browser (`sw.js`, `uv/uv.config.js`, `uv/baremux-worker.js`, `js/proxy.js`, `js/home.js`):**
  - Runs Ultraviolet v3 + BareMux v2 + Epoxy/Libcurl transport statically on GitHub Pages (with dynamic subpath detection for `/VesperUB/`).
  - Switch search engines right from Home or the Browser bar (**Brave Search**, **DuckDuckGo**, **Google**, **Startpage**, **Bing**, **Ecosia**, or **Custom URL**).
  - Configure or test any `wss://` Wisp relay server directly inside **Settings**, plus a **Reader** fallback mode.
- **Tab Cloak (`js/cloak.js`, `js/settings.js`):**
  - Live mini browser tab preview right inside Settings.
  - Built-in presets (Google Classroom, Canvas, Google, Google Drive, Google Docs, Khan Academy, Clever, Wikipedia).
  - **Copy from Any Link:** Paste any website URL to automatically copy its favicon & tab title.
  - Supports custom title, custom favicon upload, **Cloak Only When Away**, and **Open in `about:blank`**.
- **352+ Games Hub (`trxinty/Html-games-`):**
  - Auto-syncs and streams single-file `.html` games directly inside Vesper's Fullscreen Theater Player.
- **Discord-Style Chat:**
  - Custom Profile Pictures, Profile Banners, Display Names + permanent `@username`, Server Icons, Server Banners, Server Roles with 8 granular Discord permissions, Profile Popouts, Pinned Messages, In-Channel Search, and Mobile Swipe Gestures.

## How to Upload to GitHub Pages
1. Unzip `vesper-v6.zip`.
2. Upload everything **inside** the `vesper/` folder (`index.html`, `sw.js`, `README.md`, `uv/`, `css/`, `js/`) into the root of your `VesperUB` repository.
3. Make sure `sw.js` and the `uv/` folder are at the root next to `index.html` so the Ultraviolet Service Worker registers properly on `https://trxinty.github.io/VesperUB/`.
