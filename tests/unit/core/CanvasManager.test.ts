import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Canvas } from 'fabric'
import type { FabricPaintOptions } from '../../../types'
import CanvasManager from '../../../src/core/CanvasManager'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { TEST_CANVAS_SIZE, TEST_ZOOM } from '../../fixtures/testData'

describe('CanvasManager', () => {
  let canvas: any
  let eventBus: EventBus
  let manager: CanvasManager

  const createManager = (options: FabricPaintOptions = {}) =>
    new CanvasManager(canvas as unknown as Canvas, eventBus, {
      zoomAnimationDuration: 0,
      ...options
    })

  beforeEach(() => {
    canvas = createMockCanvas({
      width: TEST_CANVAS_SIZE.width,
      height: TEST_CANVAS_SIZE.height,
      zoom: TEST_ZOOM.default
    })
    eventBus = new EventBus()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始化', () => {
    it('应使用默认配置初始化', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)

      expect(manager.options.zoomStep).toBe(0.2)
      expect(manager.options.minZoom).toBe(0.2)
      expect(manager.options.maxZoom).toBe(3)
      expect(manager.options.zoomOrigin).toBe('center')
      expect(manager.options.zoomAnimationDuration).toBe(500)
      expect(manager.options.enableWheelZoom).toBe(false)
      expect(manager.options.autoResize).toBe(true)
      expect(manager.options.autoResizeFit).toBe('stretch')
    })

    it('应使用自定义配置初始化', () => {
      manager = createManager({
        zoomStep: 0.2,
        minZoom: 0.5,
        maxZoom: 10,
        zoomOrigin: 'topLeft',
        zoomAnimationDuration: 250,
        enableWheelZoom: true
      })

      expect(manager.options.zoomStep).toBe(0.2)
      expect(manager.options.minZoom).toBe(0.5)
      expect(manager.options.maxZoom).toBe(10)
      expect(manager.options.zoomOrigin).toBe('topLeft')
      expect(manager.options.zoomAnimationDuration).toBe(250)
      expect(manager.options.enableWheelZoom).toBe(true)
    })

    it('enableWheelZoom 默认为 false 时不绑定滚轮缩放', () => {
      manager = createManager()

      expect(vi.mocked(canvas.on).mock.calls.some(call => call[0] === 'mouse:wheel')).toBe(false)
    })

    it('enableWheelZoom=true 时绑定滚轮缩放', () => {
      manager = createManager({ enableWheelZoom: true })

      expect(vi.mocked(canvas.on).mock.calls.some(call => call[0] === 'mouse:wheel')).toBe(true)
    })
  })

  describe('zoomIn()', () => {
    beforeEach(() => {
      manager = createManager()
    })

    it('应放大画布', () => {
      const initialZoom = canvas.getZoom()

      manager.zoomIn()

      expect(canvas.setViewportTransform).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(initialZoom * 1.2)
      expect(callArgs[0][3]).toBeCloseTo(initialZoom * 1.2)
    })

    it('应限制最大缩放', () => {
      canvas.viewportTransform = [4.8, 0, 0, 4.8, 0, 0]

      manager.zoomIn()

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(3)
    })

    it('应触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)

      manager.zoomIn()

      expect(callback).toHaveBeenCalledWith(1.2)
    })

    it('center 原点应围绕当前内容中心缩放', () => {
      manager.zoomIn('center')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo((TEST_CANVAS_SIZE.width - TEST_CANVAS_SIZE.width * 1.2) / 2)
      expect(callArgs[0][5]).toBeCloseTo(
        (TEST_CANVAS_SIZE.height - TEST_CANVAS_SIZE.height * 1.2) / 2
      )
    })

    it('topLeft 原点应保持左上锚点', () => {
      manager.zoomIn('topLeft')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBe(0)
      expect(callArgs[0][5]).toBe(0)
    })
  })

  describe('zoomOut()', () => {
    beforeEach(() => {
      manager = createManager()
    })

    it('应缩小画布', () => {
      const initialZoom = canvas.getZoom()

      manager.zoomOut()

      expect(canvas.setViewportTransform).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(initialZoom / 1.2)
      expect(callArgs[0][3]).toBeCloseTo(initialZoom / 1.2)
    })

    it('应限制最小缩放', () => {
      canvas.viewportTransform = [0.25, 0, 0, 0.25, 0, 0]

      manager.zoomOut()

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(0.2, 1)
    })

    it('应触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)

      manager.zoomOut()

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('resetZoom()', () => {
    beforeEach(() => {
      manager = createManager()
    })

    it('应重置画布缩放', () => {
      manager.zoomIn()
      vi.mocked(canvas.setViewportTransform).mockClear()

      manager.resetZoom()

      expect(canvas.setViewportTransform).toHaveBeenCalledWith([1, 0, 0, 1, 0, 0])
    })

    it('应触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)

      manager.resetZoom()

      expect(callback).toHaveBeenCalledWith(1)
    })

    it('应支持传入还原倍率并回到显示区锚点', () => {
      canvas.viewportTransform = [2, 0, 0, 2, 120, 80]

      manager.resetZoom(0.5)

      expect(canvas.setViewportTransform).toHaveBeenCalledWith([0.5, 0, 0, 0.5, 200, 200])
    })
  })

  describe('setZoom()', () => {
    beforeEach(() => {
      manager = createManager()
    })

    it('应设置指定缩放值', () => {
      manager.setZoom(2)

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(2)
    })

    it('display 尺寸与 logical 不一致时应按相对 fit 倍率计算', () => {
      canvas.lowerCanvasEl = { clientWidth: 1200, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1200, clientHeight: 600, style: {} }

      manager.setZoom(2)

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(1.5)
    })

    it('应限制缩放范围', () => {
      manager.setZoom(10)
      let callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(3)

      vi.mocked(canvas.setViewportTransform).mockClear()
      manager.setZoom(0.1)
      callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(0.2)
    })

    it('应支持 ZoomScale 对象', () => {
      manager.setZoom({ x: 2, y: 1.5 })

      expect(canvas.setViewportTransform).toHaveBeenCalled()
    })

    it('应触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)

      manager.setZoom(2)

      expect(callback).toHaveBeenCalledWith(2)
    })

    it('center 模式应按容器与缩放后画布差值居中', () => {
      canvas.lowerCanvasEl = { clientWidth: 1000, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1000, clientHeight: 600, style: {} }
      canvas.getWidth = vi.fn(() => 1000)
      canvas.getHeight = vi.fn(() => 600)

      manager.setZoom(0.5, 'center')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(250)
      expect(callArgs[0][5]).toBeCloseTo(150)
    })

    it('center 模式在平移后仍应围绕当前内容中心缩放', () => {
      canvas.viewportTransform = [1, 0, 0, 1, 120, 80]

      manager.setZoom(2, 'center')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(-280)
      expect(callArgs[0][5]).toBeCloseTo(-320)
    })

    it('topLeft 模式在平移后应保持当前左上锚点', () => {
      canvas.viewportTransform = [1, 0, 0, 1, 120, 80]

      manager.setZoom(2, 'topLeft')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(120)
      expect(callArgs[0][5]).toBeCloseTo(80)
    })
  })

  describe('getZoom()', () => {
    beforeEach(() => {
      manager = createManager()
    })

    it('应返回当前缩放值', () => {
      expect(manager.getZoom()).toBe(1)
    })

    it('fitViewport 场景下应返回相对 fit 的业务 zoom', () => {
      canvas.viewportTransform = [0.75, 0, 0, 0.75, 100, 50]
      canvas.lowerCanvasEl = { clientWidth: 1200, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1200, clientHeight: 600, style: {} }

      expect(manager.getZoom()).toBeCloseTo(1)
    })
  })

  describe('zoom animation', () => {
    it('默认缩放动画应逐帧触发 canvas:zooming 并在结束时触发 canvas:zoomed', () => {
      const frameCallbacks: Array<(timestamp: number) => void> = []

      vi.spyOn(globalThis.performance, 'now').mockImplementation(() => 0)
      vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      })
      vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})

      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)

      const zooming = vi.fn()
      const zoomed = vi.fn()
      eventBus.on('canvas:zooming', zooming)
      eventBus.on('canvas:zoomed', zoomed)

      manager.setZoom(2)

      expect(canvas.setViewportTransform).not.toHaveBeenCalled()
      expect(frameCallbacks).toHaveLength(1)

      frameCallbacks.shift()!(200)

      expect(canvas.setViewportTransform).toHaveBeenCalled()
      expect(zooming).toHaveBeenCalled()
      expect(zoomed).not.toHaveBeenCalled()
      expect(frameCallbacks).toHaveLength(1)

      frameCallbacks.shift()!(1000)

      expect(zoomed).toHaveBeenCalledWith(2)
      expect(vi.mocked(canvas.setViewportTransform).mock.calls.at(-1)?.[0]).toEqual([
        2, 0, 0, 2, -400, -400
      ])
    })

    it('新的缩放请求应取消上一段动画', () => {
      const frameCallbacks: Array<(timestamp: number) => void> = []
      const cancelAnimationFrame = vi
        .spyOn(globalThis, 'cancelAnimationFrame')
        .mockImplementation(() => {})

      vi.spyOn(globalThis.performance, 'now').mockImplementation(() => 0)
      vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      })

      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)

      manager.setZoom(2)
      manager.setZoom(3)

      expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
      expect(frameCallbacks).toHaveLength(2)
    })
  })
})
