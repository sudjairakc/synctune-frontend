<script>
  import { history } from '$lib/stores.js'

  export let ws = null

  let open = false

  $: topSongs = (() => {
    const counts = {}
    for (const s of $history) {
      if (!counts[s.id]) counts[s.id] = { id: s.id, title: s.title, thumbnail: s.thumbnail, count: 0 }
      counts[s.id].count++
    }
    return Object.values(counts).filter(s => s.count >= 2).sort((a, b) => b.count - a.count).slice(0, 20)
  })()

  function handleAdd(song) {
    if (!ws) return
    ws.send('add_song', { youtube_url: `https://www.youtube.com/watch?v=${song.id}` })
  }
</script>

{#if topSongs.length > 0}
  <div class="suggestions">
    <button class="toggle" on:click={() => open = !open}>
      <span>Top Songs</span>
      <span class="chevron" class:open>{open ? '▲' : '▼'}</span>
    </button>

    {#if open}
      <ul class="list">
        {#each topSongs as song, i (song.id)}
          <li class="item">
            <span class="rank">{i + 1}</span>
            {#if song.thumbnail}
              <img class="thumb" src={song.thumbnail} alt="" aria-hidden="true" />
            {/if}
            <span class="title">{song.title || song.id}</span>
            <span class="count">{song.count}x</span>
            <button class="add-btn" on:click={() => handleAdd(song)} title="Add to queue">+</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .suggestions {
    border-top: 1px solid var(--border);
    margin-bottom: 4px;
  }

  .toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 8px 12px;
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    user-select: none;
  }

  .toggle:hover { color: var(--accent); }

  .chevron { font-size: 10px; }

  .list {
    list-style: none;
    margin: 0;
    padding: 0 0 8px 0;
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border-radius: 5px;
  }

  .item:hover { background: var(--bg-surface); }

  .thumb {
    width: 40px;
    height: 30px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rank {
    font-size: 11px;
    color: var(--text-muted);
    width: 18px;
    text-align: right;
    flex-shrink: 0;
  }

  .count {
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .add-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 15px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: color 0.15s, border-color 0.15s;
  }

  .add-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
