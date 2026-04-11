<script>
  import { createEventDispatcher } from 'svelte'

  export let visible = true

  const dispatch = createEventDispatcher()

  let username = ''
  let roomId = ''
  let error = ''

  function handleSubmit() {
    const name = username.trim()
    if (!name) {
      error = 'กรุณาใส่ชื่อ'
      return
    }
    if (name.length > 30) {
      error = 'ชื่อยาวเกินไป (สูงสุด 30 ตัวอักษร)'
      return
    }
    const room = roomId.trim()
    if (room && !/^\d{6}$/.test(room)) {
      error = 'Room ID ต้องเป็นตัวเลข 6 หลัก'
      return
    }
    dispatch('join', { username: name, room_id: room || null })
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') handleSubmit()
  }
</script>

{#if visible}
  <div class="overlay">
    <div class="modal">
      <h2 class="modal-title">ยินดีต้อนรับสู่ SyncTune</h2>
      <p class="modal-sub">ใส่ชื่อของคุณเพื่อเข้าร่วม</p>

      <input
        type="text"
        bind:value={username}
        on:keydown={handleKeydown}
        placeholder="ชื่อของคุณ"
        maxlength="30"
        class="name-input"
        class:error={!!error}
        autofocus
      />

      <div class="room-row">
        <input
          type="text"
          bind:value={roomId}
          on:keydown={handleKeydown}
          placeholder="Room ID (6 หลัก) — ว่างไว้ = สร้างห้องใหม่"
          maxlength="6"
          class="name-input room-input"
          class:error={!!error && /Room/.test(error)}
          inputmode="numeric"
          pattern="\d*"
        />
      </div>

      {#if error}
        <p class="error-text">{error}</p>
      {/if}

      <button class="join-btn" on:click={handleSubmit} disabled={!username.trim()}>
        เข้าร่วม
      </button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 32px;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow);
  }

  .modal-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    text-align: center;
  }

  .modal-sub {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
    text-align: center;
  }

  .name-input {
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
  }

  .name-input::placeholder { color: var(--text-muted); }
  .name-input:focus { border-color: var(--accent); }
  .name-input.error { border-color: #ff4444; }

  .room-row { display: flex; gap: 8px; }
  .room-input { font-size: 14px; letter-spacing: 0.05em; }

  .error-text {
    margin: 0;
    font-size: 13px;
    color: #ff4444;
  }

  .join-btn {
    padding: 10px;
    background: var(--yt-red);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .join-btn:hover:not(:disabled) { background: var(--yt-red-hover); }
  .join-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
