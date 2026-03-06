import { describe, it, expect, vi, beforeEach } from 'vitest'
import SelectTool from '../../../src/tools/SelectTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { createMockFabricObject } from '../../fixtures/mockFabricObjects'
import type { Canvas } from 'fabric'

describe('SelectTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: SelectTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = { canvas, eventBus }
    tool = new SelectTool()
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化选择工具', () => {
      expect(tool.name).toBe('select')
      expect(tool.options.allowSelection).toBeDefined()
    })

    it('应该使用默认配置', () => {
      expect(tool.options.activeCursor).toBeDefined()
      expect(tool.options.deactiveCursor).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new SelectTool({ allowSelection: false })
      expect(customTool.options.allowSelection).toBe(false)
    })
  })

  describe('onActivate()', () => {
    it('应该启用画布选择', () => {
      tool.activate()
      expect(canvas.selection).toBe(tool.options.allowSelection)
    })

    it('应该设置激活光标', () => {
      tool.activate()
      expect(canvas.defaultCursor).toBe(tool.options.activeCursor)
    })

    it('应该使区域对象可选', () => {
      const areaObj = createMockFabricObject()
      areaObj.customType = 'area'
      areaObj.set = vi.fn()
      canvas.add(areaObj)

      tool.activate()

      expect(areaObj.set).toHaveBeenCalledWith({
        selectable: true,
        evented: true
      })
    })
  })

  describe('onDeactivate()', () => {
    beforeEach(() => {
      tool.activate()
    })

    it('应该取消选中对象', () => {
      tool.deactivate()
      expect(canvas.discardActiveObject).toHaveBeenCalled()
    })

    it('应该重新渲染画布', () => {
      tool.deactivate()
      expect(canvas.renderAll).toHaveBeenCalled()
    })
  })
})
