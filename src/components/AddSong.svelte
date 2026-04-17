<script>
  // 1. Imports
  import { currentUser } from '$lib/stores.js'

  // 2. Props
  export let ws = null

  // 3. Local State
  let youtubeUrl = ''
  let addedBy = ''
  let errorMessage = ''
  let isSubmitting = false

  // 5. Event Handlers
  function handleSubmit() {
    errorMessage = ''

    if (!youtubeUrl.trim()) {
      errorMessage = 'Please enter a YouTube URL'
      return
    }

    if (!isValidYouTubeURL(youtubeUrl.trim())) {
      errorMessage = 'Invalid URL. Please use a YouTube URL'
      return
    }

    if (!ws) {
      errorMessage = 'Not connected. Please wait a moment'
      return
    }

    isSubmitting = true
    try {
      const payload = { youtube_url: youtubeUrl.trim() }
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

  function isValidYouTubeURL(url) {
    return /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/.test(url)
  }
</script>

<div class="add-song">
  <h3>Add Song</h3>

  <div class="input-row">
    <input
      type="text"
      bind:value={youtubeUrl}
      on:keydown={handleKeydown}
      placeholder="YouTube URL (youtube.com/watch?v=... or youtu.be/...)"
      class="url-input"
      class:error={errorMessage}
      disabled={isSubmitting}
    />
    {#if !$currentUser}
      <input
        type="text"
        bind:value={addedBy}
        on:keydown={handleKeydown}
        placeholder="Added by (optional)"
        class="name-input"
        maxlength="30"
        disabled={isSubmitting}
      />
    {/if}
    <button
      on:click={handleSubmit}
      disabled={isSubmitting || !youtubeUrl.trim()}
      class="add-btn"
    >
      {isSubmitting ? 'Adding...' : 'Add'}
    </button>
  </div>

  {#if errorMessage}
    <p class="error-text">{errorMessage}</p>
  {/if}
</div>

<style>
  .add-song {
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 8px;
    margin-bottom: 16px;
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
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  input::placeholder { color: var(--text-muted); }
  input:focus { border-color: var(--border-focus); }
  input.error { border-color: #ff4444; }
  input:disabled { opacity: 0.6; }

  .add-btn {
    padding: 8px 20px;
    background: var(--yt-red);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
    white-space: nowrap;
  }

  .add-btn:hover:not(:disabled) { background: var(--yt-red-hover); }
  .add-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .error-text {
    margin: 8px 0 0 0;
    color: #ff4444;
    font-size: 13px;
  }
</style>
