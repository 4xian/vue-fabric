import { describe, it, expect, beforeEach, vi } from 'vitest'
import Toolbar from '../../../src/ui/Toolbar'
import PaintBoard from '../../../src/core/PaintBoard'

describe('Toolbar', () => {
  let paintBoard: PaintBoard
  let toolbar: Toolbar
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    paintBoard = new PaintBoard(container, { width: 800, height: 600 })
    paintBoard.init()
  })

  describe('构造函数', () => {
    it('应该使用默认配置创建', () => {
      toolbar = new Toolbar(paintBoard)
      expect(toolbar).toBeDefined()
    })

    it('应该使用自定义工具列表创建', () => {
      toolbar = new Toolbar(paintBoard, { tools: ['select', 'line'] })
      expect(toolbar).toBeDefined()
    })

    it('应该支持隐藏配置', () => {
      toolbar = new Toolbar(paintBoard, { visible: false })
      expect(toolbar).toBeDefined()
    })
  })

  describe('初始化', () => {
    it('init() 应该创建工具栏容器', () => {
      toolbar = new Toolbar(paintBoard)
      toolbar.init()
      const toolbarEl = container.querySelector('.paint-toolbar')
      expect(toolbarEl).toBeDefined()
    })

    it('init() 应该返回 this 支持链式调用', () => {
      toolbar = new Toolbar(paintBoard)
      const result = toolbar.init()
      expect(result).toBe(toolbar)
    })
  })

  describe('显示和隐藏', () => {
    beforeEach(() => {
      toolbar = new Toolbar(paintBoard)
      toolbar.init()
    })

    it('show() 应该显示工具栏', () => {
      toolbar.hide()
      toolbar.show()
      const toolbarEl = container.querySelector('.paint-toolbar') as HTMLElement
      expect(toolbarEl?.style.display).not.toBe('none')
    })

    it('hide() 应该隐藏工具栏', () => {
      toolbar.hide()
      const toolbarEl = container.querySelector('.paint-toolbar') as HTMLElement
      expect(toolbarEl?.style.display).toBe('none')
    })
  })
})
