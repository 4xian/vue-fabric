import { describe, it, expect, vi, beforeEach } from 'vitest'
import DragTool from '../../../src/tools/DragTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('DragTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: DragTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = { canvas, eventBus }
    tool = new DragTool()
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化拖拽工具', () => {
      expect(tool.name).toBe('drag')
      expect(tool['isDragging']).toBe(false)
      expect(tool['lastPosX']).toBe(0)
      expect(tool['lastPosY']).toBe(0)
    })
  })

  describe('onActivate()', () => {
    it('应该禁用画布选择', () => {
      tool.activate()
      expect(canvas.selection).toBe(false)
    })

    it('应该设置默认光标', () => {
      tool.activate()
      expect(canvas.defaultCursor).toBe(tool.options.defaultCursor)
    })
  })

  describe('onDeactivate()', () => {
    beforeEach(() => {
      tool.activate()
    })

    it('应该停止拖拽', () => {
      tool['isDragging'] = true
      tool.deactivate()
      expect(tool['isDragging']).toBe(false)
    })

    it('应该恢复默认光标', () => {
      tool.deactivate()
      expect(canvas.defaultCursor).toBe(tool.options.defaultCursor)
    })
  })

  describe('onMouseDown()', () => {
    beforeEach(() => {
      tool.activate()
    })

    it('按住Ctrl键应开始拖拽', () => {
      const mockEvent = {
        e: new MouseEvent('mousedown', { ctrlKey: true, clientX: 100, clientY: 200 })
      }
      tool.onMouseDown(mockEvent as any)
      expect(tool['isDragging']).toBe(true)
      expect(tool['lastPosX']).toBe(100)
      expect(tool['lastPosY']).toBe(200)
    })

    it('按住Meta键应开始拖拽', () => {
      const mockEvent = {
        e: new MouseEvent('mousedown', { metaKey: true, clientX: 150, clientY: 250 })
      }
      tool.onMouseDown(mockEvent as any)
      expect(tool['isDragging']).toBe(true)
    })

    it('未按修饰键不应开始拖拽', () => {
      const mockEvent = {
        e: new MouseEvent('mousedown', { clientX: 100, clientY: 200 })
      }
      tool.onMouseDown(mockEvent as any)
      expect(tool['isDragging']).toBe(false)
    })
  })

  describe('onMouseMove()', () => {
    beforeEach(() => {
      tool.activate()
    })

    it('拖拽时应更新视口', () => {
      tool['isDragging'] = true
      tool['lastPosX'] = 100
      tool['lastPosY'] = 200

      const mockEvent = {
        e: new MouseEvent('mousemove', { ctrlKey: true, clientX: 150, clientY: 250 })
      }

      const vpt = [1, 0, 0, 1, 0, 0]
      canvas.viewportTransform = vpt

      tool.onMouseMove(mockEvent as any)

      expect(vpt[4]).toBe(50)
      expect(vpt[5]).toBe(50)
      expect(canvas.requestRenderAll).toHaveBeenCalled()
    })

    it('按住Ctrl但未拖拽时应显示grab光标', () => {
      const mockEvent = {
        e: new MouseEvent('mousemove', { ctrlKey: true })
      }
      tool.onMouseMove(mockEvent as any)
      expect(canvas.setCursor).toHaveBeenCalledWith('grab')
    })

    it('释放Ctrl键应停止拖拽', () => {
      tool['isDragging'] = true
      const mockEvent = {
        e: new MouseEvent('mousemove', { ctrlKey: false })
      }
      tool.onMouseMove(mockEvent as any)
      expect(tool['isDragging']).toBe(false)
    })
  })

  describe('onMouseUp()', () => {
    beforeEach(() => {
      tool.activate()
    })

    it('应该停止拖拽', () => {
      tool['isDragging'] = true
      tool.onMouseUp()
      expect(tool['isDragging']).toBe(false)
    })

    it('停止拖拽时应触发事件', () => {
      const callback = vi.fn()
      eventBus.on('canvas:panned', callback)
      tool['isDragging'] = true
      tool.onMouseUp()
      expect(callback).toHaveBeenCalled()
    })
  })
})
