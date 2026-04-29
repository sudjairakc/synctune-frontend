<script>
  // 1. Imports
  import { onMount, onDestroy } from 'svelte'
  import { queue, currentIndex, seekTime, isPlaying, ttsActive, activeSpeaker, playbackSpeed, soundPadActive } from '$lib/stores.js'

  // 2. Props
  export let ws = null

  // 3. Local State
  let playerContainer
  let player = null
  let isPlayerReady = false
  let currentQueueId = null
  let needsResume = false
  let userSeekedAt = 0
  let isUserPaused = false
  let songEndedSent = false
  let originalVolume = null
  let loadingVideo = false
  let isLiveVideo = false

  const SEEK_DRIFT_THRESHOLD = 3
  const USER_SEEK_COOLDOWN = 5000

  // 4. Derived
  $: currentSong = $queue[$currentIndex]
  $: isBroadcast = currentSong?.is_broadcast === true
  $: if (currentSong && isPlayerReady && currentSong.queue_id !== currentQueueId) {
    loadVideo(currentSong.id, currentSong.queue_id)
  }
  $: if ($seekTime && isPlayerReady) {
    if ($playbackSpeed === 1) syncSeekIfNeeded($seekTime)
  }
  $: if (isPlayerReady && player) {
    player.setPlaybackRate($playbackSpeed)
  }
  $: if (isPlayerReady && player) {
    const shouldDuck = $ttsActive || $activeSpeaker.length > 0 || $soundPadActive
    if (shouldDuck && originalVolume === null) {
      originalVolume = player.getVolume()
      player.setVolume(Math.round(originalVolume * 0.6))
    } else if (!shouldDuck && originalVolume !== null) {
      player.setVolume(originalVolume)
      originalVolume = null
    }
  }

  // 5. Lifecycle
  onMount(() => {
    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      window.onYouTubeIframeAPIReady = initPlayer
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(script)
    }
  })

  onDestroy(() => {
    if (player) {
      try {
        player.destroy()
      } catch (err) {
        console.warn('[Player] destroy error:', err)
      }
    }
  })

  // 6. Event Handlers
  function initPlayer() {
    player = new window.YT.Player(playerContainer, {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        mute: 1,
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handleStateChange,
        onError: handlePlayerError,
      },
    })
  }

  function handlePlayerReady() {
    isPlayerReady = true
    console.info('[Player] YouTube player ready')
    if (currentSong) {
      loadVideo(currentSong.id, currentSong.queue_id)
    }
  }

  function handleStateChange(event) {
    // YT.PlayerState: -1=UNSTARTED, 0=ENDED, 1=PLAYING, 2=PAUSED, 3=BUFFERING, 5=CUED
    if (event.data === 0) {
      console.info('[Player] video ended, queue_id:', currentQueueId)
      if (currentQueueId && ws && !songEndedSent) {
        songEndedSent = true
        try {
          ws.send('song_ended', { song_id: currentQueueId })
        } catch (err) {
          console.error('[Player] failed to send song_ended:', err)
        }
      }
    }
    if (event.data === 2) {
      // PAUSED — user กด pause จริงๆ → block seek_sync ตลอดจนกว่าจะ play ใหม่
      isUserPaused = true
      userSeekedAt = Date.now()
    }
    if (event.data === 3) {
      // BUFFERING — set cooldown เฉพาะตอน user drag seek bar (ไม่ใช่ตอน loadVideo)
      if (!loadingVideo) userSeekedAt = Date.now()
    }
    if (event.data === 5 && $isPlaying) {
      needsResume = true
      console.warn('[Player] autoplay blocked by browser')
    }
    if (event.data === 1) {
      needsResume = false
      isUserPaused = false
      loadingVideo = false
      // fallback: detect live via duration ถ้า is_live ไม่ได้ถูกส่งมา (เช่น watch?v= ที่เป็น live)
      if (!isLiveVideo && player.getDuration() === 0) {
        isLiveVideo = true
        console.info('[Player] live stream detected via duration, seek disabled')
      }
    }
  }

  function handlePlayerError(event) {
    const errorCode = event.data
    console.error('[Player] YouTube API error:', errorCode)

    if ((errorCode === 101 || errorCode === 150) && currentQueueId && ws) {
      try {
        ws.send('report_error', {
          song_id: currentQueueId,
          error_code: errorCode,
        })
      } catch (err) {
        console.error('[Player] failed to send report_error:', err)
      }
    }
  }

  function loadVideo(videoId, queueId) {
    if (!player || !isPlayerReady) return
    currentQueueId = queueId
    songEndedSent = false
    loadingVideo = true
    isLiveVideo = currentSong?.is_live === true
    userSeekedAt = 0
    // startSeconds ทำให้ video เริ่มที่ตำแหน่งที่ถูกต้องทันที (ไม่ต้องรอ seek_sync)
    // ไม่ส่ง startSeconds ถ้าเป็น 0 เพื่อให้ live stream เล่นจาก live edge
    const startSeconds = $seekTime > 0 ? $seekTime : undefined
    if ($isPlaying) {
      player.loadVideoById({ videoId, startSeconds })
    } else {
      player.cueVideoById({ videoId, startSeconds })
    }
    if ($playbackSpeed !== 1) {
      player.setPlaybackRate($playbackSpeed)
    }
    console.info('[Player] loading video:', videoId, 'queue_id:', queueId, 'playing:', $isPlaying)
  }

  function syncSeekIfNeeded(serverSeek) {
    if (!player || !isPlayerReady) return
    if (isUserPaused) return
    if (isLiveVideo) return
    if (userSeekedAt && Date.now() - userSeekedAt < USER_SEEK_COOLDOWN) return
    try {
      const duration = player.getDuration()
      if (!duration || serverSeek >= duration) {
        console.warn('[Player] seek skipped: serverSeek', serverSeek, '>=', duration, 's')
        return
      }
      const clientSeek = player.getCurrentTime()
      const drift = Math.abs(clientSeek - serverSeek)
      if (drift > SEEK_DRIFT_THRESHOLD) {
        player.seekTo(serverSeek, true)
        console.info('[Player] seeking to', serverSeek, '(drift:', drift.toFixed(1), 's)')
      }
    } catch (err) {
      console.warn('[Player] syncSeekIfNeeded error:', err)
    }
  }

  function handleResumeClick() {
    if (!player) return
    player.playVideo()
    needsResume = false
  }

  function handleSpeedChange(rate) {
    if (!ws) return
    ws.send('set_playback_speed', { speed: rate })
  }

  function handleSkip() {
    if (!currentQueueId || !ws) return
    try {
      ws.send('skip_song', { song_id: currentQueueId })
    } catch (err) {
      console.error('[Player] failed to send skip_song:', err)
    }
  }
