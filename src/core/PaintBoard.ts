import * as fabric from 'fabric'
import type { Canvas } from 'fabric'
import type { PaintBoardOptions, ExportImageOptions, EventCallback, AreaCustomData } from '../../types'
import EventBus from './EventBus'
import CanvasManager from './CanvasManager'
import UndoRedoManager from '../utils/UndoRedoManager'
import * as exportUtils from '../utils/export'
import BaseTool from '../tools/BaseTool'

const defaultOptions: PaintBoardOptions = {
  width: 1200,
  height: 800,
  backgroundColor: 'transparent',
  lineColor: 'rgba(2, 167, 240, 1)',
  fillColor: 'rgba(128, 255, 255, 1)',
  selection: true,
  preserveObjectStacking: true
}

export default class PaintBoard {
  container: HTMLElement | null
  options: Required<PaintBoardOptions>
  canvas: Canvas | null
  eventBus: EventBus
  canvasManager: CanvasManager | null
  currentTool: BaseTool | null
  tools: Map<string, BaseTool>
  lineColor: string
  fillColor: string
  undoRedoManager: UndoRedoManager | null
  private _initialized: boolean

  constructor(container: string | HTMLElement, options: PaintBoardOptions = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container
    this.options = { ...defaultOptions, ...options } as Required<PaintBoardOptions>
    this.canvas = null
    this.eventBus = new EventBus()
    this.canvasManager = null
    this.currentTool = null
    this.tools = new Map()
    this.lineColor = this.options.lineColor
    this.fillColor = this.options.fillColor
    this.undoRedoManager = null
    this._initialized = false
  }

  init(): this {
    if (this._initialized) return this
    this._createCanvas()
    this._initCanvasManager()
    this._initUndoRedo()
    this._bindEvents()
    this._initialized = true
    return this
  }

  private _createCanvas(): void {
    if (!this.container) return

    const canvasEl = document.createElement('canvas')
    canvasEl.id = `paint-board-${Date.now()}`
    this.container.appendChild(canvasEl)

    this.canvas = new fabric.Canvas(canvasEl, {
      width: this.options.width,
      height: this.options.height,
      backgroundColor: this.options.backgroundColor,
      selection: this.options.selection,
      preserveObjectStacking: this.options.preserveObjectStacking,
      stopContextMenu: true,
      fireRightClick: true,
      skipOffscreen: false
    })
  }

  private _initCanvasManager(): void {
    if (!this.canvas) return
    this.canvasManager = new CanvasManager(this.canvas, this.eventBus, this.options)
  }

  private _initUndoRedo(): void {
    if (!this.canvas) return
    this.undoRedoManager = new UndoRedoManager(this.canvas, this.eventBus)
  }

  private _bindEvents(): void {
    if (!this.canvas) return

    this.canvas.on('mouse:move', (e) => {
      const pointer = this.canvas!.getPointer(e.e)
      this.eventBus.emit('mouse:move', {
        x: Math.round(pointer.x),
        y: Math.round(pointer.y)
      })
    })

    this.canvas.on('selection:created', (e) => {
      this.eventBus.emit('object:selected', e.selected)
    })

    this.canvas.on('selection:updated', (e) => {
      this.eventBus.emit('object:selected', e.selected)
    })

    this.canvas.on('selection:cleared', () => {
      this.eventBus.emit('selection:cleared')
    })

    this.canvas.on('object:added', (e) => {
      this.eventBus.emit('object:created', e.target)
    })

    this.canvas.on('object:modified', (e) => {
      this.eventBus.emit('object:modified', e.target)
    })
  }

  registerTool(name: string, tool: BaseTool): this {
    if (!this.canvas) return this
    this.tools.set(name, tool)
    tool.bindCanvas(this.canvas, this.eventBus, this)
    return this
  }

  setTool(toolName: string): this {
    if (this.currentTool) {
      this.currentTool.deactivate()
    }
    const tool = this.tools.get(toolName)
    if (tool) {
      this.currentTool = tool
      tool.activate()
      this.eventBus.emit('tool:changed', toolName)
    }
    return this
  }

  setLineColor(color: string): this {
    this.lineColor = color
    this.eventBus.emit('lineColor:changed', color)
    return this
  }

  setFillColor(color: string): this {
    this.fillColor = color
    this.eventBus.emit('fillColor:changed', color)
    return this
  }

  zoomIn(): this {
    this.canvasManager?.zoomIn()
    return this
  }

  zoomOut(): this {
    this.canvasManager?.zoomOut()
    return this
  }

  resetZoom(): this {
    this.canvasManager?.resetZoom()
    return this
  }

  undo(): boolean {
    return this.undoRedoManager?.undo() ?? false
  }

  redo(): boolean {
    return this.undoRedoManager?.redo() ?? false
  }

  canUndo(): boolean {
    return this.undoRedoManager?.canUndo() ?? false
  }

  canRedo(): boolean {
    return this.undoRedoManager?.canRedo() ?? false
  }

  clear(): this {
    if (!this.canvas) return this
    this.canvas.clear()
    this.canvas.backgroundColor = this.options.backgroundColor
    this.canvas.renderAll()
    this.undoRedoManager?.clear()
    this.eventBus.emit('canvas:cleared')
    return this
  }

  exportToJSON(additionalProperties: string[] = []): string {
    if (!this.canvas) return '{}'
    return exportUtils.exportToJSON(this.canvas, additionalProperties)
  }

  importFromJSON(json: string | object): Promise<void> {
    if (!this.canvas) return Promise.reject(new Error('Canvas not initialized'))
    return exportUtils.importFromJSON(this.canvas, json, this.eventBus).then(() => {
      this.eventBus.emit('canvas:loaded')
    })
  }

  exportToImage(options: ExportImageOptions | string = {}): string {
    if (!this.canvas) return ''
    return exportUtils.exportToImage(this.canvas, options)
  }

  exportToSVG(): string {
    if (!this.canvas) return ''
    return exportUtils.exportToSVG(this.canvas)
  }

  getAreasData(): AreaCustomData[] {
    if (!this.canvas) return []
    return exportUtils.getAreasData(this.canvas)
  }

  getTextsData(): ReturnType<typeof exportUtils.getTextsData> {
    if (!this.canvas) return []
    return exportUtils.getTextsData(this.canvas)
  }

  on(event: string, callback: EventCallback): this {
    this.eventBus.on(event, callback)
    return this
  }

  off(event: string, callback?: EventCallback): this {
    this.eventBus.off(event, callback)
    return this
  }

  getCanvas(): Canvas | null {
    return this.canvas
  }

  destroy(): void {
    if (this.currentTool) {
      this.currentTool.deactivate()
    }
    this.tools.forEach(tool => tool.destroy && tool.destroy())
    this.tools.clear()
    this.eventBus.clear()
    this.canvas?.dispose()
    if (this.container) {
      this.container.innerHTML = ''
    }
    this._initialized = false
  }
}
