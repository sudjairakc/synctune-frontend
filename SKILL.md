# SKILL.md — synctune-frontend
## คู่มือ Claude Code Skills สำหรับ Svelte Frontend

ไฟล์นี้รวม skill patterns ที่ใช้บ่อยใน repo นี้ ให้ Claude Code ใช้เป็น cheatsheet ก่อนเริ่มงาน

---

## 1. เพิ่ม WebSocket Event Handler

### Server → Client (รับ event)

เพิ่มใน `src/lib/websocket.js` ใน `ws.onmessage` switch block:

```js
case 'event_name':
    someStore.set(payload.field);
    break;
```

Store updates ต้องผ่าน WebSocket เท่านั้น — ห้าม optimistic update

### Client → Server (ส่ง event)

```js
// ใน websocket.js — export function
export function sendXxx(data) {
    send('event_name', data);
}

// ใน component
import { sendXxx } from '../lib/websocket.js';
sendXxx({ field: value });
```

---

## 2. เพิ่ม Store

```js
// src/lib/stores.js
import { writable } from 'svelte/store';

export const myStore = writable(defaultValue);
```

ใน component:
```svelte
<script>
    import { myStore } from '../lib/stores.js';
    $: value = $myStore;
</script>
```

---

## 3. เพิ่ม Component

```svelte
<!-- src/components/MyComponent.svelte -->
<script>
    import { someStore } from '../lib/stores.js';
    import { sendXxx } from '../lib/websocket.js';
</script>

<div class="my-component">
    <!-- content -->
</div>

<style>
    .my-component {
        /* ใช้ CSS custom properties เสมอ */
        background: var(--bg-secondary);
        color: var(--text-primary);
    }
</style>
```

Mount ใน `App.svelte` ที่ตำแหน่งที่เหมาะสม

---

## 4. YouTube IFrame API Rules

```js
// playerContainer ต้องอยู่ใน DOM เสมอ — ห้ามใส่ใน {#if}
// ใช้ cueVideoById ถ้า isPlaying = false
// ใช้ loadVideoById ถ้า isPlaying = true

if ($isPlaying) {
    player.loadVideoById({ videoId, startSeconds: seek });
} else {
    player.cueVideoById({ videoId, startSeconds: seek });
}
```

Seek guard (Player.svelte):
```js
const drift = Math.abs(currentTime - serverSeek);
if (drift > 3 && serverSeek < duration) {
    player.seekTo(serverSeek);
}
```

---

## 5. SoundPad Pattern

SoundPad slots เล่นอิสระกันทั้งหมด — ทุก client จัดการ audio ของตัวเอง:

```js
// รับ soundpad_play event
case 'soundpad_play':
    // สร้าง YouTube player ชั่วคราวหรือใช้ hidden player
    // เล่นทันที ไม่ต้องรอ global state
    playSoundPadSlot(payload.slot, payload.video_id);
    break;
```

ไม่มี store สำหรับ "soundpad is playing" — แต่ละ client รู้สถานะของตัวเอง

---

## 6. Voice PTT Pattern (WebRTC)

```
voice_start → broadcast แจ้งทุกคน
Listeners ส่ง voice_join → speaker
Speaker ส่ง voice_offer → each listener
Listener ส่ง voice_answer → speaker
แลก voice_ice candidates ทั้งสองทิศทาง
```

Peer connections จัดการใน `VoicePTT.svelte` — backend เป็นแค่ relay

---

## 7. Theme & CSS

```svelte
<!-- ใช้ CSS custom properties เสมอ ห้าม hardcode hex -->
<style>
    .element {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border);
    }
</style>
```

CSS variables ทั้งหมดนิยามใน `App.svelte` `:global(:root)` (dark) และ `:global([data-theme="light"])`

---

## 8. Toast Notifications

```js
import { showToast } from '../lib/toast.js';

showToast('ข้อความ', 'success');  // success | error | info | warning
```

---

## 9. Debug Tips

```bash
# Dev server
npm run dev

# ดู WebSocket messages ใน browser
# DevTools → Network → WS → Messages

# ตรวจ stores
# DevTools → Svelte tab (ถ้าติดตั้ง Svelte DevTools extension)
```

```js
// ดู store value ใน console
import { get } from 'svelte/store';
import { queue } from './lib/stores.js';
console.log(get(queue));
```

---

## 10. Common Pitfalls

| ปัญหา | วิธีแก้ |
|---|---|
| Store ไม่ update | ตรวจ WebSocket handler ใน websocket.js |
| YouTube player หาย | ตรวจว่า playerContainer ไม่อยู่ใน `{#if}` |
| Seek snap-back | ตรวจ user seek cooldown (5 s ignore) |
| queue_id vs video_id | ทุก event ใช้ `queue_id` เสมอ |
| Soundpad ไม่เล่น | เช็คว่า browser อนุญาต autoplay (ต้อง user gesture ก่อน) |
| PTT ไม่ได้ยิน | เช็ค microphone permission + ICE candidate exchange |

---

## 11. Checklist ก่อน PR

- [ ] Store update ผ่าน WebSocket เท่านั้น (ไม่มี optimistic)
- [ ] Error path มี toast หรือ UI feedback
- [ ] CSS ใช้ custom properties ไม่ hardcode สี
- [ ] playerContainer ไม่อยู่ใน `{#if}`
- [ ] อัปเดต CLAUDE.md + README.md ถ้าเพิ่ม component/event ใหม่
- [ ] `npm run test` ผ่าน
