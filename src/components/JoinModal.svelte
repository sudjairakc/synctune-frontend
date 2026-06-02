<script>
  import { createEventDispatcher } from 'svelte'
  import { fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { pressable, shake, modalIn, inputFocus } from '$lib/motionActions.js'

  export let visible = true
  export let initialRoomId = ''

  const dispatch = createEventDispatcher()

  let username = ''
  let roomId = initialRoomId
  let error = ''
  let usernameInput

  function handleSubmit() {
    const name = username.trim()
    if (!name) {
      error = 'Please enter a name'
      shake(usernameInput)
      return
    }
    if (name.length > 30) {
      error = 'Name is too long (max 30 characters)'
      shake(usernameInput)
      return
    }
    const room = roomId.trim()
    if (room && !/^\d{6}$/.test(room)) {
      error = 'Room ID must be a 6-digit number'
      return
    }
    dispatch('join', { username: name, room_id: room || null })
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') handleSubmit()
  }
</script>

{#if visible}
  <div class="overlay" transition:fade={{ duration: 220 }}>
    <div class="modal" use:modalIn>
      <h2 class="modal-title">Welcome to SyncTune</h2>
      <p class="modal-sub">Enter your name to join</p>

      <input
        bind:this={usernameInput}
        type="text"
        use:inputFocus
        bind:value={username}
        on:keydown={handleKeydown}
        placeholder="Your name"
        maxlength="30"
        class="name-input"
        class:error={!!error}
        autofocus
      />

      <div class="room-row">
        <input
          type="text"
          use:inputFocus
          bind:value={roomId}
          on:keydown={handleKeydown}
          placeholder="Room ID (6 digits) — leave blank to create a new room"
          maxlength="6"
          class="name-input room-input"
          class:error={!!error && /Room/.test(error)}
          inputmode="numeric"
          pattern="\d*"
        />
      </div>

      {#if error}
        <p class="error-text" in:fade={{ duration: 150 }}>{error}</p>
      {/if}

      <button class="join-btn" use:pressable on:click={handleSubmit} disabled={!username.trim()}>
        Join
      </button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
  }

  .modal {
    background: var(--bg-surface-solid);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 40px 36px 32px;
    width: calc(100% - 32px);
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: var(--shadow-3);
    will-change: transform;
  }

  .modal-title {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    color: var(--text-primary);
    text-align: center;
    letter-spacing: -0.03em;
  }

  .modal-sub {
    margin: 0 0 10px;
    font-size: 15px;
    color: var(--text-muted);
    text-align: center;
    letter-spacing: -0.01em;
  }

  .name-input {
    padding: 13px 16px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 15px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
  }

  .name-input::placeholder { color: var(--text-muted); }
  .name-input:focus {
    border-color: var(--accent);
    box-shadow: var(--accent-glow);
  }
  .name-input.error {
    border-color: var(--status-disconnected);
    box-shadow: 0 0 0 4px rgba(255, 69, 58, 0.18);
  }

  .room-row { display: flex; gap: 8px; }
  .room-input { font-size: 14px; letter-spacing: 0.05em; }

  .error-text {
    margin: 0;
    font-size: 13px;
    color: var(--status-disconnected);
    font-weight: 500;
  }

  .join-btn {
    padding: 14px;
    background: linear-gradient(180deg, var(--yt-red) 0%, var(--yt-red-hover) 100%);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: opacity 0.2s, box-shadow 0.25s;
    box-shadow: 0 6px 16px rgba(255, 55, 95, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    margin-top: 6px;
    will-change: transform;
  }

  .join-btn:hover:not(:disabled) {
    box-shadow: 0 10px 24px rgba(255, 55, 95, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .join-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
</style>
