# CLAUDE.md — synctune-frontend
## Svelte Frontend · Vite · YouTube IFrame API

อ่านไฟล์นี้ก่อนทำงานใดๆ ใน repo นี้เสมอ

---

## 1. Stack และโครงสร้าง

```
synctune-frontend/
├── CLAUDE.md
├── index.html
├── package.json
├── vite.config.js
├── nginx.conf
├── .env.example
├── Dockerfile
└── src/
    ├── main.js
    ├── App.svelte
    ├── test-setup.js
    ├── lib/
    │   ├── websocket.js          ← WS client + exponential backoff + join()
    │   ├── stores.js             ← Svelte writable stores (single source of truth)
    │   └── toast.js              ← Toast notification store
    └── components/
        ├── Player.svelte         ← YouTube IFrame wrapper + seek guard + autoplay
        ├── Queue.svelte          ← Drag & drop queue list
        ├── AddSong.svelte        ← URL input (ซ่อน added_by ถ้า joined แล้ว)
        ├── History.svelte        ← Playback history + requeue
        ├── PlaybackControls.svelte ← Autoplay / Shuffle / Random toggle
        ├── Chat.svelte           ← Real-time chat + online users
        └── JoinModal.svelte      ← Modal ตั้งชื่อก่อนเข้าใช้งาน
```

---

## 2. คำสั่งที่ใช้บ่อย

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # Vitest unit + component tests
npm run lint
npm run build
```

---

## 3. Critical Rules

- **Store อัปเดตผ่าน WebSocket Event เท่านั้น** — ห้าม Optimistic Update
- **Seek Guard**: ตรวจ drift > 3 วิ ก่อน seek ทุกครั้ง และ skip ถ้า serverSeek >= duration
- **User Seek Cooldown**: หลัง user drag/pause ใน player ให้ ignore `seek_sync` 5 วินาที เพื่อไม่ให้ snap กลับ
- **YouTube IFrame API**: ต้องรอ `onYouTubeIframeAPIReady` ก่อน — `playerContainer` ต้องอยู่ใน DOM เสมอ (ห้ามอยู่ใน `{#if}`)
- **queue_id**: ทุก event ที่ส่งหา backend (`song_ended`, `skip_song`, `report_error`, `reorder_queue`, `remove_song`) ใช้ `queue_id` ไม่ใช่ YouTube video ID
- **isPlaying**: ตรวจก่อน loadVideo — ถ้า false ให้ `cueVideoById` แทน `loadVideoById`
- **join ก่อนเสมอ**: `ws.join()` ต้องถูกเรียกก่อน event อื่นทุกตัว — websocket.js จัดการส่งอัตโนมัติใน `onopen`
- **Error ทุก path ต้องมี UI feedback** — ไม่ silent fail

---

## 4. WebSocket Events

### Server → Client

| Event | Store ที่อัปเดต |
|---|---|
| `initial_state` | queue, currentIndex, seekTime, isPlaying, history, autoplay, shuffle, randomPlay, chatHistory, onlineUsers |
| `queue_updated` | queue, currentIndex, isPlaying, history (ถ้ามี) |
| `seek_sync` | seekTime, isPlaying |
| `playback_mode_updated` | autoplay, shuffle, randomPlay (เฉพาะ field ที่ส่งมา — ใช้ `!= null` check) |
| `song_skipped` | toast พร้อม reason mapping |
| `user_joined` | onlineUsers + toast notice |
| `user_left` | onlineUsers |
| `message_received` | chatHistory (append) |
| `error` | toast — รองรับ error code: `NOT_JOINED`, `INVALID_USERNAME`, `EMPTY_MESSAGE`, `RATE_LIMITED` |

### Client → Server

| Event | Payload | หมายเหตุ |
|---|---|---|
| `join` | `{ username, profile_img? }` | ส่งทันทีหลัง connect — อัตโนมัติจาก `ws.join()` |
| `add_song` | `{ youtube_url, added_by? }` | `added_by` ส่งเฉพาะเมื่อยังไม่ join |
| `remove_song` | `{ song_id: queue_id }` | |
| `reorder_queue` | `{ song_id: queue_id, new_index }` | |
| `skip_song` | `{ song_id: queue_id }` | |
| `song_ended` | `{ song_id: queue_id }` | |
| `report_error` | `{ song_id: queue_id, error_code }` | |
| `set_playback_mode` | `{ autoplay?, shuffle?, random_play? }` | |
| `send_message` | `{ text }` | ตัดที่ 500 ตัวอักษร |

---

## 5. Stores

| Store | Type | คำอธิบาย |
|---|---|---|
| `queue` | `Song[]` | คิวเพลงปัจจุบัน |
| `currentIndex` | `number` | index เพลงที่กำลังเล่น |
| `seekTime` | `number` | ตำแหน่งเล่น (วินาที) จาก server |
| `isPlaying` | `boolean` | |
| `history` | `HistorySong[]` | เพลงที่เล่นผ่านไปแล้ว |
| `toasts` | `Toast[]` | |
| `connectionStatus` | `string` | `'connecting'`\|`'connected'`\|`'disconnected'` |
| `autoplay` | `boolean` | |
| `shuffle` | `boolean` | |
| `randomPlay` | `boolean` | |
| `currentUser` | `User\|null` | user ของตัวเอง (null ถ้ายังไม่ join) |
| `onlineUsers` | `User[]` | รายชื่อ user ที่ online |
| `chatHistory` | `ChatMessage[]` | ประวัติข้อความแชท |

---

## 6. Theme

ใช้ CSS custom properties ทั้งหมด — ห้าม hardcode hex ใน component
Dark/Light theme toggle ผ่าน `data-theme` attribute บน `<html>` บันทึกใน `localStorage`
อ่าน `prefers-color-scheme` ครั้งแรกถ้ายังไม่เคยเลือก
Variables ทั้งหมด define ใน `App.svelte` `:global(:root)` และ `:global([data-theme="light"])`
