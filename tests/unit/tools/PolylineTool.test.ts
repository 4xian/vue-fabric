import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Canvas } from 'fabric'
import PolylineTool from '../../../src/tools/PolylineTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'

describe('PolylineTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: PolylineTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = {
      canvas,
      eventBus,
      lineColor: '#ff0000',
      pauseHistory: vi.fn(),
      resumeHistory: vi.fn(),
      setTool: vi.fn(),
      isHelpersVisible: vi.fn(() => true)
    }
    tool = new PolylineTool()
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  it('应该正确初始化折线工具', () => {
    expect(tool.name).toBe('polyline')
    expect(tool.isDrawing()).toBe(false)
  })

  it('第一次左键点击应该开始绘制', () => {
    tool.activate()
    canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))

    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    expect(tool.isDrawing()).toBe(true)
    expect(mockPaintBoard.pauseHistory).toHaveBeenCalledTimes(1)
  })

  it('左键连续点击期间不应该触发创建事件', () => {
    const callback = vi.fn()
    eventBus.on('polyline:created', callback)
    tool.activate()
    canvas.getPointer = vi.fn()

    canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 300, y: 300 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    expect(tool.isDrawing()).toBe(true)
    expect(callback).not.toHaveBeenCalled()
    expect(mockPaintBoard.resumeHistory).not.toHaveBeenCalled()
  })

  it('绘制过程中左键落点后应该保留预览折线路径', () => {
    tool.activate()
    canvas.getPointer = vi.fn()

    canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    expect(tool.isDrawing()).toBe(true)
    expect(canvas._objects.length).toBeGreaterThan(3)
  })

  it('右键应该一次性完成折线并触发创建事件', () => {
    const callback = vi.fn()
    eventBus.on('polyline:created', callback)
    tool.activate()
    canvas.getPointer = vi.fn()

    canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 300, y: 300 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    const rightClickEvent = {
      button: 2,
      preventDefault: vi.fn()
    } as unknown as MouseEvent
    tool.onMouseDown({ e: rightClickEvent } as any)

    expect(tool.isDrawing()).toBe(false)
    expect(rightClickEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(mockPaintBoard.resumeHistory).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
          { x: 300, y: 300 }
        ],
        distances: [expect.any(Number), expect.any(Number)]
      })
    )
  })

  it('绘制中按 Escape 应该取消当前折线', () => {
    tool.activate()
    canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))

    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)
    expect(tool.isDrawing()).toBe(true)

    tool.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(tool.isDrawing()).toBe(false)
  })

  it('绘制中按 Enter 应该完成折线并阻止默认行为', () => {
    const callback = vi.fn()
    eventBus.on('polyline:created', callback)
    tool.activate()
    canvas.getPointer = vi.fn()

    canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 300, y: 300 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    const enterEvent = {
      key: 'Enter',
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent
    tool.onKeyDown(enterEvent)

    expect(tool.isDrawing()).toBe(false)
    expect(enterEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(mockPaintBoard.resumeHistory).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('完成绘制后不应再由工具私有栈撤销', () => {
    tool.activate()
    canvas.getPointer = vi.fn()

    canvas.getPointer.mockReturnValue({ x: 100, y: 100 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 200, y: 200 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    canvas.getPointer.mockReturnValue({ x: 300, y: 300 })
    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 0 }) } as any)

    tool.onMouseDown({ e: new MouseEvent('mousedown', { button: 2 }) } as any)

    expect(tool.canUndoTool()).toBe(false)
    expect(tool.canRedoTool()).toBe(false)
    expect(tool.undo()).toBe(false)
  })
})
