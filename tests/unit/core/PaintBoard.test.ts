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

  const createBoard = (options: ConstructorParameters<typeof PaintBoard>[1] = {}) =>
    new PaintBoard(container, {
      width: 800,
      height: 600,
      autoResize: false,
      zoomAnimationDuration: 0,
      ...options
    })

  beforeEach(() => {
    ResizeObserverMock.reset()
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', {
      configurable: true,
      get: () => 800
    })
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      get: () => 600
    })
    document.body.appendChild(container)
    board = createBoard()
    board.init()
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
    vi.useRealTimers()
  })

  describe('resize', () => {
    it('resize() 应重建画布尺寸，但不改逻辑对象数据', () => {
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
      expect(board.canvas?.getWidth()).toBe(1000)
      expect(board.canvas?.getHeight()).toBe(700)
      expect(board.canvas?.viewportTransform?.[0]).toBeCloseTo(1)
      expect(board.canvas?.viewportTransform?.[3]).toBeCloseTo(1)
      expect(board.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(board.canvas?.viewportTransform?.[5]).toBeCloseTo(0)
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

    it('fitViewport resize() 应同步触发 canvas:zoomed 事件并重置业务 zoom', () => {
      const callback = vi.fn()
      board.on('canvas:zoomed', callback)

      board.resize(900, 700)

      expect(callback).toHaveBeenCalledWith(1)
      expect(board.getZoom()).toBeCloseTo(1)
    })

    it('resize() 传入 0 或负数时应被忽略', () => {
      const oldTransform = [...(board.canvas?.viewportTransform || [])]

      board.resize(0, 0)

      expect(board.canvas?.viewportTransform).toEqual(oldTransform)
    })

    it('autoResize 场景下 resize() 应按新尺寸重建画布，并延续当前业务缩放', () => {
      const fitBoard = createBoard({
        width: 1000,
        height: 800,
        autoResize: true
      })
      fitBoard.init()

      expect(fitBoard.canvas?.getWidth()).toBe(800)
      expect(fitBoard.canvas?.getHeight()).toBe(600)
      expect(fitBoard.getZoom()).toBeCloseTo(1)

      fitBoard.zoomIn()
      expect(fitBoard.getZoom()).toBeCloseTo(1.2)

      fitBoard.resize(1200, 700)

      expect(fitBoard.getZoom()).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.getWidth()).toBe(1200)
      expect(fitBoard.canvas?.getHeight()).toBe(700)
      expect(fitBoard.canvas?.viewportTransform?.[0]).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.viewportTransform?.[3]).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.viewportTransform?.[4]).toBeCloseTo(-120)
      expect(fitBoard.canvas?.viewportTransform?.[5]).toBeCloseTo(-70)

      fitBoard.destroy()
    })

    it('topLeft 原点下 resize() 也应延续当前业务缩放', () => {
      const fitBoard = createBoard({
        width: 1000,
        height: 800,
        autoResize: true,
        zoomOrigin: 'topLeft'
      })
      fitBoard.init()

      fitBoard.zoomIn()
      fitBoard.resize(1200, 700)

      expect(fitBoard.getZoom()).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.getWidth()).toBe(1200)
      expect(fitBoard.canvas?.getHeight()).toBe(700)
      expect(fitBoard.canvas?.viewportTransform?.[0]).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.viewportTransform?.[3]).toBeCloseTo(1.2)
      expect(fitBoard.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(fitBoard.canvas?.viewportTransform?.[5]).toBeCloseTo(0)

      fitBoard.destroy()
    })

    it('viewport 模式应保持 referenceSize 并按显示区适配', () => {
      const fitBoard = createBoard({
        width: 800,
        height: 600,
        autoResize: true,
        autoResizeMode: 'viewport',
        autoResizeFit: 'contain',
        referenceSize: { width: 800, height: 600 }
      })
      fitBoard.init()

      fitBoard.resize(1200, 700)

      expect((fitBoard as any)._getLogicalCanvasSize()).toEqual({ width: 800, height: 600 })
      expect(fitBoard.canvas?.getWidth()).toBe(1200)
      expect(fitBoard.canvas?.getHeight()).toBe(700)
      expect(fitBoard.canvas?.viewportTransform?.[0]).toBeCloseTo(700 / 600)
      expect(fitBoard.canvas?.viewportTransform?.[3]).toBeCloseTo(700 / 600)
      expect(fitBoard.canvas?.viewportTransform?.[4]).toBeCloseTo((1200 - 800 * (700 / 600)) / 2)
      expect(fitBoard.canvas?.viewportTransform?.[5]).toBeCloseTo(0)

      fitBoard.destroy()
    })

    it('viewport 模式在未传 referenceSize 时应回退到初始容器尺寸', () => {
      const fitBoard = createBoard({
        width: 1000,
        height: 800,
        autoResize: true,
        autoResizeMode: 'viewport'
      })
      fitBoard.init()

      expect((fitBoard as any)._getLogicalCanvasSize()).toEqual({ width: 800, height: 600 })

      fitBoard.resize(1200, 700)

      expect((fitBoard as any)._getLogicalCanvasSize()).toEqual({ width: 800, height: 600 })

      fitBoard.destroy()
    })

    it('cover 模式应按 referenceSize 填满显示区', () => {
      const fitBoard = createBoard({
        width: 800,
        height: 600,
        autoResize: true,
        autoResizeMode: 'viewport',
        autoResizeFit: 'cover',
        referenceSize: { width: 800, height: 600 }
      })
      fitBoard.init()

      fitBoard.resize(1200, 700)

      expect(fitBoard.canvas?.viewportTransform?.[0]).toBeCloseTo(1.5)
      expect(fitBoard.canvas?.viewportTransform?.[3]).toBeCloseTo(1.5)
      expect(fitBoard.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(fitBoard.canvas?.viewportTransform?.[5]).toBeCloseTo(-100)

      fitBoard.destroy()
    })

    it('stretch 模式应独立缩放 x 和 y', () => {
      const fitBoard = createBoard({
        width: 800,
        height: 600,
        autoResize: true,
        autoResizeMode: 'viewport',
        autoResizeFit: 'stretch',
        referenceSize: { width: 800, height: 600 }
      })
      fitBoard.init()

      fitBoard.resize(1200, 700)

      expect(fitBoard.canvas?.viewportTransform?.[0]).toBeCloseTo(1.5)
      expect(fitBoard.canvas?.viewportTransform?.[3]).toBeCloseTo(700 / 600)
      expect(fitBoard.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(fitBoard.canvas?.viewportTransform?.[5]).toBeCloseTo(0)

      fitBoard.destroy()
    })
  })

  describe('zoom routing', () => {
    it('应通过 FabricPaintOptions 把缩放配置传给 CanvasManager', () => {
      const configuredBoard = createBoard({
        zoomStep: 0.5,
        minZoom: 0.4,
        maxZoom: 6,
        expandMargin: 30,
        expandSize: 120,
        zoomOrigin: 'topLeft',
        zoomAnimationDuration: 250,
        enableWheelZoom: true
      })
      configuredBoard.init()

      expect(configuredBoard.canvasManager?.options).toEqual(
        expect.objectContaining({
          zoomStep: 0.5,
          minZoom: 0.4,
          maxZoom: 6,
          expandMargin: 30,
          expandSize: 120,
          zoomOrigin: 'topLeft',
          zoomAnimationDuration: 250,
          enableWheelZoom: true
        })
      )

      configuredBoard.destroy()
    })

    it('canvas:zooming 时也应同步 viewport 展示层', () => {
      const syncViewportPresentation = vi.spyOn(board as never, '_syncViewportPresentation' as never)

      ;(board as any).eventBus.emit('canvas:zooming')

      expect(syncViewportPresentation).toHaveBeenCalled()
    })

    it('resize() 的缩放应复用 CanvasManager.setViewportTransform', () => {
      const setViewportTransform = vi.spyOn(board.canvasManager!, 'setViewportTransform')

      board.resize(900, 700)

      expect(setViewportTransform).toHaveBeenCalled()
    })

    it('viewport-fit 下 resetZoom() 也应复用 CanvasManager.setViewportTransform', () => {
      const fitBoard = createBoard({
        width: 1000,
        height: 800,
        autoResize: true
      })
      fitBoard.init()
      const setViewportTransform = vi.spyOn(fitBoard.canvasManager!, 'setViewportTransform')

      fitBoard.resetZoom(0.5)

      expect(setViewportTransform).toHaveBeenCalled()
      fitBoard.destroy()
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
      const autoBoard = createBoard({
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
      const autoBoard = createBoard({
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
      const ratioBoard = createBoard({
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

  describe('zoomOrigin', () => {
    it('修改 board.options.zoomOrigin 后默认缩放应同步使用新的锚点', () => {
      board.options.zoomOrigin = 'topLeft'
      board.zoomIn()

      expect(board.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(board.canvas?.viewportTransform?.[5]).toBeCloseTo(0)
    })

    it('setZoomOrigin() 应同步更新默认缩放锚点', () => {
      board.setZoomOrigin('topLeft').resetZoom().zoomIn()

      expect(board.canvas?.viewportTransform?.[4]).toBeCloseTo(0)
      expect(board.canvas?.viewportTransform?.[5]).toBeCloseTo(0)
    })

    it('resetZoom() 应支持传入还原倍率，默认仍回到居中视图', () => {
      board.setZoom(2)
      board.resetZoom(0.5)

      expect(board.getZoom()).toBeCloseTo(0.5)
      expect(board.canvas?.viewportTransform?.[4]).toBeCloseTo(200)
      expect(board.canvas?.viewportTransform?.[5]).toBeCloseTo(150)
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
      expect(board.showAllAreaHelpers()).toBe(board)
    })

    it('hideAllAreaHelpers() 应返回 this', () => {
      expect(board.hideAllAreaHelpers()).toBe(board)
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
        canRedo: vi.fn(() => true),
        redo: vi.fn(() => true)
      } as any

      expect(board.redo()).toBe(true)
      expect(board.undoRedoManager.canRedo).toHaveBeenCalled()
      expect(board.undoRedoManager.redo).toHaveBeenCalled()
    })

    it('redo() should prefer global history before tool redo', () => {
      const tool = {
        canRedoTool: vi.fn(() => true),
        redo: vi.fn(() => true),
        deactivate: vi.fn(),
        destroy: vi.fn()
      }
      board.currentTool = tool as any
      board.undoRedoManager = {
        canRedo: vi.fn(() => true),
        redo: vi.fn(() => true)
      } as any

      expect(board.redo()).toBe(true)
      expect(board.undoRedoManager.redo).toHaveBeenCalled()
      expect(tool.redo).not.toHaveBeenCalled()
    })
  })
})
