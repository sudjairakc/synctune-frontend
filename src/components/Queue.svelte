<script>
  // 1. Imports
  import { queue, currentIndex, queueActivity } from '$lib/stores.js'

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
    remove_song:        '🗑',
    skip_song:          '⏭',
    reorder_queue:      '↕️',
    set_playback_mode:  '🎛',
    set_playback_speed: '⚡',
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
  <h3>Queue ({$queue.length} {$queue.length === 1 ? 'song' : 'songs'})</h3>

  {#if isBroadcasting}
    <div class="broadcast-banner">
      <span class="broadcast-icon">📡</span>
      <div class="broadcast-text">
        <span class="broadcast-title">Broadcast in progress</span>
        <span class="broadcast-sub">Your queue will resume automatically after the broadcast ends</span>
      </div>
    </div>
  {:else if $queue.length === 0}
    <p class="empty">Queue is empty. Add a song to start playing</p>
  {:else}
    <ul class="song-list">
      {#each $queue as song, i (song.queue_id ?? song.id + '_' + i)}
        <li
          class="song-item"
          class:playing={i === $currentIndex}
          class:drag-over={dragOverIndex === i}
          draggable={i !== $currentIndex}
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
            <span class="now-playing-badge" class:broadcast-badge={song.is_broadcast}>{song.is_broadcast ? '📡 Broadcast' : 'Now Playing'}</span>
          {:else}
            <button
              class="remove-btn"
              on:click={() => handleRemove(song.queue_id)}
              aria-label="Remove {song.title || song.id}"
            >
              ✕
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if $queueActivity.length > 0}
    <div class="q-activity">
      <button class="q-activity-toggle" on:click={() => (activityExpanded = !activityExpanded)}>
        <span class="q-activity-title">Activity</span>
        <span class="q-activity-chevron" class:open={activityExpanded}>›</span>
      </button>
      {#if activityExpanded}
        <div class="q-activity-list">
          {#each $queueActivity.slice(0, 20) as entry (entry.timestamp)}
            <div class="q-activity-row">
              <span class="q-activity-icon">{activityIcon[entry.action] ?? '•'}</span>
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
    border-radius: 8px;
    padding: 16px;
    border: 1px solid var(--border);
  }

  .song-list {
    max-height: 320px;
    overflow-y: auto;
  }

  h3 {
    margin: 0 0 12px 0;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
    padding: 24px 0;
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
    padding: 10px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    border: 1px solid transparent;
    cursor: grab;
    transition: background 0.15s, border-color 0.15s;
    user-select: none;
  }

  .song-item:hover { background: var(--bg-hover); }

  .song-item.playing {
    border-color: var(--accent);
    background: var(--accent-soft);
    cursor: default;
  }

  .song-item.drag-over {
    border-color: var(--accent);
    background: var(--bg-hover);
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
    border-radius: 3px;
    flex-shrink: 0;
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
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-badge);
    padding: 2px 8px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: #ff4444;
    background: rgba(255, 68, 68, 0.1);
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
    font-size: 16px;
    color: var(--text-muted);
    transform: rotate(90deg);
    transition: transform 0.2s;
    line-height: 1;
  }

  .q-activity-chevron.open {
    transform: rotate(-90deg);
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
    font-size: 13px;
    width: 20px;
    text-align: center;
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
