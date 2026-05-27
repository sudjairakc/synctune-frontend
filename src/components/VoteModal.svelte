<script>
  import { onDestroy } from 'svelte'
  import { activeVote, currentUser } from '$lib/stores.js'

  export let ws = null

  let countdown = 30
  let timer = null

  // เริ่ม timer ใหม่ทุกครั้งที่มี vote ใหม่
  $: if ($activeVote) {
    const expiresAt = $activeVote.expires_at
    countdown = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
    clearInterval(timer)
    timer = setInterval(() => {
      countdown = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
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
  $: isBroadcastVote = $activeVote?.action === 'skip_broadcast'
</script>

{#if $activeVote && isBroadcastVote}
  <!-- Broadcast skip vote — overlay modal กลางหน้าจอ -->
  <div class="broadcast-overlay">
    <div class="broadcast-modal">
      <div class="broadcast-icon">📡</div>
      <h3 class="broadcast-title">Broadcast กำลังเล่น</h3>
      <p class="broadcast-desc">
        กด <strong>Skip</strong> ถ้าต้องการข้าม<br>
        ต้องทุกคนกดพร้อมกัน ถึงจะข้ามได้
      </p>
      <div class="broadcast-count">
        {$activeVote.yes_votes}/{$activeVote.required} คนกด skip · {countdown}s
      </div>
      <div class="vote-progress-bar">
        <div
          class="vote-progress-fill"
          style="width: {Math.min(100, ($activeVote.yes_votes / $activeVote.required) * 100)}%"
        ></div>
      </div>
      <button
        type="button"
        class="broadcast-skip-btn"
        disabled={alreadyVoted}
        on:click={castVoteAndTrack}
      >
        {alreadyVoted ? '✓ กดแล้ว' : '⏭ Skip Broadcast'}
      </button>
    </div>
  </div>
{:else if $activeVote}
  <!-- Vote ปกติ (remove/skip song) — overlay modal กลางหน้าจอ -->
  <div class="broadcast-overlay">
    <div class="broadcast-modal">
      <div class="broadcast-icon">{actionLabel === 'skip' ? '⏭' : '🗑'}</div>
      <h3 class="broadcast-title">{actionLabel === 'skip' ? 'โหวต Skip เพลง' : 'โหวตลบเพลง'}</h3>
      <p class="broadcast-desc">
        <strong>{$activeVote.initiated_by}</strong> ขอ{actionLabel === 'skip' ? 'ข้าม' : 'ลบ'}<br>
        <em>"{$activeVote.song_title}"</em>
      </p>
      <div class="broadcast-count">
        {$activeVote.yes_votes}/{$activeVote.required} โหวต (จาก {$activeVote.total} คน) · {countdown}s
      </div>
      <div class="vote-progress-bar">
        <div
          class="vote-progress-fill"
          style="width: {Math.min(100, ($activeVote.yes_votes / $activeVote.required) * 100)}%"
        ></div>
      </div>
      <button
        type="button"
        class="broadcast-skip-btn"
        disabled={alreadyVoted}
        on:click={castVoteAndTrack}
      >
        {alreadyVoted ? '✓ โหวตแล้ว' : '👍 โหวต Yes'}
      </button>
    </div>
  </div>
{/if}

<style>
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

  /* Vote overlay */
  .broadcast-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .broadcast-modal {
    background: var(--bg-elevated);
    border: 1px solid var(--accent);
    border-radius: 14px;
    padding: 28px 24px;
    max-width: 320px;
    width: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .broadcast-icon {
    font-size: 36px;
  }

  .broadcast-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .broadcast-desc {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .broadcast-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .broadcast-skip-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    padding: 10px 24px;
    cursor: pointer;
    transition: opacity 0.15s;
    width: 100%;
    margin-top: 4px;
  }

  .broadcast-skip-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .broadcast-skip-btn:not(:disabled):hover {
    opacity: 0.85;
  }
</style>
