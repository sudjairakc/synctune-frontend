<script>
  // 1. Imports
  import { autoplay, shuffle, randomPlay } from '$lib/stores.js'

  // 2. Props
  export let ws = null

  // 3. Event Handlers
  function sendMode(field, value) {
    console.log('sendMode', field, value)
    if (!ws) return
    try {
      ws.send('set_playback_mode', { [field]: value })
    } catch (err) {
      console.error('[PlaybackControls] send failed:', err)
    }
  }

  function toggleAutoplay() {
    sendMode('autoplay', !$autoplay)
  }

  function toggleShuffle() {
    // shuffle และ random_play ไม่ควรเปิดพร้อมกัน
    sendMode('shuffle', !$shuffle)
  }

  function toggleRandom() {
    // random_play และ shuffle ไม่ควรเปิดพร้อมกัน
    sendMode('random_play', !$randomPlay)
  }
</script>

<div class="controls">
  <button
    class="ctrl-btn"
    class:active={$autoplay}
    on:click={toggleAutoplay}
    title="เล่นอัตโนมัติ"
    aria-pressed={$autoplay}
  >
    <span class="icon">↻</span>
    <span class="label">เล่นต่อ</span>
  </button>

  <button
    class="ctrl-btn"
    class:active={$shuffle}
    class:disabled={$randomPlay}
    on:click={toggleShuffle}
    disabled={$randomPlay}
    title={$randomPlay ? 'ปิด Random ก่อนใช้ Shuffle' : 'สลับลำดับคิว'}
    aria-pressed={$shuffle}
  >
    <span class="icon">⇄</span>
    <span class="label">สลับคิว</span>
  </button>

  <button
    class="ctrl-btn"
    class:active={$randomPlay}
    class:disabled={$shuffle}
    on:click={toggleRandom}
    disabled={$shuffle}
    title={$shuffle ? 'ปิด Shuffle ก่อนใช้ Random' : 'สุ่มเพลง'}
    aria-pressed={$randomPlay}
  >
    <span class="icon">⚄</span>
    <span class="label">สุ่มเพลง</span>
  </button>
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }

  .ctrl-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    user-select: none;
  }

  .ctrl-btn:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--accent);
  }

  .ctrl-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .ctrl-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .icon {
    font-size: 15px;
    line-height: 1;
  }

  .label {
    font-size: 12px;
  }
</style>
