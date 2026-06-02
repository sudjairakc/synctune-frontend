import { animate, stagger, inView } from 'motion'

// ─── Apple-style spring presets (snappy, slight bounce, never floaty) ────────
const springFast   = { type: 'spring', stiffness: 600, damping: 30, mass: 0.5 }   // button taps
const springNormal = { type: 'spring', stiffness: 400, damping: 32, mass: 0.8 }   // modals / cards
const springMedium = { type: 'spring', stiffness: 320, damping: 28, mass: 0.85 }  // list mounts
const springSlow   = { type: 'spring', stiffness: 220, damping: 30, mass: 0.95 }  // sheets / drawers

// ─── Svelte action: press scale micro-interaction (Apple-style snap) ────────
export function pressable(node, options = {}) {
  const scale = options.scale ?? 0.96
  function down() {
    animate(node, { scale }, { duration: 0.12, easing: [0.32, 0.72, 0, 1] })
  }
  function up() {
    animate(node, { scale: 1 }, { ...springFast })
  }
  node.addEventListener('mousedown', down)
  node.addEventListener('touchstart', down, { passive: true })
  node.addEventListener('mouseup', up)
  node.addEventListener('mouseleave', up)
  node.addEventListener('touchend', up)
  return {
    destroy() {
      node.removeEventListener('mousedown', down)
      node.removeEventListener('touchstart', down)
      node.removeEventListener('mouseup', up)
      node.removeEventListener('mouseleave', up)
      node.removeEventListener('touchend', up)
    }
  }
}

// ─── Svelte action: input focus (Apple-style soft lift + caret pop) ─────────
export function inputFocus(node) {
  function onFocus() {
    animate(node, { y: -1, scale: 1.005 }, { ...springFast })
  }
  function onBlur() {
    animate(node, { y: 0, scale: 1 }, { ...springFast })
  }
  function onInput() {
    // tiny tactile pulse on each keystroke (very subtle)
    animate(node, { scale: [1.005, 1.012, 1.005] }, { duration: 0.18, easing: [0.32, 0.72, 0, 1] })
  }
  node.addEventListener('focus', onFocus)
  node.addEventListener('blur', onBlur)
  node.addEventListener('input', onInput)
  return {
    destroy() {
      node.removeEventListener('focus', onFocus)
      node.removeEventListener('blur', onBlur)
      node.removeEventListener('input', onInput)
    }
  }
}

// ─── Svelte action: hover lift (Apple card / button hover) ──────────────────
export function hoverLift(node, options = {}) {
  const y = options.y ?? -2
  const scale = options.scale ?? 1.02
  function enter() {
    animate(node, { y, scale }, { duration: 0.25, easing: [0.32, 0.72, 0, 1] })
  }
  function leave() {
    animate(node, { y: 0, scale: 1 }, { ...springFast })
  }
  node.addEventListener('mouseenter', enter)
  node.addEventListener('mouseleave', leave)
  return {
    destroy() {
      node.removeEventListener('mouseenter', enter)
      node.removeEventListener('mouseleave', leave)
    }
  }
}

// ─── Svelte action: pop in on mount ─────────────────────────────────────────
export function popIn(node, options = {}) {
  const { delay = 0, y = 10 } = options
  animate(
    node,
    { opacity: [0, 1], scale: [0.95, 1], y: [y, 0] },
    { ...springMedium, delay }
  )
  return {}
}

// ─── Svelte action: stagger children on mount ────────────────────────────────
export function staggerChildren(node, options = {}) {
  const { selector = ':scope > *', gap = 0.06, y = 8, startDelay = 0 } = options
  const children = [...node.querySelectorAll(selector)]
  if (!children.length) return {}
  animate(
    children,
    { opacity: [0, 1], y: [y, 0] },
    {
      duration: 0.3,
      delay: stagger(gap, { startDelay }),
      easing: 'ease-out',
    }
  )
  return {}
}

// ─── Svelte action: stagger children as they enter viewport ──────────────────
export function inViewStagger(node, options = {}) {
  const { selector = ':scope > *', gap = 0.07 } = options
  const children = [...node.querySelectorAll(selector)]
  if (!children.length) return {}
  const stop = inView(node, () => {
    animate(
      children,
      { opacity: [0, 1], y: [12, 0] },
      { duration: 0.35, delay: stagger(gap), easing: 'ease-out' }
    )
  }, { amount: 0.1 })
  return { destroy: stop }
}

// ─── Imperative: shake an element (for errors) ───────────────────────────────
export function shake(node) {
  animate(
    node,
    { x: [0, -10, 10, -7, 7, -4, 4, 0] },
    { duration: 0.45, easing: 'ease-out' }
  )
}

// ─── Imperative: pulse scale (for copy feedback) ─────────────────────────────
export function pulse(node) {
  animate(
    node,
    { scale: [1, 1.12, 1] },
    { ...springNormal, duration: undefined }
  )
}

// ─── Imperative: spin once (theme toggle icon) ───────────────────────────────
export function spinOnce(node) {
  animate(
    node,
    { rotate: [0, 360] },
    { duration: 0.5, easing: 'ease-in-out' }
  )
}

// ─── Svelte action: slide in from right ──────────────────────────────────────
export function slideFromRight(node, options = {}) {
  animate(
    node,
    { opacity: [0, 1], x: ['100%', '0%'] },
    { ...springSlow, delay: options.delay ?? 0 }
  )
  return {}
}

// ─── Svelte action: fade + scale for modals ──────────────────────────────────
export function modalIn(node) {
  animate(
    node,
    { opacity: [0, 1], scale: [0.92, 1], y: [20, 0] },
    { ...springNormal }
  )
  return {}
}

// ─── Svelte action: glow pulse for "now playing" badge ───────────────────────
export function glowPulse(node) {
  animate(
    node,
    { opacity: [1, 0.5, 1] },
    { duration: 2, repeat: Infinity, easing: 'ease-in-out' }
  )
  return { destroy() {} }
}
