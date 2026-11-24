# Vesper

A sleek, customizable web portal featuring a **dark purple & black** default aesthetic, an immediate front-door account gate (with Guest mode), an in-page DuckDuckGo Search Viewer, a full 18-game HTML5 Games Hub with Fullscreen Theater Player, and an account-gated Discord-style Chat experience with profile/server customizations and granular Role Permissions.

## What's Included (Phases 1–3)
- **Front-Door Entry Gate & Guest Mode:** Immediate Sign In / Create Account / Continue as Guest gate with confirmation warning modal.
- **In-Page DuckDuckGo Search Viewer (Home):** Type any query in the Home search bar to view live DuckDuckGo Instant Answer & knowledge results directly inside Vesper, switch between **Results** and **Frame** view (`duckduckgo.com/?q=...`), or open full results on DuckDuckGo in one click.
- **Games Hub (18 Playable Games + Custom Game Importer):**
  - 16 built-in, zero-dependency HTML5 Canvas/Web games inside `games/` (Neon Dash, 2048, Void Runner, Flappy Vesper, Tetrix, Star Blaster, Neon Snake, Brick Breaker, Cosmic Clicker, Word Pulse, Aim Trainer, Cyber Dino, Minesweeper, Neon Pong 1P/2P, Memory Flip, Reaction Zero) that run 100% locally and on GitHub Pages.
  - 2 legitimate open-source web games (Hextris & A Dark Room).
  - Search, category filter chips, Favorites star pins, Recently Played tracking, Fullscreen Theater Player, and an in-app **"+ Add Game"** modal for adding your own HTML5 games or URLs.
- **Discord-Style Chat with Full Customizations & Role Permissions:**
  - Upload custom **Profile Pictures**, **Profile Banners**, **Server Icons**, and **Server Banners** (auto-compressed cleanly in `js/media.js`).
  - Change your **Display Name** while keeping your permanent **`@username`**.
  - **Discord Role Permissions (`Server Settings -> Roles`):** Click any role to edit its Name, Color, Hoist toggle, and 8 granular permissions (`Administrator`, `Manage Server`, `Manage Roles`, `Manage Channels`, `Manage Messages`, `Send Messages`, `Add Reactions`, `Create Invites`) — enforced live across Chat.
  - Clickable Profile Popouts, Pinned Messages, In-Channel Search, Markdown, Replies, Reactions, Edit/Delete, and Mobile Swipe Gestures.
- **Dynamic Theme Engine:** Default Dark Purple & Black (`Vesper Purple`), 8 built-in presets, accent dots, and dual custom color pickers.

## How to Upload to GitHub Pages
1. Unzip `vesper-v4.zip`.
2. Upload everything **inside** the `vesper/` folder (`index.html`, `README.md`, `css/`, `js/`, `games/`) into the root of your GitHub repository.
3. Enable GitHub Pages from `main` -> `/ (root)` in **Settings -> Pages**.
