<script>
  // 1. Imports
  import { queue, currentIndex } from '$lib/stores.js'

  // 2. Props
  export let ws = null

  // 3. Local State
  let dragFromIndex = null
  let dragOverIndex = null

  // 4. Event Handlers
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
</script>

<div class="queue">
  <h3>Queue ({$queue.length} {$queue.length === 1 ? 'song' : 'songs'})</h3>

  {#if $queue.length === 0}
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
</div>

<style>
  .queue {
    background: var(--bg-surface);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid var(--border);
  }

  h3 {
    margin: 0 0 12px 0;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
</style>
