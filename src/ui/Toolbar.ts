import type { ToolbarOptions, ToolName } from '../../types'
import ColorPicker from './ColorPicker'
import type PaintBoard from '../core/PaintBoard'
import type ImageTool from '../tools/ImageTool'
import { PROJECT_NAME } from '../utils/settings'

const TOOL_ICONS: Record<string, string> = {
  line: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3.5 22l1.5-1.5L18.5 7l1.5-1.5L18.5 4 17 5.5 3.5 19 2 20.5 3.5 22z"/></svg>`,
  area: `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  curve: `<svg viewBox="0 0 28 28" width="24" height="24"><path fill="currentColor" d="M4 19c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  text: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4z"/></svg>`,
  image: `<svg viewBox="0 0 16 16" width="20" height="20"><path fill="currentColor" d="M10.496 7c-.824 0-1.572-.675-1.498-1.5 0-.825.674-1.5 1.498-1.5.823 0 1.497.675 1.497 1.5S11.319 7 10.496 7zM13.8 9.476V2.2H2.2v5.432l.1-.078C3.132 6.904 4.029 6.5 5 6.5c.823 0 1.552.27 2.342.778.226.145.449.304.735.518.06.045.546.413.69.52 1.634 1.21 2.833 1.6 4.798 1.207l.235-.047zm0 1.523V10.7c-5 1-6.3-3-8.8-3-1.5 0-2.8 1.6-2.8 1.6v4.6h11.6V11zM14 1c.6 0 1 .536 1 1.071v11.784c0 .642-.4 1.071-1 1.071H2c-.6 0-1-.429-1-1.07V2.07c0-.535.4-1.07 1-1.07h12z"></path></svg>`,
  zoomIn: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm.5-7H9v2H7v1h2v2h1v-2h2V9h-2z"/></svg>`,
  zoomOut: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/></svg>`,
  fitZoom: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  select: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18z"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>`,
  redo: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>`,
  toggleHelpers: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`
}

const TOOL_TITLES: Record<string, string> = {
  select: '选择',
  line: '画直线',
  area: '画区域',
  curve: '画曲线',
  text: '写文字',
  image: '上传图片',
  undo: '撤销',
  redo: '重做',
  zoomIn: '放大视图',
  zoomOut: '缩小视图',
  fitZoom: '重置视图',
  download: '下载图片',
  lineColor: '线段颜色',
  fillColor: '填充颜色',
  toggleHelpers: '显示/隐藏距离提示'
}

const DEFAULT_TOOLS: ToolName[] = [
  'lineColor',
  'fillColor',
  'select',
  'line',
  'area',
  'curve',
  'text',
  'image',
  'undo',
  'redo',
  'zoomIn',
  'zoomOut',
  'fitZoom',
  'download',
  'toggleHelpers'
]

export default class Toolbar {
  private paintBoard: PaintBoard
  private options: Required<ToolbarOptions>
  private container: HTMLDivElement | null
  private buttons: Map<string, HTMLButtonElement>
  private lineColorPicker: ColorPicker | null
  private fillColorPicker: ColorPicker | null
  private activeTool: string | null
  private lineColorBtn: HTMLDivElement | null
  private fillColorBtn: HTMLDivElement | null
  private helpersVisible: boolean

  constructor(paintBoard: PaintBoard, options: ToolbarOptions = {}) {
    this.paintBoard = paintBoard
    this.options = {
      tools: options.tools ?? DEFAULT_TOOLS,
      visible: options.visible ?? true
    }
    this.container = null
    this.buttons = new Map()
    this.lineColorPicker = null
    this.fillColorPicker = null
    this.activeTool = null
    this.lineColorBtn = null
    this.fillColorBtn = null
    this.helpersVisible = false
  }

  init(): this {
    this._createContainer()
    this._createToolsByConfig()
    this._bindEvents()
    if (!this.options.visible) {
      this.hide()
    }
    return this
  }

  private _createContainer(): void {
    this.container = document.createElement('div')
    this.container.className = `${PROJECT_NAME} paint-toolbar`
    this.paintBoard.container?.appendChild(this.container)
  }

