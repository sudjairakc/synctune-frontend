<script>
  import { onMount, onDestroy } from 'svelte'
  import { soundPad, soundPadActive, onlineUsers, currentUser, soundpadHistory } from '$lib/stores.js'
  import { showToast } from '$lib/toast.js'

  export let ws = null

  let padPlayerContainer
  let padPlayer = null
  let isPadReady = false
  let editingSlot = null
  let editUrl = ''
  let playingSlot = null
  let playingUserId = null
  let savingSlot = false
  let pendingPadPlay = null

  function getUserLabel(userId) {
    if (!userId) return null
    const me = $currentUser
    if (me && me.id === userId) return 'you'
    const user = $onlineUsers.find(u => u.id === userId)
    return user ? user.username : null
  }

  const THUMB = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`

  function extractVideoId(url) {
    const u = (url || '').trim()
    const m = u.match(
      /(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|shorts\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:[^&]*&)*v=)([\w-]{11})/
    )
    return m ? m[1] : null
  }

  function watchUrlForOembed(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`
  }

  async function fetchTitle(videoId) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrlForOembed(videoId))}&format=json`
    const res = await fetch(oembedUrl)
    if (!res.ok) throw new Error('Could not load video info')
    const data = await res.json()
    return data.title || ''
  }

  function playPadVideo(detail) {
    const d = detail || {}
    const videoId = d.video_id ?? d.videoId
    const slot = d.slot
    if (videoId == null || slot == null) return
    playingSlot = slot
    playingUserId = d.user_id ?? null
    if (!isPadReady || !padPlayer) {
      pendingPadPlay = detail
      return
    }
    try {
      padPlayer.loadVideoById({ videoId, startSeconds: 0 })
      padPlayer.playVideo()
      pendingPadPlay = null
      soundPadActive.set(true)
    } catch (err) {
      console.error('[SoundPad] play error:', err)
      showToast('Could not play sound pad', 'error')
      playingSlot = null
      pendingPadPlay = null
      soundPadActive.set(false)
    }
  }

  function initPadPlayer() {
    if (padPlayer || !padPlayerContainer) return
    padPlayer = new window.YT.Player(padPlayerContainer, {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          isPadReady = true
          if (pendingPadPlay) playPadVideo(pendingPadPlay)
        },
        onStateChange: (e) => {
          if (e.data === 0) {
            playingSlot = null
            playingUserId = null
            soundPadActive.set(false)
          }
        },
      },
    })
  }

  function onSoundPadPlay(e) {
    playPadVideo(e.detail)
  }

  function handleStop() {
    if (padPlayer && isPadReady) {
      try {
        padPlayer.setVolume(0)
        padPlayer.stopVideo()
        padPlayer.setVolume(100)
      } catch (err) {
        console.warn('[SoundPad] stop error:', err)
      }
    }
    playingSlot = null
    playingUserId = null
    soundPadActive.set(false)
  }

  function openEdit(i) {
    editingSlot = i
    editUrl = ''
  }

  function cancelEdit() {
    editingSlot = null
    editUrl = ''
  }

  async function saveEdit(slot) {
    const id = extractVideoId(editUrl)
    if (!id) {
      showToast('Invalid YouTube URL', 'error')
      return
    }
    if (!ws) {
      showToast('Not connected', 'error')
      return
    }
    savingSlot = true
    try {
      const title = await fetchTitle(id)
      ws.send('soundpad_set', { slot, video_id: id, title })
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
    if (!ws) {
      showToast('Not connected', 'error')
      return
    }
    try {
      ws.send('soundpad_clear', { slot })
    } catch (err) {
      console.error('[SoundPad] clear failed:', err)
      showToast('Failed to clear slot', 'error')
    }
  }

  function playSlot(slot) {
    if (!ws) {
      showToast('Not connected', 'error')
      return
    }
    const cell = $soundPad[slot]
    if (!cell?.video_id) return
    try {
      ws.send('soundpad_play', { slot })
    } catch (err) {
      console.error('[SoundPad] play send failed:', err)
      showToast('Failed to trigger play', 'error')
    }
  }

  function onSlotClick(i) {
    if (editingSlot === i) return
    const cell = $soundPad[i]
    if (cell) playSlot(i)
    else openEdit(i)
  }

  onMount(() => {
    window.addEventListener('soundpad:play', onSoundPadPlay)

    function boot() {
      initPadPlayer()
    }

    if (window.YT && window.YT.Player) {
      boot()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev()
        boot()
      }
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(script)
      }
    }
  })

  onDestroy(() => {
    soundPadActive.set(false)
    window.removeEventListener('soundpad:play', onSoundPadPlay)
    if (padPlayer) {
      try {
        padPlayer.destroy()
      } catch (err) {
        console.warn('[SoundPad] destroy error:', err)
      }
    }
  })
</script>

<div class="sound-pad">
  <div class="sound-pad-header">
    <h3 class="sound-pad-title">Sound Pad</h3>
    <button type="button" class="stop-btn" on:click={handleStop}>Stop</button>
  </div>

  <!-- ต้องอยู่ใน DOM เสมอ (ไม่ห่อด้วย {#if}) -->
  <div
    bind:this={padPlayerContainer}
    class="sound-pad-yt-host"
    aria-hidden="true"
  ></div>

  <div class="sound-pad-grid" role="group" aria-label="Sound pad slots">
    {#each $soundPad as cell, i (i)}
      <div
        class="slot"
        class:playing={playingSlot === i}
        class:empty={!cell}
      >
        {#if editingSlot === i}
          <div class="slot-edit">
            <input
              class="edit-input"
              type="text"
              bind:value={editUrl}
              placeholder="YouTube URL"
              disabled={savingSlot}
              on:keydown={(e) => e.key === 'Enter' && saveEdit(i)}
            />
            <div class="edit-actions">
              <button
                type="button"
                class="btn-small"
                disabled={savingSlot}
                on:click={() => saveEdit(i)}
              >
                {savingSlot ? '…' : 'Save'}
              </button>
              <button
                type="button"
                class="btn-small ghost"
                disabled={savingSlot}
                on:click={cancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        {:else if cell}
          <!-- div แทน button ล้อม เพื่อไม่ให้ปุ่มลบซ้อนปุ่มหลัก -->
          <div
            class="slot-filled"
            role="button"
            tabindex="0"
            on:click={() => onSlotClick(i)}
            on:keydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSlotClick(i)
              }
            }}
          >
            <img
              class="thumb"
              src={THUMB(cell.video_id)}
              alt=""
              loading="lazy"
            />
            <span class="slot-title">{cell.title || cell.video_id}</span>
            {#if playingSlot === i && getUserLabel(playingUserId)}
              <span class="playing-user">{getUserLabel(playingUserId)}</span>
            {/if}
            <button
              type="button"
              class="slot-clear"
              title="Remove"
              aria-label="Remove slot"
              on:click={(e) => clearSlot(i, e)}
            >
              ×
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="slot-empty"
            on:click={() => onSlotClick(i)}
            aria-label="Add sound to slot {i + 1}"
          >
            +
          </button>
        {/if}
      </div>
    {/each}
  </div>

  {#if $soundpadHistory.length > 0}
    <div class="pad-history">
      <h4 class="pad-history-title">Recent</h4>
      <div class="pad-history-list">
        {#each $soundpadHistory.slice(0, 10) as entry (entry.timestamp + entry.user_id)}
          <div class="pad-history-row">
            <img class="pad-history-thumb" src={THUMB(entry.video_id)} alt="" loading="lazy" />
            <div class="pad-history-info">
              <span class="pad-history-song">{entry.title}</span>
              <span class="pad-history-meta">
                {entry.played_by} · {new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        {/each}
      </div>
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

  .pad-history-title {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .pad-history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
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

  @media (max-width: 900px) {
    .sound-pad-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
</style>
