<script>
  import { onDestroy } from 'svelte'
  import { currentUser, currentRoom } from '$lib/stores.js'

  const STORAGE_KEY = 'synctune_tutorial_done'

  const steps = [
    {
      id: 'room',
      title: 'ห้องของคุณ 🏠',
      body: 'Room ID ที่มุมบนซ้าย — แชร์ให้เพื่อนกดคัดลอก แล้วเพื่อนนำไปใส่ใน "Room ID" ตอน Join เพื่อเข้าห้องเดียวกัน',
      anchor: 'room-badge',
      placement: 'bottom-start',
    },
    {
      id: 'add-song',
      title: 'เพิ่มเพลง 🎵',
      body: 'วาง YouTube URL แล้วกด "เพิ่ม" — รองรับทั้ง youtube.com/watch?v=... และ youtu.be/...',
      anchor: 'add-song',
      placement: 'top',
    },
    {
      id: 'queue',
      title: 'คิวเพลง 📋',
      body: 'ลากเพื่อเรียงลำดับได้ กด ✕ เพื่อลบ — ทุกคนในห้องเห็นคิวเดียวกัน',
      anchor: 'queue-section',
      placement: 'left',
    },
    {
      id: 'controls',
      title: 'โหมดเล่น 🔀',
      body: '"เล่นต่อ" = เล่นเพลงถัดไปอัตโนมัติ · "สลับคิว" = สับเรียงทั้งคิว · "สุ่มเพลง" = สุ่มเลือกโดยไม่เปลี่ยนลำดับ',
      anchor: 'playback-controls',
      placement: 'top',
    },
    {
      id: 'chat',
      title: 'แชทสด 💬',
      body: 'คุยกับทุกคนในห้องได้แบบ real-time พร้อมดูว่ามีใคร online บ้าง',
      anchor: 'chat-section',
      placement: 'top',
    },
    {
      id: 'history',
      title: 'ประวัติเพลง ⏪',
      body: 'กด + ในประวัติเพื่อนำเพลงกลับเข้าคิวได้ทันที',
      anchor: 'history-section',
      placement: 'left',
    },
    {
      id: 'theme',
      title: 'ธีม ☀️ / 🌙',
      body: 'สลับ Dark/Light ได้ที่ปุ่มมุมบนขวา — ระบบจำการเลือกของคุณไว้',
      anchor: 'theme-toggle',
      placement: 'bottom-end',
    },
  ]

  let visible = false
  let stepIndex = 0
  let tooltipEl
  let overlayEl
  let anchorRect = null
  let rafId
  let started = false

  $: step = steps[stepIndex]
  $: isLast = stepIndex === steps.length - 1

  // เริ่ม tutorial ทันทีที่ user join แล้ว (currentUser และ currentRoom พร้อม)
  $: if ($currentUser && $currentRoom && !started && !localStorage.getItem(STORAGE_KEY)) {
    started = true
    setTimeout(() => { visible = true; updatePosition() }, 600)
  }


  onDestroy(() => {
    cancelAnimationFrame(rafId)
  })

  function findAnchor(id) {
    return document.querySelector(`[data-tutorial="${id}"]`)
  }

  function updatePosition() {
    if (!visible) return
    const el = findAnchor(step.id)
    anchorRect = el ? el.getBoundingClientRect() : null
    rafId = requestAnimationFrame(updatePosition)
  }

  function next() {
    if (isLast) return done()
    stepIndex++
    scrollToAnchor()
  }

  function prev() {
    if (stepIndex > 0) { stepIndex--; scrollToAnchor() }
  }

  function done() {
    visible = false
    cancelAnimationFrame(rafId)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  function scrollToAnchor() {
    setTimeout(() => {
      const el = findAnchor(steps[stepIndex].id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  function tooltipStyle(rect, placement) {
    if (!rect) return 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)'
    const gap = 12
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top, left, transform = ''

    if (placement === 'bottom' || placement === 'bottom-start' || placement === 'bottom-end') {
      top = rect.bottom + gap
      if (placement === 'bottom-start') left = rect.left
      else if (placement === 'bottom-end') left = rect.right
      else { left = rect.left + rect.width / 2; transform = 'translateX(-50%)' }
    } else if (placement === 'top') {
      top = rect.top - gap
      left = rect.left + rect.width / 2
      transform = 'translateX(-50%) translateY(-100%)'
    } else if (placement === 'left') {
      top = rect.top + rect.height / 2
      left = rect.left - gap
      transform = 'translateX(-100%) translateY(-50%)'
    } else if (placement === 'right') {
      top = rect.top + rect.height / 2
      left = rect.right + gap
      transform = 'translateY(-50%)'
    }

    // clamp ไม่ให้ออกนอกจอ
    const w = Math.min(300, vw - 24)
    top = Math.max(8, Math.min(top, vh - 200))
    left = Math.max(8, Math.min(left, vw - w - 8))

    return `position:fixed;top:${top}px;left:${left}px;transform:${transform};width:${w}px`
  }

  function highlightStyle(rect) {
    if (!rect) return 'display:none'
    const pad = 6
    return `position:fixed;top:${rect.top - pad}px;left:${rect.left - pad}px;width:${rect.width + pad * 2}px;height:${rect.height + pad * 2}px`
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" bind:this={overlayEl} on:click|self={done}></div>

  {#if anchorRect}
    <div class="highlight" style={highlightStyle(anchorRect)}></div>
  {/if}

  <div
    class="tooltip"
    bind:this={tooltipEl}
    style={tooltipStyle(anchorRect, step.placement)}
    role="dialog"
    aria-label="คู่มือการใช้งาน"
  >
    <div class="tooltip-header">
      <span class="step-count">{stepIndex + 1} / {steps.length}</span>
      <button class="close-btn" on:click={done} aria-label="ปิด">✕</button>
    </div>

    <h4 class="tooltip-title">{step.title}</h4>
    <p class="tooltip-body">{step.body}</p>

    <div class="tooltip-footer">
      <div class="dots">
        {#each steps as _, i}
          <button
            class="dot"
            class:active={i === stepIndex}
            on:click={() => { stepIndex = i; scrollToAnchor() }}
            aria-label="ขั้นตอนที่ {i + 1}"
          ></button>
        {/each}
      </div>
      <div class="nav-btns">
        {#if stepIndex > 0}
          <button class="nav-btn secondary" on:click={prev}>← ก่อนหน้า</button>
        {/if}
        <button class="nav-btn primary" on:click={next}>
          {isLast ? 'เริ่มใช้งาน ✓' : 'ถัดไป →'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 800;
    backdrop-filter: blur(2px);
  }

  .highlight {
    z-index: 801;
    border-radius: 8px;
    box-shadow: 0 0 0 4px var(--accent), 0 0 0 9999px rgba(0, 0, 0, 0.55);
    pointer-events: none;
    transition: top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease;
  }

  .tooltip {
    z-index: 802;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    box-shadow: var(--shadow), 0 0 0 2px var(--accent);
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: popIn 0.18s ease-out;
  }

  @keyframes popIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }

  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .step-count {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
    transition: color 0.15s;
  }
  .close-btn:hover { color: var(--text-primary); }

  .tooltip-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .tooltip-body {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .tooltip-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .dots {
    display: flex;
    gap: 5px;
    justify-content: center;
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }

  .dot.active {
    background: var(--accent);
    transform: scale(1.3);
  }

  .nav-btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .nav-btn {
    padding: 7px 14px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.15s, opacity 0.15s;
  }

  .nav-btn.primary {
    background: var(--yt-red);
    color: white;
  }
  .nav-btn.primary:hover { background: var(--yt-red-hover); }

  .nav-btn.secondary {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }
  .nav-btn.secondary:hover { background: var(--bg-hover); }
</style>
