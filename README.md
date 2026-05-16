# SyncTune Frontend

> ⚠️ **Experimental project** — built for personal learning and exploration. Not intended for commercial use.

![Version](https://img.shields.io/badge/version-1.0.1-blue)

A Svelte frontend for SyncTune — a real-time collaborative music listening app. Create a room, add YouTube videos to a shared queue, and listen in sync with friends. No account required.

**Live:** https://synctune-frontend.vercel.app

**Stack:** Svelte · Vite · YouTube IFrame API · WebSocket · WebRTC · Vitest

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
npm run format
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
        ├── Queue.svelte              ← Drag & drop queue + queue activity log
        ├── AddSong.svelte            ← URL input + validation
        ├── History.svelte            ← Playback history + requeue
        ├── PlaybackControls.svelte   ← Autoplay / Shuffle / Random / Speed toggle
        ├── Chat.svelte               ← Real-time chat + online users list
        ├── SoundPad.svelte           ← 50-slot sound pad + play history
        ├── VoicePTT.svelte           ← Push-to-talk via WebRTC
        ├── VoteModal.svelte          ← Voting UI for remove/skip
        ├── Suggestions.svelte        ← Song suggestion panel
        ├── SupportMe.svelte          ← Top spenders + PromptPay QR
        ├── AdminPanel.svelte         ← Admin controls
        ├── JoinModal.svelte          ← Name + Room ID modal before entering
        ├── TutorialTooltip.svelte    ← First-time user onboarding tooltip
        └── LegalModal.svelte         ← Terms of Service + Privacy Policy modal
```

---

## WebSocket Events

### Server → Client

| Event | Effect |
|---|---|
| `room_joined` | Sets room ID, loads queue / seek / history / playback mode / chat / online users / soundpad |
| `queue_updated` | Updates queue, currentIndex, isPlaying, history |
| `seek_sync` | Checks drift — seeks if > 3 s |
| `playback_mode_updated` | Updates autoplay / shuffle / randomPlay / playbackSpeed |
| `song_skipped` | Shows toast with skip reason |
| `user_joined` | Updates online users + shows toast |
| `user_left` | Updates online users |
| `message_received` | Appends message to chat history |
| `soundpad_updated` | Updates SoundPad slot array |
| `soundpad_play` | Triggers audio playback on all clients independently |
| `soundpad_stop` | Stops SoundPad audio on all clients |
| `vote_started` | Opens VoteModal with vote info |
| `vote_updated` | Updates yes vote count in VoteModal |
| `vote_resolved` | Closes VoteModal + shows result toast |
| `voice_start` | Shows PTT indicator for that user |
| `voice_stop` | Hides PTT indicator |
| `voice_join` / `voice_offer` / `voice_answer` / `voice_ice` | WebRTC signaling relay |
| `error` | Shows error toast |

### Client → Server

| Event | When |
|---|---|
| `join` | Sent automatically after connect |
| `add_song` | User adds a song or requeues from history |
| `remove_song` | User presses ✕ (may open vote if not own song) |
| `reorder_queue` | User drag-and-drops a song |
| `skip_song` | User presses ⏭ (may open vote if not own song) |
| `song_ended` | YouTube player fires ENDED state |
| `report_error` | YouTube player fires error 101 / 150 |
| `set_playback_mode` | User toggles autoplay / shuffle / random / speed |
| `send_message` | User sends a chat message |
| `soundpad_set` | User assigns a video to a slot |
| `soundpad_clear` | User clears a slot |
| `soundpad_play` | User taps a slot to play |
| `soundpad_stop` | User taps stop |
| `vote_cast` | User clicks Yes in VoteModal |
| `voice_start` / `voice_stop` | User holds / releases PTT button |
| `voice_join` / `voice_offer` / `voice_answer` / `voice_ice` | WebRTC signaling |

---

## Features

- **Real-time sync** — queue, seek, and playback state synced via WebSocket
- **Live chat** — real-time messages, online user list, chat history
- **Multi-room** — create or join a room with a 6-digit Room ID
- **SoundPad** — 50-slot shared sound board; all clients play each sound independently and simultaneously
- **Voice PTT** — push-to-talk via peer-to-peer WebRTC (no media server)
- **Voting** — majority vote required to remove/skip songs added by others; TTL 30 s
- **Playback Speed** — adjustable speed (0.5×–2×) synced via server
- **Song Suggestions** — curated song recommendation panel
- **Support Me** — top spenders leaderboard + PromptPay QR
- **Seek guard** — only seeks if server drift > 3 s
- **User seek cooldown** — ignores `seek_sync` for 5 s after user drags seek bar
- **Autoplay / Shuffle / Random** — server-side state
- **Sound notifications** — Web Audio API tones
- **Dark / Light theme** — saved to localStorage
- **Responsive** — desktop / tablet / mobile layouts
- **Drag & drop** — reorder queue
- **History requeue** — re-add any past song
- **Thumbnails** — shown in Player, Queue, History
- **Tutorial** — first-time onboarding tooltip
- **SEO** — meta tags, Open Graph, Twitter Card, robots.txt, sitemap.xml

---

## Important Notes

- **Stores update via WebSocket only** — no optimistic updates
- **queue_id** — all events use `queue_id` (UUID), not the YouTube video ID
- **SoundPad plays are fully independent** — each client manages its own audio; no global playback state
- **Voice PTT is peer-to-peer** — speaker connects directly to each listener; backend only relays signaling
- **join must come first** — backend returns `NOT_JOINED` for any event before `join`
- **Reconnect** — exponential backoff: 1 s → 2 s → 4 s → max 30 s

---

## Docker

```bash
docker build -t synctune-frontend .
docker run -d --name synctune-frontend -p 80:80 synctune-frontend
```

---

## Changelog

### v1.0.1 (2026-05-16)
- SoundPad: 50 shared slots + play history panel; each client plays independently
- Voice PTT: peer-to-peer audio via WebRTC (VoicePTT component)
- Voting: VoteModal for remove/skip votes with live yes-count updates
- Playback Speed control in PlaybackControls
- Queue activity log in Queue component
- Suggestions panel (Suggestions component)
- SupportMe panel with top spenders leaderboard + PromptPay QR
- AdminPanel component for room management
- Improved font integration and layout refinements

### v1.0.0 (2026-05-04)
- Initial release
- Real-time sync queue, playback, and chat via WebSocket
- Multi-room support with 6-digit Room ID
- YouTube IFrame API integration with seek guard
- Drag & drop queue reorder
- Autoplay / Shuffle / Random playback modes
- Dark/Light theme toggle
- Sound notifications via Web Audio API
- Docker + Vercel deployment support

---

## License

This project is released for personal and educational use only. Not licensed for commercial use.
