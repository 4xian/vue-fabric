import { describe, it, expect, vi, beforeEach } from 'vitest'
import AreaTool from '../../../src/tools/AreaTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('AreaTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: AreaTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = {
      canvas,
      eventBus,
      lineColor: '#ff0000',
      fillColor: '#00ff00',
      pauseHistory: vi.fn(),
      resumeHistory: vi.fn(),
      setTool: vi.fn()
    }
    tool = new AreaTool({})
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化区域工具', () => {
      expect(tool.name).toBe('area')
      expect(tool.isDrawing()).toBe(false)
    })

    it('应该使用默认配置', () => {
      expect(tool.options.pointRadius).toBeDefined()
      expect(tool.options.closeThreshold).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new AreaTool({ closeThreshold: 20 })
      expect(customTool.options.closeThreshold).toBe(20)
    })
  })

  describe('onActivate()', () => {
    it('应该禁用画布选择', () => {
      tool.activate()
      expect(canvas.selection).toBe(false)
    })
  })

  describe('onDeactivate()', () => {
    it('应该启用画布选择', () => {
      tool.activate()
      tool.deactivate()
      expect(canvas.selection).toBe(true)
    })

    it('应该取消正在进行的绘制', () => {
      tool.activate()
      canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))

      const mockEvent = {
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      }
      tool.onMouseDown(mockEvent as any)
      expect(tool.isDrawing()).toBe(true)

      tool.deactivate()
      expect(tool.isDrawing()).toBe(false)
    })
  })

  describe('绘制流程', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn()
      canvas.setActiveObject = vi.fn()
    })

    it('第一次点击应开始绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      const mockEvent = {
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      }

      tool.onMouseDown(mockEvent as any)
      expect(tool.isDrawing()).toBe(true)
      expect(mockPaintBoard.pauseHistory).toHaveBeenCalled()
    })

    it('连续点击应添加多个顶点', () => {
      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 }
      ]

      points.forEach(point => {
        canvas.getPointer.mockReturnValue(point)
        tool.onMouseDown({
          e: new MouseEvent('mousedown', { button: 0 }),
          target: null
        } as any)
      })

      expect(tool.isDrawing()).toBe(true)
      expect(canvas.add).toHaveBeenCalled()
    })

    it('非左键点击不应添加顶点', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      const mockEvent = {
        e: new MouseEvent('mousedown', { button: 2 }),
        target: null
      }

      tool.onMouseDown(mockEvent as any)
      expect(tool.isDrawing()).toBe(false)
    })
  })

  describe('撤销/重做', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn()
    })

    it('绘制中可以撤销', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      } as any)

      canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      } as any)

      expect(tool.canUndoTool()).toBe(true)
      expect(tool.undo()).toBe(true)
    })

    it('未绘制时不能撤销', () => {
      expect(tool.canUndoTool()).toBe(false)
      expect(tool.undo()).toBe(false)
    })

    it('撤销后可以重做', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      } as any)

      tool.undo()
      expect(tool.canRedoTool()).toBe(true)
      expect(tool.redo()).toBe(true)
    })
  })

  describe('键盘事件', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))
    })

    it('按Escape应取消绘制', () => {
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: null
      } as any)
      expect(tool.isDrawing()).toBe(true)

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(tool.isDrawing()).toBe(false)
    })
  })

  describe('allowOverlap配置', () => {
    it('allowOverlap为false时点击已有区域应选中', () => {
      const customTool = new AreaTool({ allowOverlap: false })
      customTool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
      customTool.activate()

      const mockArea = {
        customType: 'area',
        customData: {}
      }

      canvas.setActiveObject = vi.fn()
      customTool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: mockArea
      } as any)

      expect(canvas.setActiveObject).toHaveBeenCalledWith(mockArea)
    })
  })
})
