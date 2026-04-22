<script>
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { currentUser, activeSpeaker } from '$lib/stores.js'
  import { showToast } from '$lib/toast.js'

  export let ws = null

  let isSpeaking = false
  let localStream = null

  // clientID → RTCPeerConnection (speaker keeps one per listener)
  const peers = new Map()
  // clientID → HTMLAudioElement (listeners keep one per speaker)
  const audioEls = new Map()

  const iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

  onMount(() => {
    ws.on('voice_start', handleVoiceStart)
    ws.on('voice_stop', handleVoiceStop)
    ws.on('voice_join', handleVoiceJoin)
    ws.on('voice_offer', handleVoiceOffer)
    ws.on('voice_answer', handleVoiceAnswer)
    ws.on('voice_ice', handleVoiceIce)
  })

  onDestroy(() => {
    stopPTT()
  })

  // --- PTT controls ---

  async function startPTT() {
    if (isSpeaking) return
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      showToast('Cannot access microphone', 'error')
      return
    }
    isSpeaking = true
    ws.send('voice_start', {})
  }

  function stopPTT() {
    if (!isSpeaking) return
    isSpeaking = false
    try { ws.send('voice_stop', {}) } catch { /* ignore if disconnected */ }
    closePeers()
    stopLocalStream()
  }

  // prevent context menu on long-press mobile
  function handleContextMenu(e) { e.preventDefault() }

  // --- Incoming signaling handlers ---

  function handleVoiceStart(payload) {
    const me = get(currentUser)
    if (!me || payload.user_id === me.id) return
    activeSpeaker.set({ user_id: payload.user_id, username: payload.username })
    ws.send('voice_join', { to: payload.user_id })
  }

  function handleVoiceStop(payload) {
    activeSpeaker.update(s => (s && s.user_id === payload.user_id ? null : s))
    const pc = peers.get(payload.user_id)
    if (pc) { pc.close(); peers.delete(payload.user_id) }
    const audio = audioEls.get(payload.user_id)
    if (audio) { audio.srcObject = null; audioEls.delete(payload.user_id) }
  }

  // speaker receives: listener wants audio → create offer
  async function handleVoiceJoin({ from }) {
    if (!localStream) return
    const pc = createPeerConnection(from)
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    ws.send('voice_offer', { to: from, sdp: pc.localDescription.sdp })
  }

  // listener receives: speaker sent offer → create answer
  async function handleVoiceOffer({ from, sdp }) {
    const pc = createPeerConnection(from)
    pc.ontrack = (event) => {
      let audio = audioEls.get(from)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audioEls.set(from, audio)
      }
      audio.srcObject = event.streams[0]
      audio.play().catch(() => {})
    }
    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.send('voice_answer', { to: from, sdp: pc.localDescription.sdp })
  }

  // speaker receives: listener answered
  async function handleVoiceAnswer({ from, sdp }) {
    const pc = peers.get(from)
    if (!pc) return
    await pc.setRemoteDescription({ type: 'answer', sdp })
  }

  async function handleVoiceIce({ from, candidate }) {
    const pc = peers.get(from)
    if (!pc || !candidate) return
    try { await pc.addIceCandidate(candidate) } catch { /* ignore stale candidates */ }
  }

  // --- Helpers ---

  function createPeerConnection(clientID) {
    const existing = peers.get(clientID)
    if (existing) existing.close()
    const pc = new RTCPeerConnection(iceConfig)
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) ws.send('voice_ice', { to: clientID, candidate })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') { pc.close(); peers.delete(clientID) }
    }
    peers.set(clientID, pc)
    return pc
  }

  function closePeers() {
    peers.forEach(pc => pc.close())
    peers.clear()
    audioEls.forEach(a => { a.srcObject = null })
    audioEls.clear()
  }

  function stopLocalStream() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop())
      localStream = null
    }
  }
</script>

<div class="voice-ptt">
  {#if $activeSpeaker}
    <div class="speaking-indicator">
      <span class="mic-icon speaking">🎙</span>
      <span class="speaking-name">{$activeSpeaker.username} is speaking…</span>
    </div>
  {/if}

  <button
    class="ptt-btn"
    class:active={isSpeaking}
    on:mousedown={startPTT}
    on:mouseup={stopPTT}
    on:mouseleave={stopPTT}
    on:touchstart|preventDefault={startPTT}
    on:touchend={stopPTT}
    on:contextmenu={handleContextMenu}
    title="Hold to talk"
  >
    <span class="mic-icon">{isSpeaking ? '🎙' : '🎤'}</span>
    <span class="ptt-label">{isSpeaking ? 'Release' : 'Hold to Talk'}</span>
  </button>
</div>

<style>
  .voice-ptt {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
  }

  .ptt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-surface);
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .ptt-btn.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .ptt-btn:not(.active):hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .mic-icon { font-size: 15px; }

  .speaking-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--accent);
    font-weight: 600;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .mic-icon.speaking { font-size: 13px; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
