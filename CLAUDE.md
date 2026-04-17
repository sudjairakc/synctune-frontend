# CLAUDE.md — synctune-frontend
## Svelte Frontend · Vite · YouTube IFrame API

Read this file before doing any work in this repo.

---

## Behavioral Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 1. Stack & Structure

```
synctune-frontend/
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.js
├── nginx.conf
├── .env.example
├── Dockerfile
├── public/
│   ├── og-image.png
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.js
    ├── App.svelte
    ├── test-setup.js
    ├── lib/
    │   ├── websocket.js          ← WS client + exponential backoff + join()
    │   ├── stores.js             ← Svelte writable stores (single source of truth)
    │   ├── toast.js              ← Toast notification store
    │   └── sound.js              ← Web Audio API tones (no external audio files)
    └── components/
        ├── Player.svelte         ← YouTube IFrame wrapper + seek guard + autoplay
        ├── Queue.svelte          ← Drag & drop queue list
        ├── AddSong.svelte        ← URL input (hides added_by once joined)
        ├── History.svelte        ← Playback history + requeue
        ├── PlaybackControls.svelte ← Autoplay / Shuffle / Random toggle
        ├── Chat.svelte           ← Real-time chat + online users
        ├── JoinModal.svelte      ← Name + Room ID modal before entering
        ├── TutorialTooltip.svelte ← First-time onboarding overlay
        └── LegalModal.svelte     ← Terms of Service + Privacy Policy modal
```

---

## 2. Common Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest unit + component tests
npm run lint
npm run build
```

---

## 3. Critical Rules

- **Stores update via WebSocket events only** — no optimistic updates
- **Seek Guard**: check drift > 3 s before every seek; skip if serverSeek >= duration
- **User Seek Cooldown**: after user drags/pauses in the player, ignore `seek_sync` for 5 s to prevent snap-back
- **YouTube IFrame API**: must wait for `onYouTubeIframeAPIReady` — `playerContainer` must always be in the DOM (never inside `{#if}`)
- **queue_id**: all events sent to the backend (`song_ended`, `skip_song`, `report_error`, `reorder_queue`, `remove_song`) use `queue_id`, not the YouTube video ID
- **isPlaying**: check before loading video — if false, use `cueVideoById` instead of `loadVideoById`
- **join first**: `ws.join(username, profile_img, room_id?)` must be called before any other event — websocket.js handles sending it automatically in `onopen`
- **room_id**: 6 digits only — omitting or null causes the server to create a new room automatically
- **Every error path must have UI feedback** — no silent failures

---

## 4. WebSocket Events

### Server → Client

| Event | Stores updated |
|---|---|
| `room_joined` | currentRoom, queue, currentIndex, seekTime, isPlaying, history, autoplay, shuffle, randomPlay, chatHistory, onlineUsers |
| `initial_state` | Same as `room_joined` (backward-compat) |
| `queue_updated` | queue, currentIndex, isPlaying, history (if present) |
| `seek_sync` | seekTime, isPlaying |
| `playback_mode_updated` | autoplay, shuffle, randomPlay (only fields present — use `!= null` check) |
| `song_skipped` | toast with reason mapping |
| `user_joined` | onlineUsers + toast notice |
| `user_left` | onlineUsers |
| `message_received` | chatHistory (append) |
| `error` | toast — codes: `NOT_JOINED`, `INVALID_USERNAME`, `INVALID_ROOM_ID`, `EMPTY_MESSAGE`, `RATE_LIMITED` |

### Client → Server

| Event | Payload | Notes |
|---|---|---|
| `join` | `{ username, profile_img?, room_id? }` | Sent immediately after connect — auto from `ws.join()` — omit room_id to create a new room |
| `add_song` | `{ youtube_url, added_by? }` | `added_by` only sent when not yet joined |
| `remove_song` | `{ song_id: queue_id }` | |
| `reorder_queue` | `{ song_id: queue_id, new_index }` | |
| `skip_song` | `{ song_id: queue_id }` | |
| `song_ended` | `{ song_id: queue_id }` | |
| `report_error` | `{ song_id: queue_id, error_code }` | |
| `set_playback_mode` | `{ autoplay?, shuffle?, random_play? }` | |
| `send_message` | `{ text }` | Truncated at 500 characters |

---

## 5. Stores

| Store | Type | Description |
|---|---|---|
| `queue` | `Song[]` | Current song queue |
| `currentIndex` | `number` | Index of the currently playing song |
| `seekTime` | `number` | Current playback position (seconds) from server |
| `isPlaying` | `boolean` | |
| `history` | `HistorySong[]` | Previously played songs |
| `toasts` | `Toast[]` | |
| `connectionStatus` | `string` | `'connecting'` \| `'connected'` \| `'disconnected'` |
| `autoplay` | `boolean` | |
| `shuffle` | `boolean` | |
| `randomPlay` | `boolean` | |
| `currentUser` | `User\|null` | The local user (null if not yet joined) |
| `onlineUsers` | `User[]` | List of users currently online |
| `chatHistory` | `ChatMessage[]` | Chat message history |
| `currentRoom` | `string\|null` | room_id of the current room (null if not yet joined) |

---

## 6. Theme

- Use CSS custom properties everywhere — no hardcoded hex values in components
- Dark/Light theme toggle via `data-theme` attribute on `<html>`, saved to `localStorage`
- Reads `prefers-color-scheme` on first visit if no preference is stored
- All variables defined in `App.svelte` under `:global(:root)` and `:global([data-theme="light"])`

---

## 7. SEO & Public Files

- `index.html` has full meta tags: description, Open Graph, Twitter Card, canonical URL, robots
- `public/og-image.png` — OG image used for social sharing previews
- `public/robots.txt` — allows all crawlers, links to sitemap
- `public/sitemap.xml` — single-page sitemap for `https://synctune-frontend.vercel.app/`
- Live URL: `https://synctune-frontend.vercel.app`
