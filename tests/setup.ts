import { vi } from 'vitest'

// Mock SVG path methods（jsdom 未实现）
if (typeof SVGPathElement !== 'undefined') {
  SVGPathElement.prototype.getTotalLength = vi.fn(() => 100)
  SVGPathElement.prototype.getPointAtLength = vi.fn(() => ({ x: 50, y: 50 }))
} else {
  // jsdom 中通过 prototype 链注入
  Object.defineProperty(Element.prototype, 'getTotalLength', {
    value: vi.fn(() => 100),
    writable: true,
    configurable: true
  })
  Object.defineProperty(Element.prototype, 'getPointAtLength', {
    value: vi.fn(() => ({ x: 50, y: 50 })),
    writable: true,
    configurable: true
  })
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock HTMLCanvasElement
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn()
}))

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock')
HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  callback(new Blob(['mock'], { type: 'image/png' }))
})
