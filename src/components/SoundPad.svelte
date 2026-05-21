<script>
  import { onMount, onDestroy } from 'svelte'
  import { soundPad, soundPadActive, onlineUsers, currentUser, soundpadHistory } from '$lib/stores.js'
  import { showToast } from '$lib/toast.js'

  export let ws = null

  // --- DOM refs ---
  let padPlayerEl       // div ที่ผูกกับ YT.Player (always in DOM)

  // --- YT player state ---
  let soundpadPlayer = null
  let soundpadReady = false

  // --- playback state ---
  let playingSlot = null   // slot ที่เล่นอยู่ (null = ไม่ได้เล่น)
  let playingUserId = null
  let audioBlocked = false // browser block autoplay รอ user click

  // --- TikTok overlay state ---
  let tiktokOverlayId = null  // TikTok video ID ที่แสดงอยู่


  // --- UI state ---
  let editingSlot = null
  let editUrl = ''
  let savingSlot = false
  let historyExpanded = false
  let copyingSlot = null
  let holdTimer = null

  function onSlotPointerDown(e, i, cell) {
    holdTimer = setTimeout(() => {
      holdTimer = null
      const url = cell.platform === 'tiktok'
        ? `https://www.tiktok.com/video/${cell.video_id}`
        : `https://www.youtube.com/watch?v=${cell.video_id}`
      navigator.clipboard.writeText(url).then(() => {
        copyingSlot = i
        setTimeout(() => { copyingSlot = null }, 1200)
      })
    }, 500)
  }

  function onSlotPointerUp() {
    clearTimeout(holdTimer)
    holdTimer = null
  }

  const THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`
  const TIKTOK_THUMB = () => null // TikTok oEmbed ต้อง server-side, ใช้ placeholder แทน

  function getUserLabel(userId) {
    if (!userId) return null
    const me = $currentUser
    if (me && me.id === userId) return 'you'
    return $onlineUsers.find(u => u.id === userId)?.username ?? null
  }

  function extractVideoId(url) {
    const m = (url || '').trim().match(
      /(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|shorts\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:[^&]*&)*v=)([\w-]{11})/
    )
    return m ? m[1] : null
  }

  function extractTikTokId(url) {
    const m = (url || '').trim().match(/tiktok\.com\/(?:@[^/]+\/video\/|v\/)(\d+)/)
    return m ? m[1] : null
  }

  async function fetchTitle(videoId) {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}&format=json`)
    if (!res.ok) throw new Error('Could not load video info')
    return (await res.json()).title || ''
  }

  // --- YT player (single persistent instance, ไม่ destroy ตลอดชีวิต component) ---

  function initSoundpadPlayer() {
    soundpadPlayer = new window.YT.Player(padPlayerEl, {
      height: '1',
      width: '1',
      playerVars: { autoplay: 0, controls: 0, rel: 0 },
      events: {
        onReady: () => { soundpadReady = true },
        onStateChange: (e) => {
          if (e.data === 1) { // PLAYING
            audioBlocked = false
            soundPadActive.set(true)
          } else if (e.data === 0) { // ENDED
            playingSlot = null
            playingUserId = null
            audioBlocked = false
            soundPadActive.set(false)
          } else if (e.data === 2 && playingSlot !== null) { // PAUSED while we expect playing
            audioBlocked = true
          }
        },
      },
    })
  }

  function resumeBlockedAudio() {
    // user gesture → browser อนุญาต audio
    audioBlocked = false
    try { soundpadPlayer?.playVideo() } catch {}
  }

  function stopSoundpad() {
    playingSlot = null
    playingUserId = null
    audioBlocked = false
    tiktokOverlayId = null
    soundPadActive.set(false)
    try { soundpadPlayer?.stopVideo() } catch {}
  }

  // รับ soundpad:play event จาก websocket.js
  function onSoundPadPlay(e) {
    const d = e.detail || {}
    const videoId = d.video_id
    const slot = d.slot
    const platform = d.platform || (slot >= 50 ? 'tiktok' : 'youtube')
    if (videoId == null || slot == null) return

    playingSlot = slot
    playingUserId = d.user_id ?? null
    audioBlocked = false

    if (platform === 'tiktok') {
      try { soundpadPlayer?.stopVideo() } catch {}
      soundPadActive.set(true)
      if (tiktokOverlayId !== videoId) tiktokOverlayId = videoId // ไม่ reload ถ้าเล่นอยู่แล้ว
      return
    }

    // YouTube path
    if (!soundpadReady) return
    tiktokOverlayId = null
    try {
      soundpadPlayer.loadVideoById({ videoId, startSeconds: 0 })
    } catch (err) {
      console.error('[SoundPad] play error:', err)
      playingSlot = null
    }
  }

  function onSoundPadStop() {
    tiktokOverlayId = null
    stopSoundpad()
  }

  function handleStop() {
    if (!ws) { stopSoundpad(); return }
    try {
      ws.send('soundpad_stop', {})
    } catch (err) {
      console.error('[SoundPad] stop send failed:', err)
      stopSoundpad()
    }
  }

  // --- slot edit/clear/play ---

  function openEdit(i) { editingSlot = i; editUrl = '' }
  function cancelEdit() { editingSlot = null; editUrl = '' }

  async function saveEdit(slot) {
    if (!ws) { showToast('Not connected', 'error'); return }
    const isTikTokSlot = slot >= 50
    savingSlot = true
    try {
      if (isTikTokSlot) {
        const id = extractTikTokId(editUrl)
        if (id) {
          ws.send('soundpad_set', { slot, video_id: id, title: `TikTok ${id}`, platform: 'tiktok' })
        } else {
          // short URL — ให้ backend resolve
          ws.send('soundpad_set', { slot, video_url: editUrl.trim(), title: '', platform: 'tiktok' })
        }
      } else {
        const id = extractVideoId(editUrl)
        if (!id) { showToast('Invalid YouTube URL', 'error'); return }
        const title = await fetchTitle(id)
        ws.send('soundpad_set', { slot, video_id: id, title, platform: 'youtube' })
      }
      editingSlot = null
      editUrl = ''
    } catch (err) {
      console.error('[SoundPad] save failed:', err)
      showToast(err.message || 'Failed to save slot', 'error')
    } finally {
      savingSlot = false
    }
  }

  function clearSlot(slot, ev) {
    ev?.stopPropagation()
    if (!ws) { showToast('Not connected', 'error'); return }
    try { ws.send('soundpad_clear', { slot }) } catch (err) {
      console.error('[SoundPad] clear failed:', err)
    }
  }

  function playSlot(slot) {
    if (!ws) { showToast('Not connected', 'error'); return }
    const cell = $soundPad[slot]
    if (!cell?.video_id) return

    // TikTok: set immediately within user gesture so browser allows autoplay
    if (cell.platform === 'tiktok') {
      try { soundpadPlayer?.stopVideo() } catch {}
      soundPadActive.set(true)
      playingSlot = slot
      playingUserId = $currentUser?.id ?? null
      tiktokOverlayId = cell.video_id
    }

    try { ws.send('soundpad_play', { slot }) } catch (err) {
      console.error('[SoundPad] play send failed:', err)
      if (cell.platform === 'tiktok') stopSoundpad()
    }
  }

  function onSlotClick(i) {
    if (editingSlot === i) return
    if ($soundPad[i]) playSlot(i)
    else openEdit(i)
  }

  // --- lifecycle ---

  onMount(() => {
    window.addEventListener('soundpad:play', onSoundPadPlay)
    window.addEventListener('soundpad:stop', onSoundPadStop)

    // YT API อาจโหลดแล้ว (จาก Player.svelte) หรือยังไม่โหลด
    if (window.YT && window.YT.Player) {
      initSoundpadPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev()
        initSoundpadPlayer()
      }
    }
  })

  onDestroy(() => {
    soundPadActive.set(false)
    window.removeEventListener('soundpad:play', onSoundPadPlay)
    window.removeEventListener('soundpad:stop', onSoundPadStop)
    try { soundpadPlayer?.destroy() } catch {}
  })
