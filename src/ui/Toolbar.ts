import type { ToolbarOptions, ToolName } from '../../types'
import ColorPicker from './ColorPicker'
import type PaintBoard from '../core/PaintBoard'
import type ImageTool from '../tools/ImageTool'
import { PROJECT_NAME } from '../utils/settings'
import { TOOL_ICONS } from '../assets/svg'

const TOOL_TITLES: Record<string, string> = {
  select: '选择',
  drag: '拖拽画布',
  line: '画直线',
  area: '画任意区域',
  curve: '画曲线',
  rect: '画矩形区域',
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
  helpers: '显示/隐藏距离提示'
}

const DEFAULT_TOOLS: ToolName[] = [
  'lineColor',
  'fillColor',
  'select',
  'drag',
  'line',
  'area',
  'curve',
  'rect',
  'text',
  'image',
  'undo',
  'redo',
  'zoomIn',
  'zoomOut',
  'fitZoom',
  'download',
  'helpers'
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
      case 'drag':
      case 'line':
      case 'area':
      case 'curve':
      case 'rect':
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
      case 'helpers':
        this._createToggleButton('helpers', TOOL_TITLES.helpers, TOOL_ICONS.helpers, () => {
          this.helpersVisible = !this.helpersVisible
          if (this.helpersVisible) {
            this.paintBoard.showAllAreaHelpers()
          } else {
            this.paintBoard.hideAllAreaHelpers()
          }
          const btn = this.buttons.get('helpers')
          btn?.classList.toggle('active', this.helpersVisible)
        })
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

    this.paintBoard.on('rect:created', () => {
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
    const btn = this.buttons.get('helpers')
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
