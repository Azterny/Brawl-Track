# CLAUDE.md — Brawl-Track Codebase Guide

This file documents the structure, conventions, and workflows for the Brawl-Track repository. It is intended for AI assistants working on this codebase.

---

## Project Overview

**Brawl-Track** is a French-language web application for tracking Brawl Stars player statistics and trophy history. It is a **static, client-side SPA** hosted on GitHub Pages at `brawl-track.com`. There is no build step — the HTML/CSS/JS is served as-is.

The backend API is hosted separately at `https://api.brawl-track.com` and is **not part of this repository**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Data visualization | Chart.js 4.4.1 |
| Date picker | Flatpickr |
| XSS prevention | DOMPurify 3.0.6 |
| Markdown rendering | Marked |
| Fonts | Google Fonts (Audiowide, Lilita One, Roboto) |
| Game assets | Brawlify CDN |
| Hosting | GitHub Pages (CNAME: `brawl-track.com`) |
| Build tool | **None** |
| Package manager | **None** (all dependencies via CDN) |
| Testing | **None configured** |

---

## Repository Structure

```
Brawl-Track/
├── CNAME                     # Custom domain: brawl-track.com
├── 404.html                  # Custom 404 error page
├── index.html                # Landing page (public search + login/register)
├── userhome.html             # User hub (linked accounts, followed players)
├── dashboard.html            # Player statistics & history (main feature)
├── leaderboard.html          # Global/regional leaderboards
├── club.html                 # Club info & member list
├── mailbox.html              # In-app inbox with Markdown support
├── subscribe.html            # Subscription tiers & pricing
├── admin.html                # Admin stats dashboard
├── admin_edit.html           # Admin direct-edit interface
├── maintenance.html          # Maintenance mode page
├── css/
│   ├── global.css            # Site-wide base styles & CSS variables
│   ├── navbar.css            # Navigation bar styles
│   ├── index.css             # Landing page styles
│   ├── dashboard.css         # Dashboard page styles
│   ├── userhome.css          # User hub styles
│   ├── leaderboard.css       # Leaderboard styles
│   ├── club.css              # Club page styles
│   ├── mailbox.css           # Mailbox styles
│   ├── subscribe.css         # Subscription page styles
│   └── admin.css             # Admin page styles
├── js/
│   ├── config.js             # Global config: API_URL, GLOBAL_MAINTENANCE
│   ├── utils.js              # Shared utilities (menu toggles, rank helper, escaping)
│   ├── auth.js               # Login/register API calls, token management
│   ├── navbar.js             # Dynamic nav rendering, notification badge
│   ├── index.js              # Landing page logic (player search, events)
│   ├── dashboard.js          # Core feature: charts, stats, brawler details (1,279 LOC)
│   ├── userhome.js           # Account hub: linked & followed players, stats
│   ├── leaderboard.js        # Leaderboard fetching, zone/category switching
│   ├── club.js               # Club data loading, member sorting
│   ├── mailbox.js            # Message fetching, read tracking
│   ├── link_account.js       # Multi-step modal for account linking
│   ├── picture_generator.js  # Shareable stat card image export (HTML2Canvas)
│   └── settings.js           # Auto-archive interval configuration
└── assets/
    ├── icons/                # Feature icons (PNG)
    ├── ranks/                # Brawler rank badges (WebP)
    ├── grade/                # Subscription tier badges (PNG)
    └── logo.png, default_icon.png, loading_icon.png, trophy_*.png
```

---

## Global Configuration

**`js/config.js`** — Edit this file to change environment settings:

```javascript
const GLOBAL_MAINTENANCE = false; // Set to true to redirect all pages to maintenance.html
const API_URL = "https://api.brawl-track.com"; // Backend base URL
```

To develop against a local backend, change `API_URL` to `http://localhost:<port>`.

---

## Authentication

- Auth state is stored in **`localStorage`**:
  - `localStorage.getItem("token")` — JWT token
  - `localStorage.getItem("username")` — Username
- All authenticated API calls include the header: `Authorization: Bearer <token>`
- Auth helpers are in `js/auth.js`
- The navbar (`js/navbar.js`) reads auth state to show/hide menu items and the notification badge

---

## API Integration Pattern

All API calls follow this pattern using the Fetch API:

```javascript
const response = await fetch(`${API_URL}/api/some-endpoint`, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${localStorage.getItem("token")}`
  }
});
const data = await response.json();
```

### Key API Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /auth/login` | No | Login |
| `POST /auth/register` | No | Register |
| `GET /api/public/player/{tag}` | No | Player profile |
| `GET /api/public/club/{tag}` | No | Club info |
| `POST /api/bulk-players` | Yes | Batch player fetch |
| `GET /api/my-stats` | Yes | Current user stats |
| `GET /api/messages` | Yes | Inbox messages |
| `POST /api/messages/{id}/read` | Yes | Mark message read |
| `GET /api/messages/unread-count` | Yes | Unread count |
| `POST /api/settings/interval` | Yes | Save archive interval |
| `GET /api/link/status` | Yes | Account link status |
| `GET /api/events` | No | Current event rotation |