  private _createToolsByConfig(): void {
    if (!this.container) return

    const tools = this.options.tools
    for (let i = 0; i < tools.length; i++) {
      const toolName = tools[i]
      this._createToolItem(toolName)
    }
  }

  private _createToolItem(toolName: string): void {
    switch (toolName) {
      case 'lineColor':
        this._createLineColorPicker()
        break
      case 'fillColor':
        this._createFillColorPicker()
        break
      case 'select':
      case 'line':
      case 'area':
      case 'curve':
      case 'text':
        this._createToolButton(toolName, TOOL_TITLES[toolName], TOOL_ICONS[toolName], () => {
          this.paintBoard.setTool(toolName)
        })
        break
      case 'undo':
        this._createActionButton('undo', TOOL_TITLES.undo, TOOL_ICONS.undo, () => {
          this.paintBoard.undo()
          this._updateUndoRedoState()
        })
        break
      case 'redo':
        this._createActionButton('redo', TOOL_TITLES.redo, TOOL_ICONS.redo, () => {
          this.paintBoard.redo()
          this._updateUndoRedoState()
        })
        break
      case 'zoomIn':
        this._createActionButton('zoomIn', TOOL_TITLES.zoomIn, TOOL_ICONS.zoomIn, () => {
          this.paintBoard.zoomIn()
        })
        break
      case 'zoomOut':
        this._createActionButton('zoomOut', TOOL_TITLES.zoomOut, TOOL_ICONS.zoomOut, () => {
          this.paintBoard.zoomOut()
        })
        break
      case 'fitZoom':
        this._createActionButton('fitZoom', TOOL_TITLES.fitZoom, TOOL_ICONS.fitZoom, () => {
          this.paintBoard.resetZoom()
        })
        break
      case 'download':
        this._createActionButton('download', TOOL_TITLES.download, TOOL_ICONS.download, () => {
          this.paintBoard.exportToImage()
        })
        break
      case 'toggleHelpers':
        this._createToggleButton(
          'toggleHelpers',
          TOOL_TITLES.toggleHelpers,
          TOOL_ICONS.toggleHelpers,
          () => {
            this.helpersVisible = !this.helpersVisible
            if (this.helpersVisible) {
              this.paintBoard.showAllAreaHelpers()
            } else {
              this.paintBoard.hideAllAreaHelpers()
            }
            const btn = this.buttons.get('toggleHelpers')
            btn?.classList.toggle('active', this.helpersVisible)
          }
        )
        break
      case 'image':
        this._createActionButton('image', TOOL_TITLES.image, TOOL_ICONS.image, () => {
          const imageTool = this.paintBoard.tools.get('image') as ImageTool | undefined
          if (imageTool) {
            imageTool.openFileDialog()
          } else {
            console.warn('ImageTool not registered. Please register ImageTool first.')
          }
        })
        break
    }
  }

