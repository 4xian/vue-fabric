import { describe, it, expect, vi, beforeEach } from 'vitest'
import RectTool from '../../../src/tools/RectTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('RectTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: RectTool
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
      isHelpersVisible: vi.fn(() => false)
    }
    tool = new RectTool()
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化矩形工具', () => {
      expect(tool.name).toBe('rect')
      expect(tool.isDrawing()).toBe(false)
    })

    it('应该使用默认配置', () => {
      expect(tool.options.strokeWidth).toBeDefined()
      expect(tool.options.defaultShowHelpers).toBeDefined()
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

      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
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

    it('鼠标按下应开始绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      expect(tool.isDrawing()).toBe(true)
      expect(mockPaintBoard.pauseHistory).toHaveBeenCalled()
    })

    it('鼠标移动应更新预览', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
      tool.onMouseMove({
        e: new MouseEvent('mousemove')
      } as any)

      expect(canvas.add).toHaveBeenCalled()
    })

    it('第二次点击应完成绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      expect(tool.isDrawing()).toBe(false)
      expect(mockPaintBoard.resumeHistory).toHaveBeenCalled()
    })

    it('非左键点击不应开始绘制', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 2 })
      } as any)

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
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      expect(tool.canUndoTool()).toBe(true)
      expect(tool.undo()).toBe(true)
      expect(tool.isDrawing()).toBe(false)
    })

    it('完成绘制后撤销状态重置', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)
      expect(tool.canUndoTool()).toBe(true)

      canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)

      // 完成后 isDrawing 为 false，canUndoTool 也返回 false
      expect(tool.isDrawing()).toBe(false)
      expect(tool.canUndoTool()).toBe(false)
    })

    it('撤销后可以重做', () => {
      canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
      tool.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
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
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)
      expect(tool.isDrawing()).toBe(true)

      tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(tool.isDrawing()).toBe(false)
    })
  })
})
