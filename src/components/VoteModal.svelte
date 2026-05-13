<script>
  import { onDestroy } from 'svelte'
  import { activeVote, currentUser } from '$lib/stores.js'

  export let ws = null

  let countdown = 30
  let timer = null

  function startTimer() {
    clearInterval(timer)
    countdown = 30
    timer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(timer)
        activeVote.set(null)
      }
    }, 1000)
  }

  // เริ่ม timer ใหม่ทุกครั้งที่มี vote ใหม่
  $: if ($activeVote) {
    const remaining = Math.max(0, Math.round(($activeVote.expires_at - Date.now()) / 1000))
    countdown = remaining
    clearInterval(timer)
    timer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(timer)
        activeVote.set(null)
      }
    }, 1000)
  } else {
    clearInterval(timer)
  }

  onDestroy(() => clearInterval(timer))

  function castVote() {
    if (!ws || !$activeVote) return
    try {
      ws.send('vote_cast', { vote_id: $activeVote.vote_id })
    } catch (err) {
      console.error('[VoteModal] vote_cast failed:', err)
    }
  }

  // track local vote ที่เราส่งไปแล้ว (server ไม่ส่ง voter_ids กลับมาใน payload)
  let votedVoteIDs = new Set()
  $: alreadyVoted = $activeVote
    ? ($activeVote.initiated_by === $currentUser?.username || votedVoteIDs.has($activeVote.vote_id))
    : false

  function castVoteAndTrack() {
    if (!ws || !$activeVote || alreadyVoted) return
    votedVoteIDs = new Set([...votedVoteIDs, $activeVote.vote_id])
    castVote()
  }

  $: actionLabel = $activeVote?.action === 'remove_song' ? 'remove' : 'skip'
</script>

{#if $activeVote}
  <div class="vote-banner">
    <div class="vote-info">
      <span class="vote-icon">{actionLabel === 'skip' ? '⏭' : '🗑'}</span>
      <div class="vote-text">
        <span class="vote-title">
          <strong>{$activeVote.initiated_by}</strong> wants to {actionLabel}
          <em>"{$activeVote.song_title}"</em>
        </span>
        <span class="vote-sub">
          {$activeVote.yes_votes}/{$activeVote.required} votes needed · {countdown}s
        </span>
      </div>
    </div>
    <div class="vote-progress-bar">
      <div
        class="vote-progress-fill"
        style="width: {Math.min(100, ($activeVote.yes_votes / $activeVote.required) * 100)}%"
      ></div>
    </div>
    <button
      type="button"
      class="vote-btn"
      disabled={alreadyVoted}
      on:click={castVoteAndTrack}
    >
      {alreadyVoted ? '✓ Voted' : '👍 Vote Yes'}
    </button>
  </div>
{/if}

<style>
  .vote-banner {
    background: var(--bg-elevated);
    border: 1px solid var(--accent);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }

  .vote-info {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .vote-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .vote-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .vote-title {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .vote-title em {
    font-style: normal;
    color: var(--accent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    max-width: 180px;
    vertical-align: bottom;
  }

  .vote-sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  .vote-progress-bar {
    height: 4px;
    background: var(--bg-base);
    border-radius: 2px;
    overflow: hidden;
  }

  .vote-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .vote-btn {
    align-self: flex-end;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 14px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .vote-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .vote-btn:not(:disabled):hover {
    opacity: 0.85;
  }
</style>
