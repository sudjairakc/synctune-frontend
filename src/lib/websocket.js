import { get } from 'svelte/store'
import { queue, currentIndex, seekTime, isPlaying, history, connectionStatus, autoplay, shuffle, randomPlay, onlineUsers, chatHistory, currentRoom, currentUser, activeSpeaker, playbackSpeed, soundPad, soundpadHistory } from './stores.js'
import { showToast } from './toast.js'
import { playUserJoined, playChatMessage } from './sound.js'

const MIN_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 30000

const SOUND_PAD_SLOTS = 50

function normalizeSoundPad(arr) {
  const out = new Array(SOUND_PAD_SLOTS).fill(null)
  if (!Array.isArray(arr)) return out
  for (let i = 0; i < SOUND_PAD_SLOTS; i++) {
    const x = arr[i]
    if (x && (x.video_id != null || x.videoId != null)) {
      out[i] = {
        video_id: x.video_id ?? x.videoId,
        title: x.title ?? '',
      }
    }
  }
  return out
}

/**
 * createWebSocket สร้าง WebSocket Client พร้อม Auto-reconnect (Exponential Backoff)
 * @param {string} url WebSocket URL
 * @returns {{ send: Function, disconnect: Function, on: Function }}
 */
export function createWebSocket(url) {
  let ws = null
  let reconnectDelay = MIN_RECONNECT_DELAY
  let reconnectTimer = null
  let isManuallyClosed = false
  let pendingJoin = null  // { username, profile_img, room_id? } รอส่งหลัง connect
  let wasBroadcasting = false
  const listeners = {}

  function connect() {
    connectionStatus.set('connecting')
    console.info('[WebSocket] connecting to', url)

    ws = new WebSocket(url)

    ws.onopen = () => {
      console.info('[WebSocket] connected')
      reconnectDelay = MIN_RECONNECT_DELAY
      connectionStatus.set('connected')
      // ส่ง join ทันทีถ้ามี pending
      if (pendingJoin) {
        ws.send(JSON.stringify({ event: 'join', payload: pendingJoin }))
        console.info('[WebSocket] sent join for', pendingJoin.username)
      }
    }

    ws.onmessage = (event) => {
      handleMessage(event.data)
    }

    ws.onclose = () => {
      if (isManuallyClosed) return
      console.warn('[WebSocket] disconnected, reconnecting in', reconnectDelay, 'ms')
      connectionStatus.set('disconnected')
      scheduleReconnect()
    }

    ws.onerror = (err) => {
      console.error('[WebSocket] error:', err)
    }
  }

  function handleMessage(raw) {
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error('[WebSocket] failed to parse message:', err)
      return
    }

    const { event, payload } = parsed

    switch (event) {
      case 'room_joined':
      case 'initial_state':
        if (payload.room_id != null) currentRoom.set(payload.room_id)
        queue.set(payload.current_queue ?? [])
        currentIndex.set(payload.current_index ?? 0)
        seekTime.set(payload.seek_time ?? 0)
        isPlaying.set(payload.is_playing ?? false)
        history.set(payload.history ?? [])
        autoplay.set(payload.autoplay ?? true)
        shuffle.set(payload.shuffle ?? false)
        randomPlay.set(payload.random_play ?? false)
        if (payload.chat_history != null) chatHistory.set(payload.chat_history)
        if (payload.online_users != null) onlineUsers.set(payload.online_users)
        if (payload.sound_pad != null) soundPad.set(normalizeSoundPad(payload.sound_pad))
        if (payload.playback_speed != null) playbackSpeed.set(payload.playback_speed)
        if (payload.soundpad_history != null) soundpadHistory.set(payload.soundpad_history)
        break

      case 'playback_mode_updated':
        if (payload.autoplay != null) autoplay.set(payload.autoplay)
        if (payload.shuffle != null) shuffle.set(payload.shuffle)
        if (payload.random_play != null) randomPlay.set(payload.random_play)
        break

      case 'queue_updated': {
        const newQueue = payload.current_queue ?? []
        const newIndex = payload.current_index ?? 0
        const isBroadcastNow = newQueue[newIndex]?.is_broadcast === true
        if (isBroadcastNow && !wasBroadcasting) {
          showToast('📡 Broadcast started — your queue will resume after', 'info')
        }
        wasBroadcasting = isBroadcastNow
        queue.set(newQueue)
        currentIndex.set(newIndex)
        isPlaying.set(payload.is_playing ?? false)
        if (payload.history != null) history.set(payload.history)
        break
      }

      case 'seek_sync':
        seekTime.set(payload.seek_time ?? 0)
        isPlaying.set(payload.is_playing ?? false)
        break

      case 'song_skipped': {
        const reasonMap = {
          user_skipped: 'Skipped by user',
          embed_not_allowed: 'Cannot play (embedding disabled)',
          embed_not_allowed_by_request: 'Cannot play (owner disabled embedding)',
        }
        const reason = reasonMap[payload.reason] ?? `Error ${payload.error_code ?? payload.reason}`
        showToast(`Skipped: ${payload.title || payload.song_id} — ${reason}`, 'warning')
        break
      }

      case 'user_joined':
        onlineUsers.set(payload.online_users ?? [])
        showToast(`${payload.user.username} joined`, 'info')
        playUserJoined()
        break

      case 'user_left':
        onlineUsers.set(payload.online_users ?? [])
        break

      case 'message_received': {
        chatHistory.update((msgs) => [...msgs, payload])
        // เล่นเสียงเฉพาะข้อความจากคนอื่น
        const me = get(currentUser)
        if (!me || payload.user.id !== me.id) {
          playChatMessage()
        }
        break
      }

      case 'playback_speed_updated':
        playbackSpeed.set(payload.speed ?? 1)
        break

      case 'voice_start':
        activeSpeaker.set({ user_id: payload.user_id, username: payload.username })
        break

      case 'voice_stop':
        activeSpeaker.update(s => (s && s.user_id === payload.user_id ? null : s))
        break

      case 'soundpad_updated':
        soundPad.set(normalizeSoundPad(payload.sound_pad))
        break

      case 'soundpad_play': {
        window.dispatchEvent(new CustomEvent('soundpad:play', { detail: payload }))
        const pad = get(soundPad)
        const padCell = pad[payload.slot]
        const me = get(currentUser)
        soundpadHistory.update(h => {
          const entry = {
            slot: payload.slot,
            video_id: payload.video_id,
            title: padCell?.title || payload.video_id,
            played_by: me?.id === payload.user_id ? me.username : (get(onlineUsers).find(u => u.id === payload.user_id)?.username ?? 'Unknown'),
            user_id: payload.user_id,
            timestamp: Date.now(),
          }
          return [entry, ...h].slice(0, 100)
        })
        break
      }

      case 'error': {
        const errorMsgMap = {
          NOT_JOINED: 'Please set a name before using the app',
          INVALID_USERNAME: 'Invalid username',
          INVALID_ROOM_ID: 'Room ID must be a 6-digit number',
          EMPTY_MESSAGE: 'Message is empty',
          RATE_LIMITED: 'Sending too fast. Please wait a moment',
        }
        showToast(errorMsgMap[payload.code] || payload.message || 'An error occurred', 'error')
        break
      }

      default:
        console.warn('[WebSocket] unknown event:', event)
    }

    if (listeners[event]) {
      listeners[event].forEach((fn) => fn(payload))
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
      connect()
    }, reconnectDelay)
  }

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(fn)
  }

  function send(event, payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] cannot send, not connected')
      throw new Error('WebSocket not connected')
    }
    ws.send(JSON.stringify({ event, payload }))
  }

  /**
   * join ตั้งค่า pendingJoin แล้วส่งทันทีถ้า connected อยู่แล้ว
   * ถ้ายังไม่ connect จะส่งอัตโนมัติใน onopen
   */
  function join(username, profile_img = '', room_id = null) {
    pendingJoin = { username, profile_img }
    if (room_id) pendingJoin.room_id = room_id
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'join', payload: pendingJoin }))
      console.info('[WebSocket] sent join for', username, room_id ? `room ${room_id}` : '(new room)')
    }
  }

  function disconnect() {
    isManuallyClosed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) ws.close()
    connectionStatus.set('disconnected')
  }

  /**
   * leave ออกจากห้อง: ตัด connection เดิม แล้ว reconnect ใหม่สะอาด
   * pendingJoin จะถูก clear — เรียก join() หลังจากนี้เพื่อส่ง join ใหม่
   */
  function leave() {
    pendingJoin = null
    isManuallyClosed = false
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) {
      ws.onclose = null  // ป้องกัน scheduleReconnect อัตโนมัติ
      ws.close()
    }
    connect()
  }

  connect()

  return { on, send, join, disconnect, leave }
}
