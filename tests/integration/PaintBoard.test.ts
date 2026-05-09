import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fabric from 'fabric'
import VueFabric from '../../src/core/PaintBoard'
import SelectTool from '../../src/tools/SelectTool'
import LineTool from '../../src/tools/LineTool'

function createContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '600px'
  document.body.appendChild(container)
  return container
}

describe('VueFabric (PaintBoard) 集成测试', () => {
  let container: HTMLDivElement
  let board: VueFabric

  beforeEach(() => {
    container = createContainer()
    board = new VueFabric(container, {
      width: 800,
      height: 600,
      autoResize: false
    })
    board.init()
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
  })

  describe('初始化', () => {
    it('应该成功初始化并创建画布', () => {
      expect(board.canvas).not.toBeNull()
      expect(board.eventBus).toBeDefined()
    })

    it('重复调用 init() 不应重复初始化', () => {
      const canvas1 = board.canvas
      board.init()
      expect(board.canvas).toBe(canvas1)
    })

    it('支持 CSS 选择器作为容器', () => {
      const id = `test-selector-container-${Date.now()}`
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)

      const b = new VueFabric(`#${id}`, { width: 200, height: 200, autoResize: false })
      b.init()
      expect(b.canvas).not.toBeNull()
      b.destroy()
      document.body.removeChild(el)
    })
  })

  describe('工具管理', () => {
    it('应该能注册工具', () => {
      const selectTool = new SelectTool()
      board.registerTool('select', selectTool)
      expect(board.tools.has('select')).toBe(true)
    })

    it('应该能切换工具', () => {
      const selectTool = new SelectTool()
      const lineTool = new LineTool()
      board.registerTool('select', selectTool)
      board.registerTool('line', lineTool)

      board.setTool('select')
      expect(board.currentToolName).toBe('select')

      board.setTool('line')
      expect(board.currentToolName).toBe('line')
    })

    it('切换工具时应触发 tool:changed 事件', () => {
      const callback = vi.fn()
      board.on('tool:changed', callback)

      board.registerTool('select', new SelectTool())
      board.setTool('select')

      expect(callback).toHaveBeenCalledWith('select')
    })
  })

  describe('缩放功能', () => {
    it('getZoom() 应返回当前缩放比例', () => {
      const zoom = board.getZoom()
      expect(typeof zoom).toBe('number')
      expect(zoom).toBeGreaterThan(0)
    })

    it('zoomIn() / zoomOut() 应改变缩放比例', () => {
      const initialZoom = board.getZoom()
      board.zoomIn()
      expect(board.getZoom()).toBeGreaterThan(initialZoom)

      board.zoomOut()
    })

    it('setZoom() 应设置缩放比例', () => {
      board.setZoom(2)
      expect(board.getZoom()).toBeCloseTo(2)
    })

    it('resetZoom() 应重置缩放', () => {
      board.setZoom(3)
      board.resetZoom()
      expect(board.getZoom()).toBeCloseTo(1)
    })

    it('resize() 后不应污染对象逻辑值和导出 JSON', () => {
      const rect = new fabric.Rect({
        left: 120,
        top: 90,
        width: 80,
        height: 40,
        scaleX: 1.2,
        scaleY: 1.1
      })
      board.canvas?.add(rect)

      const before = board.exportToJSON({ excludeTypes: [] })
      board.resize(1000, 700)
      const after = board.exportToJSON({ excludeTypes: [] })

      expect(rect.left).toBe(120)
      expect(rect.top).toBe(90)
      expect(rect.scaleX).toBe(1.2)
      expect(rect.scaleY).toBe(1.1)
      expect(JSON.parse(after)).toEqual(JSON.parse(before))
    })
  })

  describe('撤销与历史', () => {
    it('初始状态 canUndo() 应返回 false', () => {
      expect(board.canUndo()).toBe(false)
    })

    it('undo() 无历史时应返回 false', () => {
      expect(board.undo()).toBe(false)
    })

    it('pauseHistory() / resumeHistory() 应切换状态', () => {
      board.pauseHistory()
      expect(board.isHistoryPaused()).toBe(true)

      board.resumeHistory()
      expect(board.isHistoryPaused()).toBe(false)
    })
  })

  describe('clear 和 destroy', () => {
    it('clear() 应清空画布内容', () => {
      board.clear()
      const objects = board.canvas?.getObjects() ?? []
      expect(objects.length).toBe(0)
    })

    it('clear() 应触发 canvas:cleared 事件', () => {
      const callback = vi.fn()
      board.on('canvas:cleared', callback)
      board.clear()
      expect(callback).toHaveBeenCalled()
    })

    it('destroy() 后应清空容器', () => {
      board.destroy()
      expect(container.innerHTML).toBe('')
    })
  })

  describe('事件系统', () => {
    it('on() / off() 应正确注册和取消事件', () => {
      const callback = vi.fn()
      board.on('test:event', callback)
      board.eventBus.emit('test:event', {})
      expect(callback).toHaveBeenCalledTimes(1)

      board.off('test:event', callback)
      board.eventBus.emit('test:event', {})
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })
})
