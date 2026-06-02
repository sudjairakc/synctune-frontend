<script>
  // 1. Imports
  import { fade } from 'svelte/transition'
  import { pressable, shake, inputFocus } from '$lib/motionActions.js'
  import { currentUser } from '$lib/stores.js'
  import { Plus, Link, AlertCircle, Radio } from 'lucide-svelte'

  // 2. Props
  export let ws = null

  // 3. Local State
  let youtubeUrl = ''
  let addedBy = ''
  let errorMessage = ''
  let isSubmitting = false
  let urlInput

  // 5. Event Handlers
  function handleSubmit() {
    errorMessage = ''

    if (!youtubeUrl.trim()) {
      errorMessage = 'Please enter a YouTube or TikTok URL'
      shake(urlInput)
      return
    }

    if (!isValidURL(youtubeUrl.trim())) {
      errorMessage = 'Invalid URL. Please use a YouTube or TikTok URL'
      shake(urlInput)
      return
    }

    if (isShortTikTokURL(youtubeUrl.trim())) {
      errorMessage = 'TikTok short link ไม่รองรับ — กรุณาเปิดลิงก์ในเบราว์เซอร์แล้วคัดลอก URL จาก address bar (ควรมี /video/ อยู่ใน URL)'
      shake(urlInput)
      return
    }

    if (!ws) {
      errorMessage = 'Not connected. Please wait a moment'
      return
    }

    isSubmitting = true
    try {
      const payload = { video_url: youtubeUrl.trim() }
      if (!$currentUser) payload.added_by = addedBy.trim() || 'Anonymous'
      ws.send('add_song', payload)
      youtubeUrl = ''
      errorMessage = ''
    } catch (err) {
      console.error('[AddSong] send failed:', err)
      errorMessage = 'Failed to send request. Please try again'
    } finally {
      isSubmitting = false
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') handleSubmit()
  }

  function isValidURL(url) {
    return isValidYouTubeURL(url) || isValidTikTokURL(url)
  }

  function isValidYouTubeURL(url) {
    return /^https?:\/\/(www\.)?(youtube\.com\/(watch\?.*v=|shorts\/|live\/|music\/watch\?.*v=)|music\.youtube\.com\/watch\?.*v=|youtu\.be\/)[\w-]{11}/.test(url)
  }

  function isValidTikTokURL(url) {
    return /^https?:\/\/(www\.|m\.|vt\.|vm\.)?tiktok\.com\//.test(url)
  }

  function isShortTikTokURL(url) {
    return /^https?:\/\/(vt\.|vm\.)tiktok\.com\//.test(url) ||
      /^https?:\/\/(www\.)?tiktok\.com\/t\//.test(url)
  }

  function isLiveYouTubeURL(url) {
    return /youtube\.com\/live\//.test(url)
  }

  $: liveWarning = youtubeUrl && isLiveYouTubeURL(youtubeUrl.trim())
</script>

<div class="add-song">
  <h3>
    <Plus size="18" strokeWidth="2.2" />
    <span>Add Song</span>
  </h3>

  <div class="input-row">
    <input
      bind:this={urlInput}
      type="text"
      use:inputFocus
      bind:value={youtubeUrl}
      on:keydown={handleKeydown}
      placeholder="YouTube or TikTok URL"
      class="url-input"
      class:error={errorMessage}
      disabled={isSubmitting}
    />
    {#if !$currentUser}
      <input
        type="text"
        use:inputFocus
        bind:value={addedBy}
        on:keydown={handleKeydown}
        placeholder="Added by (optional)"
        class="name-input"
        maxlength="30"
        disabled={isSubmitting}
      />
    {/if}
    <button
      use:pressable
      on:click={handleSubmit}
      disabled={isSubmitting || !youtubeUrl.trim()}
      class="add-btn"
      aria-label="Add song"
    >
      {#if isSubmitting}
        <span class="spinner"></span>
      {:else}
        <Plus size="18" strokeWidth="2.5" />
      {/if}
    </button>
  </div>

  {#if liveWarning}
    <p class="live-text" in:fade={{ duration: 150 }}><Radio size="13" strokeWidth="2.2" /><span>Live stream — will play from live edge</span></p>
  {/if}
  {#if errorMessage}
    <p class="error-text" in:fade={{ duration: 150 }}><AlertCircle size="13" strokeWidth="2.2" /><span>{errorMessage}</span></p>
  {/if}
</div>

<style>
  .add-song {
    padding: 20px;
    background: var(--bg-surface);
    backdrop-filter: var(--blur-bg);
    -webkit-backdrop-filter: var(--blur-bg);
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-1);
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

  h3 :global(svg) { color: var(--accent); }

  .input-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .url-input {
    flex: 1;
    min-width: 200px;
  }

  .name-input {
    width: 150px;
  }

  input {
    padding: 11px 14px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  input::placeholder { color: var(--text-muted); }
  input:focus {
    border-color: var(--border-focus);
    box-shadow: var(--accent-glow);
  }
  input.error {
    border-color: var(--status-disconnected);
    box-shadow: 0 0 0 4px rgba(255, 69, 58, 0.18);
  }
  input:disabled { opacity: 0.5; }

  .add-btn {
    padding: 0;
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, var(--yt-red) 0%, var(--yt-red-hover) 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: opacity 0.2s, box-shadow 0.25s;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(255, 55, 95, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    will-change: transform;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: white;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .add-btn:hover:not(:disabled) {
    box-shadow: 0 8px 20px rgba(255, 55, 95, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .add-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

  .live-text,
  .error-text {
    margin: 10px 0 0 0;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .live-text { color: var(--status-connecting); }
  .error-text { color: var(--status-disconnected); }
</style>
