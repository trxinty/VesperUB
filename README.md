# Vesper

A sleek, customizable web workspace featuring a **dark purple & black** default aesthetic, an immediate front-door account gate (with Guest mode), a customizable Theme Engine, a clean Games Hub shell, and an account-gated Discord-style Chat experience with full profile & server customizations.

## What's Included (Phase 1 + Phase 2)
- **Front-Door Entry Gate:** Sign In, Create Account, and Continue as Guest right when you open Vesper.
- **Guest Warning Confirmation:** Clicking **Continue as Guest** prompts `"Are you sure? If you continue as a guest, you won't be able to use the chat feature"` before entering.
- **Full Profile Customizations (Discord-Style):**
  - Upload a custom **Profile Picture (PFP)** (automatically resized & compressed for smooth storage) or pick a fallback color.
  - Upload a custom **Profile Banner** image or pick a custom banner gradient color.
  - Customize your **Display Name** freely while keeping your permanent **`@username`** login handle intact.
  - Set your **About Me / Bio** and online status (`Online`, `Idle`, `Do Not Disturb`, `Invisible`) with a live Discord Profile Card preview.
  - Click any user's avatar or name in chat or the member list to inspect their full **Profile Popout Card** and message them directly.
- **Full Server Customizations & Roles:**
  - Upload a custom **Server Icon** image or set 1–2 letters/emoji.
  - Upload a custom **Server Banner** image displayed right at the top of the server channel sidebar.
  - Create custom **Server Roles** with custom colors, toggle **Hoist** ("Display role members separately"), and assign roles to members.
  - Role-colored member names and hoisted role groups in the Members drawer.
- **Rich Chat Features:** Create servers, copy/regenerate invite codes, create/delete text channels, Direct Messages, Markdown formatting (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`), `@mentions`, replies, edit/delete, emoji reactions, pinned messages, in-channel search, and mobile swipe gestures.
- **Dynamic Theme Engine:** Defaults to **Vesper Purple** (dark purple + black), plus 8 built-in presets, accent color swatches, and dual custom color pickers.
- **Games Hub Shell:** Clean category filters, instant search, and an intentional **"No games yet"** placeholder ready for Games in `js/games-data.js`.

## How to Upload to GitHub Pages
1. Unzip `vesper-v3.zip`.
2. Open your GitHub repository and upload everything **inside** the `vesper/` folder (`index.html`, `README.md`, `css/`, `js/`) to the root of your repository.
3. Go to **Settings -> Pages** in your GitHub repo.
4. Under **Build and deployment**, select **Deploy from a branch**, pick `main` and `/ (root)`, then click **Save**.
5. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute.
