import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

    it('应该使用默认颜色配置', () => {
      expect(board.lineColor).toBeDefined()
      expect(board.fillColor).toBeDefined()
    })

    it('支持 CSS 选择器作为容器', () => {
      const id = 'test-selector-container-' + Date.now()
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

    it('切换工具时应停用旧工具', () => {
      const tool1 = new SelectTool()
      const tool2 = new LineTool()
      board.registerTool('select', tool1)
      board.registerTool('line', tool2)

      board.setTool('select')
      expect(tool1.isActive).toBe(true)

      board.setTool('line')
      expect(tool1.isActive).toBe(false)
      expect(tool2.isActive).toBe(true)
    })

    it('切换工具时应触发 tool:changed 事件', () => {
      const callback = vi.fn()
      board.on('tool:changed', callback)

      board.registerTool('select', new SelectTool())
      board.setTool('select')

      expect(callback).toHaveBeenCalledWith('select')
    })
  })

  describe('颜色管理', () => {
    it('setLineColor() 应更新线条颜色', () => {
      board.setLineColor('#ff0000')
      expect(board.lineColor).toBe('#ff0000')
    })

    it('setFillColor() 应更新填充颜色', () => {
      board.setFillColor('#00ff00')
      expect(board.fillColor).toBe('#00ff00')
    })

    it('setLineColor() 支持链式调用', () => {
      const result = board.setLineColor('#blue')
      expect(result).toBe(board)
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
  })

  describe('撤销/重做', () => {
    it('初始状态 canUndo() 应返回 false', () => {
      expect(board.canUndo()).toBe(false)
    })

    it('undo() 无历史时应返回 false', () => {
      expect(board.undo()).toBe(false)
    })

    it('canRedo() 应返回布尔值', () => {
      expect(typeof board.canRedo()).toBe('boolean')
    })
  })

  describe('历史记录暂停/恢复', () => {
    it('pauseHistory() 应暂停历史记录', () => {
      board.pauseHistory()
      expect(board.isHistoryPaused()).toBe(true)
    })

    it('resumeHistory() 应恢复历史记录', () => {
      board.pauseHistory()
      board.resumeHistory()
      expect(board.isHistoryPaused()).toBe(false)
    })
  })

  describe('clear() 和 destroy()', () => {
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

    it('destroy() 后 canvas 应为 null 或已处置', () => {
      board.destroy()
      // destroy 会清理容器内容
      expect(container.innerHTML).toBe('')
    })
  })

  describe('辅助元素控制', () => {
    it('isHelpersVisible() 应返回初始状态', () => {
      expect(typeof board.isHelpersVisible()).toBe('boolean')
    })

    it('showAllAreaHelpers() 应触发事件', () => {
      const callback = vi.fn()
      board.on('areaHelpers:shown', callback)
      board.showAllAreaHelpers()
      expect(callback).toHaveBeenCalled()
    })

    it('hideAllAreaHelpers() 应触发事件', () => {
      const callback = vi.fn()
      board.on('areaHelpers:hidden', callback)
      board.hideAllAreaHelpers()
      expect(callback).toHaveBeenCalled()
    })

    it('toggleAreaHelpers() 应切换辅助元素显示状态', () => {
      const initialState = board.isHelpersVisible()
      board.toggleAreaHelpers()
      expect(board.isHelpersVisible()).toBe(!initialState)
    })
  })

  describe('导出功能', () => {
    it('exportToJSON() 应返回合法 JSON 字符串', () => {
      const json = board.exportToJSON()
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('exportToImage() 应返回字符串', () => {
      const data = board.exportToImage()
      expect(typeof data).toBe('string')
    })

    it('exportToSVG() 应返回字符串', () => {
      const svg = board.exportToSVG()
      expect(typeof svg).toBe('string')
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