</script>

<div class="player-wrapper">
  <!-- playerContainer ต้องอยู่ใน DOM เสมอก่อน YT API พร้อม -->
  <div class="youtube-container" class:hidden={$queue.length === 0}>
    <div bind:this={playerContainer}></div>
    {#if needsResume}
      <button class="resume-overlay" on:click={handleResumeClick}>
        <span class="resume-icon">▶</span>
        <span class="resume-text">Tap to play</span>
      </button>
    {/if}
  </div>

  {#if $queue.length === 0}
    <div class="player-placeholder">
      <p>Add a song to start playing</p>
    </div>
  {:else if currentSong}
    <div class="now-playing-info">
      {#if currentSong.thumbnail}
        <img class="now-playing-thumb" src={currentSong.thumbnail} alt="" aria-hidden="true" />
      {/if}
      <div class="now-playing-text">
        <span class="label" class:broadcast={isBroadcast}>{isBroadcast ? '📡 Broadcast' : 'Now Playing'}</span>
        <span class="title">{currentSong.title || currentSong.id}</span>
        <span class="added-by">Added by {currentSong.added_by}</span>
      </div>
      <div class="speed-btns">
        {#each [0.5, 1, 1.5, 2] as rate}
          <button
            class="speed-btn"
            class:active={$playbackSpeed === rate}
            on:click={() => handleSpeedChange(rate)}
          >{rate}x</button>
        {/each}
      </div>
      <button class="skip-btn" on:click={handleSkip} title="Skip song" disabled={isBroadcast}>⏭</button>
    </div>
  {/if}
</div>

<style>
  .player-wrapper {
    background: var(--bg-surface);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
    border: 1px solid var(--border);
  }

  .player-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--text-muted);
    font-size: 14px;
  }

  .youtube-container {
    position: relative;
    padding-top: 56.25%;
    background: #000;
  }

  .youtube-container.hidden {
    display: none;
  }

  .youtube-container :global(iframe),
  .youtube-container > div {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }

  .resume-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    cursor: pointer;
    color: #fff;
    transition: background 0.15s;
  }

  .resume-overlay:hover { background: rgba(0, 0, 0, 0.45); }

  .resume-icon {
    font-size: 48px;
    line-height: 1;
    color: var(--accent);
  }

  .resume-text {
    font-size: 14px;
    color: #ccc;
  }

  .now-playing-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--now-playing-bg);
    border-top: 1px solid var(--border);
  }

  .now-playing-thumb {
    width: 48px;
    height: 36px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .now-playing-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .label {
    font-size: 11px;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  .title {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .added-by {
    color: var(--text-muted);
    font-size: 12px;
    flex-shrink: 0;
  }

  .skip-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    line-height: 1;
    transition: color 0.15s;
    flex-shrink: 0;
  }

  .skip-btn:hover { color: var(--accent); }
  .skip-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .label.broadcast { color: #e05c00; }

  .speed-btns {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .speed-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1.4;
    transition: color 0.15s, border-color 0.15s;
  }

  .speed-btn:hover { color: var(--accent); border-color: var(--accent); }
  .speed-btn.active { color: var(--accent); border-color: var(--accent); }
</style>
