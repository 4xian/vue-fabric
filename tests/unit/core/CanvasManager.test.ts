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
    })

    it('应该使用自定义配置初始化', () => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus, {
        zoomStep: 1.5,
        minZoom: 0.5,
        maxZoom: 10,
        zoomOrigin: 'topLeft'
      })
      expect(manager.options.zoomStep).toBe(1.5)
      expect(manager.options.minZoom).toBe(0.5)
      expect(manager.options.maxZoom).toBe(10)
      expect(manager.options.zoomOrigin).toBe('topLeft')
    })
  })

  describe('zoomIn() - 放大', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该放大画布', () => {
      const initialZoom = canvas.getZoom()
      manager.zoomIn()
      expect(canvas.zoomToPoint).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBeCloseTo(initialZoom * 1.1)
    })

    it('应该限制最大缩放', () => {
      canvas.getZoom = vi.fn(() => 4.8)
      manager.zoomIn()
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBe(5)
    })

    it('应该触发 canvas:zoomed 事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:zoomed', callback)
      manager.zoomIn()
      expect(callback).toHaveBeenCalled()
    })

    it('使用 center 原点应该在画布中心缩放', () => {
      manager.zoomIn('center')
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[0]).toEqual(
        expect.objectContaining({
          x: TEST_CANVAS_SIZE.width / 2,
          y: TEST_CANVAS_SIZE.height / 2
        })
      )
    })

    it('使用 topLeft 原点应该在左上角缩放', () => {
      manager.zoomIn('topLeft')
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[0]).toEqual(
        expect.objectContaining({
          x: 0,
          y: 0
        })
      )
    })
  })

  describe('zoomOut() - 缩小', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该缩小画布', () => {
      const initialZoom = canvas.getZoom()
      manager.zoomOut()
      expect(canvas.zoomToPoint).toHaveBeenCalled()
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBeCloseTo(initialZoom / 1.1)
    })

    it('应该限制最小缩放', () => {
      canvas.getZoom = vi.fn(() => 0.25)
      manager.zoomOut()
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBeCloseTo(0.2, 1)
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
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBe(2)
    })

    it('应该限制缩放范围', () => {
      manager.setZoom(10)
      const callArgs = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs[1]).toBe(5)

      vi.mocked(canvas.zoomToPoint).mockClear()
      manager.setZoom(0.1)
      const callArgs2 = vi.mocked(canvas.zoomToPoint).mock.calls[0]
      expect(callArgs2[1]).toBe(0.2)
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
  })

  describe('getZoom() - 获取缩放', () => {
    beforeEach(() => {
      manager = new CanvasManager(canvas as unknown as Canvas, eventBus)
    })

    it('应该返回当前缩放值', () => {
      const zoom = manager.getZoom()
      expect(zoom).toBe(1)
    })
  })
})
