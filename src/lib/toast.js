import { toasts } from './stores.js'

let nextId = 0
const DEFAULT_DURATION = 4000

/**
 * showToast แสดง Toast Notification
 * @param {string} message ข้อความที่แสดง
 * @param {'info'|'success'|'error'|'warning'} type ประเภท Toast
 * @param {number} duration ระยะเวลาแสดง (ms)
 */
export function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
  const id = ++nextId
  toasts.update((list) => [...list, { id, message, type }])
  setTimeout(() => dismissToast(id), duration)
}

/**
 * dismissToast ลบ Toast ออก
 * @param {number} id
 */
export function dismissToast(id) {
  toasts.update((list) => list.filter((t) => t.id !== id))
}
