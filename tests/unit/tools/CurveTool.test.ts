import { describe, it, expect, vi, beforeEach } from 'vitest'
import CurveTool from '../../../src/tools/CurveTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('CurveTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: CurveTool
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
      setTool: vi.fn(),
      isHelpersVisible: vi.fn(() => true)
    }
    tool = new CurveTool({})
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化曲线工具', () => {
      expect(tool.name).toBe('curve')
      expect(tool.isDrawing()).toBe(false)
    })

    it('应该使用默认配置', () => {
      expect(tool.options.pointRadius).toBeDefined()
      expect(tool.options.closeThreshold).toBeDefined()
      expect(tool.options.tension).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new CurveTool({ closeThreshold: 30, tension: 0.5 })
      expect(customTool.options.closeThreshold).toBe(30)
      expect(customTool.options.tension).toBe(0.5)
    })
  })

  describe('onActivate()', () => {
    it('应该禁用画布选择', () => {
      tool.activate()
      expect(canvas.selection).toBe(false)
    })

    it('应该将所有对象设为不可选择', () => {
      const mockObj = { set: vi.fn() } as any
      canvas._objects.push(mockObj)

      tool.activate()

      expect(mockObj.set).toHaveBeenCalledWith({ selectable: false, evented: false })
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

      tool.onMouseDown({
        e: new MouseEvent('mousedown'),
        target: null
      } as any)
      expect(tool.isDrawing()).toBe(true)

      tool.deactivate()
      expect(tool.isDrawing()).toBe(false)
    })
  })

  describe('绘制流程', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn()
    })

    it('第一次点击应开始绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })

      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      expect(tool.isDrawing()).toBe(true)
      expect(mockPaintBoard.pauseHistory).toHaveBeenCalled()
    })

    it('连续点击应添加多个控制点', () => {
      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 }
      ]

      points.forEach(point => {
        canvas.getPointer.mockReturnValue(point)
        tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)
      })

      expect(tool.isDrawing()).toBe(true)
      expect(canvas.add).toHaveBeenCalled()
    })

    it('鼠标移动时应更新预览', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      canvas.getPointer.mockReturnValue({ x: 150, y: 150 })
      tool.onMouseMove({ e: new MouseEvent('mousemove'), target: null } as any)

      expect(canvas.renderAll).toHaveBeenCalled()
    })

    it('未开始绘制时移动不触发预览', () => {
      canvas.renderAll.mockClear()
      canvas.getPointer.mockReturnValue({ x: 150, y: 150 })
      tool.onMouseMove({ e: new MouseEvent('mousemove'), target: null } as any)

      // renderAll 不应被额外调用
      expect(canvas.renderAll).not.toHaveBeenCalled()
    })
  })

  describe('按 Enter 键完成绘制', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn()
    })

    it('Enter 键应完成绘制并触发事件', () => {
      const callback = vi.fn()
      eventBus.on('curve:created', callback)

      const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 }
      ]

      points.forEach(point => {
        canvas.getPointer.mockReturnValue(point)
        tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)
      })

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }))

      expect(tool.isDrawing()).toBe(false)
      expect(callback).toHaveBeenCalled()
    })

    it('点数不足时按 Enter 应取消绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }))
      expect(tool.isDrawing()).toBe(false)
    })
  })

  describe('键盘事件', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))
    })

    it('按 Escape 应取消绘制', () => {
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)
      expect(tool.isDrawing()).toBe(true)

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(tool.isDrawing()).toBe(false)
    })

    it('取消绘制应恢复历史记录', () => {
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)
      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))

      expect(mockPaintBoard.resumeHistory).toHaveBeenCalled()
    })
  })

  describe('撤销/重做', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn()
    })

    it('绘制中可以撤销', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      expect(tool.canUndoTool()).toBe(true)
      expect(tool.undo()).toBe(true)
    })

    it('未绘制时不能撤销', () => {
      expect(tool.canUndoTool()).toBe(false)
      expect(tool.undo()).toBe(false)
    })

    it('撤销所有点后绘制状态停止', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      tool.undo()
      expect(tool.isDrawing()).toBe(false)
    })

    it('撤销后可以重做', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      tool.undo()
      expect(tool.canRedoTool()).toBe(true)
      expect(tool.redo()).toBe(true)
    })

    it('未撤销时不能重做', () => {
      expect(tool.canRedoTool()).toBe(false)
      expect(tool.redo()).toBe(false)
    })
  })

  describe('setTension()', () => {
    it('应该更新张力值', () => {
      tool.setTension(0.8)
      expect(tool.options.tension).toBe(0.8)
    })

    it('张力值应被限制在 0-1 范围内', () => {
      tool.setTension(1.5)
      expect(tool.options.tension).toBe(1)

      tool.setTension(-0.5)
      expect(tool.options.tension).toBe(0)
    })
  })
})
