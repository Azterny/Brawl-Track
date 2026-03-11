# CLAUDE.md — Brawl-Track Codebase Guide

This file provides essential context for AI assistants working on the Brawl-Track codebase.

---

## Project Overview

**Brawl-Track** is a Brawl Stars statistics tracking web application with French localization. It allows users to view player stats, trophy history, leaderboards, club info, and manage linked game accounts.

- **Live site**: https://brawl-track.com
- **Backend API**: https://api.brawl-track.com
- **Language/Audience**: French (UI text is in French)

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+) — no build step, no npm
- **Libraries (CDN-loaded)**:
  - Chart.js 4.4.1 + chartjs-adapter-date-fns — data visualization
  - Flatpickr — date picker
  - Marked — Markdown parsing
  - DOMPurify — HTML sanitization (XSS prevention)
  - Google Fonts (Audiowide, Lilita One, Roboto)
- **Deployment**: Static file hosting; GitHub Pages compatible; `CNAME` = `brawl-track.com`
- **No package.json, no build tool, no test framework**

---

## Directory Structure

```
/
├── assets/                 # Static images
│   ├── ranks/              # Rank tier icons (wood, bronze, silver, gold, prestige)
│   ├── icons/              # Feature icons
│   ├── grade/              # Grade indicators
│   └── logo.png, default_icon.png, loading_icon.png, ...
├── css/                    # Page-scoped stylesheets
│   ├── base.css            # CSS reset and global custom properties
│   ├── style.css           # Main shared component styles
│   ├── dashboard.css
│   ├── userhome.css
│   ├── leaderboard.css
│   ├── club.css
│   ├── index.css
│   ├── link_account.css
│   ├── mailbox.css
│   └── responsive.css      # All media queries / mobile overrides
├── js/                     # Page-scoped JavaScript modules
│   ├── config.js           # Global config & shared mutable state
│   ├── utils.js            # Shared helpers (rank config, brawler ranking)
│   ├── auth.js             # Authenticated fetch wrapper + token management
│   ├── navbar.js           # Navigation bar generation
│   ├── index.js            # Landing page logic
│   ├── dashboard.js        # Player dashboard & Chart.js visualization
│   ├── leaderboard.js      # Leaderboard filtering & rendering
│   ├── club.js             # Club page logic
│   ├── userhome.js         # Account management hub
│   ├── link_account.js     # Account linking workflow
│   ├── settings.js         # User settings (interval, profile, archive)
│   ├── mailbox.js          # Message system
│   └── picture_generator.js # Image export (screenshot-style player cards)
├── index.html              # Landing / login page
├── dashboard.html          # Player stats viewer
├── userhome.html           # Authenticated user hub
├── leaderboard.html        # Global/regional rankings
├── club.html               # Club info page
├── subscribe.html          # Subscription/pricing page
├── mailbox.html            # User messages
├── admin.html              # Admin dashboard (styles embedded)
├── admin_edit.html         # Admin content editor
├── maintenance.html        # Maintenance mode page
├── 404.html                # SPA-style routing fallback
├── CNAME                   # Domain: brawl-track.com
└── README.md
```

---

## Configuration (`js/config.js`)

The central config file exposes globals used across all page scripts:

```javascript
const GLOBAL_MAINTENANCE = false;   // Toggle maintenance mode
const API_URL = "https://api.brawl-track.com";
let currentUserTier = 'basic';      // 'basic' | 'subscriber' | 'premium'
let globalBrawlersList = [];        // Populated on app load
let fullHistoryData = [];           // Trophy history for charts
let currentLiveTrophies = null;
window.myChart = null;              // Active Chart.js instance
```

When changing the API URL (e.g., for local dev), edit `config.js` only.

---

## Authentication (`js/auth.js`)

