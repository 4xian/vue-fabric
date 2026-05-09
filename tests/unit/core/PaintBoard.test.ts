import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fabric from 'fabric'
import PaintBoard from '../../../src/core/PaintBoard'

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverMock.instances.push(this)
  }

  trigger(width: number, height: number, target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: { width, height } as DOMRectReadOnly
        } as ResizeObserverEntry
      ],
      this as unknown as ResizeObserver
    )
  }

  static reset(): void {
    ResizeObserverMock.instances = []
  }
}

global.ResizeObserver = ResizeObserverMock as any

describe('PaintBoard - 核心功能', () => {
  let container: HTMLDivElement
  let board: PaintBoard

  beforeEach(() => {
    ResizeObserverMock.reset()
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
    vi.useRealTimers()
  })

  describe('resize', () => {
    it('resize() 应只调整展示层，不改逻辑对象数据', () => {
      const rect = new fabric.Rect({
        left: 100,
        top: 80,
        width: 120,
        height: 60,
        scaleX: 1.5,
        scaleY: 1.25
      })
      board.canvas!.add(rect)

      const before = {
        left: rect.left,
        top: rect.top,
        scaleX: rect.scaleX,
        scaleY: rect.scaleY
      }

      board.resize(1000, 700)

      expect(rect.left).toBe(before.left)
      expect(rect.top).toBe(before.top)
      expect(rect.scaleX).toBe(before.scaleX)
      expect(rect.scaleY).toBe(before.scaleY)
      expect(board.canvas?.getWidth()).toBe(800)
      expect(board.canvas?.getHeight()).toBe(600)
      expect(board.canvas?.viewportTransform?.[0]).toBeCloseTo(1000 / 800 > 700 / 600 ? 700 / 600 : 1000 / 800)
    })

    it('resize() 应触发 canvas:resized 事件', () => {
      const callback = vi.fn()
      board.on('canvas:resized', callback)
      board.resize(900, 700)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 900,
          height: 700,
          origin: 'center'
        })
      )
    })

    it('resize() 传入 0 或负数时应被忽略', () => {
      const oldTransform = [...(board.canvas?.viewportTransform || [])]
      board.resize(0, 0)
      expect(board.canvas?.viewportTransform).toEqual(oldTransform)
    })
  })

  describe('autoResize', () => {
    it('enableAutoResize() 应启用自动调整', () => {
      const result = board.enableAutoResize()
      expect(result).toBe(board)
      expect(ResizeObserverMock.instances).toHaveLength(1)
    })

    it('容器变化时应经过 500ms 防抖后只执行最后一次 resize', () => {
      vi.useFakeTimers()
      const autoBoard = new PaintBoard(container, {
        width: 800,
        height: 600,
        autoResize: true
      })
      autoBoard.init()
      const resizeSpy = vi.spyOn(autoBoard, 'resize')
      const observer = ResizeObserverMock.instances.at(-1)!

      observer.trigger(900, 700, container)
      observer.trigger(1000, 720, container)

      vi.advanceTimersByTime(499)
      expect(resizeSpy).not.toHaveBeenCalledWith(1000, 720, undefined, 'center')

      vi.advanceTimersByTime(1)
      expect(resizeSpy).toHaveBeenLastCalledWith(1000, 720, undefined, 'center')

      autoBoard.destroy()
    })

    it('disableAutoResize() 应断开监听并清理防抖定时器', () => {
      vi.useFakeTimers()
      const autoBoard = new PaintBoard(container, {
        width: 800,
        height: 600,
        autoResize: true
      })
      autoBoard.init()
      const observer = ResizeObserverMock.instances.at(-1)!

      observer.trigger(900, 700, container)
      autoBoard.disableAutoResize()
      vi.runAllTimers()

      expect(observer.disconnect).toHaveBeenCalled()
      autoBoard.destroy()
    })
  })

  describe('pixelRatio', () => {
    it('pixelRatio 不应影响初始业务缩放', () => {
      const ratioBoard = new PaintBoard(container, {
        width: 800,
        height: 600,
        autoResize: false,
        pixelRatio: 3
      })
      ratioBoard.init()

      expect(ratioBoard.getPixelRatio()).toBe(3)
      expect(ratioBoard.getZoom()).toBe(1)
      expect(ratioBoard.canvas?.getWidth()).toBe(800)
      expect(ratioBoard.canvas?.getHeight()).toBe(600)

      ratioBoard.destroy()
    })
  })

  describe('clear', () => {
    it('originClear() 应清空画布', () => {
      board.originClear()
      expect(board.canvas?.getObjects().length).toBe(0)
    })

    it('originClear() 应触发 canvas:cleared 事件', () => {
      let cleared = false
      board.on('canvas:cleared', () => {
        cleared = true
      })
      board.originClear()
      expect(cleared).toBe(true)
    })
  })

  describe('辅助元素', () => {
    it('showAllAreaHelpers() 应返回 this', () => {
      const result = board.showAllAreaHelpers()
      expect(result).toBe(board)
    })

    it('hideAllAreaHelpers() 应返回 this', () => {
      const result = board.hideAllAreaHelpers()
      expect(result).toBe(board)
    })
  })

  describe('撤销还原', () => {
    it('canUndo() 应回退到全局历史管理器', () => {
      board.undoRedoManager = {
        canUndo: vi.fn(() => true)
      } as any

      expect(board.canUndo()).toBe(true)
      expect(board.undoRedoManager.canUndo).toHaveBeenCalled()
    })

    it('redo() 应回退到全局历史管理器', () => {
      board.undoRedoManager = {
        redo: vi.fn(() => true)
      } as any

      expect(board.redo()).toBe(true)
      expect(board.undoRedoManager.redo).toHaveBeenCalled()
    })
  })
})
