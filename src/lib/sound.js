/**
 * sound.js — Web Audio API notification sounds
 * ไม่ต้องโหลดไฟล์เสียงภายนอก สร้าง tone ด้วย oscillator
 */

let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // resume ถ้า suspended (browser policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

function playTone(frequency, duration, volume = 0.25, type = 'sine') {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // silent fail — browser อาจไม่รองรับ
  }
}

export function isSoundEnabled() {
  return localStorage.getItem('sound_enabled') !== 'false'
}

export function setSoundEnabled(val) {
  localStorage.setItem('sound_enabled', String(val))
}

/** เสียง toast ทั่วไป (info / warning / error) */
export function playNotification(type = 'info') {
  if (!isSoundEnabled()) return
  if (type === 'error') {
    playTone(440, 0.12, 0.3)
    setTimeout(() => playTone(330, 0.18, 0.25), 110)
  } else if (type === 'warning') {
    playTone(660, 0.14, 0.2)
  } else {
    playTone(880, 0.12, 0.18)
  }
}

/** เสียงคนเข้าร่วมห้อง — สองโน้ตขึ้น */
export function playUserJoined() {
  if (!isSoundEnabled()) return
  playTone(660, 0.1, 0.2)
  setTimeout(() => playTone(880, 0.14, 0.2), 110)
}

/** เสียงข้อความแชทใหม่ — เสียงเบาสั้น */
export function playChatMessage() {
  if (!isSoundEnabled()) return
  playTone(1200, 0.08, 0.12)
}
