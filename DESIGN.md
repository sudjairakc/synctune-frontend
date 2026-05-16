# DESIGN.md — synctune-frontend
## Architecture Decisions & Design Notes · v1.0.1

ไฟล์นี้บันทึก design decisions ที่สำคัญ เหตุผลเบื้องหลัง และ trade-offs ที่เลือก

---

## 1. Framework Choice — Svelte + Vite

**Decision:** ใช้ Svelte 4 + Vite (ไม่ใช่ SvelteKit)

**Reason:**
- SyncTune เป็น Single Page App — ไม่ต้องการ SSR หรือ file-based routing
- Svelte compile-time reactivity ทำให้ bundle เล็กและ runtime ไว
- Vite hot reload เร็วกว่า webpack มาก

**Trade-off:** ไม่มี SSR → SEO ต้องทำผ่าน static meta tags ใน index.html แทน

---

## 2. Single Source of Truth — WebSocket Only

**Decision:** Svelte stores อัปเดตจาก WebSocket events เท่านั้น — ไม่มี optimistic updates

**Reason:**
- State ทั้งหมดอยู่ที่ server (Redis) — client เป็นแค่ view
- Optimistic update ซับซ้อนและอาจ desync ถ้า server reject
- หลายคนใช้ร่วมกัน → ต้องรอ server confirm ก่อนอัปเดต UI เสมอ

**Trade-off:** UI รู้สึก "ช้า" เล็กน้อยเมื่อ click (ต้องรอ round-trip) แต่ acceptable เพราะ latency ต่ำอยู่แล้ว

---

## 3. YouTube IFrame API — Always in DOM

**Decision:** `playerContainer` div ต้องอยู่ใน DOM ตลอดเวลา — ห้ามใส่ใน `{#if}`

**Reason:** YouTube IFrame API inject iframe เข้าไปใน container ที่กำหนด ถ้า container หาย player instance จะ invalid และต้อง reinitialize ทุกครั้ง ซึ่งทำให้ seek sync พัง

**Pattern:** ใช้ CSS `visibility: hidden` หรือ `display: none` แทน `{#if}` เมื่อต้องการซ่อน player

---

## 4. Seek Guard & User Seek Cooldown

**Decision:**
- ตรวจ drift > 3 วินาทีก่อน seek
- หลัง user ลาก seek bar → ignore `seek_sync` 5 วินาที

**Reason:**
- drift < 3 วิ เป็นปกติจาก network jitter — seek ทุกครั้งจะรู้สึกกระตุก
- User seek cooldown ป้องกัน snap-back ทันทีหลัง user เลือก position ใหม่

**Trade-off:** ช่วง 5 วิ หลัง user seek, ถ้า server ส่ง seek_sync มา client จะไม่ sync → acceptable เพราะ 5 วิ สั้นมาก

---

## 5. SoundPad — Per-Client Independent Audio

**Decision:** แต่ละ client จัดการ audio ของตัวเองอิสระหลังรับ `soundpad_play` event

**Reason:**
- SoundPad ออกแบบมาเป็น "trigger" ไม่ใช่ "synced playback"
- ไม่มี global state → ไม่ต้อง sync seek สำหรับ soundpad
- Browser autoplay policy: ต้องมี user gesture ก่อนเล่น audio — each client ต้องจัดการเอง

**Trade-off:** Clients ที่ connect ช้าจะไม่ได้ยิน sound ที่กำลังเล่นอยู่ — acceptable

**Note:** Browser autoplay policy ต้องการ user interaction ก่อน (click/tap) ถ้า user เข้า room โดยยังไม่ได้ touch UI อาจต้อง unmute ก่อน

---

## 6. Voice PTT — WebRTC Peer Management

**Decision:** `VoicePTT.svelte` จัดการ RTCPeerConnection map (speakerID → connection)

**Flow:**
```
User กด PTT → ส่ง voice_start → รับ voice_start broadcast
Listeners ส่ง voice_join → speaker
Speaker createOffer → ส่ง voice_offer → listener
Listener createAnswer → ส่ง voice_answer → speaker
ทั้งสองฝั่งแลก ICE candidates
```

**Reason:** ไม่มี media server → mesh topology บน client

**Trade-off:** Speaker ต้อง maintain N connections (N = จำนวน listeners) — scale ไม่ดีถ้าห้องใหญ่

---

## 7. Voting — VoteModal State

**Decision:** `activeVote` store เก็บ Vote object ที่ active — VoteModal แสดง/ซ่อนตาม store นี้

**Flow:**
- `vote_started` → set `activeVote` → VoteModal เปิด
- `vote_updated` → update `activeVote` (yes count)
- `vote_resolved` → clear `activeVote` → VoteModal ปิด + toast

**Reason:** Single store ทำให้ logic ชัดเจน — ไม่มี vote ซ้อนกัน (backend enforce แค่ 1 vote ต่อห้อง)

---

## 8. Theme System — CSS Custom Properties

**Decision:** ใช้ CSS custom properties (variables) ทั้งหมด — ไม่ hardcode สีในแต่ละ component

**Reason:**
- Dark/Light switch ทำแค่เปลี่ยน `data-theme` attribute บน `<html>`
- Component ไม่ต้องรู้เรื่อง theme — ใช้ `var(--bg-primary)` แล้วจบ
- เพิ่ม theme ใหม่ได้ง่าย

**Variables defined in:** `App.svelte` `:global(:root)` (dark mode default) และ `:global([data-theme="light"])`

---

## 9. Reconnect Strategy — Exponential Backoff

**Decision:** Reconnect delay: 1s → 2s → 4s → ... → max 30s

**Reason:** ถ้า backoff สั้นเกิน server จะถูก hammer ตอน restart — exponential backoff เป็น standard practice

**State on reconnect:** sessionStorage เก็บ username + room_id ไว้ → `ws.join()` ส่ง room_id เดิมอัตโนมัติ → server ส่ง `room_joined` พร้อม state ล่าสุด

---

## 10. Responsive Layout

**Decision:** สามระดับ — desktop (2-column), tablet (320px sidebar), mobile (1-column)

**Breakpoints:**
- Desktop: `> 768px` — sidebar + main content แนวนอน
- Mobile: `≤ 768px` — stack เป็น column เดียว

**Reason:** ใช้งานจริงใน office มักเป็น desktop/tablet — mobile เป็น secondary

---

## 11. Sound Notifications — Web Audio API

**Decision:** ใช้ Web Audio API สร้าง tone เอง — ไม่ใช้ external audio files

**Reason:**
- ไม่ต้อง load audio file (ลด network request)
- ไม่มี audio file ใน repo — clean
- Tone สั้นๆ ไม่ต้องการคุณภาพสูง

**Trade-off:** Sound ฟังดู "electronic" ไม่เป็นธรรมชาติ — acceptable สำหรับ notification tone
