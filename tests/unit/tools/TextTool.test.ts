import { describe, it, expect, vi, beforeEach } from 'vitest'
import TextTool from '../../../src/tools/TextTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('TextTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: TextTool
  let mockPaintBoard: any

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
    mockPaintBoard = {
      canvas,
      eventBus,
      lineColor: '#000000',
      fillColor: '#ffffff',
      pauseHistory: vi.fn(),
      resumeHistory: vi.fn(),
      setTool: vi.fn()
    }
    tool = new TextTool({})
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  describe('初始化', () => {
    it('应该正确初始化文本工具', () => {
      expect(tool.name).toBe('text')
    })

    it('应该使用默认配置', () => {
      expect(tool.options.fontSize).toBeDefined()
      expect(tool.options.fontFamily).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new TextTool({ fontSize: 24, fontFamily: 'Arial' })
      expect(customTool.options.fontSize).toBe(24)
      expect(customTool.options.fontFamily).toBe('Arial')
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
  })

  describe('onMouseDown()', () => {
    beforeEach(() => {
      tool.activate()
      canvas.getPointer = vi.fn(() => ({ x: 100, y: 100 }))
      // Mock IText 的方法
      canvas.setActiveObject = vi.fn()
    })

    it('点击应触发 text:created 事件', () => {
      const callback = vi.fn()
      eventBus.on('text:created', callback)

      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: null } as any)

      expect(callback).toHaveBeenCalled()
      expect(canvas.add).toHaveBeenCalled()
    })

    it('点击已有文本对象时不应创建新文本', () => {
      const existingText = {
        customType: 'text',
        type: 'i-text'
      }

      canvas.add.mockClear()
      tool.onMouseDown({ e: new MouseEvent('mousedown'), target: existingText } as any)

      expect(canvas.add).not.toHaveBeenCalled()
    })
  })

  describe('setFontSize()', () => {
    it('应该更新工具的字体大小', () => {
      canvas.getActiveObject = vi.fn(() => null)
      tool.setFontSize(24)
      expect(tool.options.fontSize).toBe(24)
    })

    it('有活动文本对象时应更新其字体大小', () => {
      const mockTextObj = {
        customType: 'text',
        set: vi.fn()
      } as any

      canvas.getActiveObject = vi.fn(() => mockTextObj)
      tool.setFontSize(24)

      expect(mockTextObj.set).toHaveBeenCalledWith('fontSize', 24)
      expect(canvas.renderAll).toHaveBeenCalled()
    })

    it('活动对象非文本时不应更改', () => {
      const mockNonText = {
        customType: 'rect',
        set: vi.fn()
      } as any

      canvas.getActiveObject = vi.fn(() => mockNonText)
      tool.setFontSize(24)

      expect(mockNonText.set).not.toHaveBeenCalled()
    })
  })

  describe('setFontFamily()', () => {
    it('应该更新工具的字体家族', () => {
      canvas.getActiveObject = vi.fn(() => null)
      tool.setFontFamily('Georgia')
      expect(tool.options.fontFamily).toBe('Georgia')
    })

    it('有活动文本对象时应更新其字体家族', () => {
      const mockTextObj = {
        customType: 'text',
        set: vi.fn()
      } as any

      canvas.getActiveObject = vi.fn(() => mockTextObj)
      tool.setFontFamily('Georgia')

      expect(mockTextObj.set).toHaveBeenCalledWith('fontFamily', 'Georgia')
    })
  })

  describe('setTextColor()', () => {
    it('有活动文本对象时应更新颜色', () => {
      const mockTextObj = {
        customType: 'text',
        set: vi.fn()
      } as any

      canvas.getActiveObject = vi.fn(() => mockTextObj)
      canvas.renderAll = vi.fn()
      tool.setTextColor('#ff0000')

      expect(mockTextObj.set).toHaveBeenCalledWith('fill', '#ff0000')
      expect(canvas.renderAll).toHaveBeenCalled()
    })
  })

  describe('createTextAt()', () => {
    it('应该在指定位置创建文本并返回结果', () => {
      const result = tool.createTextAt({
        x: 100,
        y: 200,
        text: 'Hello',
        fontSize: 16
      })

      expect(result).not.toBeNull()
      expect(result!.customData.text).toBe('Hello')
      expect(result!.customData.x).toBe(100)
      expect(result!.customData.y).toBe(200)
      expect(canvas.add).toHaveBeenCalled()
    })

    it('应该触发 text:created 事件', () => {
      const callback = vi.fn()
      eventBus.on('text:created', callback)

      tool.createTextAt({ x: 0, y: 0, text: 'Test' })

      expect(callback).toHaveBeenCalled()
    })

    it('canvas 未绑定时应返回 null', () => {
      const unbound = new TextTool()
      const result = unbound.createTextAt({ x: 0, y: 0, text: 'Test' })
      expect(result).toBeNull()
    })

    it('应该使用自定义 id 作为 drawId', () => {
      const result = tool.createTextAt({
        x: 0,
        y: 0,
        text: 'Test',
        id: 'my-custom-id'
      })

      expect(result!.customData.drawId).toBe('my-custom-id')
    })
  })

  describe('createTextWithoutRender()', () => {
    it('应该创建文本但不调用 renderAll', () => {
      canvas.renderAll.mockClear()
      const result = tool.createTextWithoutRender({
        x: 50,
        y: 50,
        text: 'NoRender'
      })

      expect(result).not.toBeNull()
      expect(canvas.add).toHaveBeenCalled()
      expect(canvas.renderAll).not.toHaveBeenCalled()
    })
  })
})
