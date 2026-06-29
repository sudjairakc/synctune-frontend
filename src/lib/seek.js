// shouldResync ตัดสินใจว่าควร seekTo ตาม server seek หรือไม่
//
// drift = clientSeek - serverSeek
//  - client นำหน้า server (drift > 0): ปกติ เพราะ server tick หยาบทีละ interval (5 วิ)
//    client เล่นต่อเนื่องจึงนำ counter ได้ตามธรรมชาติ → resync เฉพาะเมื่อนำเกิน leadTolerance
//  - client ตามหลัง server (drift < 0): resync เมื่อตามหลังเกิน threshold (ดึงให้ทัน)
//
// ออกแบบ asymmetric เพื่อกันอาการ seek เด้งถอยหลัง (เช่น 2:00 → 1:55) ที่เกิดจาก
// drift ตามธรรมชาติของ counter หยาบ ทั้งที่ client เล่นถูกอยู่แล้ว
export function shouldResync(clientSeek, serverSeek, threshold, leadTolerance) {
  const drift = clientSeek - serverSeek
  if (drift > 0) return drift > leadTolerance
  return -drift > threshold
}
