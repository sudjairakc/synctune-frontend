# SyncTune Frontend

Svelte frontend สำหรับ SyncTune — Real-time Office Jukebox

**Stack:** Svelte · Vite · YouTube IFrame API · Vitest

---

## Prerequisites

- Node.js 20+
- Backend รันอยู่ที่ `localhost:8080` (ดู [synctune-backend](../synctune-backend/README.md))

---

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # Dev server (hot reload)
npm run build        # Build สำหรับ Production
npm run preview      # Preview Production build
npm run test         # รัน Tests
npm run test:watch   # Watch mode
npm run lint
```

---

## Environment Variables

| Variable | Default | คำอธิบาย |
|---|---|---|
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL ของ Backend |
| `VITE_APP_TITLE` | `SyncTune` | ชื่อแอปที่แสดงใน Header |

---

## โครงสร้างโปรเจ็กต์

```
synctune-frontend/
├── index.html
├── vite.config.js
└── src/
    ├── main.js                       ← Entry point
    ├── App.svelte                    ← Root component + Layout + Theme + Toast + Join flow
    ├── lib/
    │   ├── websocket.js              ← WS client + exponential backoff + join()
    │   ├── stores.js                 ← Svelte writable stores (single source of truth)
    │   └── toast.js                  ← Toast notification helpers
    └── components/
        ├── Player.svelte             ← YouTube IFrame API + seek sync + autoplay guard
        ├── Queue.svelte              ← Drag & drop queue
        ├── AddSong.svelte            ← URL input + validation
        ├── History.svelte            ← Playback history + requeue
        ├── PlaybackControls.svelte   ← Autoplay / Shuffle / Random toggle
        ├── Chat.svelte               ← Real-time chat + online users list
        └── JoinModal.svelte          ← Modal ตั้งชื่อ + Room ID ก่อนเข้าใช้งาน
```

---

## WebSocket Events

### Server → Client

| Event | ผลที่เกิด |
|---|---|
| `room_joined` | set room_id + โหลด queue, seek, history, playback mode, chat history, online users |
| `initial_state` | เหมือน `room_joined` (backward-compat) |
| `queue_updated` | อัปเดต queue, currentIndex, isPlaying, history |
| `seek_sync` | ตรวจ drift แล้ว seek ถ้าเกิน 3 วิ |
| `playback_mode_updated` | อัปเดต autoplay / shuffle / random |
| `song_skipped` | toast พร้อม reason |
| `user_joined` | อัปเดต online users + toast notice |
| `user_left` | อัปเดต online users |
| `message_received` | append ลง chat |
| `error` | toast error (`NOT_JOINED`, `INVALID_USERNAME`, `INVALID_ROOM_ID`, `EMPTY_MESSAGE`, `RATE_LIMITED`) |

### Client → Server

| Event | ส่งเมื่อ |
|---|---|
| `join` | อัตโนมัติหลัง connect (ผ่าน `ws.join(username, '', room_id?)`) — ไม่ส่ง room_id = สร้างห้องใหม่ |
| `add_song` | กดปุ่มเพิ่มเพลง หรือ requeue จาก history |
| `remove_song` | กด ✕ ใน queue |
| `reorder_queue` | drag & drop เพลงในคิว |
| `skip_song` | กดปุ่ม ⏭ |
| `song_ended` | YouTube player fire state ENDED |
| `report_error` | YouTube player fire error 101/150 |
| `set_playback_mode` | toggle autoplay / shuffle / random |
| `send_message` | ส่งข้อความแชท |

---

## Features

- **Real-time sync** — queue, seek, playback state sync ทุก client ผ่าน WebSocket
- **Chat** — real-time chat พร้อม online users list และ chat history
- **Multi-room** — สร้างห้องใหม่อัตโนมัติ หรือเข้าห้องที่มีด้วย Room ID 6 หลัก, แสดง badge คลิกคัดลอกได้
- **Join flow** — modal ตั้งชื่อ + Room ID ก่อนเข้า, reconnect อัตโนมัติด้วย sessionStorage
- **Seek guard** — ตรวจ drift > 3 วิ ก่อน seek, skip ถ้า serverSeek เกิน duration
- **User seek cooldown** — ไม่ snap กลับ 5 วินาทีหลัง user drag seek bar
- **Autoplay / Shuffle / Random** — ควบคุมผ่าน PlaybackControls, state อยู่ที่ server
- **Dark / Light theme** — YouTube theme พร้อม toggle, บันทึกใน localStorage
- **Responsive** — desktop (2 column) / tablet (320px sidebar) / mobile (1 column)
- **Drag & drop** — reorder queue
- **History requeue** — กด + ใน history เพื่อเพิ่มเพลงกลับเข้าคิว
- **Thumbnail** — แสดงใน Player, Queue, History

---

## หมายเหตุสำคัญ

- **Store อัปเดตผ่าน WebSocket เท่านั้น** — ห้าม optimistic update
- **queue_id** — ทุก event ใช้ `queue_id` (UUID) ไม่ใช่ YouTube video ID
- **join ต้องก่อน event อื่น** — backend ตรวจ `NOT_JOINED` error ถ้าส่งก่อน join
- **room_id** — ตัวเลข 6 หลักเท่านั้น, format ผิด = `INVALID_ROOM_ID` error
- **YouTube player** — เริ่มต้น mute เสมอ, user กด unmute เอง
- **Reconnect** — Exponential Backoff: 1s → 2s → 4s → สูงสุด 30s

---

## รัน Docker

```bash
docker build -t synctune-frontend .
docker run -d --name synctune-frontend -p 80:80 synctune-frontend
```
