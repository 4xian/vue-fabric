import type { ToolbarOptions } from '../../types'
import ColorPicker from './ColorPicker'
import type PaintBoard from '../core/PaintBoard'

const TOOL_ICONS: Record<string, string> = {
  line: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3.5 22l1.5-1.5L18.5 7l1.5-1.5L18.5 4 17 5.5 3.5 19 2 20.5 3.5 22z"/></svg>`,
  curve: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 19c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  text: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4z"/></svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"/></svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  select: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18z"/></svg>`
}

export default class Toolbar {
  private paintBoard: PaintBoard
  private options: ToolbarOptions
  private container: HTMLDivElement | null
  private buttons: Map<string, HTMLButtonElement>
  private lineColorPicker: ColorPicker | null
  private fillColorPicker: ColorPicker | null
  private activeTool: string | null

  constructor(paintBoard: PaintBoard, options: ToolbarOptions = {}) {
    this.paintBoard = paintBoard
    this.options = options
    this.container = null
    this.buttons = new Map()
    this.lineColorPicker = null
    this.fillColorPicker = null
    this.activeTool = null
  }

  init(): this {
    this._createContainer()
    this._createColorPickers()
    this._createToolButtons()
    this._bindEvents()
    return this
  }

  private _createContainer(): void {
    this.container = document.createElement('div')
    this.container.className = 'paint-toolbar'
    this.paintBoard.container?.appendChild(this.container)
  }

  private _createColorPickers(): void {
    if (!this.container) return

    const lineColorWrapper = document.createElement('div')
    lineColorWrapper.className = 'toolbar-item color-item'
    lineColorWrapper.title = '线条颜色'

    const lineColorBtn = document.createElement('div')
    lineColorBtn.className = 'color-btn line-color-btn'
    lineColorBtn.style.backgroundColor = this.paintBoard.lineColor
    lineColorWrapper.appendChild(lineColorBtn)

    this.lineColorPicker = new ColorPicker({
      defaultColor: this.paintBoard.lineColor,
      onChange: (color: string) => {
        this.paintBoard.setLineColor(color)
        lineColorBtn.style.backgroundColor = color
      }
    })
    lineColorWrapper.appendChild(this.lineColorPicker.getElement()!)

    lineColorBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.fillColorPicker?.hide()
      this.lineColorPicker?.toggle()
    })

    this.container.appendChild(lineColorWrapper)

    const fillColorWrapper = document.createElement('div')
    fillColorWrapper.className = 'toolbar-item color-item'
    fillColorWrapper.title = '填充颜色'

    const fillColorBtn = document.createElement('div')
    fillColorBtn.className = 'color-btn fill-color-btn'
    fillColorBtn.style.backgroundColor = this.paintBoard.fillColor
    fillColorWrapper.appendChild(fillColorBtn)

    this.fillColorPicker = new ColorPicker({
      defaultColor: this.paintBoard.fillColor,
      onChange: (color: string) => {
        this.paintBoard.setFillColor(color)
        fillColorBtn.style.backgroundColor = color
      }
    })
    fillColorWrapper.appendChild(this.fillColorPicker.getElement()!)

    fillColorBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.lineColorPicker?.hide()
      this.fillColorPicker?.toggle()
    })

    this.container.appendChild(fillColorWrapper)

    this._addDivider()
  }

  private _createToolButtons(): void {
    this._createToolButton('select', '选择工具', TOOL_ICONS.select, () => {
      this.paintBoard.setTool('select')
    })

    this._createToolButton('line', '直线工具', TOOL_ICONS.line, () => {
      this.paintBoard.setTool('line')
    })

    this._createToolButton('curve', '曲线工具', TOOL_ICONS.curve, () => {
      this.paintBoard.setTool('curve')
    })

    this._createToolButton('text', '文字工具', TOOL_ICONS.text, () => {
      this.paintBoard.setTool('text')
    })

    this._addDivider()

    this._createActionButton('zoomIn', '放大', TOOL_ICONS.zoomIn, () => {
      this.paintBoard.zoomIn()
    })

    this._createActionButton('zoomOut', '缩小', TOOL_ICONS.zoomOut, () => {
      this.paintBoard.zoomOut()
    })

    this._createActionButton('reset', '重置视图', TOOL_ICONS.reset, () => {
      this.paintBoard.resetZoom()
    })

    this._addDivider()

    this._createActionButton('download', '下载图片', TOOL_ICONS.download, () => {
      this.paintBoard.exportToImage()
    })
  }

  private _createToolButton(name: string, title: string, icon: string, onClick: () => void): void {
    if (!this.container) return

    const btn = document.createElement('button')
    btn.className = 'toolbar-btn tool-btn'
    btn.title = title
    btn.innerHTML = icon
    btn.dataset.tool = name

    btn.addEventListener('click', () => {
      this._setActiveToolButton(name)
      onClick()
    })

    this.buttons.set(name, btn)
    this.container.appendChild(btn)
  }

  private _createActionButton(name: string, title: string, icon: string, onClick: () => void): void {
    if (!this.container) return

    const btn = document.createElement('button')
    btn.className = 'toolbar-btn action-btn'
    btn.title = title
    btn.innerHTML = icon

    btn.addEventListener('click', onClick)

    this.buttons.set(name, btn)
    this.container.appendChild(btn)
  }

  private _addDivider(): void {
    if (!this.container) return
    const divider = document.createElement('div')
    divider.className = 'toolbar-divider'
    this.container.appendChild(divider)
  }

  private _setActiveToolButton(name: string): void {
    this.buttons.forEach((btn, key) => {
      if (btn.classList.contains('tool-btn')) {
        btn.classList.toggle('active', key === name)
      }
    })
    this.activeTool = name
  }

  private _bindEvents(): void {
    document.addEventListener('click', (e) => {
      if (!this.container?.contains(e.target as Node)) {
        this.lineColorPicker?.hide()
        this.fillColorPicker?.hide()
      }
    })

    this.paintBoard.on('tool:changed', (toolName: unknown) => {
      this._setActiveToolButton(toolName as string)
    })
  }

  setActiveTool(name: string): void {
    this._setActiveToolButton(name)
  }

  destroy(): void {
    if (this.lineColorPicker) this.lineColorPicker.destroy()
    if (this.fillColorPicker) this.fillColorPicker.destroy()
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
