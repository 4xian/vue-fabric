import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Canvas } from 'fabric'
import PenTool from '../../../src/tools/PenTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { CustomType } from '../../../src/utils/settings'

describe('PenTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: PenTool
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
      isHistoryPaused: vi.fn(() => false),
      getBackgroundImage: vi.fn(() => null)
    }
    tool = new PenTool()
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  it('should initialize with pen defaults', () => {
    expect(tool.name).toBe('pen')
    expect(tool.isDrawing()).toBe(false)
    expect(tool.options.strokeWidth).toBeDefined()
    expect(tool.options.decimate).toBeDefined()
    expect(tool.options.perPixelTargetFind).toBe(true)
  })

  it('should enable drawing mode on activate and restore on deactivate', () => {
    tool.activate()
    expect(canvas.selection).toBe(false)
    expect(canvas.isDrawingMode).toBe(true)
    expect(canvas.freeDrawingBrush).toBeDefined()

    tool.deactivate()
    expect(canvas.selection).toBe(true)
    expect(canvas.isDrawingMode).toBe(false)
    expect(canvas.freeDrawingBrush).toBeUndefined()
  })

  it('should tag created path and pause history before path creation', () => {
    tool.activate()
    const path = {
      set: vi.fn(),
      on: vi.fn()
    }

    canvas.fire('before:path:created', { path })

    expect(mockPaintBoard.pauseHistory).toHaveBeenCalledTimes(1)
    expect(path.set).toHaveBeenCalledWith(
      expect.objectContaining({
        selectable: true,
        evented: true,
        hasBorders: tool.options.hasBorders,
        hasControls: tool.options.hasControls,
        lockMovementX: tool.options.lockMovementX,
        lockMovementY: tool.options.lockMovementY,
        perPixelTargetFind: true
      })
    )
    expect((path as any).customType).toBe(CustomType.Pen)
    expect((path as any).customData).toEqual(
      expect.objectContaining({
        lineColor: '#ff0000',
        strokeWidth: tool.options.strokeWidth
      })
    )
  })

  it('should emit pen:created and resume history after path creation', () => {
    const created = vi.fn()
    eventBus.on('pen:created', created)

    tool.activate()
    const path = {
      set: vi.fn(),
      on: vi.fn()
    }

    canvas.fire('before:path:created', { path })
    canvas.fire('path:created', { path })

    expect(created).toHaveBeenCalledTimes(1)
    expect(created).toHaveBeenCalledWith(
      expect.objectContaining({
        lineColor: '#ff0000',
        strokeWidth: tool.options.strokeWidth,
        object: path
      })
    )
    expect(mockPaintBoard.resumeHistory).toHaveBeenCalledTimes(1)
  })

  it('should pause history only once and resume on deactivate when drawing is interrupted', () => {
    tool.activate()
    const path = {
      set: vi.fn(),
      on: vi.fn()
    }

    canvas.fire('before:path:created', { path })
    tool.deactivate()

    expect(mockPaintBoard.resumeHistory).toHaveBeenCalledTimes(1)
  })

  it('should update brush width at runtime', () => {
    tool.activate()
    tool.setStrokeWidth(8)

    expect(tool.options.strokeWidth).toBe(8)
    expect(canvas.freeDrawingBrush.width).toBe(8)
  })
})
