import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import Chat from './Chat.svelte'
import { chatHistory, soundEnabled, currentUser, onlineUsers, activeSpeaker, pinnedMessages, currentRoom } from '$lib/stores.js'

// ws mock — VoicePTT.onMount เรียก ws.on(...), handleSend เรียก ws.send(...)
const ws = { on: vi.fn(), send: vi.fn() }

function msg(id, text) {
  return { id, text, user: { id: 'u' + id, username: 'user' + id }, timestamp: Date.now() }
}

beforeEach(() => {
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() })
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(t) { this.text = t }
  })
  chatHistory.set([])
  currentRoom.set(null)
  soundEnabled.set(true)
  currentUser.set({ id: 'me', username: 'me' })
  onlineUsers.set([])
  activeSpeaker.set([])
  pinnedMessages.set([])
})

describe('Chat TTS — ไม่อ่านแชทเก่าตอนเข้าห้อง', () => {
  it('ไม่อ่าน TTS เมื่อ history ถูกโหลดตอน join (หลัง mount)', async () => {
    render(Chat, { props: { ws } })
    await tick()

    // จำลอง room_joined: ตั้ง currentRoom + โหลด history พร้อมกัน (หลัง component mount)
    chatHistory.set([msg('1', 'แชทเก่า 1'), msg('2', 'แชทเก่าล่าสุด')])
    currentRoom.set('123456')
    await tick()

    expect(speechSynthesis.speak).not.toHaveBeenCalled()
  })

  it('อ่าน TTS เฉพาะข้อความใหม่ที่เข้ามาหลัง join', async () => {
    render(Chat, { props: { ws } })
    await tick()
    chatHistory.set([msg('1', 'แชทเก่า 1'), msg('2', 'แชทเก่าล่าสุด')])
    currentRoom.set('123456')
    await tick()

    // ข้อความใหม่เข้ามา
    chatHistory.update((h) => [...h, msg('3', 'ข้อความใหม่')])
    await tick()

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    const utt = speechSynthesis.speak.mock.calls[0][0]
    expect(utt.text).toContain('ข้อความใหม่')
  })

  it('เข้าห้องว่าง (ไม่มี history) — ข้อความแรกที่เข้ามายังอ่านปกติ', async () => {
    render(Chat, { props: { ws } })
    await tick()

    // join ห้องว่าง: currentRoom ถูกตั้ง แต่ไม่มี history
    currentRoom.set('123456')
    await tick()

    // ข้อความแรกของห้องเข้ามาหลัง join
    chatHistory.set([msg('1', 'ข้อความแรก')])
    await tick()

    expect(speechSynthesis.speak).toHaveBeenCalledTimes(1)
    expect(speechSynthesis.speak.mock.calls[0][0].text).toContain('ข้อความแรก')
  })
})
