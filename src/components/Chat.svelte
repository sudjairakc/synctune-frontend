<script>
  import { afterUpdate } from 'svelte'
  import { chatHistory, onlineUsers, currentUser } from '$lib/stores.js'

  export let ws = null

  let messageText = ''
  let listEl
  let autoScroll = true
  let ttsEnabled = false
  let lastReadId = null

  $: if (ttsEnabled && $chatHistory.length > 0) {
    const lastMsg = $chatHistory[$chatHistory.length - 1]
    if (lastMsg.id !== lastReadId) {
      lastReadId = lastMsg.id
      const label = `${lastMsg.user.username} พูดว่า ${lastMsg.text}`
      const utt = new SpeechSynthesisUtterance(label)
      utt.lang = 'th-TH'
      speechSynthesis.cancel()
      speechSynthesis.speak(utt)
    }
  }

  const MAX_LENGTH = 500

  $: charsLeft = MAX_LENGTH - messageText.length

  afterUpdate(() => {
    if (autoScroll && listEl) {
      listEl.scrollTop = listEl.scrollHeight
    }
  })

  function handleScroll() {
    if (!listEl) return
    const atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40
    autoScroll = atBottom
  }

  function handleSend() {
    const text = messageText.trim()
    if (!text || !ws) return
    try {
      ws.send('send_message', { text })
      messageText = ''
      autoScroll = true
    } catch (err) {
      console.error('[Chat] send failed:', err)
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  function isOwnMessage(msg) {
    return $currentUser && msg.user.id === $currentUser.id
  }
</script>

<div class="chat">
  <div class="chat-header">
    <span class="chat-title">Chat</span>
    <div class="header-right">
      <button
        class="tts-btn"
        class:active={ttsEnabled}
        on:click={() => { ttsEnabled = !ttsEnabled; if (!ttsEnabled) speechSynthesis.cancel() }}
        title={ttsEnabled ? 'ปิดอ่านข้อความ' : 'เปิดอ่านข้อความ'}
      >
        {ttsEnabled ? '🔊' : '🔇'}
      </button>
      <div class="online-count" title="Online users">
        <span class="online-dot"></span>
        {$onlineUsers.length} online
      </div>
    </div>
  </div>

  <!-- Online users -->
  {#if $onlineUsers.length > 0}
    <div class="online-list">
      {#each $onlineUsers as user (user.id)}
        <div class="online-user" title={user.username}>
          {#if user.profile_img}
            <img class="avatar" src={user.profile_img} alt={user.username} />
          {:else}
            <div class="avatar avatar-placeholder">{user.username[0].toUpperCase()}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Messages -->
  <div class="message-list" bind:this={listEl} on:scroll={handleScroll}>
    {#if $chatHistory.length === 0}
      <p class="empty">No messages yet</p>
    {:else}
      {#each $chatHistory as msg (msg.id)}
        <div class="message" class:own={isOwnMessage(msg)}>
          {#if !isOwnMessage(msg)}
            {#if msg.user.profile_img}
              <img class="msg-avatar" src={msg.user.profile_img} alt={msg.user.username} />
            {:else}
              <div class="msg-avatar avatar-placeholder">{msg.user.username[0].toUpperCase()}</div>
            {/if}
          {/if}
          <div class="msg-body">
            {#if !isOwnMessage(msg)}
              <span class="msg-username">{msg.user.username}</span>
            {/if}
            <div class="msg-bubble">
              <span class="msg-text">{msg.text}</span>
              <span class="msg-time">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input -->
  <div class="chat-input-row">
    <textarea
      bind:value={messageText}
      on:keydown={handleKeydown}
      placeholder="Type a message..."
      maxlength={MAX_LENGTH}
      rows="1"
      class="chat-input"
      class:warn={charsLeft < 50}
    ></textarea>
    <button class="send-btn" on:click={handleSend} disabled={!messageText.trim()} title="Send (Enter)">
      ➤
    </button>
  </div>
  {#if charsLeft < 100}
    <div class="char-count" class:warn={charsLeft < 50}>{charsLeft}</div>
  {/if}
</div>

<style>
  .chat {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .chat-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tts-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    line-height: 1;
    color: var(--text-muted);
    transition: border-color 0.15s, background 0.15s;
  }

  .tts-btn.active {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }

  .tts-btn:hover { border-color: var(--accent); }

  .online-count {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .online-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--status-connected);
    flex-shrink: 0;
  }

  .online-list {
    display: flex;
    gap: 6px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .online-user { display: flex; }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--bg-base);
  }

  .avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: white;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 2px solid var(--bg-base);
  }

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 200px;
    max-height: 320px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
    margin: auto;
  }

  .message {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .message.own {
    flex-direction: row-reverse;
  }

  .msg-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .msg-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 75%;
  }

  .message.own .msg-body { align-items: flex-end; }

  .msg-username {
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 4px;
  }

  .msg-bubble {
    background: var(--bg-elevated);
    border-radius: 12px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .message.own .msg-bubble {
    background: var(--accent);
    color: white;
  }

  .msg-text {
    font-size: 13px;
    line-height: 1.4;
    word-break: break-word;
    white-space: pre-wrap;
  }

  .msg-time {
    font-size: 10px;
    color: var(--text-muted);
    align-self: flex-end;
  }

  .message.own .msg-time { color: rgba(255,255,255,0.65); }

  .chat-input-row {
    display: flex;
    gap: 6px;
    padding: 10px 14px 6px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    resize: none;
    line-height: 1.4;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  .chat-input::placeholder { color: var(--text-muted); }
  .chat-input:focus { border-color: var(--accent); }
  .chat-input.warn { border-color: #ff9800; }

  .send-btn {
    background: var(--yt-red);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    width: 36px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    flex-shrink: 0;
    align-self: flex-end;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-btn:hover:not(:disabled) { background: var(--yt-red-hover); }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .char-count {
    font-size: 11px;
    color: var(--text-muted);
    text-align: right;
    padding: 0 14px 8px;
    flex-shrink: 0;
  }

  .char-count.warn { color: #ff9800; }
</style>
