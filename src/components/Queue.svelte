<script>
  // 1. Imports
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { pressable, staggerChildren } from '$lib/motionActions.js'
  import { queue, currentIndex, queueActivity } from '$lib/stores.js'
  import { X, Radio, Trash2, SkipForward, ArrowUpDown, SlidersHorizontal, Zap, ChevronRight, ListMusic, Music } from 'lucide-svelte'

  // 2. Props
  export let ws = null

  // 3. Local State
  let dragFromIndex = null
  let dragOverIndex = null
  let activityExpanded = false

  // 4. Derived
  $: isBroadcasting = $queue[$currentIndex]?.is_broadcast === true

  // 5. Event Handlers
  function handleDragStart(event, index) {
    dragFromIndex = index
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event, index) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    dragOverIndex = index
  }

  function handleDrop(event, toIndex) {
    event.preventDefault()
    if (dragFromIndex === null || dragFromIndex === toIndex) {
      dragFromIndex = null
      dragOverIndex = null
      return
    }

    const song = $queue[dragFromIndex]
    if (!song || !ws) {
      dragFromIndex = null
      dragOverIndex = null
      return
    }

    try {
      ws.send('reorder_queue', {
        song_id: song.queue_id,
        new_index: toIndex,
      })
    } catch (err) {
      console.error('[Queue] reorder send failed:', err)
    }

    dragFromIndex = null
    dragOverIndex = null
  }

  function handleDragEnd() {
    dragFromIndex = null
    dragOverIndex = null
  }

  function handleRemove(queueId) {
    if (!ws) return
    try {
      ws.send('remove_song', { song_id: queueId })
    } catch (err) {
      console.error('[Queue] remove send failed:', err)
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const activityIcon = {
    remove_song:        Trash2,
    skip_song:          SkipForward,
    reorder_queue:      ArrowUpDown,
    set_playback_mode:  SlidersHorizontal,
    set_playback_speed: Zap,
  }

  function activityText(entry) {
    switch (entry.action) {
      case 'remove_song':        return `removed "${entry.detail}"`
      case 'skip_song':          return `skipped "${entry.detail}"`
      case 'reorder_queue':      return `reordered "${entry.detail}"`
      case 'set_playback_mode':  return `changed ${entry.detail}`
      case 'set_playback_speed': return `set speed to ${entry.detail}`
      default: return entry.detail
    }
  }
</script>

<div class="queue">
  <h3>
    <ListMusic size="18" strokeWidth="2" />
    <span>Queue</span>
    <span class="count">{$queue.length}</span>
  </h3>

  {#if isBroadcasting}
    <div class="broadcast-banner">
      <span class="broadcast-icon"><Radio size="22" strokeWidth="2" /></span>
      <div class="broadcast-text">
        <span class="broadcast-title">Broadcast in progress</span>
        <span class="broadcast-sub">Your queue will resume automatically after the broadcast ends</span>
      </div>
    </div>
  {:else if $queue.length === 0}
    <p class="empty"><Music size="22" strokeWidth="1.5" /><span>Queue is empty</span></p>
  {:else}
    <ul class="song-list" use:staggerChildren={{ gap: 0.05 }}>
      {#each $queue as song, i (song.queue_id ?? song.id + '_' + i)}
        <li
          class="song-item"
          class:playing={i === $currentIndex}
          class:drag-over={dragOverIndex === i}
          draggable={i !== $currentIndex}
          in:fly={{ y: 10, duration: 220, delay: Math.min(i * 30, 300), easing: cubicOut }}
          on:dragstart={(e) => handleDragStart(e, i)}
          on:dragover={(e) => handleDragOver(e, i)}
          on:drop={(e) => handleDrop(e, i)}
          on:dragend={handleDragEnd}
        >
          <span class="song-index">{i + 1}</span>

          {#if song.thumbnail}
            <img class="song-thumb" src={song.thumbnail} alt="" aria-hidden="true" />
          {/if}

          <div class="song-info">
            <span class="song-title">{song.title || song.id}</span>
            <span class="song-meta">
              by {song.added_by} · {formatDuration(song.duration)}
            </span>
          </div>

          {#if i === $currentIndex}
            <span class="now-playing-badge" class:broadcast-badge={song.is_broadcast} title={song.is_broadcast ? 'Broadcast' : 'Now Playing'}>
              {#if song.is_broadcast}
                <Radio size="12" strokeWidth="2.5" />
              {:else}
                <span class="eq">
                  <span></span><span></span><span></span>
                </span>
              {/if}
            </span>
          {:else}
            <button
              class="remove-btn"
              use:pressable={{ scale: 0.88 }}
              on:click={() => handleRemove(song.queue_id)}
              aria-label="Remove {song.title || song.id}"
            >
              <X size="14" strokeWidth="2.2" />
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if $queueActivity.length > 0}
    <div class="q-activity">
      <button class="q-activity-toggle" use:pressable on:click={() => (activityExpanded = !activityExpanded)}>
        <span class="q-activity-title">Activity</span>
        <span class="q-activity-chevron" class:open={activityExpanded}><ChevronRight size="14" strokeWidth="2.2" /></span>
      </button>
      {#if activityExpanded}
        <div class="q-activity-list">
          {#each $queueActivity.slice(0, 20) as entry (entry.timestamp)}
            <div class="q-activity-row">
              <span class="q-activity-icon">
                {#if activityIcon[entry.action]}
                  <svelte:component this={activityIcon[entry.action]} size="13" strokeWidth="2" />
                {/if}
              </span>
              <div class="q-activity-info">
                <span class="q-activity-text"><strong>{entry.by_username}</strong> {activityText(entry)}</span>
                <span class="q-activity-time">{new Date(entry.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .queue {
    background: var(--bg-surface);
    backdrop-filter: var(--blur-bg);
    -webkit-backdrop-filter: var(--blur-bg);
    border-radius: var(--radius-lg);
    padding: 20px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-1);
  }

  .song-list {
    max-height: 320px;
    overflow-y: auto;
  }

  h3 {
    margin: 0 0 14px 0;
    color: var(--text-primary);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h3 :global(svg) { color: var(--text-secondary); }

  h3 .count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    padding: 3px 9px;
    border-radius: var(--radius-pill);
  }

  .broadcast-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(224, 92, 0, 0.08);
    border: 1px solid rgba(224, 92, 0, 0.3);
    border-radius: 8px;
  }

  .broadcast-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .broadcast-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .broadcast-title {
    font-size: 13px;
    font-weight: 600;
    color: #e05c00;
  }

  .broadcast-sub {
    font-size: 12px;
    color: var(--text-muted);
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
    padding: 28px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .song-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .song-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--bg-elevated);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    cursor: grab;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.25s, transform 0.2s;
    user-select: none;
    will-change: transform;
  }

  .song-item:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-1);
  }

  .song-item.playing {
    border-color: var(--accent);
    background: var(--accent-soft);
    cursor: default;
    box-shadow: 0 0 0 4px var(--accent-soft), var(--shadow-1);
  }

  .song-item.playing:hover { transform: none; }

  .song-item.drag-over {
    border-color: var(--accent);
    background: var(--bg-hover);
    transform: scale(1.01);
  }

  .song-index {
    color: var(--text-muted);
    font-size: 12px;
    width: 20px;
    text-align: right;
    flex-shrink: 0;
  }

  .song-thumb {
    width: 48px;
    height: 36px;
    object-fit: cover;
    border-radius: 8px;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 400px) {
    .song-thumb { display: none; }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .song-title {
    color: var(--text-primary);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .song-meta {
    color: var(--text-muted);
    font-size: 12px;
  }

  .now-playing-badge.broadcast-badge {
    color: #e05c00;
    background: rgba(224, 92, 0, 0.12);
  }

  .now-playing-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background: var(--accent-badge);
    padding: 6px 9px;
    border-radius: var(--radius-pill);
    flex-shrink: 0;
    min-width: 32px;
    height: 24px;
  }

  /* Animated equalizer for "now playing" */
  .eq {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
  }
  .eq span {
    display: block;
    width: 2px;
    background: currentColor;
    border-radius: 2px;
    animation: eqBar 1s ease-in-out infinite;
  }
  .eq span:nth-child(1) { animation-delay: -0.6s; }
  .eq span:nth-child(2) { animation-delay: -0.3s; }
  .eq span:nth-child(3) { animation-delay: -0.9s; }

  @keyframes eqBar {
    0%, 100% { height: 4px; }
    50%      { height: 12px; }
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: var(--status-disconnected);
    background: rgba(255, 69, 58, 0.12);
  }

  .q-activity {
    margin-top: 12px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .q-activity-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0 0 6px;
    cursor: pointer;
  }

  .q-activity-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .q-activity-chevron {
    display: inline-flex;
    color: var(--text-muted);
    transform: rotate(90deg);
    transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .q-activity-chevron.open {
    transform: rotate(270deg);
  }

  .q-activity-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 180px;
    overflow-y: auto;
  }

  .q-activity-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .q-activity-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .q-activity-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .q-activity-text {
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .q-activity-time {
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
