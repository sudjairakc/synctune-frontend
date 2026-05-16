# CLAUDE.md — synctune-frontend
## Svelte Frontend · Vite · YouTube IFrame API · v1.0.1

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
├── SKILL.md                          ← คู่มือ Claude Code Skills สำหรับ repo นี้
├── DESIGN.md                         ← Architecture decisions และ design notes
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
    │   ├── websocket.js              ← WS client + exponential backoff + join()
    │   ├── stores.js                 ← Svelte writable stores (single source of truth)
    │   ├── toast.js                  ← Toast notification store
    │   └── sound.js                  ← Web Audio API tones (no external audio files)
    └── components/
        ├── Player.svelte             ← YouTube IFrame wrapper + seek guard + autoplay
        ├── Queue.svelte              ← Drag & drop queue list + activity log
        ├── AddSong.svelte            ← URL input (hides added_by once joined)
        ├── History.svelte            ← Playback history + requeue
        ├── PlaybackControls.svelte   ← Autoplay / Shuffle / Random / Speed toggle
        ├── Chat.svelte               ← Real-time chat + online users
        ├── SoundPad.svelte           ← 50-slot shared sound pad + play history
        ├── VoicePTT.svelte           ← Push-to-talk WebRTC (PTT button + peer management)
        ├── VoteModal.svelte          ← Voting UI for remove/skip with live count
        ├── Suggestions.svelte        ← Curated song suggestion panel
        ├── SupportMe.svelte          ← Top spenders leaderboard + PromptPay QR
        ├── AdminPanel.svelte         ← Admin controls (broadcast scheduler, top spenders)
        ├── JoinModal.svelte          ← Name + Room ID modal before entering
        ├── TutorialTooltip.svelte    ← First-time onboarding overlay
        └── LegalModal.svelte         ← Terms of Service + Privacy Policy modal
```

---

## 2. Common Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest unit + component tests
npm run lint
npm run format
npm run build
```

---

## 3. Critical Rules

- **Stores update via WebSocket events only** — no optimistic updates
- **Seek Guard**: check drift > 3 s before every seek; skip if serverSeek >= duration
- **User Seek Cooldown**: after user drags/pauses in the player, ignore `seek_sync` for 5 s
- **YouTube IFrame API**: must wait for `onYouTubeIframeAPIReady` — `playerContainer` must always be in the DOM (never inside `{#if}`)
- **queue_id**: all events sent to backend use `queue_id`, not the YouTube video ID
- **isPlaying**: check before loading video — if false, use `cueVideoById` instead of `loadVideoById`
- **join first**: `ws.join()` must be called before any other event — websocket.js sends it automatically in `onopen`
- **SoundPad**: each client plays audio fully independently — no global soundpad playback state
- **Voice PTT**: backend only relays signaling; all media is peer-to-peer between clients
- **Every error path must have UI feedback** — no silent failures

---

## 4. WebSocket Events

### Server → Client

| Event | Stores / Effect |
|---|---|
| `room_joined` | currentRoom, queue, currentIndex, seekTime, isPlaying, history, autoplay, shuffle, randomPlay, playbackSpeed, chatHistory, onlineUsers, soundpad |
| `initial_state` | Same as `room_joined` (backward-compat) |
| `queue_updated` | queue, currentIndex, isPlaying, history |
| `seek_sync` | seekTime, isPlaying |
| `playback_mode_updated` | autoplay, shuffle, randomPlay, playbackSpeed |
| `song_skipped` | toast with reason |
| `user_joined` | onlineUsers + toast |
| `user_left` | onlineUsers |
| `message_received` | chatHistory (append) |
| `soundpad_updated` | soundpad store (50-slot array) |
| `soundpad_play` | trigger audio on this client independently |
| `soundpad_stop` | stop soundpad audio on this client |
| `vote_started` | open VoteModal with vote info |
| `vote_updated` | update yes count in VoteModal |
| `vote_resolved` | close VoteModal + show result toast |
| `voice_start` | show PTT indicator for that user |
| `voice_stop` | hide PTT indicator |
| `voice_join / offer / answer / ice` | WebRTC signaling — handled in VoicePTT.svelte |
| `error` | toast — codes: `NOT_JOINED`, `VOTE_IN_PROGRESS`, `NO_ACTIVE_VOTE`, `ALREADY_VOTED`, etc. |

### Client → Server

| Event | Payload | Notes |
|---|---|---|
| `join` | `{ username, profile_img?, room_id? }` | Auto from `ws.join()` |
| `add_song` | `{ youtube_url, added_by? }` | |
| `remove_song` | `{ song_id: queue_id }` | May open vote if not own song |
| `reorder_queue` | `{ song_id: queue_id, new_index }` | |
| `skip_song` | `{ song_id: queue_id }` | May open vote if not own song |
| `song_ended` | `{ song_id: queue_id }` | |
| `report_error` | `{ song_id: queue_id, error_code }` | |
| `set_playback_mode` | `{ autoplay?, shuffle?, random_play?, playback_speed? }` | |
| `send_message` | `{ text }` | Max 500 chars |
| `soundpad_set` | `{ slot, video_id, title }` | slot = 0–49 |
| `soundpad_clear` | `{ slot }` | |
| `soundpad_play` | `{ slot }` | Triggers broadcast to all clients |
| `soundpad_stop` | — | Triggers stop broadcast |
| `vote_cast` | `{ vote_id }` | |
| `voice_start` | — | |
| `voice_stop` | — | |
| `voice_join` | `{ to: client_id }` | |
| `voice_offer` | `{ to, sdp }` | |
| `voice_answer` | `{ to, sdp }` | |
| `voice_ice` | `{ to, candidate }` | |

---

## 5. Stores

| Store | Type | Description |
|---|---|---|
| `queue` | `Song[]` | Current song queue |
| `currentIndex` | `number` | Index of currently playing song |
| `seekTime` | `number` | Playback position (seconds) from server |
| `isPlaying` | `boolean` | |
| `history` | `HistorySong[]` | Played/skipped songs |
| `toasts` | `Toast[]` | |
| `connectionStatus` | `string` | `'connecting'` \| `'connected'` \| `'disconnected'` |
| `autoplay` | `boolean` | |
| `shuffle` | `boolean` | |
| `randomPlay` | `boolean` | |
| `playbackSpeed` | `number` | Playback speed (0.5–2.0) |
| `currentUser` | `User\|null` | Local user (null before join) |
| `onlineUsers` | `User[]` | Currently online users |
| `chatHistory` | `ChatMessage[]` | Chat messages |
| `currentRoom` | `string\|null` | Room ID (null before join) |
| `soundpad` | `(SoundPadSlot\|null)[]` | 50-slot SoundPad state |
| `topSpenders` | `TopSpender[]` | Top spenders leaderboard |
| `activeVote` | `Vote\|null` | Current active vote (null if none) |

---

## 6. Theme

- Use CSS custom properties everywhere — no hardcoded hex values in components
- Dark/Light theme toggle via `data-theme` attribute on `<html>`, saved to `localStorage`
- Reads `prefers-color-scheme` on first visit if no preference is stored
- All variables defined in `App.svelte` under `:global(:root)` and `:global([data-theme="light"])`

---

## 7. SEO & Public Files

- `index.html` has full meta tags: description, Open Graph, Twitter Card, canonical URL
- `public/og-image.png` — OG image for social sharing
- `public/robots.txt` — allows all crawlers, links to sitemap
- `public/sitemap.xml` — single-page sitemap for `https://synctune-frontend.vercel.app/`
- Live URL: `https://synctune-frontend.vercel.app`
