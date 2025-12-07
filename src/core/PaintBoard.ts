import * as fabric from 'fabric'
import type { Canvas, FabricObject, Circle, Line, Text, FabricImage } from 'fabric'
import type {
  PaintBoardOptions,
  ExportImageOptions,
  EventCallback,
  AreaCustomData,
  AddTextOptions,
  AddImageOptions,
  CustomImageData,
  TextCustomData,
  BackgroundImageOptions,
  CurveCustomData,
  LineCustomData,
  TrajectoryOptions
} from '../../types'
import PersonTracker from '../utils/PersonTracker'
import TextTool from '../tools/TextTool'
import ImageTool from '../tools/ImageTool'
import EventBus from './EventBus'
import CanvasManager from './CanvasManager'
import UndoRedoManager from '../utils/UndoRedoManager'
import * as exportUtils from '../utils/export'
import BaseTool from '../tools/BaseTool'

const defaultOptions: PaintBoardOptions = {
  width: 800,
  height: 800,
  backgroundColor: 'transparent',
  lineColor: 'rgba(2, 167, 240, 1)',
  fillColor: 'rgba(128, 255, 255, 1)',
  selection: true,
  preserveObjectStacking: true,
  perPixelTargetFind: false,
  targetFindTolerance: 0
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
  private _helpersVisible: boolean
  private _backgroundImage: FabricImage | null
  private _bgImageOptions: BackgroundImageOptions | null
  private _personTracker: PersonTracker | null

  constructor(container: string | HTMLElement, options: PaintBoardOptions = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container
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
    this._helpersVisible = false
    this._backgroundImage = null
    this._bgImageOptions = null
    this._personTracker = null
  }

  init(): this {
    if (this._initialized) return this
    this._createCanvas()
    this._initCanvasManager()
    this._initUndoRedo()
    this._bindEvents()
    this._initialized = true

    if (this.options.backgroundImage) {
      this.setBackgroundImage(this.options.backgroundImage)
    }

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
      perPixelTargetFind: this.options.perPixelTargetFind,
      targetFindTolerance: this.options.targetFindTolerance,
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
    this.undoRedoManager = new UndoRedoManager(this.canvas, this.eventBus, {
      excludeTypes: [
        'text', 'customImage',
        'area', 'areaPoint', 'areaLine', 'areaLabel',
        'curve', 'curveHelper', 'curveHelperLabel', 'curvePreview',
        'line', 'lineHelper', 'lineHelperLabel'
      ],
      getBackgroundImage: () => this._backgroundImage
    })
  }

  private _bindEvents(): void {
    if (!this.canvas) return

    this.canvas.on('mouse:move', e => {
      const pointer = this.canvas!.getPointer(e.e)
      this.eventBus.emit('mouse:move', {
        x: Math.round(pointer.x),
        y: Math.round(pointer.y)
      })
    })

    this.canvas.on('selection:created', e => {
      this.eventBus.emit('object:selected', e.selected)
    })

    this.canvas.on('selection:updated', e => {
      this.eventBus.emit('object:selected', e.selected)
    })

    this.canvas.on('selection:cleared', () => {
      this.eventBus.emit('selection:cleared')
    })

    this.canvas.on('object:added', e => {
      this.eventBus.emit('object:created', e.target)
    })

    this.canvas.on('object:modified', e => {
      this.eventBus.emit('object:modified', e.target)
    })

    this.eventBus.on('canvas:zoomed', () => {
      this._updateBackgroundImageTransform()
    })

    this.eventBus.on('canvas:panned', () => {
      this._updateBackgroundImageTransform()
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
    if (this.currentTool?.canUndoTool()) {
      return this.currentTool.undo()
    }
    for (const tool of this.tools.values()) {
      if (tool !== this.currentTool && tool.canUndoTool()) {
        return tool.undo()
      }
    }
    return this.undoRedoManager?.undo() ?? false
  }

  redo(): boolean {

    if (this.currentTool?.canRedoTool()) {
      return this.currentTool.redo()
    }
    for (const tool of this.tools.values()) {
      if (tool !== this.currentTool && tool.canRedoTool()) {
        return tool.redo()
      }
    }
    return this.undoRedoManager?.redo() ?? false
  }

  canUndo(): boolean {
    for (const tool of this.tools.values()) {
      if (tool.canUndoTool()) {
        return true
      }
    }
    return this.undoRedoManager?.canUndo() ?? false
  }

  canRedo(): boolean {
    for (const tool of this.tools.values()) {
      if (tool.canRedoTool()) {
        return true
      }
    }
    return this.undoRedoManager?.canRedo() ?? false
  }

  pauseHistory(): void {
    this.undoRedoManager?.pause()
  }

  resumeHistory(): void {
    this.undoRedoManager?.resume()
  }

  isHistoryPaused(): boolean {
    return this.undoRedoManager?.isPaused() ?? false
  }

  clear(): this {
    if (!this.canvas) return this
    const objects = this.canvas.getObjects()
    objects.forEach(obj => {
      if (obj !== this._backgroundImage) {
        this.canvas!.remove(obj)
      }
    })
    this.canvas.backgroundColor = this.options.backgroundColor
    this.canvas.renderAll()
    this.undoRedoManager?.clear()
    this.eventBus.emit('canvas:cleared')
    return this
  }

  setBackgroundImage(source: string | BackgroundImageOptions): Promise<this> {
    return new Promise(resolve => {
      if (!this.canvas) {
        resolve(this)
        return
      }

      const options: BackgroundImageOptions =
        typeof source === 'string'
          ? { source, scaleMode: 'fill', opacity: 1 }
          : { scaleMode: 'fill', opacity: 1, ...source }

      this._bgImageOptions = options

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const fabricImg = new fabric.FabricImage(img, {
          originX: 'left',
          originY: 'top',
          selectable: false,
          evented: false,
          excludeFromExport: true
        })

        if (this._backgroundImage) {
          this.canvas!.remove(this._backgroundImage)
        }

        this._backgroundImage = fabricImg
        fabricImg.set('opacity', options.opacity ?? 1)

        this.canvas!.add(fabricImg)
        this.canvas!.sendObjectToBack(fabricImg)
        this._updateBackgroundImageTransform()
        this.canvas!.renderAll()

        this.eventBus.emit('backgroundImage:set', { source: options.source })
        resolve(this)
      }

      img.onerror = () => {
        console.error('Failed to load background image:', options.source)
        this.eventBus.emit('backgroundImage:error', { source: options.source })
        resolve(this)
      }

      img.src = options.source
    })
  }

  private _updateBackgroundImageTransform(): void {
    if (!this.canvas || !this._backgroundImage || !this._bgImageOptions) return

    const vpt = this.canvas.viewportTransform
    if (!vpt) return

    const zoom = this.canvas.getZoom()
    const panX = vpt[4]
    const panY = vpt[5]

    const canvasWidth = this.canvas.width || this.options.width
    const canvasHeight = this.canvas.height || this.options.height
    const img = this._backgroundImage
    const imgWidth = img.width || 1
    const imgHeight = img.height || 1
    const scaleMode = this._bgImageOptions.scaleMode || 'fill'

    let baseScaleX = 1
    let baseScaleY = 1
    let baseLeft = 0
    let baseTop = 0

    switch (scaleMode) {
      case 'fill': {
        const scaleX = canvasWidth / imgWidth
        const scaleY = canvasHeight / imgHeight
        const scale = Math.max(scaleX, scaleY)
        baseScaleX = baseScaleY = scale
        baseLeft = 0
        baseTop = 0
        break
      }
      case 'fit': {
        const scaleX = canvasWidth / imgWidth
        const scaleY = canvasHeight / imgHeight
        const scale = Math.min(scaleX, scaleY)
        baseScaleX = baseScaleY = scale
        baseLeft = (canvasWidth - imgWidth * scale) / 2
        baseTop = (canvasHeight - imgHeight * scale) / 2
        break
      }
      case 'stretch':
        baseScaleX = canvasWidth / imgWidth
        baseScaleY = canvasHeight / imgHeight
        baseLeft = 0
        baseTop = 0
        break
      case 'center':
        baseScaleX = baseScaleY = 1
        baseLeft = (canvasWidth - imgWidth) / 2
        baseTop = (canvasHeight - imgHeight) / 2
        break
      case 'repeat':
        baseScaleX = baseScaleY = 1
        baseLeft = 0
        baseTop = 0
        break
    }

    img.set({
      scaleX: baseScaleX / zoom,
      scaleY: baseScaleY / zoom,
      left: (baseLeft - panX) / zoom,
      top: (baseTop - panY) / zoom
    })
    img.setCoords()
  }

  clearBackgroundImage(): this {
    if (!this.canvas) return this

    if (this._backgroundImage) {
      this.canvas.remove(this._backgroundImage)
      this._backgroundImage = null
      this._bgImageOptions = null
      this.canvas.renderAll()
      this.eventBus.emit('backgroundImage:cleared')
    }

    return this
  }

  getBackgroundImage(): FabricImage | null {
    return this._backgroundImage
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

  showAllAreaHelpers(): this {
    if (!this.canvas) return this
    this.canvas.forEachObject(
      (obj: FabricObject & { customType?: string; customData?: AreaCustomData | CurveCustomData | LineCustomData }) => {
        if (obj.customType === 'area' && obj.customData) {
          const data = obj.customData as AreaCustomData
          data.lines?.forEach((line: Line) => {
            line.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(line)
          })
          data.circles?.forEach((circle: Circle) => {
            circle.set({ visible: true, opacity: 1, evented: true, hoverCursor: 'pointer' })
            this.canvas!.bringObjectToFront(circle)
          })
          data.labels?.forEach((label: Text) => {
            label.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(label)
          })
        } else if (obj.customType === 'curve' && obj.customData) {
          const data = obj.customData as CurveCustomData
          data.circles?.forEach((circle: Circle) => {
            circle.set({ visible: true, opacity: 1, evented: true, hoverCursor: 'pointer' })
            this.canvas!.bringObjectToFront(circle)
          })
          data.labels?.forEach((label: Text) => {
            label.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(label)
          })
        } else if (obj.customType === 'line' && obj.customData) {
          const data = obj.customData as LineCustomData
          if (data.startCircle) {
            data.startCircle.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(data.startCircle)
          }
          if (data.endCircle) {
            data.endCircle.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(data.endCircle)
          }
          if (data.label) {
            data.label.set({ visible: true, opacity: 1 })
            this.canvas!.bringObjectToFront(data.label)
          }
        }
      }
    )
    this.canvas.renderAll()
    this.eventBus.emit('areaHelpers:shown')
    this._helpersVisible = true
    return this
  }

  hideAllAreaHelpers(): this {
    if (!this.canvas) return this
    this.canvas.forEachObject(
      (obj: FabricObject & { customType?: string; customData?: AreaCustomData | CurveCustomData | LineCustomData }) => {
        if (obj.customType === 'area' && obj.customData) {
          const data = obj.customData as AreaCustomData
          data.circles?.forEach((circle: Circle) => {
            circle.set({ visible: false })
          })
          data.labels?.forEach((label: Text) => {
            label.set({ visible: false })
          })
          data.lines?.forEach((line: Line) => {
            line.set({ visible: false })
          })
        } else if (obj.customType === 'curve' && obj.customData) {
          const data = obj.customData as CurveCustomData
          data.circles?.forEach((circle: Circle) => {
            circle.set({ visible: false })
          })
          data.labels?.forEach((label: Text) => {
            label.set({ visible: false })
          })
        } else if (obj.customType === 'line' && obj.customData) {
          const data = obj.customData as LineCustomData
          if (data.startCircle) {
            data.startCircle.set({ visible: false })
          }
          if (data.endCircle) {
            data.endCircle.set({ visible: false })
          }
          if (data.label) {
            data.label.set({ visible: false })
          }
        }
      }
    )
    this.canvas.renderAll()
    this.eventBus.emit('areaHelpers:hidden')
    this._helpersVisible = false
    return this
  }

  toggleAreaHelpers(): this {
    if (this._helpersVisible) {
      this.hideAllAreaHelpers()
    } else {
      this.showAllAreaHelpers()
      this._helpersVisible = true
    }
    return this
  }

  isHelpersVisible(): boolean {
    return this._helpersVisible
  }

  addText(
    options: AddTextOptions
  ): (Text & { customType: string; customData: TextCustomData }) | null {
    const textTool = this.tools.get('text') as TextTool | undefined
    if (!textTool) {
      console.warn('TextTool not registered. Please register TextTool first.')
      return null
    }

    const result = textTool.createTextAt(options)
    if (!result) return null

    return result.textObj
  }

  async addImage(options: AddImageOptions): Promise<FabricImage | null> {
    const imageTool = this.tools.get('image') as ImageTool | undefined
    if (!imageTool) {
      console.warn('ImageTool not registered. Please register ImageTool first.')
      return Promise.resolve(null)
    }

    const result = await imageTool.addImageAt(options)
    if (!result) return null
    return result.imageObj
  }

  removeById(id: string): boolean {
    if (!this.canvas) return false

    let removed = false
    const objects = this.canvas.getObjects()

    type CustomData = TextCustomData | CustomImageData | AreaCustomData | CurveCustomData | LineCustomData

    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: CustomData }
      if (customObj.customData) {
        let objId: string | undefined

        switch (customObj.customType) {
          case 'text':
            objId = (customObj.customData as TextCustomData).textId
            break
          case 'customImage':
            objId = (customObj.customData as CustomImageData).customImageId
            break
          case 'area':
            objId = (customObj.customData as AreaCustomData).areaId
            break
          case 'curve':
            objId = (customObj.customData as CurveCustomData).curveId
            break
          case 'line':
            objId = (customObj.customData as LineCustomData).lineId
            break
        }

        if (objId === id) {
          if (customObj.customType === 'area') {
            this._removeAreaWithHelpers(customObj as FabricObject & { customData: AreaCustomData })
          } else if (customObj.customType === 'curve') {
            this._removeCurveWithHelpers(customObj as FabricObject & { customData: CurveCustomData })
          } else if (customObj.customType === 'line') {
            this._removeLineWithHelpers(customObj as FabricObject & { customData: LineCustomData })
          } else {
            this.canvas.remove(obj)
          }
          removed = true
          this.eventBus.emit('object:removed', { id, type: customObj.customType })
          break
        }
      }
    }

    if (removed) {
      this.canvas.renderAll()
    }

    return removed
  }

  private _removeAreaWithHelpers(areaObj: FabricObject & { customData: AreaCustomData }): void {
    if (!this.canvas) return

    const data = areaObj.customData
    data.circles?.forEach((circle: Circle) => {
      this.canvas!.remove(circle)
    })
    data.labels?.forEach((label: Text) => {
      this.canvas!.remove(label)
    })
    data.lines?.forEach((line: Line) => {
      this.canvas!.remove(line)
    })
    this.canvas.remove(areaObj)
  }

  private _removeCurveWithHelpers(curveObj: FabricObject & { customData: CurveCustomData }): void {
    if (!this.canvas) return

    const data = curveObj.customData
    data.circles?.forEach((circle: Circle) => {
      this.canvas!.remove(circle)
    })
    data.labels?.forEach((label: Text) => {
      this.canvas!.remove(label)
    })
    this.canvas.remove(curveObj)
  }

  private _removeLineWithHelpers(lineObj: FabricObject & { customData: LineCustomData }): void {
    if (!this.canvas) return

    const data = lineObj.customData
    if (data.startCircle) {
      this.canvas.remove(data.startCircle)
    }
    if (data.endCircle) {
      this.canvas.remove(data.endCircle)
    }
    if (data.label) {
      this.canvas.remove(data.label)
    }
    this.canvas.remove(lineObj)
  }

  getCustomObjects(): Array<{ id: string; type: string; object: FabricObject }> {
    if (!this.canvas) return []

    const result: Array<{ id: string; type: string; object: FabricObject }> = []
    const objects = this.canvas.getObjects()

    type CustomData = TextCustomData | CustomImageData | AreaCustomData | CurveCustomData | LineCustomData

    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: CustomData }
      if (customObj.customType && customObj.customData) {
        let id: string | undefined

        switch (customObj.customType) {
          case 'text':
            id = (customObj.customData as TextCustomData).textId
            break
          case 'customImage':
            id = (customObj.customData as CustomImageData).customImageId
            break
          case 'area':
            id = (customObj.customData as AreaCustomData).areaId
            break
          case 'curve':
            id = (customObj.customData as CurveCustomData).curveId
            break
          case 'line':
            id = (customObj.customData as LineCustomData).lineId
            break
        }

        if (id) {
          result.push({
            id,
            type: customObj.customType,
            object: obj
          })
        }
      }
    }

    return result
  }

  updateTextById(
    id: string,
    options: Partial<Omit<AddTextOptions, 'x' | 'y'>> & { x?: number; y?: number }
  ): boolean {
    if (!this.canvas) return false

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: TextCustomData }
      if (customObj.customType === 'text' && customObj.customData?.textId === id) {
        const textObj = obj as fabric.IText

        if (options.text !== undefined) textObj.set('text', options.text)
        if (options.x !== undefined) textObj.set('left', options.x)
        if (options.y !== undefined) textObj.set('top', options.y)
        if (options.fontSize !== undefined) textObj.set('fontSize', options.fontSize)
        if (options.fontFamily !== undefined) textObj.set('fontFamily', options.fontFamily)
        if (options.fill !== undefined) textObj.set('fill', options.fill)
        if (options.fontWeight !== undefined) textObj.set('fontWeight', options.fontWeight)
        if (options.fontStyle !== undefined) textObj.set('fontStyle', options.fontStyle)
        if (options.textAlign !== undefined) textObj.set('textAlign', options.textAlign)
        if (options.selectable !== undefined) textObj.set('selectable', options.selectable)
        if (options.editable !== undefined) {
          textObj.set('editable', options.editable)
        }

        this.canvas.renderAll()
        this.eventBus.emit('text:updated', { id, options })
        return true
      }
    }

    return false
  }

  updateImageById(
    id: string,
    options: Partial<Omit<AddImageOptions, 'base64'>> & { x?: number; y?: number }
  ): boolean {
    if (!this.canvas) return false

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: CustomImageData }
      if (customObj.customType === 'customImage' && customObj.customData?.customImageId === id) {
        if (options.x !== undefined) obj.set('left', options.x)
        if (options.y !== undefined) obj.set('top', options.y)
        if (options.angle !== undefined) obj.set('angle', options.angle)
        if (options.scaleX !== undefined) obj.set('scaleX', options.scaleX)
        if (options.scaleY !== undefined) obj.set('scaleY', options.scaleY)
        if (options.opacity !== undefined) obj.set('opacity', options.opacity)
        if (options.selectable !== undefined) obj.set('selectable', options.selectable)

        this.canvas.renderAll()
        this.eventBus.emit('custom:image:updated', { id, options })
        return true
      }
    }

    return false
  }

  getObjectById(id: string): FabricObject | null {
    if (!this.canvas) return null

    type CustomData = TextCustomData | CustomImageData | AreaCustomData | CurveCustomData | LineCustomData

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: CustomData }
      if (customObj.customData) {
        let objId: string | undefined

        switch (customObj.customType) {
          case 'text':
            objId = (customObj.customData as TextCustomData).textId
            break
          case 'customImage':
            objId = (customObj.customData as CustomImageData).customImageId
            break
          case 'area':
            objId = (customObj.customData as AreaCustomData).areaId
            break
          case 'curve':
            objId = (customObj.customData as CurveCustomData).curveId
            break
          case 'line':
            objId = (customObj.customData as LineCustomData).lineId
            break
        }

        if (objId === id) {
          return obj
        }
      }
    }

    return null
  }

  createPersonTracker(options?: TrajectoryOptions): PersonTracker {
    if (!this.canvas) {
      throw new Error('Canvas not initialized')
    }
    if (this._personTracker) {
      this._personTracker.destroy()
    }
    this._personTracker = new PersonTracker(this.canvas, this.eventBus, options)
    return this._personTracker
  }

  getPersonTracker(): PersonTracker | null {
    return this._personTracker
  }

  private _bindCustomObjectEvents(obj: FabricObject, type: 'text' | 'image'): void {
    const customData = (obj as FabricObject & { customData: TextCustomData | CustomImageData })
      .customData

    obj.on('mousedown', () => {
      this.eventBus.emit(`custom:${type}:clicked`, {
        id:
          type === 'text'
            ? (customData as TextCustomData).textId
            : (customData as CustomImageData).customImageId,
        object: obj
      })
    })

    obj.on('selected', () => {
      this.eventBus.emit('custom:selected', {
        type,
        id:
          type === 'text'
            ? (customData as TextCustomData).textId
            : (customData as CustomImageData).customImageId,
        object: obj
      })
    })

    obj.on('modified', () => {
      this.eventBus.emit(`custom:${type}:modified`, {
        id:
          type === 'text'
            ? (customData as TextCustomData).textId
            : (customData as CustomImageData).customImageId,
        object: obj
      })
    })
  }

  destroy(): void {
    if (this.currentTool) {
      this.currentTool.deactivate()
    }
    this.tools.forEach(tool => tool.destroy && tool.destroy())
    this.tools.clear()
    this._personTracker?.destroy()
    this._personTracker = null
    this.eventBus.clear()
    this.canvas?.dispose()
    if (this.container) {
      this.container.innerHTML = ''
    }
    this._initialized = false
  }
}
