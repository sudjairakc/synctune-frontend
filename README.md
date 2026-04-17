# SyncTune Frontend

> ⚠️ **Experimental project** — built for personal learning and exploration. Not intended for commercial use.

A Svelte frontend for SyncTune — a real-time collaborative music listening app. Create a room, add YouTube videos to a shared queue, and listen in sync with friends. No account required.

**Live:** https://synctune-frontend.vercel.app

**Stack:** Svelte · Vite · YouTube IFrame API · WebSocket · Vitest

---

## Getting Started

**Prerequisites:** Node.js 20+ and the [synctune-backend](../synctune-backend/README.md) running at `localhost:8080`

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

---

## Commands

```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run preview      # Preview production build locally
npm run test         # Run Vitest tests
npm run test:watch   # Watch mode
npm run lint
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_WS_URL` | `ws://localhost:8080/ws` | Backend WebSocket URL |
| `VITE_APP_TITLE` | `SyncTune` | App title shown in the header |

---

## Project Structure

```
synctune-frontend/
├── index.html
├── vite.config.js
├── public/
│   ├── og-image.png
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.js                       ← Entry point
    ├── App.svelte                    ← Root component · layout · theme · toast · join flow
    ├── lib/
    │   ├── websocket.js              ← WS client · exponential backoff · join()
    │   ├── stores.js                 ← Svelte writable stores (single source of truth)
    │   ├── toast.js                  ← Toast notification helpers
    │   └── sound.js                  ← Web Audio API tones (no external files)
    └── components/
        ├── Player.svelte             ← YouTube IFrame API · seek sync · autoplay guard
        ├── Queue.svelte              ← Drag & drop queue
        ├── AddSong.svelte            ← URL input + validation
        ├── History.svelte            ← Playback history + requeue
        ├── PlaybackControls.svelte   ← Autoplay / Shuffle / Random toggle
        ├── Chat.svelte               ← Real-time chat + online users list
        ├── JoinModal.svelte          ← Name + Room ID modal before entering
        ├── TutorialTooltip.svelte    ← First-time user onboarding tooltip
        └── LegalModal.svelte         ← Terms of Service + Privacy Policy modal
```

---

## WebSocket Events

### Server → Client

| Event | Effect |
|---|---|
| `room_joined` | Sets room ID, loads queue / seek / history / playback mode / chat / online users |
| `initial_state` | Same as `room_joined` (backward-compat) |
| `queue_updated` | Updates queue, currentIndex, isPlaying, history |
| `seek_sync` | Checks drift — seeks if > 3 s |
| `playback_mode_updated` | Updates autoplay / shuffle / randomPlay |
| `song_skipped` | Shows toast with skip reason |
| `user_joined` | Updates online users + shows toast |
| `user_left` | Updates online users |
| `message_received` | Appends message to chat history |
| `error` | Shows error toast (`NOT_JOINED`, `INVALID_USERNAME`, `INVALID_ROOM_ID`, `EMPTY_MESSAGE`, `RATE_LIMITED`) |

### Client → Server

| Event | When |
|---|---|
| `join` | Sent automatically after connect via `ws.join(username, '', room_id?)` — omit room_id to create a new room |
| `add_song` | User adds a song or requeues from history |
| `remove_song` | User presses ✕ in the queue |
| `reorder_queue` | User drag-and-drops a song |
| `skip_song` | User presses ⏭ |
| `song_ended` | YouTube player fires ENDED state |
| `report_error` | YouTube player fires error 101 / 150 |
| `set_playback_mode` | User toggles autoplay / shuffle / random |
| `send_message` | User sends a chat message |

---

## Features

- **Real-time sync** — queue, seek, and playback state synced across all clients via WebSocket
- **Live chat** — real-time messages, online user list, and chat history
- **Multi-room** — create a new room automatically or join an existing one with a 6-digit Room ID
- **Join flow** — name + Room ID modal on first visit; auto-rejoin on reconnect via sessionStorage
- **Seek guard** — only seeks if server drift > 3 s; skips if serverSeek ≥ duration
- **User seek cooldown** — ignores `seek_sync` for 5 s after the user drags the seek bar
- **Autoplay / Shuffle / Random** — controlled via PlaybackControls; state lives on the server
- **Sound notifications** — Web Audio API tones for user join and new chat messages
- **Dark / Light theme** — toggle saved to localStorage; respects `prefers-color-scheme` on first visit
- **Responsive** — desktop (2-column) / tablet (320 px sidebar) / mobile (1-column)
- **Drag & drop** — reorder queue
- **History requeue** — press + in history to re-add any song to the queue
- **Thumbnails** — shown in Player, Queue, and History
- **Tutorial** — first-time onboarding tooltip overlay
- **SEO** — meta tags, Open Graph, Twitter Card, robots.txt, sitemap.xml

---

## Important Notes

- **Stores update via WebSocket only** — no optimistic updates
- **queue_id** — all events use `queue_id` (UUID), not the YouTube video ID
- **join must come first** — the backend returns `NOT_JOINED` if any event arrives before `join`
- **room_id** — 6 digits only; wrong format returns `INVALID_ROOM_ID`
- **YouTube player** — starts muted by default; user unmutes manually
- **Reconnect** — exponential backoff: 1 s → 2 s → 4 s → max 30 s

---

## Docker

```bash
docker build -t synctune-frontend .
docker run -d --name synctune-frontend -p 80:80 synctune-frontend
```

---

## License

This project is released for personal and educational use only. Not licensed for commercial use.
