<script>
  // 1. Imports
  import { history } from '$lib/stores.js'

  // 2. Props
  export let ws = null

  // 4. Derived
  $: displayHistory = $history.slice(0, 20)

  function formatDuration(seconds) {
    if (!seconds) return '--:--'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function handleRequeue(song) {
    if (!ws) return
    try {
      ws.send('add_song', {
        youtube_url: `https://www.youtube.com/watch?v=${song.id}`,
        added_by: song.added_by,
      })
    } catch (err) {
      console.error('[History] requeue failed:', err)
    }
  }
</script>

<div class="history">
  <h3>Play History</h3>

  {#if displayHistory.length === 0}
    <p class="empty">No songs played yet</p>
  {:else}
    <ul class="history-list">
      {#each displayHistory as song, i (song.id + song.status + i)}
        <li class="history-item" class:skipped={song.status === 'skipped'}>
          {#if song.thumbnail}
            <img class="song-thumb" src={song.thumbnail} alt="" aria-hidden="true" />
          {/if}
          <div class="song-info">
            <span class="song-title">{song.title || song.id}</span>
            <span class="song-meta">
              {song.added_by} · {formatDuration(song.duration)}
            </span>
          </div>
          <span class="status-badge" class:skipped={song.status === 'skipped'}>
            {song.status === 'skipped' ? 'Skipped' : 'Played'}
          </span>
          <button
            class="requeue-btn"
            on:click={() => handleRequeue(song)}
            title="Add to queue again"
            aria-label="Add {song.title || song.id} to queue"
          >+</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .history {
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
    padding: 16px 0;
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-base);
    border-radius: 6px;
    opacity: 0.85;
  }

  .history-item.skipped { opacity: 0.5; }

  .song-thumb {
    width: 44px;
    height: 33px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .song-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .song-title {
    color: var(--text-secondary);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .song-meta {
    color: var(--text-muted);
    font-size: 11px;
  }

  .status-badge {
    font-size: 11px;
    color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
    padding: 2px 8px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .status-badge.skipped {
    color: #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }

  .requeue-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s, border-color 0.15s;
  }

  .requeue-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
