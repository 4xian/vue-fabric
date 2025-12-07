import type { Canvas, FabricObject } from 'fabric'
import type { HistoryState } from '../../types'
import EventBus from '../core/EventBus'

const MAX_HISTORY = 50

interface UndoRedoOptions {
  excludeTypes?: string[]
  getBackgroundImage?: () => FabricObject | null
}

export default class UndoRedoManager {
  private canvas: Canvas
  private eventBus: EventBus
  private undoStack: string[]
  private redoStack: string[]
  private _isRestoring: boolean
  private _isPaused: boolean
  private _excludeTypes: string[]
  private _getBackgroundImage: (() => FabricObject | null) | null

  constructor(canvas: Canvas, eventBus: EventBus, options: UndoRedoOptions = {}) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.undoStack = []
    this.redoStack = []
    this._isRestoring = false
    this._isPaused = false
    this._excludeTypes = options.excludeTypes || []
    this._getBackgroundImage = options.getBackgroundImage || null
    this._bindEvents()
    this._saveInitialState()
  }

  private _saveInitialState(): void {
    setTimeout(() => {
      this.undoStack.push(this._serializeCanvas())
    }, 0)
  }

  pause(): void {
    this._isPaused = true
  }

  resume(): void {
    if (this._isPaused) {
      this._isPaused = false
      this.saveState()
    }
  }

  isPaused(): boolean {
    return this._isPaused
  }

  private _bindEvents(): void {
    this.canvas.on('object:added', () => this._onCanvasChanged())
    this.canvas.on('object:removed', () => this._onCanvasChanged())
    this.canvas.on('object:modified', () => this._onCanvasChanged())
  }

  private _onCanvasChanged(): void {
    if (this._isRestoring || this._isPaused) return
    this.saveState()
  }

  saveState(): void {
    if (this._isRestoring) return

    const state = this._serializeCanvas()
    this.undoStack.push(state)

    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }

    this.redoStack = []

    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    } as HistoryState)
  }

  undo(): boolean {
    if (this.undoStack.length < 2) return false

    const currentState = this.undoStack.pop()!
    this.redoStack.push(currentState)

    const previousState = this.undoStack[this.undoStack.length - 1]
    this._restoreState(previousState)

    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    } as HistoryState)

    return true
  }

  redo(): boolean {
    if (!this.canRedo()) return false

    const currentState = this._serializeCanvas()
    this.undoStack.push(currentState)

    const nextState = this.redoStack.pop()!
    this._restoreState(nextState)

    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    } as HistoryState)

    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 1
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  private _serializeCanvas(): string {
    const additionalProperties = [
      'customType',
      'customData',
      'lineId',
      'selectable',
      'evented',
      'hasControls',
      'hasBorders',
      'lockMovementX',
      'lockMovementY',
      'lockScalingX',
      'lockScalingY',
      'lockRotation',
      'hoverCursor',
      'moveCursor'
    ]

    const bgImage = this._getBackgroundImage?.()
    const canvasData = this.canvas.toObject(additionalProperties)

    canvasData.objects = canvasData.objects.filter((obj: { customType?: string }, index: number) => {
      const fabricObj = this.canvas.getObjects()[index]
      if (bgImage && fabricObj === bgImage) return false
      if (obj.customType && this._excludeTypes.includes(obj.customType)) return false
      return true
    })

    return JSON.stringify(canvasData)
  }

  private _getExcludedObjects(): FabricObject[] {
    if (this._excludeTypes.length === 0) return []
    return this.canvas.getObjects().filter(obj => {
      const customType = (obj as FabricObject & { customType?: string }).customType
      return customType && this._excludeTypes.includes(customType)
    })
  }

  private _restoreState(state: string): void {
    this._isRestoring = true

    const excludedObjects = this._getExcludedObjects()
    const bgImage = this._getBackgroundImage?.()
    const data = JSON.parse(state)

    this.canvas.loadFromJSON(data).then(() => {
      if (bgImage) {
        this.canvas.add(bgImage)
        this.canvas.sendObjectToBack(bgImage)
      }
      excludedObjects.forEach(obj => this.canvas.add(obj))
      this.canvas.renderAll()
      this._isRestoring = false
    })
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this._saveInitialState()
    this.eventBus.emit('history:changed', {
      canUndo: false,
      canRedo: false
    } as HistoryState)
  }

  getUndoCount(): number {
    return this.undoStack.length
  }

  getRedoCount(): number {
    return this.redoStack.length
  }
}