</script>

<div class="sound-pad">
  <div class="sound-pad-header">
    <h3 class="sound-pad-title">Sound Pad</h3>
    <div class="sound-pad-actions">
      {#if audioBlocked}
        <button type="button" class="unlock-btn" on:click={resumeBlockedAudio}>🔊 Click to hear</button>
      {/if}
      <button type="button" class="stop-btn" on:click={handleStop}>Stop</button>
    </div>
  </div>

  <!-- persistent YT player — ต้องอยู่ใน DOM เสมอ เหมือน main player -->
  <div bind:this={padPlayerEl} class="sound-pad-yt-host" aria-hidden="true"></div>

  {#if tiktokOverlayId}
    <div class="tiktok-modal-backdrop" on:click={handleStop} role="presentation">
      <div class="tiktok-modal" on:click|stopPropagation role="presentation">
        <button class="tiktok-modal-close" on:click={handleStop} aria-label="Close">×</button>
        <iframe
          src="https://www.tiktok.com/embed/v2/{tiktokOverlayId}?lang={navigator.language}&referrer={encodeURIComponent(window.location.href)}"
          class="tiktok-iframe"
          allow="autoplay; fullscreen"
          allowfullscreen
          title="TikTok"
        ></iframe>
      </div>
    </div>
  {/if}

  <!-- YouTube slots -->
  <div class="section-label">YouTube</div>
  <div class="sound-pad-grid" role="group" aria-label="YouTube sound pad slots">
    {#each $soundPad.slice(0, 50) as cell, i (i)}
      {@const slot = i}
      <div class="slot" class:playing={slot === playingSlot} class:empty={!cell}>
        {#if editingSlot === slot}
          <div class="slot-edit">
            <input class="edit-input" type="text" bind:value={editUrl}
              placeholder="YouTube URL" disabled={savingSlot}
              on:keydown={(e) => e.key === 'Enter' && saveEdit(slot)} />
            <div class="edit-actions">
              <button type="button" class="btn-small" disabled={savingSlot} on:click={() => saveEdit(slot)}>
                {savingSlot ? '…' : 'Save'}
              </button>
              <button type="button" class="btn-small ghost" disabled={savingSlot} on:click={cancelEdit}>Cancel</button>
            </div>
          </div>
        {:else if cell}
          <div class="slot-filled" role="button" tabindex="0"
            on:click={() => onSlotClick(slot)}
            on:pointerdown={(e) => onSlotPointerDown(e, slot, cell)}
            on:pointerup={onSlotPointerUp} on:pointerleave={onSlotPointerUp}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlotClick(slot) } }}>
            {#if copyingSlot === slot}<span class="copy-tooltip">Copied!</span>{/if}
            <span class="slot-num">{slot + 1}</span>
            <img class="thumb" src={THUMB(cell.video_id)} alt="" loading="lazy" />
            <span class="slot-title">{cell.title || cell.video_id}</span>
            {#if slot === playingSlot && getUserLabel(playingUserId)}
              <span class="playing-user">{getUserLabel(playingUserId)}</span>
            {/if}
            <button type="button" class="slot-clear" title="Remove" aria-label="Remove slot" on:click={(e) => clearSlot(slot, e)}>×</button>
          </div>
        {:else}
          <button type="button" class="slot-empty" on:click={() => onSlotClick(slot)} aria-label="Add YouTube sound to slot {slot + 1}">
            <span class="slot-num-empty">{slot + 1}</span>
            <span>+</span>
          </button>
        {/if}
      </div>
    {/each}
  </div>


  {#if $soundpadHistory.length > 0}
    <div class="pad-history">
      <button class="pad-history-toggle" on:click={() => (historyExpanded = !historyExpanded)}>
        <span class="pad-history-title">Recent</span>
        <span class="pad-history-chevron" class:open={historyExpanded}>›</span>
      </button>
      {#if historyExpanded}
        <div class="pad-history-list">
          {#each $soundpadHistory.slice(0, 20) as entry (entry.timestamp)}
            <div class="pad-history-row">
              {#if entry.type === 'play' || !entry.type}
                <img class="pad-history-thumb" src={THUMB(entry.video_id)} alt="" loading="lazy" />
                <div class="pad-history-info">
                  <span class="pad-history-song">▶ {entry.title}</span>
                  <span class="pad-history-meta">
                    {entry.by_username ?? entry.played_by} · {new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              {:else if entry.type === 'soundpad_set'}
                <span class="pad-history-icon">➕</span>
                <div class="pad-history-info">
                  <span class="pad-history-song">{entry.title || 'Untitled'}</span>
                  <span class="pad-history-meta">{entry.by_username} added · {new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              {:else if entry.type === 'soundpad_clear'}
                <span class="pad-history-icon">🗑</span>
                <div class="pad-history-info">
                  <span class="pad-history-song">{entry.title || 'Slot'}</span>
                  <span class="pad-history-meta">{entry.by_username} removed · {new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              {:else if entry.type === 'soundpad_stop'}
                <span class="pad-history-icon">🔇</span>
                <div class="pad-history-info">
                  <span class="pad-history-song">Stopped</span>
                  <span class="pad-history-meta">{entry.by_username} · {new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .sound-pad {
    position: relative;
    margin-top: 16px;
    padding: 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    min-width: 0;
  }

  .sound-pad-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .sound-pad-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .sound-pad-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .unlock-btn {
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    border-radius: 6px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 10px;
    cursor: pointer;
  }

  .stop-btn {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    padding: 5px 12px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }

  .stop-btn:hover {
    border-color: var(--accent);
    color: var(--text-primary);
    background: var(--accent-soft);
  }

  .sound-pad-yt-host {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .sound-pad-grid {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 6px;
  }

  .slot {
    position: relative;
    aspect-ratio: 1;
    min-height: 56px;
    border-radius: 8px;
    border: 2px solid var(--border);
    background: var(--bg-elevated);
    overflow: hidden;
    transition: border-color 0.15s;
  }

  .slot.playing {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent-soft);
  }

  .slot-empty,
  .slot-filled {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 22px;
    font-weight: 300;
    transition: background 0.15s, color 0.15s;
  }

  .slot-empty:hover {
    background: var(--bg-hover);
    color: var(--accent);
  }

  .slot-filled {
    flex-direction: column;
    position: relative;
    align-items: stretch;
    justify-content: flex-start;
    padding: 4px;
    gap: 4px;
  }

  .slot-filled:hover {
    background: var(--bg-hover);
  }

  .copy-tooltip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }

  .thumb {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 4px;
    display: block;
  }

  .slot-title {
    font-size: 9px;
    line-height: 1.2;
    color: var(--text-secondary);
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: left;
    width: 100%;
    padding-right: 16px;
  }

  .playing-user {
    font-size: 8px;
    color: var(--accent);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    padding-right: 16px;
  }

  .slot-num {
    position: absolute;
    top: 3px;
    left: 3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.95);
    font-size: 8px;
    font-weight: 700;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
    z-index: 2;
  }

  .slot-num-empty {
    position: absolute;
    top: 3px;
    left: 3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--bg-base);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 8px;
    font-weight: 700;
    line-height: 14px;
    text-align: center;
    pointer-events: none;
  }

  .slot-clear {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .slot-clear:hover {
    background: rgba(255, 0, 0, 0.85);
  }

  .slot-edit {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    box-sizing: border-box;
  }

  .edit-input {
    width: 100%;
    font-size: 10px;
    padding: 4px 6px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-base);
    color: var(--text-primary);
    min-width: 0;
  }

  .edit-input:focus {
    outline: none;
    border-color: var(--border-focus);
  }

  .edit-actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .btn-small {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-small.ghost {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .btn-small:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pad-history {
    margin-top: 12px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .pad-history-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0 0 8px;
    cursor: pointer;
  }

  .pad-history-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .pad-history-chevron {
    font-size: 16px;
    color: var(--text-muted);
    transform: rotate(90deg);
    transition: transform 0.2s;
    line-height: 1;
  }

  .pad-history-chevron.open {
    transform: rotate(-90deg);
  }

  .pad-history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .pad-history-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pad-history-thumb {
    width: 36px;
    height: 27px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .pad-history-icon {
    width: 36px;
    height: 27px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .pad-history-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .pad-history-song {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pad-history-meta {
    font-size: 10px;
    color: var(--text-muted);
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    margin: 10px 0 6px;
  }

  .tiktok-label {
    color: #e8306a;
    margin-top: 14px;
  }

  .tiktok-grid {
    grid-template-columns: repeat(10, minmax(0, 1fr));
  }

  .tiktok-slot {
    border-color: rgba(232, 48, 106, 0.25);
  }

  .tiktok-slot.playing {
    border-color: #e8306a;
    box-shadow: 0 0 0 1px rgba(232, 48, 106, 0.3);
  }

  .tiktok-empty:hover {
    color: #e8306a;
  }

  .tiktok-btn {
    background: #e8306a;
  }

  .tiktok-thumb-placeholder {
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: 40px;
    background: rgba(232, 48, 106, 0.12);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #e8306a;
  }

  .tiktok-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .tiktok-modal {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  }

  .tiktok-modal-close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tiktok-modal-close:hover {
    background: rgba(0, 0, 0, 0.85);
  }

  .tiktok-iframe {
    width: 325px;
    height: 580px;
    border: none;
    display: block;
  }

  @media (max-width: 900px) {
    .sound-pad-grid,
    .tiktok-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
</style>
