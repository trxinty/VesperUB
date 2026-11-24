# Vesper

A sleek, customizable web workspace featuring a **dark purple & black** default aesthetic, an immediate front-door account gate (with Guest mode), a customizable Theme Engine, a clean Games Hub shell, and an account-gated Discord-style Chat experience.

## What's Included in Phase 1
- **Front-Door Entry Gate:** Sign In, Create Account, and Continue as Guest right when you open Vesper.
- **Guest Warning Confirmation:** Clicking **Continue as Guest** prompts `"Are you sure? If you continue as a guest, you won't be able to use the chat feature"` before entering.
- **Synced Username:** The username you create at the front door automatically becomes your profile name inside **Chat** and **Settings**.
- **Floating Pill Dock:** Displays only your core tabs (**Vesper Logo**, **Home**, **Games**, **Chat**, **Settings**), with a lock badge on Chat for Guests and a bottom/top position toggle in Settings.
- **Theme Engine:** Defaults to **Vesper Purple** (dark purple + black), plus 8 built-in presets (including *Blue & Dark Blue* and *Blue & Yellow*), accent color swatches, and dual custom color pickers so you can mix any two colors.
- **Games Hub Shell:** Clean category filters, instant search, and an intentional **"No games yet"** placeholder ready for Phase 2 games in `js/games-data.js`.
- **Discord-Style Chat (Account-Gated):** Create servers, copy/join via invite codes, create text channels, send Direct Messages, format text with Markdown (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`), reply, edit/delete messages, react with emojis, and customize your status & avatar color. Works out of the box with live multi-tab syncing via `localStorage` + `BroadcastChannel`.

## How to Upload to GitHub Pages
1. Unzip `vesper.zip`.
2. Create a new repository on GitHub (for example, `vesper`).
3. Upload everything **inside** the `vesper/` folder (`index.html`, `css/`, `js/`, `README.md`) to the root of your repository.
4. Go to **Settings -> Pages** in your GitHub repo.
5. Under **Build and deployment**, select **Deploy from a branch**, pick `main` and `/ (root)`, then click **Save**.
6. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute.

## Testing Locally
You can double-click `index.html` directly on your laptop—no build step or local server required. Open `index.html` in two browser tabs at the same time to see messages and servers sync live across tabs!

## Adding Games Later (Phase 2)
Open `js/games-data.js` and add game entries to `window.Vesper.GamesData`. The Games page will automatically switch from the **"No games yet"** state to a full searchable, filterable grid.

## Enabling Cross-Device Live Chat Later (Phase 2)
Right now Chat syncs instantly across browser tabs locally. When you're ready for friends on different devices to chat live, open `js/firebase-config.js` and plug in your free Firebase project credentials.
