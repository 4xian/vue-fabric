import { describe, it, expect, vi, beforeEach } from 'vitest'
import CanvasManager from '../../../src/core/CanvasManager'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { TEST_CANVAS_SIZE, TEST_ZOOM } from '../../fixtures/testData'
import type { Canvas } from 'fabric'

describe('CanvasManager', () => {
  let canvas: any
  let eventBus: EventBus
  let manager: CanvasManager

  beforeEach(() => {
    canvas = createMockCanvas({
      width: TEST_CANVAS_SIZE.width,
      height: TEST_CANVAS_SIZE.height,
      zoom: TEST_ZOOM.default
    })
    eventBus = new EventBus()
  })

  describe('初始化', () => {
    it('应该使用默认配置初始化', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
      expect(manager.options.zoomStep).toBe(1.1)
      expect(manager.options.minZoom).toBe(0.2)
      expect(manager.options.maxZoom).toBe(5)
      expect(manager.options.zoomOrigin).toBe('center')
      expect(manager.options.enableWheelZoom).toBe(false)
    })

    it('应该使用自定义配置初始化', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus, {
        zoomStep: 1.5,
        minZoom: 0.5,
        maxZoom: 10,
        zoomOrigin: 'topLeft',
        enableWheelZoom: true
      })
      expect(manager.options.zoomStep).toBe(1.5)
      expect(manager.options.minZoom).toBe(0.5)
      expect(manager.options.maxZoom).toBe(10)
      expect(manager.options.zoomOrigin).toBe('topLeft')
      expect(manager.options.enableWheelZoom).toBe(true)
    })

    it('enableWheelZoom 默认为 false 时不绑定滚轮缩放', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
      expect(vi.mocked(canvas.on).mock.calls.some(call => call[0] === 'mouse:wheel')).toBe(false)
    })

    it('enableWheelZoom=true 时绑定滚轮缩放', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus, {
        enableWheelZoom: true
      })
      expect(vi.mocked(canvas.on).mock.calls.some(call => call[0] === 'mouse:wheel')).toBe(true)
    })
  })

  describe('zoomIn() - 放大', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该放大画布', () => {
      const initialZoom = canvas.getZoom()
      manager.zoomIn()
      expect(canvas.setViewportTransform).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(initialZoom * 1.1)
      expect(callArgs[0][3]).toBeCloseTo(initialZoom * 1.1)
    })

    it('应该限制最大缩放', () => {
      canvas.viewportTransform = [4.8, 0, 0, 4.8, 0, 0]
      manager.zoomIn()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(5)
    })

    it('应该触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)
      manager.zoomIn()
      expect(callback).toHaveBeenCalled()
    })

    it('使用 center 原点时应该在画布中心缩放', () => {
      manager.zoomIn('center')
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo((TEST_CANVAS_SIZE.width - TEST_CANVAS_SIZE.width * 1.1) / 2)
      expect(callArgs[0][5]).toBeCloseTo((TEST_CANVAS_SIZE.height - TEST_CANVAS_SIZE.height * 1.1) / 2)
    })

    it('使用 topLeft 原点时应贴左上缩放', () => {
      manager.zoomIn('topLeft')
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBe(0)
      expect(callArgs[0][5]).toBe(0)
    })
  })

  describe('zoomOut() - 缩小', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该缩小画布', () => {
      const initialZoom = canvas.getZoom()
      manager.zoomOut()
      expect(canvas.setViewportTransform).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(initialZoom / 1.1)
      expect(callArgs[0][3]).toBeCloseTo(initialZoom / 1.1)
    })

    it('应该限制最小缩放', () => {
      canvas.viewportTransform = [0.25, 0, 0, 0.25, 0, 0]
      manager.zoomOut()
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(0.2, 1)
    })

    it('应该触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)
      manager.zoomOut()
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('resetZoom() - 重置缩放', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该重置画布缩放', () => {
      manager.zoomIn()
      manager.resetZoom()
      expect(canvas.setViewportTransform).toHaveBeenCalledWith([1, 0, 0, 1, 0, 0])
    })

    it('应该触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)
      manager.resetZoom()
      expect(callback).toHaveBeenCalledWith(1)
    })
  })

  describe('setZoom() - 设置缩放', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该设置指定的缩放值', () => {
      manager.setZoom(2)
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(2)
    })

    it('display 尺寸与 logical 不一致时，number zoom 应按相对 fit 倍率计算', () => {
      canvas.lowerCanvasEl = { clientWidth: 1200, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1200, clientHeight: 600, style: {} }

      manager.setZoom(2)

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBeCloseTo(1.5)
    })

    it('应该限制缩放范围', () => {
      manager.setZoom(10)
      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][0]).toBe(5)

      vi.mocked(canvas.setViewportTransform).mockClear()
      manager.setZoom(0.1)
      const callArgs2 = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs2[0][0]).toBe(0.2)
    })

    it('应该支持 ZoomScale 对象', () => {
      manager.setZoom({ x: 2, y: 1.5 })
      expect(canvas.setViewportTransform).toHaveBeenCalled()
    })

    it('应该触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)
      manager.setZoom(2)
      expect(callback).toHaveBeenCalledWith(2)
    })

    it('center 模式应按容器与缩放后画布差值平均居中', () => {
      canvas.lowerCanvasEl = { clientWidth: 1000, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1000, clientHeight: 600, style: {} }
      canvas.getWidth = vi.fn(() => 1000)
      canvas.getHeight = vi.fn(() => 600)

      manager.setZoom(0.5, 'center')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(250)
      expect(callArgs[0][5]).toBeCloseTo(150)
    })

    it('center 模式在画布已平移后应围绕当前画布内容中心缩放', () => {
      canvas.viewportTransform = [1, 0, 0, 1, 120, 80]

      manager.setZoom(2, 'center')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(-280)
      expect(callArgs[0][5]).toBeCloseTo(-320)
    })

    it('topLeft 模式在画布已平移后应保持当前画布左上锚点', () => {
      canvas.viewportTransform = [1, 0, 0, 1, 120, 80]

      manager.setZoom(2, 'topLeft')

      const callArgs = vi.mocked(canvas.setViewportTransform).mock.calls[0]
      expect(callArgs[0][4]).toBeCloseTo(120)
      expect(callArgs[0][5]).toBeCloseTo(80)
    })
  })

  describe('getZoom() - 获取缩放', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该返回当前缩放值', () => {
      const zoom = manager.getZoom()
      expect(zoom).toBe(1)
    })

    it('fitViewport 场景下应返回相对 fit 的业务 zoom', () => {
      canvas.viewportTransform = [0.75, 0, 0, 0.75, 100, 50]
      canvas.lowerCanvasEl = { clientWidth: 1200, clientHeight: 600, style: {} }
      canvas.wrapperEl = { clientWidth: 1200, clientHeight: 600, style: {} }

      const zoom = manager.getZoom()
      expect(zoom).toBeCloseTo(1)
    })
  })

  describe('resetZoom() - 指定还原倍率', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该支持传入还原倍率，并回到容器居中视图', () => {
      canvas.viewportTransform = [2, 0, 0, 2, 120, 80]

      manager.resetZoom(0.5)

      expect(canvas.setViewportTransform).toHaveBeenCalledWith([0.5, 0, 0, 0.5, 200, 200])
    })
  })
})
