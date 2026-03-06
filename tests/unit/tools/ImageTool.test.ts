import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ImageTool from '../../../src/tools/ImageTool'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

// 创建一个能触发 onload 的 Image mock 类
class MockHTMLImageElement {
  crossOrigin = ''
  width = 100
  height = 80
  naturalWidth = 100
  naturalHeight = 80
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''

  get src(): string {
    return this._src
  }

  set src(value: string) {
    this._src = value
    // 同步触发 onload
    if (this.onload) {
      this.onload()
    }
  }
}

describe('ImageTool', () => {
  let canvas: any
  let eventBus: EventBus
  let tool: ImageTool
  let mockPaintBoard: any
  let OriginalImage: typeof Image

  beforeEach(() => {
    OriginalImage = global.Image
    global.Image = MockHTMLImageElement as any

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
    tool = new ImageTool({})
    tool.bindCanvas(canvas as unknown as Canvas, eventBus, mockPaintBoard)
  })

  afterEach(() => {
    global.Image = OriginalImage
  })

  describe('初始化', () => {
    it('应该正确初始化图片工具', () => {
      expect(tool.name).toBe('image')
    })

    it('应该使用默认配置', () => {
      expect(tool.options.defaultSelectable).toBeDefined()
      expect(tool.options.defaultHasControls).toBeDefined()
    })

    it('应该合并自定义配置', () => {
      const customTool = new ImageTool({ defaultSelectable: true })
      expect(customTool.options.defaultSelectable).toBe(true)
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

  describe('addImageAt()', () => {
    it('应该使用 base64 添加图片', async () => {
      const callback = vi.fn()
      eventBus.on('image:created', callback)

      const result = await tool.addImageAt({
        x: 100,
        y: 100,
        base64: 'data:image/png;base64,mock'
      })

      expect(result).not.toBeNull()
      expect(canvas.add).toHaveBeenCalled()
      expect(callback).toHaveBeenCalled()
    })

    it('应该使用 src 添加图片', async () => {
      const result = await tool.addImageAt({
        x: 50,
        y: 50,
        src: 'data:image/png;base64,mock'
      })

      expect(result).not.toBeNull()
    })

    it('没有 src 或 base64 时应返回 null', async () => {
      const result = await tool.addImageAt({
        x: 0,
        y: 0
      } as any)

      expect(result).toBeNull()
    })

    it('canvas 未绑定时应返回 null', async () => {
      const unbound = new ImageTool()
      const result = await unbound.addImageAt({
        x: 0,
        y: 0,
        src: 'data:image/png;base64,mock'
      })
      expect(result).toBeNull()
    })

    it('应该使用自定义 id 作为 drawId', async () => {
      const result = await tool.addImageAt({
        x: 0,
        y: 0,
        src: 'data:image/png;base64,mock',
        id: 'custom-img-id'
      })

      expect(result!.customData.drawId).toBe('custom-img-id')
    })

    it('指定 width 时应等比缩放', async () => {
      const result = await tool.addImageAt({
        x: 0,
        y: 0,
        src: 'data:image/png;base64,mock',
        width: 50
      })

      // 图片原始宽度100，目标宽度50，scaleX应为0.5
      expect(result).not.toBeNull()
      const imageObj = result!.imageObj
      expect(imageObj.scaleX).toBeCloseTo(0.5)
      expect(imageObj.scaleY).toBeCloseTo(0.5)
    })
  })

  describe('addImageWithoutRender()', () => {
    it('应该添加图片但不调用 renderAll', async () => {
      canvas.renderAll.mockClear()
      const result = await tool.addImageWithoutRender({
        x: 0,
        y: 0,
        src: 'data:image/png;base64,mock'
      })

      expect(result).not.toBeNull()
      expect(canvas.add).toHaveBeenCalled()
      expect(canvas.renderAll).not.toHaveBeenCalled()
    })
  })

  describe('图片属性操作', () => {
    let imageId: string

    beforeEach(async () => {
      const result = await tool.addImageAt({
        x: 100,
        y: 100,
        src: 'data:image/png;base64,mock'
      })
      imageId = result!.customData.drawId
    })

    it('setAngle() 应该更新图片角度', () => {
      const success = tool.setAngle(imageId, 45)
      expect(success).toBe(true)
    })

    it('setOpacity() 应该更新图片透明度', () => {
      const success = tool.setOpacity(imageId, 0.5)
      expect(success).toBe(true)
    })

    it('setOpacity() 应该将值限制在 0-1', () => {
      tool.setOpacity(imageId, 1.5)
      const imageObj = tool.getImageById(imageId)
      expect(imageObj?.opacity).toBeLessThanOrEqual(1)

      tool.setOpacity(imageId, -0.5)
      expect(imageObj?.opacity).toBeGreaterThanOrEqual(0)
    })

    it('setPosition() 应该更新图片位置', () => {
      const success = tool.setPosition(imageId, 200, 300)
      expect(success).toBe(true)
    })

    it('setScale() 应该更新图片缩放', () => {
      const success = tool.setScale(imageId, 2)
      expect(success).toBe(true)
    })

    it('setSelectable() 应该更新可选择状态', () => {
      const success = tool.setSelectable(imageId, true)
      expect(success).toBe(true)
    })

    it('setLockMovement() 应该更新移动锁定状态', () => {
      const success = tool.setLockMovement(imageId, true)
      expect(success).toBe(true)
    })

    it('setLockScaling() 应该更新缩放锁定状态', () => {
      const success = tool.setLockScaling(imageId, true)
      expect(success).toBe(true)
    })

    it('getImageById() 应该返回正确的图片对象', () => {
      const imageObj = tool.getImageById(imageId)
      expect(imageObj).not.toBeNull()
    })

    it('操作不存在的 id 应返回 false', () => {
      expect(tool.setAngle('nonexistent', 45)).toBe(false)
      expect(tool.setOpacity('nonexistent', 0.5)).toBe(false)
      expect(tool.setPosition('nonexistent', 0, 0)).toBe(false)
      expect(tool.setScale('nonexistent', 1)).toBe(false)
    })

    it('getImageById() 不存在时应返回 null', () => {
      expect(tool.getImageById('nonexistent')).toBeNull()
    })
  })

  describe('destroy()', () => {
    it('应该清理文件输入元素', () => {
      tool.openFileDialog()
      tool.destroy()
      // 不应抛出错误
    })
  })
})
