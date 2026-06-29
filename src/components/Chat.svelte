<script>
  import { afterUpdate, onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { inputFocus } from '$lib/motionActions.js'
  import { chatHistory, onlineUsers, currentUser, ttsActive, soundEnabled, activeSpeaker, pinnedMessages } from '$lib/stores.js'
  import VoicePTT from './VoicePTT.svelte'
  import Suggestions from './Suggestions.svelte'

  export let ws = null

  $: speakingIds = new Set($activeSpeaker.map(s => s.user_id))

  let messageText = ''
  let listEl
  let autoScroll = true
  // seed ด้วยแชทล่าสุดที่มีอยู่ตอนเข้าห้อง — ไม่อ่าน TTS ข้อความเก่า อ่านเฉพาะข้อความใหม่หลัง join
  const initialChat = get(chatHistory)
  let lastReadId = initialChat.length ? initialChat[initialChat.length - 1].id : null

  // Reply / Thread state
  let replyTo = null     // ChatMessage being replied to
  let threadOf = null    // ChatMessage whose thread is open
  let imagePreview = null // { dataUrl, file }
  let fileInput

  // Emoji picker state
  let showEmojiPicker = false
  let reactingMsgId = null   // message ID showing reaction picker

  // Image lightbox
  let lightboxSrc = null
  function openLightbox(src) { lightboxSrc = src }
  function closeLightbox() { lightboxSrc = null }
  function handleLightboxKey(e) { if (e.key === 'Escape') closeLightbox() }

  // Pinned bar
  let pinsExpanded = false

  const MAX_LENGTH = 500

  $: charsLeft = MAX_LENGTH - messageText.length

  // TTS
  $: if ($soundEnabled && $chatHistory.length > 0) {
    const lastMsg = $chatHistory[$chatHistory.length - 1]
    if (lastMsg.id !== lastReadId && !lastMsg.deleted) {
      lastReadId = lastMsg.id
      const label = `${lastMsg.user.username} พูดว่า ${lastMsg.text}`
      const utt = new SpeechSynthesisUtterance(label)
      utt.lang = 'th-TH'
      utt.rate = 0.75
      utt.onstart = () => ttsActive.set(true)
      utt.onend = () => ttsActive.set(false)
      utt.onerror = () => ttsActive.set(false)
      speechSynthesis.cancel()
      speechSynthesis.speak(utt)
    }
  }

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
    if (!text && !imagePreview) return
    if (!ws) return
    try {
      const payload = { text }
      if (replyTo) payload.reply_to_id = replyTo.id
      if (threadOf) payload.thread_id = threadOf.id
      if (imagePreview) payload.image_data = imagePreview.dataUrl
      ws.send('send_message', payload)
      messageText = ''
      imagePreview = null
      replyTo = null
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
    if (e.key === 'Escape') {
      replyTo = null
      threadOf = null
      showEmojiPicker = false
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  function isOwnMessage(msg) {
    return $currentUser && msg.user.id === $currentUser.id
  }

  // ---- Delete ----
  function deleteMessage(msgId) {
    if (!ws) return
    ws.send('delete_message', { message_id: msgId })
  }

  // ---- React ----
  function openReactPicker(e, msgId) {
    e.stopPropagation()
    if (reactingMsgId === msgId) {
      reactingMsgId = null
      return
    }
    reactingMsgId = msgId
    showEmojiPicker = false
  }

  function sendReaction(emoji) {
    if (!ws || !reactingMsgId) return
    ws.send('react_message', { message_id: reactingMsgId, emoji })
    reactingMsgId = null
  }

  // ---- Pin ----
  function togglePin(msgId) {
    if (!ws) return
    ws.send('pin_message', { message_id: msgId })
  }

  // ---- Reply ----
  function startReply(msg) {
    replyTo = msg
    threadOf = null
    showEmojiPicker = false
    reactingMsgId = null
  }

  // ---- Thread ----
  function openThread(msg) {
    threadOf = msg
    replyTo = null
    showEmojiPicker = false
    reactingMsgId = null
  }

  // ---- Emoji picker (input) ----
  function insertEmoji(emoji) {
    messageText += emoji
    showEmojiPicker = false
  }

  // ---- Image upload ----
  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      imagePreview = { dataUrl: ev.target.result, file }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeImage() {
    imagePreview = null
  }

  // ---- Thread messages ----
  $: threadMessages = threadOf
    ? $chatHistory.filter(m => m.thread_id === threadOf.id)
    : []

  // ---- Main messages (exclude thread-only messages) ----
  $: mainMessages = $chatHistory.filter(m => !m.thread_id)

  // ---- Reply counts per message ----
  $: replyCounts = $chatHistory.reduce((acc, m) => {
    if (m.thread_id) acc[m.thread_id] = (acc[m.thread_id] || 0) + 1
    return acc
  }, {})

  // ---- Close pickers on outside click ----
  function handleDocClick() {
    showEmojiPicker = false
    reactingMsgId = null
  }

  onMount(() => document.addEventListener('click', handleDocClick))
  onDestroy(() => document.removeEventListener('click', handleDocClick))

  // ---- Emoji data (common emojis by category) ----
  const emojiCategories = [
    { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
    { label: 'People', emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👁','👀','👅','👄','💋','🫦'] },
    { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💔','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕊️','♾️'] },
    { label: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦅','🦆','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐛','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'] },
    { label: 'Food', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'] },
    { label: 'Objects', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🥌','🎿','⛷','🏂','🪂','🏋','🤼','🤸','⛹','🤺','🤾','🏌','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🏵','🎗','🎫','🎟','🎪','🎭','🎨','🎬','🎤','🎧','🎼','🎵','🎶','🎹','🥁','🪘','🎷','🎺','🎸','🪗','🎻','🎲','♟','🎯','🎳','🎮','🎰','🧩'] },
    { label: 'Symbols', emojis: ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','❤','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','⬛','⬜','◼','◻','◾','◽','▪','▫','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','⁉️','❓','❔','❕','❗','🔅','🔆','🔱','⚜','🔰','♻','✅','❎','🆘','💯','✔️','❌','🚫','🔞','✨','🌟','⭐','🌠','🎇','🎆','🌈','☀️','⛅','🌤','🌥','☁️','🌦','🌧','⛈','🌩','🌨','❄️','☃️','⛄','🌬','💨','💧','💦','☔','☂️','🌊','🌀'] },
  ]

  let activeEmojiCat = 0
  let activeReactCat = 0
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="chat" role="region" aria-label="Chat" on:click|stopPropagation on:keydown>
  <!-- Header -->
  <div class="chat-header">
    <span class="chat-title">Chat</span>
    <div class="header-right">
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
        <div class="online-user" class:speaking={speakingIds.has(user.id)} data-tooltip={user.username}>
          {#if user.profile_img}
            <img class="avatar" src={user.profile_img} alt={user.username} />
          {:else}
            <div class="avatar avatar-placeholder">{user.username[0].toUpperCase()}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Pinned Messages Bar -->
  {#if $pinnedMessages.length > 0}
    <div class="pins-bar">
      <div class="pins-header" role="button" tabindex="0" on:click={() => pinsExpanded = !pinsExpanded} on:keydown={(e) => e.key === 'Enter' && (pinsExpanded = !pinsExpanded)}>
        <span class="pin-icon">📌</span>
        <span class="pin-label">
          {pinsExpanded ? `Pinned (${$pinnedMessages.length})` : ($pinnedMessages[0].deleted ? 'Message deleted' : ($pinnedMessages[0].text || '[image]'))}
        </span>
        <button class="pin-toggle" on:click|stopPropagation={() => pinsExpanded = !pinsExpanded}>
          {pinsExpanded ? '▲' : '▼'}
        </button>
      </div>
      {#if pinsExpanded}
        <div class="pins-list">
          {#each $pinnedMessages as pin (pin.id)}
            <div class="pin-item">
              <span class="pin-user">{pin.user.username}</span>
              <span class="pin-text">{pin.deleted ? '[Message deleted]' : (pin.text || '[image]')}</span>
              {#if $currentUser}
                <button class="pin-remove" title="Unpin" on:click={() => togglePin(pin.id)}>✕</button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Main area: messages + optional thread panel -->
  <div class="chat-body">
    <!-- Messages -->
    <div class="message-list" bind:this={listEl} on:scroll={handleScroll}>
      {#if mainMessages.length === 0}
        <p class="empty">No messages yet</p>
      {:else}
        {#each mainMessages as msg (msg.id)}
          {@const own = isOwnMessage(msg)}
          {@const threadCount = replyCounts[msg.id] || 0}
          <div class="message" class:own>
            {#if !own}
              {#if msg.user.profile_img}
                <img class="msg-avatar" src={msg.user.profile_img} alt={msg.user.username} />
              {:else}
                <div class="msg-avatar avatar-placeholder">{msg.user.username[0].toUpperCase()}</div>
              {/if}
            {/if}

            <div class="msg-body">
              {#if !own}
                <span class="msg-username">{msg.user.username}</span>
              {/if}

              <!-- Reply preview -->
              {#if msg.reply_to && !msg.deleted}
                <div class="reply-preview">
                  <span class="reply-user">{msg.reply_to.username}</span>
                  <span class="reply-text">{msg.reply_to.image_url ? '[image]' : msg.reply_to.text}</span>
                </div>
              {/if}

              <div class="msg-bubble" class:deleted={msg.deleted}>
                {#if msg.deleted}
                  <span class="msg-deleted">Message deleted</span>
                {:else}
                  {#if msg.text}
                    <span class="msg-text">{msg.text}</span>
                  {/if}
                  {#if msg.image_url}
                    <button class="msg-image-btn" on:click={() => openLightbox(msg.image_url)}>
                      <img class="msg-image" src={msg.image_url} alt="" loading="lazy" />
                    </button>
                  {/if}
                {/if}
                <span class="msg-time">{formatTime(msg.timestamp)}</span>
              </div>

              <!-- Reactions display -->
              {#if msg.reactions && Object.keys(msg.reactions).length > 0}
                <div class="reactions">
                  {#each Object.entries(msg.reactions) as [emoji, users]}
                    <button
                      class="reaction-btn"
                      class:reacted={$currentUser && users.includes($currentUser.id)}
                      on:click={() => ws && ws.send('react_message', { message_id: msg.id, emoji })}
                      title={users.join(', ')}
                    >
                      {emoji} {users.length}
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- Thread count -->
              {#if threadCount > 0}
                <button class="thread-btn" on:click={() => openThread(msg)}>
                  💬 {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
                </button>
              {/if}
            </div>

            <!-- Message actions (hover) -->
            {#if !msg.deleted}
              <div class="msg-actions" class:own>
                <!-- Emoji react -->
                <button class="action-btn" title="React" on:click={(e) => openReactPicker(e, msg.id)}>😊</button>
                <!-- Reply -->
                <button class="action-btn" title="Reply" on:click={() => startReply(msg)}>↩</button>
                <!-- Thread -->
                <button class="action-btn" title="Open thread" on:click={() => openThread(msg)}>💬</button>
                <!-- Pin -->
                {#if $currentUser}
                  <button class="action-btn" title="Pin" on:click={() => togglePin(msg.id)}>📌</button>
                {/if}
                <!-- Delete (own only) -->
                {#if own}
                  <button class="action-btn danger" title="Delete" on:click={() => deleteMessage(msg.id)}>🗑</button>
                {/if}

                <!-- Reaction picker for this message -->
                {#if reactingMsgId === msg.id}
                  <div class="react-picker" role="dialog" aria-label="Reaction picker" on:click|stopPropagation on:keydown|stopPropagation>
                    <div class="ep-cats">
                      {#each emojiCategories as cat, i}
                        <button class="ep-cat" class:active={activeReactCat === i} on:click={() => activeReactCat = i}>
                          {cat.emojis[0]}
                        </button>
                      {/each}
                    </div>
                    <div class="ep-grid">
                      {#each emojiCategories[activeReactCat].emojis as em}
                        <button class="ep-emoji" on:click={() => sendReaction(em)}>{em}</button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <!-- Thread Panel -->
    {#if threadOf}
      <div class="thread-panel">
        <div class="thread-header">
          <span>Thread</span>
          <button class="thread-close" on:click={() => { threadOf = null }}>✕</button>
        </div>
        <div class="thread-parent">
          <span class="thread-parent-user">{threadOf.user.username}</span>
          <span class="thread-parent-text">{threadOf.deleted ? '[deleted]' : (threadOf.text || '[image]')}</span>
        </div>
        <div class="thread-messages">
          {#each threadMessages as msg (msg.id)}
            {@const own = isOwnMessage(msg)}
            <div class="message" class:own style="padding: 4px 0">
              {#if !own}
                <div class="msg-avatar avatar-placeholder" style="width:20px;height:20px;font-size:9px">{msg.user.username[0].toUpperCase()}</div>
              {/if}
              <div class="msg-body">
                {#if !own}<span class="msg-username">{msg.user.username}</span>{/if}
                <div class="msg-bubble" class:deleted={msg.deleted}>
                  {#if msg.deleted}<span class="msg-deleted">deleted</span>
                  {:else}
                    {#if msg.text}<span class="msg-text">{msg.text}</span>{/if}
                    {#if msg.image_url}<button class="msg-image-btn" on:click={() => openLightbox(msg.image_url)}><img class="msg-image" src={msg.image_url} alt="img" loading="lazy" /></button>{/if}
                  {/if}
                  <span class="msg-time">{formatTime(msg.timestamp)}</span>
                </div>
                {#if msg.reactions && Object.keys(msg.reactions).length > 0}
                  <div class="reactions">
                    {#each Object.entries(msg.reactions) as [emoji, users]}
                      <button class="reaction-btn" class:reacted={$currentUser && users.includes($currentUser.id)}
                        on:click={() => ws && ws.send('react_message', { message_id: msg.id, emoji })}>{emoji} {users.length}</button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/each}
          {#if threadMessages.length === 0}
            <p class="empty" style="font-size:12px">No replies yet</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Reply context bar -->
  {#if replyTo}
    <div class="reply-bar">
      <span class="reply-bar-label">↩ Replying to <strong>{replyTo.user.username}</strong>:</span>
      <span class="reply-bar-text">{replyTo.text || '[image]'}</span>
      <button class="reply-bar-close" on:click={() => replyTo = null}>✕</button>
    </div>
  {/if}

  <!-- Image preview -->
  {#if imagePreview}
    <div class="image-preview">
      <img src={imagePreview.dataUrl} alt="preview" />
      <button class="img-remove" on:click={removeImage}>✕</button>
    </div>
  {/if}

  <Suggestions {ws} />

  <!-- Input row -->
  <div class="chat-input-row" role="group" aria-label="Message input" on:click|stopPropagation on:keydown|stopPropagation>
    <!-- Emoji picker button -->
    <div class="emoji-wrap">
      <button class="icon-btn" title="Emoji" on:click|stopPropagation={() => { showEmojiPicker = !showEmojiPicker; reactingMsgId = null }}>
        😊
      </button>
      {#if showEmojiPicker}
        <div class="emoji-picker" role="dialog" aria-label="Emoji picker" on:click|stopPropagation on:keydown|stopPropagation>
          <div class="ep-cats">
            {#each emojiCategories as cat, i}
              <button class="ep-cat" class:active={activeEmojiCat === i} on:click={() => activeEmojiCat = i}>
                {cat.emojis[0]}
              </button>
            {/each}
          </div>
          <div class="ep-grid">
            {#each emojiCategories[activeEmojiCat].emojis as em}
              <button class="ep-emoji" on:click={() => insertEmoji(em)}>{em}</button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Image upload button -->
    <button class="icon-btn" title="Attach image" on:click={() => fileInput.click()}>🖼</button>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/*"
      style="display:none"
      on:change={handleFileChange}
    />

    <textarea
      use:inputFocus
      bind:value={messageText}
      on:keydown={handleKeydown}
      placeholder={threadOf ? 'Reply in thread...' : 'Type a message...'}
      maxlength={MAX_LENGTH}
      rows="1"
      class="chat-input"
      class:warn={charsLeft < 50}
    ></textarea>
    <button class="send-btn" on:click={handleSend} disabled={!messageText.trim() && !imagePreview} title="Send (Enter)">
      ➤
    </button>
  </div>
  {#if charsLeft < 100}
    <div class="char-count" class:warn={charsLeft < 50}>{charsLeft}</div>
  {/if}
  <VoicePTT {ws} />
</div>

{#if lightboxSrc}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="lightbox-overlay" on:click={closeLightbox} on:keydown={handleLightboxKey} tabindex="-1">
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
    <img class="lightbox-img" src={lightboxSrc} alt="" on:click|stopPropagation />
    <button class="lightbox-close" on:click={closeLightbox}>✕</button>
  </div>
{/if}

<style>
  .chat {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }

  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .chat-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .header-right { display: flex; align-items: center; gap: 8px; }

  .online-count {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .online-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--status-connected);
  }

  .online-list {
    display: flex;
    gap: 6px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .online-user { display: flex; position: relative; }

  .online-user::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 10;
  }

  .online-user:hover::after { opacity: 1; }

  .online-user.speaking .avatar,
  .online-user.speaking .avatar-placeholder {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent);
    animation: speaking-pulse 1.2s ease-in-out infinite;
  }

  @keyframes speaking-pulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--accent); }
    50% { box-shadow: 0 0 0 4px var(--accent); }
  }

  .avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--bg-base);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .avatar-placeholder {
    width: 28px; height: 28px;
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
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  /* ---- Pins bar ---- */
  .pins-bar {
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-elevated);
  }

  .pins-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    cursor: pointer;
    user-select: none;
  }

  .pin-icon { font-size: 13px; }

  .pin-label {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pin-toggle {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
  }

  .pins-list {
    border-top: 1px solid var(--border);
    max-height: 120px;
    overflow-y: auto;
  }

  .pin-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }

  .pin-user {
    color: var(--accent);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pin-text {
    flex: 1;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pin-remove {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    flex-shrink: 0;
  }

  .pin-remove:hover { color: var(--yt-red); }

  /* ---- Chat body ---- */
  .chat-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ---- Message list ---- */
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

  /* ---- Thread panel ---- */
  .thread-panel {
    width: 220px;
    flex-shrink: 0;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
  }

  .thread-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .thread-close {
    background: none; border: none;
    color: var(--text-muted); cursor: pointer; font-size: 12px;
  }

  .thread-parent {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    border-left: 2px solid var(--accent);
    margin: 4px 8px;
    border-radius: 2px;
    font-size: 11px;
  }

  .thread-parent-user { color: var(--accent); font-weight: 600; display: block; }
  .thread-parent-text { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

  .thread-messages {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ---- Message ---- */
  .message {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    position: relative;
  }

  .message.own { flex-direction: row-reverse; }

  .message:hover .msg-actions { opacity: 1; pointer-events: all; }

  .msg-avatar {
    width: 26px; height: 26px;
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

  .msg-username { font-size: 11px; color: var(--text-muted); padding: 0 4px; }

  /* ---- Reply preview in bubble ---- */
  .reply-preview {
    background: var(--bg-base);
    border-left: 2px solid var(--accent);
    border-radius: 4px;
    padding: 3px 7px;
    margin-bottom: 2px;
    font-size: 11px;
    display: flex;
    gap: 5px;
    align-items: baseline;
    max-width: 100%;
    overflow: hidden;
  }

  .reply-user { color: var(--accent); font-weight: 600; white-space: nowrap; flex-shrink: 0; }
  .reply-text { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ---- Bubble ---- */
  .msg-bubble {
    background: var(--bg-elevated);
    border-radius: 16px;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .message.own .msg-bubble { background: var(--accent); color: white; }
  .msg-bubble.deleted { opacity: 0.5; font-style: italic; }

  .msg-deleted { font-size: 12px; color: var(--text-muted); }

  .msg-text { font-size: 14px; line-height: 1.45; word-break: break-word; white-space: pre-wrap; }

  .msg-image {
    max-width: 200px;
    max-height: 180px;
    border-radius: 6px;
    object-fit: contain;
    cursor: pointer;
  }

  .msg-time { font-size: 10px; color: var(--text-muted); align-self: flex-end; }
  .message.own .msg-time { color: rgba(255,255,255,0.65); }

  /* ---- Reactions ---- */
  .reactions { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }

  .reaction-btn {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1px 6px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-primary);
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .reaction-btn:hover { background: var(--bg-base); }
  .reaction-btn.reacted { background: var(--accent); color: white; border-color: var(--accent); }

  /* ---- Thread button ---- */
  .thread-btn {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 11px;
    cursor: pointer;
    padding: 2px 0;
    text-align: left;
  }

  .thread-btn:hover { text-decoration: underline; }

  /* ---- Message actions ---- */
  .msg-actions {
    position: absolute;
    top: -2px;
    right: -2px;
    display: flex;
    gap: 2px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 20;
  }

  .msg-actions.own { right: auto; left: -2px; }

  .action-btn {
    background: none;
    border: none;
    font-size: 13px;
    cursor: pointer;
    padding: 2px 3px;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.1s;
  }

  .action-btn:hover { background: var(--bg-base); }
  .action-btn.danger:hover { background: rgba(255, 50, 50, 0.15); }

  /* ---- Reaction picker (inline) ---- */
  .react-picker {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px;
    z-index: 100;
    box-shadow: var(--shadow);
    width: 240px;
  }

  /* ---- Emoji picker (main input) ---- */
  .emoji-wrap { position: relative; }

  .emoji-picker {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px;
    z-index: 100;
    box-shadow: var(--shadow);
    width: 260px;
  }

  .ep-cats {
    display: flex;
    gap: 2px;
    margin-bottom: 5px;
    flex-wrap: wrap;
  }

  .ep-cat {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 3px;
    border-radius: 4px;
    opacity: 0.6;
    transition: opacity 0.1s, background 0.1s;
  }

  .ep-cat:hover, .ep-cat.active { opacity: 1; background: var(--bg-base); }

  .ep-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
    max-height: 160px;
    overflow-y: auto;
  }

  .ep-emoji {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 3px;
    border-radius: 4px;
    line-height: 1;
    transition: background 0.1s;
  }

  .ep-emoji:hover { background: var(--bg-base); }

  /* ---- Reply bar ---- */
  .reply-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border);
    font-size: 12px;
    flex-shrink: 0;
  }

  .reply-bar-label { color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
  .reply-bar-text { flex: 1; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .reply-bar-close {
    background: none; border: none;
    color: var(--text-muted); cursor: pointer; font-size: 13px;
    flex-shrink: 0;
  }

  /* ---- Image preview ---- */
  .image-preview {
    position: relative;
    padding: 6px 14px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .image-preview img {
    max-height: 80px;
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .img-remove {
    position: absolute;
    top: 4px;
    left: 28px;
    background: rgba(0,0,0,0.6);
    border: none;
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ---- Input row ---- */
  .chat-input-row {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    padding: 10px 14px 6px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 5px;
    border-radius: 6px;
    transition: background 0.1s;
    flex-shrink: 0;
    line-height: 1;
  }

  .icon-btn:hover { background: var(--bg-elevated); }

  .chat-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-base);
    color: var(--text-primary);
    font-size: 14px;
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
    border-radius: 12px;
    color: white;
    font-size: 16px;
    width: 42px;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    flex-shrink: 0;
    height: 42px;
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

  .msg-image-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: block;
  }

  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .lightbox-img {
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
    object-fit: contain;
  }

  .lightbox-close {
    position: absolute;
    top: 16px;
    right: 20px;
    background: none;
    border: none;
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    line-height: 1;
  }
</style>
