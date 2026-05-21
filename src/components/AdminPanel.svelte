<script>
  import { onMount } from 'svelte'

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

  let token = ''
  let authed = false
  let error = ''

  let stats = null
  let rooms = []
  let schedules = []
  let settings = { allow_skip_broadcast: false }

  let activeTab = 'dashboard'

  // schedule form
  let scheduleForm = { id: '', cron_expr: '', youtube_url: '', label: '', enabled: true }
  let editingSchedule = false

  // top spenders
  let spenders = []
  let spenderForm = { id: '', name: '', amount: '', date: '' }
  let editingSpender = false

  async function api(method, path, body) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || res.statusText)
    }
    return res.json()
  }

  async function login() {
    error = ''
    try {
      await api('GET', '/admin/stats')
      authed = true
      await loadAll()
    } catch (e) {
      error = e.message
    }
  }

  async function loadAll() {
    await Promise.all([loadStats(), loadRooms(), loadSchedules(), loadSpenders(), loadSettings()])
  }

  async function loadSettings() {
    settings = await api('GET', '/admin/settings')
  }

  async function toggleSkipBroadcast() {
    try {
      settings = await api('POST', '/admin/settings', { allow_skip_broadcast: !settings.allow_skip_broadcast })
    } catch (e) {
      alert(e.message)
    }
  }

  async function loadStats() {
    stats = await api('GET', '/admin/stats')
  }

  async function loadRooms() {
    rooms = await api('GET', '/admin/rooms')
  }

  async function loadSchedules() {
    schedules = await api('GET', '/admin/schedules')
  }

  async function kickUser(clientId) {
    if (!confirm('เตะ user นี้ออก?')) return
    try {
      await api('POST', '/admin/rooms/kick', { client_id: clientId })
      await loadRooms()
    } catch (e) {
      alert(e.message)
    }
  }

  async function skipBroadcast() {
    if (!confirm('Skip broadcast ที่กำลังเล่นในทุกห้อง?')) return
    try {
      await api('POST', '/admin/broadcast/skip', {})
      alert('Skipped')
    } catch (e) {
      alert(e.message)
    }
  }

  async function triggerNow(url) {
    try {
      await api('POST', '/admin/schedules/trigger', { youtube_url: url })
      alert('Triggered!')
    } catch (e) {
      alert(e.message)
    }
  }

  function startAddSchedule() {
    scheduleForm = { id: '', cron_expr: '', youtube_url: '', label: '', enabled: true }
    editingSchedule = true
  }

  function startEditSchedule(s) {
    scheduleForm = { ...s }
    editingSchedule = true
  }

  async function saveSchedule() {
    try {
      if (scheduleForm.id) {
        await api('PUT', '/admin/schedules', scheduleForm)
      } else {
        await api('POST', '/admin/schedules', scheduleForm)
      }
      editingSchedule = false
      await loadSchedules()
    } catch (e) {
      alert(e.message)
    }
  }

  async function deleteSchedule(id) {
    if (!confirm('ลบ schedule นี้?')) return
    try {
      await api('DELETE', `/admin/schedules?id=${id}`)
      await loadSchedules()
    } catch (e) {
      alert(e.message)
    }
  }

  async function toggleEnabled(s) {
    try {
      await api('PUT', '/admin/schedules', { ...s, enabled: !s.enabled })
      await loadSchedules()
    } catch (e) {
      alert(e.message)
    }
  }

  async function loadSpenders() {
    spenders = await api('GET', '/admin/top-spenders')
  }

  function startAddSpender() {
    const today = new Date().toISOString().slice(0, 10)
    spenderForm = { id: '', name: '', amount: '', date: today }
    editingSpender = true
  }

  function startEditSpender(sp) {
    spenderForm = { ...sp, amount: String(sp.amount) }
    editingSpender = true
  }

  async function saveSpender() {
    const amount = parseInt(spenderForm.amount)
    if (!spenderForm.name || isNaN(amount) || amount <= 0 || !spenderForm.date) {
      alert('กรอกชื่อ, ยอดเงิน (บาท) และวันที่ให้ครบ')
      return
    }
    try {
      const payload = { ...spenderForm, amount }
      if (spenderForm.id) {
        await api('PUT', '/admin/top-spenders', payload)
      } else {
        await api('POST', '/admin/top-spenders', payload)
      }
      editingSpender = false
      await loadSpenders()
    } catch (e) {
      alert(e.message)
    }
  }

  async function deleteSpender(id) {
    if (!confirm('ลบรายการนี้?')) return
    try {
      await api('DELETE', `/admin/top-spenders?id=${id}`)
      await loadSpenders()
    } catch (e) {
      alert(e.message)
    }
  }
</script>

