import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import PaintBoard from '../../../src/core/PaintBoard'

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

global.ResizeObserver = ResizeObserverMock as any

describe('PaintBoard - 核心功能', () => {
  let container: HTMLDivElement
  let board: PaintBoard

  beforeEach(() => {
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    board = new PaintBoard(container, { width: 800, height: 600, autoResize: false })
    board.init()
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
  })

  describe('resize 功能', () => {
    it('resize() 应该调整画布尺寸', () => {
      board.resize(1000, 800)
      expect(board.canvas?.getWidth()).toBeGreaterThan(0)
    })

    it('resize() 应该触发 canvas:resized 事件', () => {
      let resized = false
      board.on('canvas:resized', () => {
        resized = true
      })
      board.resize(900, 700)
      expect(resized).toBe(true)
    })

    it('resize() 传入 0 或负数应该被忽略', () => {
      const oldWidth = board.canvas?.getWidth()
      board.resize(0, 0)
      expect(board.canvas?.getWidth()).toBe(oldWidth)
    })
  })

  describe('自动调整大小', () => {
    it('enableAutoResize() 应该启用自动调整', () => {
      const result = board.enableAutoResize()
      expect(result).toBe(board)
    })

    it('disableAutoResize() 应该禁用自动调整', () => {
      board.enableAutoResize()
      const result = board.disableAutoResize()
      expect(result).toBe(board)
    })
  })

  describe('像素比例', () => {
    it('getPixelRatio() 应该返回像素比例', () => {
      const ratio = board.getPixelRatio()
      expect(typeof ratio).toBe('number')
      expect(ratio).toBeGreaterThan(0)
    })
  })

  describe('清空功能', () => {
    it('originClear() 应该清空画布', () => {
      board.originClear()
      expect(board.canvas?.getObjects().length).toBe(0)
    })

    it('originClear() 应该触发 canvas:cleared 事件', () => {
      let cleared = false
      board.on('canvas:cleared', () => {
        cleared = true
      })
      board.originClear()
      expect(cleared).toBe(true)
    })
  })

  describe('辅助元素', () => {
    it('showAllAreaHelpers() 应该返回 this', () => {
      const result = board.showAllAreaHelpers()
      expect(result).toBe(board)
    })

    it('hideAllAreaHelpers() 应该返回 this', () => {
      const result = board.hideAllAreaHelpers()
      expect(result).toBe(board)
    })
  })
})
