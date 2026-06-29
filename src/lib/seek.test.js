import { describe, it, expect } from 'vitest'
import { shouldResync } from './seek.js'

// ค่าจริงจากระบบ: SEEK_DRIFT_THRESHOLD=3, SEEK_LEAD_TOLERANCE=8, server tick=5 วิ
const THRESHOLD = 3
const LEAD = 8

describe('shouldResync — seek backward bug', () => {
  it('ไม่ resync เมื่อ client นำ server ~1 tick (อาการ 2:00 → 1:55)', () => {
    // client เล่นถึง 120 (2:00), server counter หยาบยัง 115 (1:55) = นำ 5 วิ
    expect(shouldResync(120, 115, THRESHOLD, LEAD)).toBe(false)
  })

  it('ไม่ resync เมื่อ client นำอยู่ในช่วง lead tolerance (≤ 8 วิ)', () => {
    expect(shouldResync(122, 115, THRESHOLD, LEAD)).toBe(false) // นำ 7
    expect(shouldResync(123, 115, THRESHOLD, LEAD)).toBe(false) // นำ 8 พอดี
  })

  it('resync เมื่อ client นำมากเกินจริง (> 8 วิ = desync จริง)', () => {
    expect(shouldResync(125, 115, THRESHOLD, LEAD)).toBe(true) // นำ 10
  })

  it('resync เมื่อ client ตามหลัง server เกิน threshold (ดึงให้ทัน)', () => {
    expect(shouldResync(100, 105, THRESHOLD, LEAD)).toBe(true) // ตามหลัง 5 > 3
  })

  it('ไม่ resync เมื่อ client ตามหลังเล็กน้อย (≤ 3 วิ)', () => {
    expect(shouldResync(104, 105, THRESHOLD, LEAD)).toBe(false) // ตามหลัง 1
    expect(shouldResync(102, 105, THRESHOLD, LEAD)).toBe(false) // ตามหลัง 3 พอดี
  })

  it('ไม่ resync เมื่อ sync กันสนิท', () => {
    expect(shouldResync(115, 115, THRESHOLD, LEAD)).toBe(false)
  })
})