{#if !authed}
  <div class="admin-login">
    <h2>Admin Login</h2>
    <input
      type="password"
      placeholder="Admin Token"
      bind:value={token}
      on:keydown={e => e.key === 'Enter' && login()}
    />
    <button on:click={login}>เข้าสู่ระบบ</button>
    {#if error}<p class="error">{error}</p>{/if}
  </div>
{:else}
  <div class="admin-panel">
    <div class="admin-header">
      <h2>Admin Panel</h2>
      <div class="admin-actions">
        <button class="btn-danger" on:click={skipBroadcast}>⏭ Skip Broadcast</button>
        <button class="btn-secondary" on:click={loadAll}>↻ Refresh</button>
      </div>
    </div>

    <div class="tabs">
      <button class:active={activeTab === 'dashboard'} on:click={() => activeTab = 'dashboard'}>Dashboard</button>
      <button class:active={activeTab === 'rooms'} on:click={() => { activeTab = 'rooms'; loadRooms() }}>Rooms & Users</button>
      <button class:active={activeTab === 'schedules'} on:click={() => { activeTab = 'schedules'; loadSchedules() }}>Schedules</button>
      <button class:active={activeTab === 'spenders'} on:click={() => { activeTab = 'spenders'; loadSpenders() }}>Top Spenders</button>
    </div>

    <!-- Settings row -->
    {#if activeTab === 'dashboard'}
      <div class="settings-row">
        <span class="settings-label">⏭ Skip Broadcast ร่วมกัน</span>
        <button class="toggle-btn" class:on={settings.allow_skip_broadcast} on:click={toggleSkipBroadcast}>
          {settings.allow_skip_broadcast ? 'เปิด' : 'ปิด'}
        </button>
      </div>
    {/if}

    <!-- Dashboard -->
    {#if activeTab === 'dashboard' && stats}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{stats.rooms}</div>
          <div class="stat-label">Rooms Online</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.users}</div>
          <div class="stat-label">Users Online</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.songs}</div>
          <div class="stat-label">Songs in Queue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{stats.soundpads}</div>
          <div class="stat-label">Soundpad Slots</div>
        </div>
      </div>
    {/if}

    <!-- Rooms & Users -->
    {#if activeTab === 'rooms'}
      {#if rooms.length === 0}
        <p class="empty">ไม่มีห้องที่ active อยู่</p>
      {:else}
        {#each rooms as room}
          <div class="room-card">
            <div class="room-header">
              <strong>Room #{room.room_id}</strong>
              <span class="badge">{room.users.length} users · {room.songs} songs · {room.soundpads} pads</span>
            </div>
            <table class="user-table">
              <thead><tr><th>Username</th><th>ID</th><th></th></tr></thead>
              <tbody>
                {#each room.users as user}
                  <tr>
                    <td>{user.username}</td>
                    <td class="muted">{user.id.slice(0, 8)}…</td>
                    <td><button class="btn-kick" on:click={() => kickUser(user.id)}>Kick</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      {/if}
    {/if}

    <!-- Schedules -->
    {#if activeTab === 'schedules'}
      <div class="schedule-toolbar">
        <button class="btn-primary" on:click={startAddSchedule}>+ Add Schedule</button>
      </div>

      {#if editingSchedule}
        <div class="schedule-form">
          <h3>{scheduleForm.id ? 'Edit' : 'Add'} Schedule</h3>
          <label>Label <input bind:value={scheduleForm.label} placeholder="ชื่อโฆษณา" /></label>
          <label>Cron (Asia/Bangkok) <input bind:value={scheduleForm.cron_expr} placeholder="58 17 * * *" /></label>
          <label>YouTube URL <input bind:value={scheduleForm.youtube_url} placeholder="https://youtube.com/..." /></label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={scheduleForm.enabled} /> Enabled
          </label>
          <div class="form-actions">
            <button class="btn-primary" on:click={saveSchedule}>Save</button>
            <button class="btn-secondary" on:click={() => editingSchedule = false}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if schedules.length === 0 && !editingSchedule}
        <p class="empty">ยังไม่มี schedule</p>
      {:else}
        <table class="schedule-table">
          <thead><tr><th>Label</th><th>Cron</th><th>YouTube URL</th><th>Enabled</th><th></th></tr></thead>
          <tbody>
            {#each schedules as s}
              <tr class:disabled={!s.enabled}>
                <td>{s.label || '-'}</td>
                <td class="mono">{s.cron_expr}</td>
                <td class="url-cell"><a href={s.youtube_url} target="_blank" rel="noopener">{s.youtube_url.slice(0, 40)}…</a></td>
                <td>
                  <button class="toggle-btn" class:on={s.enabled} on:click={() => toggleEnabled(s)}>
                    {s.enabled ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td class="actions">
                  <button class="btn-sm" on:click={() => triggerNow(s.youtube_url)}>▶ Now</button>
                  <button class="btn-sm" on:click={() => startEditSchedule(s)}>Edit</button>
                  <button class="btn-sm btn-danger-sm" on:click={() => deleteSchedule(s.id)}>Del</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
    <!-- Top Spenders -->
    {#if activeTab === 'spenders'}
      <div class="schedule-toolbar">
        <button class="btn-primary" on:click={startAddSpender}>+ Add Spender</button>
      </div>

      {#if editingSpender}
        <div class="schedule-form">
          <h3>{spenderForm.id ? 'Edit' : 'Add'} Top Spender</h3>
          <label>ชื่อ <input bind:value={spenderForm.name} placeholder="ชื่อผู้สนับสนุน" /></label>
          <label>ยอดเงิน (บาท) <input type="number" bind:value={spenderForm.amount} placeholder="100" min="1" /></label>
          <label>วันที่ <input type="date" bind:value={spenderForm.date} /></label>
          <div class="form-actions">
            <button class="btn-primary" on:click={saveSpender}>Save</button>
            <button class="btn-secondary" on:click={() => editingSpender = false}>Cancel</button>
          </div>
        </div>
      {/if}

      {#if spenders.length === 0 && !editingSpender}
        <p class="empty">ยังไม่มีรายการ Top Spender</p>
      {:else}
        <table class="schedule-table">
          <thead><tr><th>ชื่อ</th><th>ยอดเงิน</th><th>วันที่</th><th></th></tr></thead>
          <tbody>
            {#each spenders as sp}
              <tr>
                <td>{sp.name}</td>
                <td>฿{sp.amount.toLocaleString()}</td>
                <td>{sp.date}</td>
                <td class="actions">
                  <button class="btn-sm" on:click={() => startEditSpender(sp)}>Edit</button>
                  <button class="btn-sm btn-danger-sm" on:click={() => deleteSpender(sp.id)}>Del</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .admin-login {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px;
  }

  .admin-login h2 { margin: 0; color: var(--text-primary); }

  .admin-login input {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-elevated);
    color: var(--text-primary);
    width: 240px;
  }

  .admin-login button {
    padding: 8px 20px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .error { color: var(--status-disconnected); font-size: 0.85rem; }

  .admin-panel { display: flex; flex-direction: column; gap: 16px; }

  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .admin-header h2 { margin: 0; font-size: 1rem; color: var(--text-primary); }

  .admin-actions { display: flex; gap: 8px; }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }

  .tabs button {
    padding: 6px 14px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: color 0.15s;
  }

  .tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 12px;
  }

  .stat-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px; }

  .room-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
  }

  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.9rem;
  }

  .badge {
    font-size: 0.75rem;
    color: var(--text-secondary);
    background: var(--bg-surface);
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid var(--border);
  }

  .user-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .user-table th { text-align: left; color: var(--text-muted); padding: 4px 8px; }
  .user-table td { padding: 4px 8px; border-top: 1px solid var(--border); color: var(--text-primary); }
  .muted { color: var(--text-muted); font-family: monospace; }

  .schedule-toolbar { display: flex; justify-content: flex-end; }

  .schedule-form {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  .schedule-form h3 { margin: 0; font-size: 0.9rem; color: var(--text-primary); }

  .schedule-form label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .schedule-form input[type="text"],
  .schedule-form input[type="password"],
  .schedule-form input:not([type="checkbox"]) {
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: 0.85rem;
  }

  .checkbox-label { flex-direction: row !important; align-items: center; gap: 8px !important; }

  .form-actions { display: flex; gap: 8px; }

  .schedule-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .schedule-table th { text-align: left; color: var(--text-muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
  .schedule-table td { padding: 6px 8px; border-top: 1px solid var(--border); color: var(--text-primary); vertical-align: middle; }
  .schedule-table tr.disabled td { opacity: 0.45; }

  .mono { font-family: monospace; }
  .url-cell a { color: var(--text-secondary); text-decoration: none; }
  .url-cell a:hover { color: var(--accent); }

  .actions { display: flex; gap: 4px; }

  .empty { color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px; }

  /* buttons */
  button { cursor: pointer; border-radius: 6px; border: none; font-size: 0.8rem; transition: opacity 0.15s; }
  button:hover { opacity: 0.85; }

  .btn-primary { background: var(--accent); color: #fff; padding: 6px 14px; }
  .btn-secondary { background: var(--bg-elevated); color: var(--text-primary); padding: 6px 14px; border: 1px solid var(--border); }
  .btn-danger { background: #c0392b; color: #fff; padding: 6px 14px; }
  .btn-sm { background: var(--bg-hover); color: var(--text-primary); padding: 3px 8px; border: 1px solid var(--border); }
  .btn-danger-sm { background: rgba(192, 57, 43, 0.2); color: #e74c3c; border-color: #c0392b; }
  .btn-kick { background: rgba(192, 57, 43, 0.15); color: #e74c3c; border: 1px solid #c0392b; padding: 2px 8px; font-size: 0.75rem; }

  .toggle-btn { padding: 2px 8px; background: var(--bg-hover); color: var(--text-muted); border: 1px solid var(--border); }
  .toggle-btn.on { background: rgba(76, 175, 80, 0.15); color: #4caf50; border-color: #4caf50; }

  .settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .settings-label { font-size: 0.85rem; color: var(--text-primary); }
</style>
