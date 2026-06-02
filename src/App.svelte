<script>
  import { onDestroy, onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { createWebSocket } from '$lib/websocket.js'
  import { connectionStatus, toasts, currentUser, currentRoom, queue, currentIndex, seekTime, isPlaying, history, chatHistory, onlineUsers, soundPad, soundPadActive, ttsActive, soundEnabled, soundpadHistory } from '$lib/stores.js'
  import { dismissToast } from '$lib/toast.js'
  import { setSoundEnabled } from '$lib/sound.js'
  import { pressable, staggerChildren, spinOnce, pulse } from '$lib/motionActions.js'
  import { Bell, BellOff, Sun, Moon, Settings, LogOut, X, Heart, Copy, Check } from 'lucide-svelte'

  let themeBtn
  let headerRight

  function toggleSound() {
    const next = !$soundEnabled
    setSoundEnabled(next)
    if (!next) {
      speechSynthesis.cancel()
      ttsActive.set(false)
    }
  }

  function handleLeaveRoom() {
    // ตัด WS แล้ว reconnect ใหม่สะอาด (ไม่มี pendingJoin)
    ws.leave()
    // reset stores
    currentUser.set(null)
    currentRoom.set(null)
    queue.set([])
    currentIndex.set(0)
    seekTime.set(0)
    isPlaying.set(false)
    history.set([])
    chatHistory.set([])
    onlineUsers.set([])
    soundPad.set(new Array(50).fill(null))
    soundPadActive.set(false)
    soundpadHistory.set([])
    // ล้าง session
    sessionStorage.removeItem('username')
    sessionStorage.removeItem('room_id')
    showJoinModal = true
  }
  import Player from './components/Player.svelte'
  import Queue from './components/Queue.svelte'
  import AddSong from './components/AddSong.svelte'
  import History from './components/History.svelte'
  import PlaybackControls from './components/PlaybackControls.svelte'
  import Chat from './components/Chat.svelte'
  import JoinModal from './components/JoinModal.svelte'
  import TutorialTooltip from './components/TutorialTooltip.svelte'
  import LegalModal from './components/LegalModal.svelte'
  import SoundPad from './components/SoundPad.svelte'
  import SupportMe from './components/SupportMe.svelte'
  import AdminPanel from './components/AdminPanel.svelte'
  import VoteModal from './components/VoteModal.svelte'

  let legalOpen = false;
  let adminOpen = false;
  let legalTab = 'terms';
  let roomCopied = false;

  let roomBadgeEl

  function copyRoomId() {
    navigator.clipboard.writeText($currentRoom).then(() => {
      roomCopied = true
      if (roomBadgeEl) pulse(roomBadgeEl)
      setTimeout(() => { roomCopied = false }, 1200)
    })
  }

  function openLegal(tab) {
    legalTab = tab;
    legalOpen = true;
  }

  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
  const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'SyncTune'

  const ws = createWebSocket(WS_URL)

  let theme = 'dark'
  let showJoinModal = true
  let initialRoomId = ''
  let isJoining = false
  let joinTimeoutId = null

  // ปิด loading เมื่อ room มาถึง
  $: if (isJoining && $currentRoom) {
    isJoining = false
    if (joinTimeoutId) { clearTimeout(joinTimeoutId); joinTimeoutId = null }
  }

  onMount(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') {
      theme = saved
    } else {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }
    document.documentElement.setAttribute('data-theme', theme)

    // อ่าน ?roomId= จาก URL แล้วล้างออกเพื่อไม่ให้ค้างใน address bar
    const params = new URLSearchParams(window.location.search)
    const urlRoomId = params.get('roomId') || ''
    if (urlRoomId && /^\d{6}$/.test(urlRoomId)) {
      initialRoomId = urlRoomId
      history.replaceState(null, '', window.location.pathname)
    }

    const savedUsername = sessionStorage.getItem('username')
    const savedRoomId = sessionStorage.getItem('room_id')

    // มีชื่ออยู่แล้ว → join ทันที (ให้ URL roomId มีความสำคัญกว่า session roomId)
    if (savedUsername) {
      handleJoin({ detail: { username: savedUsername, room_id: initialRoomId || savedRoomId || null } })
    }
  })

  onDestroy(() => {
    ws.disconnect()
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    if (themeBtn) spinOnce(themeBtn)
  }

  function handleJoin(e) {
    const { username, room_id } = e.detail
    currentUser.set({ id: null, username, profile_img: '' })
    ws.join(username, '', room_id)
    sessionStorage.setItem('username', username)
    if (room_id) sessionStorage.setItem('room_id', room_id)
    else sessionStorage.removeItem('room_id')
    showJoinModal = false
    isJoining = true
    // ป้องกันค้าง: ยกเลิก loading ถ้านานเกิน 12 วินาทียังไม่ได้ room
    if (joinTimeoutId) clearTimeout(joinTimeoutId)
    joinTimeoutId = setTimeout(() => { isJoining = false }, 12000)
  }
</script>

<svelte:head>
  <title>{APP_TITLE}</title>
</svelte:head>

<JoinModal visible={showJoinModal} {initialRoomId} on:join={handleJoin} />
<TutorialTooltip />

{#if isJoining}
  <div class="join-loading" transition:fade={{ duration: 250 }}>
    <div class="loading-card">
      <div class="loading-logo">
        <div class="ring r1"></div>
        <div class="ring r2"></div>
        <div class="ring r3"></div>
        <div class="logo-text">S</div>
      </div>
      <p class="loading-title">SyncTune</p>
      <p class="loading-sub">
        Joining room
        <span class="loading-dots"><span></span><span></span><span></span></span>
      </p>
    </div>
  </div>
{/if}

<div class="app">
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">{APP_TITLE}</h1>
      {#if $currentRoom}
        <button
          bind:this={roomBadgeEl}
          class="room-badge"
          use:pressable
          title="Click to copy Room ID"
          on:click={copyRoomId}
          data-tutorial="room"
        >
          {#if roomCopied}
            <Check size="14" strokeWidth="2.5" />
          {:else}
            <Copy size="13" strokeWidth="2" />
          {/if}
          <span>{$currentRoom}</span>
        </button>
      {/if}
    </div>
    <div class="header-right" bind:this={headerRight} use:staggerChildren={{ gap: 0.07, startDelay: 0.1 }}>
      {#if $currentUser}
        <div class="current-user">
          <div class="user-avatar">{$currentUser.username[0].toUpperCase()}</div>
          <span class="username">{$currentUser.username}</span>
        </div>
      {/if}
      <div
        class="connection-status"
        class:connected={$connectionStatus === 'connected'}
        class:disconnected={$connectionStatus === 'disconnected'}
        title={$connectionStatus === 'connected' ? 'Connected' : $connectionStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
      >
        <span class="status-dot"></span>
      </div>
      <button class="icon-btn" use:pressable on:click={toggleSound} title={$soundEnabled ? 'Mute' : 'Unmute'} aria-label="toggle sound">
        {#if $soundEnabled}<Bell size="18" strokeWidth="2" />{:else}<BellOff size="18" strokeWidth="2" />{/if}
      </button>
      <button bind:this={themeBtn} class="theme-toggle" use:pressable on:click={toggleTheme} title="Toggle theme" aria-label="Toggle light/dark mode" data-tutorial="theme">
        {#if theme === 'dark'}<Sun size="18" strokeWidth="2" />{:else}<Moon size="18" strokeWidth="2" />{/if}
      </button>
      {#if $currentUser}
        <button class="leave-btn icon-btn" use:pressable on:click={handleLeaveRoom} title="Leave room" aria-label="Leave room">
          <LogOut size="17" strokeWidth="2" />
        </button>
      {/if}
      <button class="icon-btn" use:pressable on:click={() => adminOpen = true} title="Admin Panel" aria-label="Admin Panel">
        <Settings size="18" strokeWidth="2" />
      </button>
    </div>
  </header>

  <main class="app-main">
    <div class="player-section">
      <Player {ws} />
      <div data-tutorial="playback-controls"><PlaybackControls {ws} /></div>
      <div data-tutorial="chat-section"><Chat {ws} /></div>
      {#if $currentUser}
        <SoundPad {ws} />
      {/if}
    </div>

    <div class="sidebar">
      <div class="sidebar-scroll">
        <div data-tutorial="add-song"><AddSong {ws} /></div>
        <VoteModal {ws} />
        <div data-tutorial="queue-section"><Queue {ws} /></div>
        <div class="history-section" data-tutorial="history-section">
          <History {ws} />
        </div>
      </div>
      <SupportMe />
    </div>
  </main>

  {#if adminOpen}
    <div class="admin-overlay" role="dialog" aria-modal="true" transition:fade={{ duration: 200 }}>
      <div class="admin-drawer" transition:fly={{ x: '100%', duration: 350, easing: cubicOut }}>
        <button class="admin-close" use:pressable on:click={() => adminOpen = false} aria-label="Close"><X size="18" strokeWidth="2.2" /></button>
        <AdminPanel />
      </div>
    </div>
  {/if}

  <footer class="app-footer">
    <span class="footer-made">Made with <Heart size="11" strokeWidth="2.5" fill="currentColor" /> by</span>
    <a href="" target="_blank" rel="noopener noreferrer">sudjairakc</a>
    <span class="dot">·</span>
    <button class="footer-link" on:click={() => openLegal('terms')}>Terms</button>
    <span class="dot">·</span>
    <button class="footer-link" on:click={() => openLegal('privacy')}>Privacy</button>
    <span class="dot">·</span>
    <a href="mailto:sudjairak.c@gmail.com">Contact</a>
  </footer>

  <LegalModal bind:open={legalOpen} bind:tab={legalTab} />

  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div
        class="toast toast-{toast.type}"
        role="alert"
        in:fly={{ x: 40, duration: 300, easing: cubicOut }}
        out:fly={{ x: 40, duration: 200, easing: cubicOut }}
      >
        <span>{toast.message}</span>
        <button class="toast-close" use:pressable on:click={() => dismissToast(toast.id)} aria-label="Dismiss"><X size="14" strokeWidth="2.2" /></button>
      </div>
    {/each}
  </div>
</div>

<style>
  :global(*) { box-sizing: border-box; }

  :global(:root),
  :global([data-theme="dark"]) {
    /* brand */
    --yt-red: #FF375F;
    --yt-red-hover: #FF5277;

    /* Apple-style layered dark surfaces */
    --bg-base: #000000;
    --bg-surface: rgba(28, 28, 30, 0.72);
    --bg-surface-solid: #1c1c1e;
    --bg-elevated: rgba(44, 44, 46, 0.78);
    --bg-hover: rgba(58, 58, 60, 0.55);

    /* SF-style text hierarchy */
    --text-primary: rgba(255, 255, 255, 0.96);
    --text-secondary: rgba(235, 235, 245, 0.62);
    --text-muted: rgba(235, 235, 245, 0.38);

    --border: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.14);
    --border-focus: #FF375F;

    --status-connected: #30D158;
    --status-connecting: #FF9F0A;
    --status-disconnected: #FF453A;

    --accent: #FF375F;
    --accent-soft: rgba(255, 55, 95, 0.14);
    --accent-badge: rgba(255, 55, 95, 0.18);
    --accent-glow: 0 0 0 4px rgba(255, 55, 95, 0.22);

    --now-playing-bg: rgba(28, 28, 30, 0.85);
    --toast-bg: rgba(44, 44, 46, 0.78);

    /* Apple multi-layer shadows */
    --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-2: 0 2px 4px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.5);
    --shadow-3: 0 4px 8px rgba(0, 0, 0, 0.45), 0 24px 48px rgba(0, 0, 0, 0.6);
    --shadow: var(--shadow-2);

    /* radii */
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;
    --radius-xl: 28px;
    --radius-pill: 999px;

    /* blur */
    --blur-bg: saturate(180%) blur(20px);
    --blur-strong: saturate(200%) blur(40px);

    /* background mesh */
    --mesh-bg:
      radial-gradient(at 20% 0%, rgba(255, 55, 95, 0.10) 0px, transparent 50%),
      radial-gradient(at 80% 0%, rgba(94, 92, 230, 0.10) 0px, transparent 50%),
      radial-gradient(at 50% 100%, rgba(48, 209, 88, 0.05) 0px, transparent 50%);
  }

  :global([data-theme="light"]) {
    --yt-red: #FF2D55;
    --yt-red-hover: #E60039;

    --bg-base: #F2F2F7;
    --bg-surface: rgba(255, 255, 255, 0.72);
    --bg-surface-solid: #ffffff;
    --bg-elevated: rgba(255, 255, 255, 0.82);
    --bg-hover: rgba(120, 120, 128, 0.12);

    --text-primary: rgba(0, 0, 0, 0.92);
    --text-secondary: rgba(60, 60, 67, 0.62);
    --text-muted: rgba(60, 60, 67, 0.38);

    --border: rgba(60, 60, 67, 0.12);
    --border-strong: rgba(60, 60, 67, 0.22);
    --border-focus: #FF2D55;

    --status-connected: #34C759;
    --status-connecting: #FF9500;
    --status-disconnected: #FF3B30;

    --accent: #FF2D55;
    --accent-soft: rgba(255, 45, 85, 0.10);
    --accent-badge: rgba(255, 45, 85, 0.14);
    --accent-glow: 0 0 0 4px rgba(255, 45, 85, 0.18);

    --now-playing-bg: rgba(255, 255, 255, 0.88);
    --toast-bg: rgba(255, 255, 255, 0.82);

    --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.08);
    --shadow-2: 0 2px 4px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.12);
    --shadow-3: 0 4px 8px rgba(0, 0, 0, 0.10), 0 24px 48px rgba(0, 0, 0, 0.18);
    --shadow: var(--shadow-2);

    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;
    --radius-xl: 28px;
    --radius-pill: 999px;

    --blur-bg: saturate(180%) blur(20px);
    --blur-strong: saturate(200%) blur(40px);

    --mesh-bg:
      radial-gradient(at 20% 0%, rgba(255, 45, 85, 0.08) 0px, transparent 50%),
      radial-gradient(at 80% 0%, rgba(88, 86, 214, 0.08) 0px, transparent 50%),
      radial-gradient(at 50% 100%, rgba(52, 199, 89, 0.05) 0px, transparent 50%);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Inter Variable', 'Inter', 'Noto Sans Thai', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    font-size: 15px;
    font-feature-settings: 'cv11', 'ss01', 'ss03';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    letter-spacing: -0.011em;
    background: var(--bg-base);
    background-image: var(--mesh-bg);
    background-attachment: fixed;
    color: var(--text-primary);
    min-height: 100vh;
    transition: background-color 0.3s, color 0.3s;
  }

  :global(button) {
    font-family: inherit;
    letter-spacing: -0.01em;
  }

  :global(input) {
    font-family: inherit;
    letter-spacing: -0.01em;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    background: var(--bg-surface);
    backdrop-filter: var(--blur-bg);
    -webkit-backdrop-filter: var(--blur-bg);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .app-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent) 0%, #FF6482 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.03em;
  }

  .room-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'SF Mono', ui-monospace, monospace;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 5px 12px 5px 10px;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    white-space: nowrap;
    will-change: transform;
  }

  .room-badge:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .current-user {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .user-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, #FF6482 100%);
    color: white;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(255, 55, 95, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .username {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connection-status {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--status-connecting);
    cursor: default;
  }

  .connection-status.connected { color: var(--status-connected); }
  .connection-status.disconnected { color: var(--status-disconnected); }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
    box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 24%, transparent), 0 0 10px currentColor;
  }

  .connection-status.connected .status-dot {
    animation: connPulse 2.2s ease-in-out infinite;
  }

  @keyframes connPulse {
    0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 22%, transparent), 0 0 8px currentColor; }
    50%      { box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 12%, transparent), 0 0 14px currentColor; }
  }

  .theme-toggle,
  .icon-btn {
    background: var(--bg-elevated);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 38px;
    height: 38px;
    font-size: 17px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.25s;
    flex-shrink: 0;
    will-change: transform;
  }

  .theme-toggle:hover,
  .icon-btn:hover {
    border-color: var(--border-strong);
    background: var(--bg-hover);
    box-shadow: var(--shadow-1);
  }

  .leave-btn {
    color: var(--text-secondary);
  }

  .leave-btn:hover {
    border-color: var(--status-disconnected);
    color: var(--status-disconnected);
    background: rgba(255, 69, 58, 0.10);
    box-shadow: var(--shadow-1);
  }

  .app-main {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 16px;
    padding: 16px 24px;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
    align-items: stretch;
  }

  .player-section {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sidebar-scroll {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    padding-bottom: 16px;
  }

  .history-section { flex-shrink: 0; }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 24px;
    font-size: 12px;
    color: var(--text-muted);
    border-top: 1px solid var(--border);
    background: var(--bg-surface);
    backdrop-filter: var(--blur-bg);
    -webkit-backdrop-filter: var(--blur-bg);
    flex-shrink: 0;
  }

  .app-footer a, .footer-link {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.15s;
    font-weight: 500;
  }

  .footer-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
  }

  .footer-made {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
  }
  .footer-made :global(svg) {
    color: var(--accent);
  }

  .dot {
    color: var(--text-muted);
    opacity: 0.6;
  }

  .app-footer a:hover, .footer-link:hover {
    color: var(--accent);
  }

  .toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    max-width: 360px;
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    border-radius: var(--radius-lg);
    font-size: 14px;
    font-weight: 500;
    background: var(--toast-bg);
    backdrop-filter: var(--blur-bg);
    -webkit-backdrop-filter: var(--blur-bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    box-shadow: var(--shadow-2);
    color: var(--text-primary);
  }

  .toast-error { border-left-color: #ff4444; color: #ff4444; }
  .toast-warning { border-left-color: #ff9800; color: #ff9800; }
  .toast-success { border-left-color: #4caf50; color: #4caf50; }
  .toast-info { border-left-color: #2196f3; color: #2196f3; }

  .toast-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    flex-shrink: 0;
    line-height: 1;
  }

  .toast-close:hover { color: var(--text-primary); }

  @media (max-width: 1024px) {
    .app-main {
      grid-template-columns: 1fr 320px;
      padding: 12px 16px;
    }
  }

  @media (max-width: 640px) {
    .app-header { padding: 10px 16px; }
    .username { display: none; }

    .app-main {
      grid-template-columns: 1fr;
      padding: 10px 12px;
      gap: 12px;
    }

    .sidebar { max-height: none; }

    .toast-container {
      bottom: 12px;
      right: 12px;
      left: 12px;
      max-width: none;
    }
  }
  .admin-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 500;
    display: flex;
    justify-content: flex-end;
  }

  .admin-drawer {
    width: min(640px, 100vw);
    height: 100%;
    background: var(--bg-surface-solid);
    border-left: 1px solid var(--border);
    border-top-left-radius: var(--radius-xl);
    border-bottom-left-radius: var(--radius-xl);
    overflow-y: auto;
    padding: 24px;
    position: relative;
    box-shadow: var(--shadow-3);
  }

  .admin-close {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1rem;
    cursor: pointer;
    padding: 4px 8px;
  }

  .admin-close:hover { color: var(--text-primary); }

  /* ─── Join loading overlay (Apple-style) ──────────────────────────────── */
  .join-loading {
    position: fixed;
    inset: 0;
    z-index: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: saturate(180%) blur(28px);
    -webkit-backdrop-filter: saturate(180%) blur(28px);
  }

  .loading-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 44px 56px;
    background: var(--bg-surface-solid);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-3);
    animation: cardIn 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes cardIn {
    from { opacity: 0; transform: scale(0.92) translateY(12px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .loading-logo {
    position: relative;
    width: 88px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-text {
    position: relative;
    z-index: 2;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 800;
    color: white;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #FF6482);
    box-shadow: 0 8px 24px rgba(255, 55, 95, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    letter-spacing: -0.04em;
    animation: logoPulse 1.6s ease-in-out infinite;
  }

  @keyframes logoPulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.06); }
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid var(--accent);
    opacity: 0;
    animation: ringExpand 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  .ring.r1 { animation-delay: 0s; }
  .ring.r2 { animation-delay: 0.7s; }
  .ring.r3 { animation-delay: 1.4s; }

  @keyframes ringExpand {
    0%   { opacity: 0.7; transform: scale(0.6); border-width: 2.5px; }
    100% { opacity: 0;   transform: scale(1.4); border-width: 0.5px; }
  }

  .loading-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, var(--accent), #FF6482);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .loading-sub {
    margin: 0;
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
    display: inline-flex;
    align-items: baseline;
    gap: 2px;
  }

  .loading-dots {
    display: inline-flex;
    gap: 3px;
    margin-left: 4px;
  }
  .loading-dots span {
    display: block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--text-secondary);
    animation: dotBounce 1.2s ease-in-out infinite;
    transform-origin: center;
  }
  .loading-dots span:nth-child(1) { animation-delay: 0s; }
  .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes dotBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40%           { transform: translateY(-4px); opacity: 1; }
  }
</style>
