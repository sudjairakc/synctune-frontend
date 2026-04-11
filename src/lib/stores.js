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
