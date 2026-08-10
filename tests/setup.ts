import { beforeAll, afterAll, vi } from 'vitest'

// ─── Mock browser APIs missing in jsdom ──────────────────────────────

// requestAnimationFrame — used by xterm.js and React
let rafId = 0
globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  rafId++
  setTimeout(() => cb(Date.now()), 0)
  return rafId
})
globalThis.cancelAnimationFrame = vi.fn()

// HTMLCanvasElement.getContext — required by xterm.js in jsdom
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  measureText: vi.fn().mockReturnValue({ width: 10 }),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray([]) }),
  putImageData: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  rect: vi.fn(),
  setTransform: vi.fn(),
  createImageData: vi.fn().mockReturnValue([]),
  canvas: { width: 100, height: 100 }
} as any)

// document.elementFromPoint — used by some React internals
document.elementFromPoint = vi.fn().mockReturnValue(null)

// getComputedStyle — used by Terminal's getTermTheme
const computedStyle = new Map<string, string>()
computedStyle.set('--term-bg', '#1e1e1e')
computedStyle.set('--term-fg', '#d4d4d4')
computedStyle.set('--term-cursor', '#d4d4d4')
computedStyle.set('--term-selection', 'rgba(255,255,255,0.25)')
;(globalThis as any).getComputedStyle = vi.fn().mockReturnValue({
  getPropertyValue: (prop: string) => computedStyle.get(prop) || ''
})

// crypto.randomUUID — might not be available in all test environments
if (!globalThis.crypto?.randomUUID) {
  ;(globalThis as any).crypto = {
    ...(globalThis.crypto || {}),
    randomUUID: vi.fn(() => '00000000-0000-4000-8000-000000000000')
  }
}

// ResizeObserver — used by some UI libraries
;(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Global test setup
beforeAll(() => {
})

afterAll(() => {
})