---

## UI / Styling Conventions

- **Dark theme** throughout; colors defined as CSS custom properties in `css/global.css`
- **CSS variables** (e.g., `--accent`, `--background`, `--card`) should be used instead of hardcoded colors
- **Responsive layout** via CSS Flexbox and Grid
- Page-specific styles live in matching CSS files (e.g., `dashboard.html` → `css/dashboard.css`)
- The `css/global.css` and `css/navbar.css` are loaded on every page

---

## JavaScript Conventions

- **No modules, no bundler** — all JS files are loaded via `<script>` tags in HTML
- `js/config.js` must be loaded first (before other scripts) on every page
- `js/utils.js` and `js/navbar.js` are loaded on most pages
- **DOM manipulation** uses `innerHTML` for performance; always sanitize user-generated content with **DOMPurify** before inserting into the DOM
- Use `escapeHTML()` from `utils.js` for escaping user-facing text in non-HTML contexts
- **`async/await`** is used throughout for API calls
- **No global state management library** — state is either in-module variables or `localStorage`

### Security: XSS Prevention

- **Always** use `DOMPurify.sanitize()` before inserting API-returned HTML/Markdown
- **Always** use `escapeHTML()` from `utils.js` when inserting API strings into HTML attributes or text nodes
- Player tags and names from API responses should be treated as untrusted input

---

## Key Files to Understand First

1. **`js/config.js`** — Global config (read before anything else)
2. **`js/utils.js`** — Shared helpers used everywhere
3. **`js/auth.js`** — Auth flow (login, register, token)
4. **`js/navbar.js`** — Navigation rendering on all pages
5. **`js/dashboard.js`** — The largest and most complex file (1,279 LOC); handles chart rendering, date filtering, trophy history display, and brawler details

---

## Page-to-Script Mapping

| HTML Page | JS Files Loaded |
|-----------|----------------|
| `index.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `index.js` |
| `dashboard.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `dashboard.js`, `picture_generator.js` |
| `userhome.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `userhome.js`, `link_account.js`, `settings.js` |
| `leaderboard.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `leaderboard.js` |
| `club.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `club.js` |
| `mailbox.html` | `config.js`, `utils.js`, `auth.js`, `navbar.js`, `mailbox.js` |

---

## Subscription Tiers

Three tiers gate certain features:

| Tier | Key Features |
|------|-------------|
| `basic` | View public stats, follow limited players |
| `subscriber` | Shorter archive intervals, more linked/followed accounts |
| `premium` | Maximum limits, priority data, advanced exports |

Tier gating is enforced on the backend. The frontend reads the tier from the user stats API response and adjusts UI accordingly.

---

## Local Development

There is no build step. To run locally:

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node (http-server)
npx http-server -p 8080

# Then open: http://localhost:8080
```

To use a local backend, change `API_URL` in `js/config.js` before serving.

---

## Maintenance Mode

To put the site in maintenance mode:

1. Edit `js/config.js`
2. Set `const GLOBAL_MAINTENANCE = true;`
3. All pages will redirect to `maintenance.html`

---

## Deployment

- Deployment is automatic via **GitHub Pages** on push to `main`
- No CI/CD pipeline, build step, or environment variables are required
- The `CNAME` file sets the custom domain to `brawl-track.com`

---

## Commit Conventions

Current commit messages in this repo use the format:
```
Update <filename>
```

When making changes, prefer descriptive commit messages that explain **what changed and why**, e.g.:
```
Fix XSS vulnerability in club member name rendering
Add trophy history chart zoom for mobile
Update API_URL to new backend endpoint
```

---

## Known Patterns & Gotchas

- **Prestige levels**: Trophy counts can reset at prestige level-ups. There is a `FIX-PRESTIGE` workaround in `dashboard.js` that handles this edge case in chart rendering.
- **Player tags**: Brawl Stars tags use `#` prefix; API calls strip or encode it as needed. Check existing usage in `dashboard.js` before modifying tag handling.
- **Brawlify CDN**: Game icons are loaded from `https://cdn.brawlify.com/` and require the brawler ID. The format is documented inline in `dashboard.js`.
- **HTML escaping bug fix**: `club.js` has a `BUG-C FIX` comment explaining a historical XSS fix for club names — be careful when modifying that section.
- **French interface**: All user-facing text, HTML labels, and placeholders are in French. Code comments may be French or English. Maintain French for UI strings.
- **No error boundary**: There is no centralized error handling. API errors are handled per-function, often with `console.error` and a fallback UI message.