  private _createLineColorPicker(): void {
    if (!this.container) return

    const lineColorWrapper = document.createElement('div')
    lineColorWrapper.className = 'toolbar-item color-item'
    lineColorWrapper.title = TOOL_TITLES.lineColor

    this.lineColorBtn = document.createElement('div')
    this.lineColorBtn.className = 'color-btn line-color-btn'
    this.lineColorBtn.style.backgroundColor = this.paintBoard.lineColor
    lineColorWrapper.appendChild(this.lineColorBtn)

    this.lineColorPicker = new ColorPicker({
      defaultColor: this.paintBoard.lineColor,
      onChange: (color: string) => {
        this.paintBoard.setLineColor(color)
        if (this.lineColorBtn) {
          this.lineColorBtn.style.backgroundColor = color
        }
      }
    })
    lineColorWrapper.appendChild(this.lineColorPicker.getElement()!)

    this.lineColorBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.fillColorPicker?.hide()
      this.lineColorPicker?.toggle()
    })

    this.container.appendChild(lineColorWrapper)
  }

  private _createFillColorPicker(): void {
    if (!this.container) return

    const fillColorWrapper = document.createElement('div')
    fillColorWrapper.className = 'toolbar-item color-item'
    fillColorWrapper.title = TOOL_TITLES.fillColor

    this.fillColorBtn = document.createElement('div')
    this.fillColorBtn.className = 'color-btn fill-color-btn'
    this.fillColorBtn.style.backgroundColor = this.paintBoard.fillColor
    fillColorWrapper.appendChild(this.fillColorBtn)

    this.fillColorPicker = new ColorPicker({
      defaultColor: this.paintBoard.fillColor,
      onChange: (color: string) => {
        this.paintBoard.setFillColor(color)
        if (this.fillColorBtn) {
          this.fillColorBtn.style.backgroundColor = color
        }
      }
    })
    fillColorWrapper.appendChild(this.fillColorPicker.getElement()!)

    this.fillColorBtn.addEventListener('click', e => {
      e.stopPropagation()
      this.lineColorPicker?.hide()
      this.fillColorPicker?.toggle()
    })

    this.container.appendChild(fillColorWrapper)
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

  private _createActionButton(
    name: string,
    title: string,
    icon: string,
    onClick: () => void
  ): void {
    if (!this.container) return

    const btn = document.createElement('button')
    btn.className = 'toolbar-btn action-btn'
    btn.title = title
    btn.innerHTML = icon

    btn.addEventListener('click', onClick)

    this.buttons.set(name, btn)
    this.container.appendChild(btn)
  }

  private _createToggleButton(
    name: string,
    title: string,
    icon: string,
    onClick: () => void
  ): void {
    if (!this.container) return

    const btn = document.createElement('button')
    btn.className = 'toolbar-btn toggle-btn'
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

  private _updateUndoRedoState(): void {
    const undoBtn = this.buttons.get('undo')
    const redoBtn = this.buttons.get('redo')
    if (undoBtn) {
      undoBtn.disabled = !this.paintBoard.canUndo()
    }
    if (redoBtn) {
      redoBtn.disabled = !this.paintBoard.canRedo()
    }
  }

  private _bindEvents(): void {
    document.addEventListener('click', e => {
      if (!this.container?.contains(e.target as Node)) {
        this.lineColorPicker?.hide()
        this.fillColorPicker?.hide()
      }
    })

    this.paintBoard.on('tool:changed', (toolName: unknown) => {
      this._setActiveToolButton(toolName as string)
      this._updateUndoRedoState()
    })

    this.paintBoard.on('history:changed', () => {
      this._updateUndoRedoState()
    })

    this.paintBoard.on('object:created', () => {
      this._updateUndoRedoState()
    })

    this.paintBoard.on('line:created', () => {
      this._updateUndoRedoState()
    })

    this.paintBoard.on('area:created', () => {
      this._updateUndoRedoState()
    })

    this.paintBoard.on('curve:created', () => {
      this._updateUndoRedoState()
    })

    this._updateUndoRedoState()

    if (this.paintBoard.currentTool) {
      this._setActiveToolButton(this.paintBoard.currentTool.name)
    }
  }

  setActiveTool(name: string): void {
    this._setActiveToolButton(name)
  }

  setHelpersVisible(visible: boolean): void {
    if (this.helpersVisible === visible) return
    this.helpersVisible = visible
    if (visible) {
      this.paintBoard.showAllAreaHelpers()
    } else {
      this.paintBoard.hideAllAreaHelpers()
    }
    const btn = this.buttons.get('toggleHelpers')
    btn?.classList.toggle('active', visible)
  }

  getHelpersVisible(): boolean {
    return this.helpersVisible
  }

  show(): void {
    if (this.container) {
      this.container.style.display = ''
    }
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none'
    }
  }

  isVisible(): boolean {
    return this.container?.style.display !== 'none'
  }

  destroy(): void {
    if (this.lineColorPicker) this.lineColorPicker.destroy()
    if (this.fillColorPicker) this.fillColorPicker.destroy()
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
  }
}