- Tokens stored in `localStorage` (`token`, `username`)
- All authenticated API calls go through `fetchAuth(url, options)` — a thin wrapper around `fetch()` that injects the `Authorization: Bearer <token>` header and handles 401 (auto-logout + redirect to `index.html`)
- Do **not** call `fetch()` directly for authenticated endpoints; always use `fetchAuth()`

---

## Page Architecture

Each HTML page has a corresponding JS file. The pattern is:
1. `DOMContentLoaded` listener calls an `init*()` function
2. Init function fetches data via `fetchAuth()` or `fetch()`
3. DOM is updated via direct manipulation or template string injection

There is **no virtual DOM, no framework, no component system** — just plain DOM manipulation.

### Key Page-to-Script Mapping

| Page | Script | Purpose |
|---|---|---|
| `index.html` | `index.js` | Auth forms, public player search, event rotation |
| `dashboard.html` | `dashboard.js` | Trophy charts, brawler stats, date range picker, image export |
| `userhome.html` | `userhome.js` | Linked account card, followed accounts grid |
| `leaderboard.html` | `leaderboard.js` | Zone/type filtering, paginated ranking tables |
| `club.html` | `club.js` | Club stats, sortable member list |
| `mailbox.html` | `mailbox.js` | Unread messages, Markdown rendering via Marked + DOMPurify |
| `admin.html` | *(inline)* | Admin controls |

---

## API Endpoints Reference

All endpoints are relative to `API_URL` (`https://api.brawl-track.com`).

### Authentication
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/register` | Register |

### User / Account
| Method | Path | Description |
|---|---|---|
| GET | `/api/my-stats` | Current user stats & tier |
| POST | `/api/settings/interval` | Update archive snapshot interval |
| POST | `/api/settings/update-profile` | Update username / password |
| POST | `/api/settings/delete-account` | Delete account |

### Account Linking
| Method | Path | Description |
|---|---|---|
| GET | `/api/link/status` | Check current link status |
| POST | `/api/link/init` | Start linking challenge |
| POST | `/api/link/verify` | Verify challenge completion |
| POST | `/api/link/cancel` | Cancel pending link |
| POST | `/api/unclaim-tag` | Unlink account |

### Player Data
| Method | Path | Description |
|---|---|---|
| GET | `/api/public/player/{tag}` | Player profile (tag without `#`) |
| GET | `/api/public/player/{tag}/brawler/{id}` | Brawler history |
| POST | `/api/bulk-players` | Fetch multiple players `{ tags: [...] }` |

### Club Data
| Method | Path | Description |
|---|---|---|
| GET | `/api/public/club/{tag}` | Club info |

### Leaderboards
| Method | Path | Description |
|---|---|---|
| GET | `/api/rankings/{zone}/players` | Player rankings |
| GET | `/api/rankings/{zone}/clubs` | Club rankings |
| GET | `/api/rankings/{zone}/brawlers/{id}` | Brawler rankings |

Supported zones: `global`, `FR`, `GB`, `US`, `DE`, `ES`, `IT`, `BR`, `JP`, `KR`, `CA`

### Misc
| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | Current event rotation |
| GET | `/api/brawlers` | Full brawler reference list |
| GET | `/api/follow-status/{tag}` | Check if user follows a tag |
| GET | `/api/messages` | User messages |
| GET | `/api/messages/{id}/read` | Mark message as read |
| GET | `/api/messages/unread-count` | Unread message count |
| POST | `/api/archive/delete` | Delete player archive |

---

## Styling Conventions

- **Dark theme** by default; backgrounds use `#0f111a`, `#121212`, `#1e1e2e`
- **CSS custom properties** defined in `base.css`:
  - Colors: `--yellow`, `--blue`, `--red`, `--green`, `--orange`, `--purple`, `--white`, `--dark-bg`, `--card-bg`, `--border`
  - Always use these variables; do not hardcode hex colors in component CSS
- **File-per-page**: Add new styles in the page's own CSS file; shared styles go in `style.css`
- **All responsive overrides** belong in `responsive.css` using `@media` queries
- CSS class names use kebab-case

