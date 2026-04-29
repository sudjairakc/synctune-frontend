import { writable } from 'svelte/store'

// queue คือรายการเพลงในคิวปัจจุบัน (Song[])
export const queue = writable([])

// currentIndex คือ Index ของเพลงที่กำลังเล่น
export const currentIndex = writable(0)

// seekTime คือตำแหน่งที่เล่นอยู่ (วินาที) จาก Server
export const seekTime = writable(0)

// isPlaying บอกว่ากำลังเล่นอยู่หรือไม่
export const isPlaying = writable(false)

// history คือเพลงที่เล่นผ่านไปแล้ว (HistorySong[])
export const history = writable([])

// toasts คือ Toast Notifications ที่แสดงอยู่
export const toasts = writable([])

// connectionStatus คือสถานะการเชื่อมต่อ WebSocket
export const connectionStatus = writable('connecting') // 'connecting' | 'connected' | 'disconnected'

// autoplay เปิด/ปิดการเล่นเพลงต่อไปอัตโนมัติ
export const autoplay = writable(true)

// shuffle เปิด/ปิดการสลับลำดับคิว
export const shuffle = writable(false)

// randomPlay เปิด/ปิดการเล่นเพลงแบบสุ่ม (ไม่เปลี่ยนลำดับคิว)
export const randomPlay = writable(false)

// currentUser คือ User ของตัวเอง (null ถ้ายังไม่ join)
export const currentUser = writable(null)

// onlineUsers คือรายชื่อ User ที่ online อยู่
export const onlineUsers = writable([])

// chatHistory คือรายการข้อความแชท
export const chatHistory = writable([])

// currentRoom คือ room_id ของห้องที่กำลังอยู่ (null ถ้ายังไม่ได้ join)
export const currentRoom = writable(null)

// ttsActive — true ขณะที่ TTS กำลังพูดอยู่ (ใช้สำหรับ duck volume)
export const ttsActive = writable(false)

// activeSpeaker — รายชื่อ User ที่กำลัง PTT อยู่ ({ user_id, username }[])
export const activeSpeaker = writable([])

// playbackSpeed — ความเร็วการเล่น (0.25 | 0.5 | 1 | 1.5 | 2)
export const playbackSpeed = writable(1)

// soundPad — Sound Pad 50 ช่อง (null | { video_id, title }) อัปเดตจาก WebSocket เท่านั้น
export const soundPad = writable(new Array(50).fill(null))

// soundPadActive — true ขณะ Sound Pad กำลังเล่น (ให้ Player หลักลดเสียง)
export const soundPadActive = writable(false)

// soundEnabled — เปิด/ปิดเสียงทั้งระบบ (ยกเว้น iframe) ซิงค์กับ localStorage
export const soundEnabled = writable(localStorage.getItem('sound_enabled') !== 'false')

// soundpadHistory — ประวัติการกด Sound Pad (newest first, max 100)
export const soundpadHistory = writable([])

// pinnedMessages — ข้อความที่ถูก pin ในห้อง (newest first, max 20)
export const pinnedMessages = writable([])
