<script>
  import { onDestroy, onMount } from 'svelte'
  import { createWebSocket } from '$lib/websocket.js'
  import { connectionStatus, toasts, currentUser, currentRoom } from '$lib/stores.js'
  import { dismissToast } from '$lib/toast.js'
  import Player from './components/Player.svelte'
  import Queue from './components/Queue.svelte'
  import AddSong from './components/AddSong.svelte'
  import History from './components/History.svelte'
  import PlaybackControls from './components/PlaybackControls.svelte'
  import Chat from './components/Chat.svelte'
  import JoinModal from './components/JoinModal.svelte'
  import TutorialTooltip from './components/TutorialTooltip.svelte'

  const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
  const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'SyncTune'

  const ws = createWebSocket(WS_URL)

  let theme = 'dark'
  let showJoinModal = true

  onMount(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') {
      theme = saved
    } else {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }
    document.documentElement.setAttribute('data-theme', theme)

    // ถ้าเคย join ไว้ใน session เดิม ให้ join อัตโนมัติ
    const savedUsername = sessionStorage.getItem('username')
    const savedRoomId = sessionStorage.getItem('room_id')
    if (savedUsername) {
      handleJoin({ detail: { username: savedUsername, room_id: savedRoomId || null } })
    }
  })

  onDestroy(() => {
    ws.disconnect()
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }

  function handleJoin(e) {
    const { username, room_id } = e.detail
    currentUser.set({ id: null, username, profile_img: '' })
    ws.join(username, '', room_id)
    sessionStorage.setItem('username', username)
    if (room_id) sessionStorage.setItem('room_id', room_id)
    else sessionStorage.removeItem('room_id')
    showJoinModal = false
  }
</script>

<svelte:head>
  <title>{APP_TITLE}</title>
</svelte:head>

<JoinModal visible={showJoinModal} on:join={handleJoin} />
<TutorialTooltip />

<div class="app">
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-title">{APP_TITLE}</h1>
      {#if $currentRoom}
        <button
          class="room-badge"
          title="คลิกเพื่อคัดลอก Room ID"
          on:click={() => navigator.clipboard.writeText($currentRoom)}
          data-tutorial="room"
        >
          #{$currentRoom}
        </button>
      {/if}
    </div>
    <div class="header-right">
      {#if $currentUser}
        <div class="current-user">
          <div class="user-avatar">{$currentUser.username[0].toUpperCase()}</div>
          <span class="username">{$currentUser.username}</span>
        </div>
      {/if}
      <div class="connection-status" class:connected={$connectionStatus === 'connected'} class:disconnected={$connectionStatus === 'disconnected'}>
        <span class="status-dot"></span>
        {#if $connectionStatus === 'connected'}
          เชื่อมต่อแล้ว
        {:else if $connectionStatus === 'connecting'}
          กำลังเชื่อมต่อ...
        {:else}
          ขาดการเชื่อมต่อ
        {/if}
      </div>
      <button class="theme-toggle" on:click={toggleTheme} title="สลับธีม" aria-label="สลับ light/dark mode" data-tutorial="theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  </header>

  <main class="app-main">
    <div class="player-section">
      <Player {ws} />
      <div data-tutorial="playback-controls"><PlaybackControls {ws} /></div>
      <div data-tutorial="add-song"><AddSong {ws} /></div>
      <div data-tutorial="chat-section"><Chat {ws} /></div>
    </div>

    <div class="sidebar">
      <div data-tutorial="queue-section"><Queue {ws} /></div>
      <div class="history-section" data-tutorial="history-section">
        <History {ws} />
      </div>
    </div>
  </main>

  <footer class="app-footer">
    <span>Made with ❤️ by</span>
    <a href="https://github.com/sudjairakc" target="_blank" rel="noopener noreferrer">sudjairakc</a>
    <!-- <span>·</span>
    <a href="https://sudjairakc.github.io/portfolio/" target="_blank" rel="noopener noreferrer">Portfolio</a> -->
  </footer>

  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}" role="alert">
        <span>{toast.message}</span>
        <button class="toast-close" on:click={() => dismissToast(toast.id)}>✕</button>
      </div>
    {/each}
  </div>
</div>

<style>
  :global(*) { box-sizing: border-box; }

  :global(:root),
  :global([data-theme="dark"]) {
    --yt-red: #ff0000;
    --yt-red-hover: #cc0000;

    --bg-base: #0f0f0f;
    --bg-surface: #212121;
    --bg-elevated: #2d2d2d;
    --bg-hover: #3d3d3d;

    --text-primary: #f1f1f1;
    --text-secondary: #aaaaaa;
    --text-muted: #717171;

    --border: #3d3d3d;
    --border-focus: #ff0000;

    --status-connected: #4caf50;
    --status-connecting: #ff9800;
    --status-disconnected: #ff6b6b;

    --accent: #ff0000;
    --accent-soft: rgba(255, 0, 0, 0.12);
    --accent-badge: rgba(255, 0, 0, 0.15);

    --now-playing-bg: #1a1a1a;
    --toast-bg: #212121;
    --shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  :global([data-theme="light"]) {
    --yt-red: #ff0000;
    --yt-red-hover: #cc0000;

    --bg-base: #ffffff;
    --bg-surface: #f2f2f2;
    --bg-elevated: #e5e5e5;
    --bg-hover: #d9d9d9;

    --text-primary: #0f0f0f;
    --text-secondary: #606060;
    --text-muted: #909090;

    --border: #d3d3d3;
    --border-focus: #ff0000;

    --status-connected: #1e7e34;
    --status-connecting: #e65c00;
    --status-disconnected: #c0392b;

    --accent: #ff0000;
    --accent-soft: rgba(255, 0, 0, 0.08);
    --accent-badge: rgba(255, 0, 0, 0.12);

    --now-playing-bg: #f9f9f9;
    --toast-bg: #ffffff;
    --shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-base);
    color: var(--text-primary);
    min-height: 100vh;
    transition: background 0.2s, color 0.2s;
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
    padding: 12px 24px;
    background: var(--bg-surface);
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
    font-size: 20px;
    font-weight: 700;
    color: var(--yt-red);
    letter-spacing: -0.02em;
  }

  .room-badge {
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 8px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .room-badge:hover {
    border-color: var(--accent);
    color: var(--text-primary);
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
  }

  .username {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--status-connecting);
  }

  .connection-status.connected { color: var(--status-connected); }
  .connection-status.disconnected { color: var(--status-disconnected); }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .theme-toggle {
    background: none;
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 34px;
    height: 34px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s;
    flex-shrink: 0;
  }

  .theme-toggle:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
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
    align-items: start;
  }

  .player-section {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    max-height: calc(100vh - 70px);
    min-width: 0;
  }

  .history-section { flex-shrink: 0; }

  .app-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 24px;
    font-size: 12px;
    color: var(--text-muted);
    border-top: 1px solid var(--border);
    background: var(--bg-surface);
    flex-shrink: 0;
  }

  .app-footer a {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.15s;
  }

  .app-footer a:hover {
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
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    background: var(--toast-bg);
    border-left: 4px solid var(--accent);
    box-shadow: var(--shadow);
    color: var(--text-primary);
    animation: slideIn 0.2s ease-out;
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

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

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
</style>