---

## JavaScript Conventions

- **camelCase** for functions and variables
- **UPPER_SNAKE_CASE** for constants (e.g., `API_URL`, `GLOBAL_MAINTENANCE`)
- **No ES modules / import/export** — scripts are loaded via `<script>` tags; globals from `config.js` and `auth.js` are available on all pages
- Use `fetchAuth()` for all authenticated requests; use `fetch()` for public endpoints
- HTML inserted into the DOM must use `escapeHtml()` (from `navbar.js`) for user-provided strings; for Markdown, pipe through `DOMPurify.sanitize(marked.parse(content))`
- Skeleton loaders are used while data is fetching — show `.skeleton` elements, hide them when data arrives
- Debounce input handlers on search/filter fields
- Use `.map()`, `.filter()`, `.forEach()` — avoid mutating arrays with `push` in loops when a transform is intended

---

## Data Models

Player tags are passed **without** the `#` prefix to all API calls.

### Player
```javascript
{
  name: string,
  tag: string,           // no '#'
  trophies: number,
  highestTrophies: number,
  totalPrestigeLevel: number,
  nameColor: string,     // hex color
  brawlers: Brawler[],
  club: Club
}
```

### Brawler
```javascript
{
  id: number,
  name: string,
  power: number,         // 1-11
  trophies: number,
  highestTrophies: number,
  skin: string
}
```

### Club
```javascript
{
  name: string,
  tag: string,
  description: string,
  trophies: number,
  type: 'open' | 'inviteOnly' | 'closed',
  badgeId: number,
  members: Member[]
}
```

---

## User Tiers

The `currentUserTier` global controls feature access:
- `'basic'` — free tier, limited history/features
- `'subscriber'` — paid tier, extended history
- `'premium'` — full access

Gate features with `if (currentUserTier === 'subscriber' || currentUserTier === 'premium')`.

---

## Security Rules

1. **Never** inject raw user input or API-returned player names directly into `innerHTML` — always pass through `escapeHtml()` first
2. Markdown content (mailbox messages) must be sanitized: `DOMPurify.sanitize(marked.parse(raw))`
3. Do not store sensitive data beyond the JWT token in `localStorage`
4. All form submissions use the `fetchAuth()` wrapper — do not manually add headers elsewhere

---

## Development Workflow

There is no build step. To work locally:

1. Clone the repository
2. Serve the root directory over HTTP (e.g., `python3 -m http.server 8080` or VS Code Live Server)
3. Update `API_URL` in `config.js` if pointing at a local backend
4. Open `http://localhost:8080` in a browser

**No transpilation, no bundling, no minification** — changes to `.html`, `.css`, or `.js` are immediately reflected on page reload.

---

## Adding a New Page

1. Create `yourpage.html` in the root — follow the `<script>` loading order of an existing page (always load `config.js` → `auth.js` → `utils.js` → `navbar.js` → `yourpage.js` last)
2. Create `css/yourpage.css` and link it in the `<head>`
3. Create `js/yourpage.js` with an `initYourPage()` function called from `DOMContentLoaded`
4. Add responsive overrides in `css/responsive.css`
5. Add navigation links in `navbar.js` if needed

---

## Common Pitfalls

- **Tag format**: Brawl Stars tags use `#` in-game but the API expects the tag **without** `#`. Strip it with `tag.replace('#', '')` before any API call.
- **Global state**: `fullHistoryData`, `globalBrawlersList`, etc. in `config.js` are shared state — be careful not to overwrite them in one page's script and break another.
- **Chart cleanup**: Always call `window.myChart.destroy()` before creating a new Chart.js instance, otherwise the canvas will accumulate invisible chart instances.
- **Admin pages**: `admin.html` and `admin_edit.html` have styles embedded in `<style>` tags rather than external CSS files.
- **French UI**: All user-visible strings should be in French. Do not introduce English-language UI text.
