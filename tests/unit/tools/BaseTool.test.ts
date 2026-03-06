import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import BaseTool from '../../../src/tools/BaseTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

class TestTool extends BaseTool {
  constructor(options = {}) {
    super('test-tool', options)
  }

  onMouseDown = vi.fn()
  onMouseMove = vi.fn()
  onMouseUp = vi.fn()
  onKeyDown = vi.fn()
  onActivate = vi.fn()
  onDeactivate = vi.fn()
}

describe('BaseTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: TestTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = { canvas, eventBus }
    tool = new TestTool()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初始化', () => {
    it('应该正确初始化工具', () => {
      expect(tool.name).toBe('test-tool')
      expect(tool.canvas).toBeNull()
      expect(tool.eventBus).toBeNull()
      expect(tool.paintBoard).toBeNull()
      expect(tool.isActive).toBe(false)
    })

    it('应该使用默认配置', () => {
      expect(tool.options.activeCursor).toBeDefined()
      expect(tool.options.deactiveCursor).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new TestTool({ activeCursor: 'crosshair' })
      expect(customTool.options.activeCursor).toBe('crosshair')
    })
  })

  describe('bindCanvas()', () => {
    it('应该绑定画布和事件总线', () => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
      expect(tool.canvas).toBe(canvas)
      expect(tool.eventBus).toBe(eventBus)
      expect(tool.paintBoard).toBe(mockPaintBoard)
    })
  })

  describe('activate()', () => {
    beforeEach(() => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
    })

    it('应该激活工具', () => {
      tool.activate()
      expect(tool.isActive).toBe(true)
    })

    it('应该注册事件监听器', () => {
      tool.activate()
      expect(canvas.on).toHaveBeenCalledWith('mouse:down', expect.any(Function))
      expect(canvas.on).toHaveBeenCalledWith('mouse:move', expect.any(Function))
      expect(canvas.on).toHaveBeenCalledWith('mouse:up', expect.any(Function))
    })

    it('应该设置激活光标', () => {
      tool.activate()
      expect(canvas.defaultCursor).toBe(tool.options.activeCursor)
    })

    it('应该调用 onActivate 钩子', () => {
      tool.activate()
      expect(tool.onActivate).toHaveBeenCalled()
    })

    it('未绑定画布时不应激活', () => {
      const unboundTool = new TestTool()
      unboundTool.activate()
      expect(unboundTool.isActive).toBe(false)
    })
  })

  describe('deactivate()', () => {
    beforeEach(() => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
      tool.activate()
    })

    it('应该停用工具', () => {
      tool.deactivate()
      expect(tool.isActive).toBe(false)
    })

    it('应该移除事件监听器', () => {
      tool.deactivate()
      expect(canvas.off).toHaveBeenCalledWith('mouse:down', expect.any(Function))
      expect(canvas.off).toHaveBeenCalledWith('mouse:move', expect.any(Function))
      expect(canvas.off).toHaveBeenCalledWith('mouse:up', expect.any(Function))
    })

    it('应该恢复默认光标', () => {
      tool.deactivate()
      expect(canvas.defaultCursor).toBe(tool.options.deactiveCursor)
    })

    it('应该调用 onDeactivate 钩子', () => {
      tool.deactivate()
      expect(tool.onDeactivate).toHaveBeenCalled()
    })
  })

  describe('鼠标事件处理', () => {
    beforeEach(() => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
      tool.activate()
    })

    it('激活状态下应触发 onMouseDown', () => {
      const mockEvent = { e: new MouseEvent('mousedown') }
      canvas.fire('mouse:down', mockEvent)
      expect(tool.onMouseDown).toHaveBeenCalledWith(mockEvent)
    })

    it('激活状态下应触发 onMouseMove', () => {
      const mockEvent = { e: new MouseEvent('mousemove') }
      canvas.fire('mouse:move', mockEvent)
      expect(tool.onMouseMove).toHaveBeenCalledWith(mockEvent)
    })

    it('激活状态下应触发 onMouseUp', () => {
      const mockEvent = { e: new MouseEvent('mouseup') }
      canvas.fire('mouse:up', mockEvent)
      expect(tool.onMouseUp).toHaveBeenCalledWith(mockEvent)
    })

    it('停用状态下不应触发事件', () => {
      tool.deactivate()
      const mockEvent = { e: new MouseEvent('mousedown') }
      canvas.fire('mouse:down', mockEvent)
      expect(tool.onMouseDown).not.toHaveBeenCalled()
    })
  })

  describe('getPointer()', () => {
    beforeEach(() => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
    })

    it('应该返回鼠标指针位置', () => {
      const mockEvent = { e: new MouseEvent('mousedown') }
      canvas.getPointer = vi.fn(() => ({ x: 100, y: 200 }))
      const pointer = tool.getPointer(mockEvent as any)
      expect(pointer).toEqual({ x: 100, y: 200 })
      expect(canvas.getPointer).toHaveBeenCalledWith(mockEvent.e)
    })
  })

  describe('destroy()', () => {
    beforeEach(() => {
      tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
      tool.activate()
    })

    it('应该清理所有引用', () => {
      tool.destroy()
      expect(tool.canvas).toBeNull()
      expect(tool.eventBus).toBeNull()
      expect(tool.paintBoard).toBeNull()
    })

    it('应该停用工具', () => {
      tool.destroy()
      expect(tool.isActive).toBe(false)
    })
  })

  describe('工具状态查询', () => {
    it('isDrawing() 默认返回 false', () => {
      expect(tool.isDrawing()).toBe(false)
    })

    it('canUndoTool() 默认返回 false', () => {
      expect(tool.canUndoTool()).toBe(false)
    })

    it('canRedoTool() 默认返回 false', () => {
      expect(tool.canRedoTool()).toBe(false)
    })

    it('undo() 默认返回 false', () => {
      expect(tool.undo()).toBe(false)
    })

    it('redo() 默认返回 false', () => {
      expect(tool.redo()).toBe(false)
    })
  })
})
