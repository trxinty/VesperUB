# Vesper

A sleek, customizable web portal featuring a **dark purple & black** default aesthetic, an immediate front-door account gate (with Guest mode), an **In-Site Tabbed Browser & DuckDuckGo Search**, a **352+ Game Hub** powered directly by your forked `trxinty/Html-games-` repository, and an account-gated Discord-style Chat with full profile/server customizations and Role Permissions.

## What's Included
- **Front-Door Entry Gate & Guest Mode:** Immediate Sign In / Create Account / Continue as Guest gate with confirmation warning modal.
- **In-Site Tabbed Browser & Search (Home):** Search DuckDuckGo or enter URLs directly inside Vesper with a top tab bar (`+` new tab, close tab, Back, Forward, Reload, Home, Address Bar). Everything stays inside Vesper—zero extra browser tabs opened.
- **352+ Games Hub (`trxinty/Html-games-`):**
  - Automatically syncs all single-file HTML games from `https://github.com/trxinty/Html-games-/tree/master/offline` via jsDelivr & GitHub APIs (cached locally in `localStorage`).
  - Streams each `.html` game with a live MB progress bar into a same-origin Blob URL and runs it directly inside Vesper's Fullscreen Theater Player (no extra tabs).
  - Includes instant search, category chips, sorting, Favorites, Recent history, Refresh, and a `+ local html` file importer.
- **Discord-Style Chat with Customizations & Role Permissions:**
  - Upload custom **Profile Pictures**, **Profile Banners**, **Server Icons**, and **Server Banners**.
  - Change your **Display Name** while keeping your permanent **`@username`**.
  - Full **Discord Role Permissions (`Server Settings -> Roles`)**: edit role names, colors, Hoist toggles, and 8 granular permissions (`Administrator`, `Manage Server`, `Manage Roles`, `Manage Channels`, `Manage Messages`, `Send Messages`, `Add Reactions`, `Create Invites`) enforced live in Chat.
  - Clickable Profile Popouts, Pinned Messages, In-Channel Search, Markdown, Replies, Reactions, Edit/Delete, and Mobile Swipe Gestures.
- **Dynamic Theme Engine:** Default Dark Purple & Black (`Vesper Purple`), 8 presets, accent dots, and dual custom color pickers.

## How to Upload to GitHub Pages
1. Unzip `vesper-final.zip`.
2. Make sure any old `games/` folder is deleted from your `VesperUB` repo.
3. Upload everything **inside** the `vesper/` folder (`index.html`, `README.md`, `css/`, `js/`) to the root of your repository.
4. Enable GitHub Pages from `main` -> `/ (root)` in **Settings -> Pages**.
