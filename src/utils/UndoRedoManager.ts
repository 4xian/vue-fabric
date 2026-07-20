import type { Canvas, FabricObject } from 'fabric'
import type { HistoryState } from '../../types'
import EventBus from '../core/EventBus'
import { DEFAULT_HISTORY_EXCLUDE_TYPES, SERIALIZATION_PROPERTIES } from '../utils/settings'
import { importFromJSON } from './export'

const MAX_HISTORY = 50

interface UndoRedoOptions {
  excludeTypes?: string[]
  getBackgroundImage?: () => FabricObject | null
  getHelpersVisible?: () => boolean
  getCurrentToolName?: () => string
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
  private _getHelpersVisible: (() => boolean) | null
  private _getCurrentToolName: (() => string) | null

  constructor(canvas: Canvas, eventBus: EventBus, options: UndoRedoOptions = {}) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.undoStack = []
    this.redoStack = []
    this._isRestoring = false
    this._isPaused = false
    this._excludeTypes = options.excludeTypes ?? DEFAULT_HISTORY_EXCLUDE_TYPES
    this._getBackgroundImage = options.getBackgroundImage || null
    this._getHelpersVisible = options.getHelpersVisible || null
    this._getCurrentToolName = options.getCurrentToolName || null
    this._bindEvents()
    this._saveInitialState()
  }

  private _saveInitialState(): void {
    if (this.undoStack.length === 0) {
      this.undoStack.push(this._serializeCanvas())
    }
  }

  pause(): void {
    if (!this._isPaused && this.redoStack.length > 0) {
      this.redoStack = []
      this._emitHistoryChanged()
    }
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

  private _emitHistoryChanged(): void {
    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    } as HistoryState)
  }

  saveState(): void {
    if (this._isRestoring) return

    const state = this._serializeCanvas()
    const lastState = this.undoStack[this.undoStack.length - 1]

    if (lastState === state) return

    this.undoStack.push(state)

    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }

    this.redoStack = []
    this._emitHistoryChanged()
  }

  undo(): boolean {
    if (this._isRestoring) return false
    if (this.undoStack.length < 2) return false

    const currentState = this.undoStack.pop()!
    this.redoStack.push(currentState)

    const previousState = this.undoStack[this.undoStack.length - 1]
    this._restoreState(previousState)
    this._emitHistoryChanged()

    return true
  }

  redo(): boolean {
    if (this._isRestoring) return false
    if (!this.canRedo()) return false

    const nextState = this.redoStack.pop()!
    this.undoStack.push(nextState)

    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift()
    }

    this._restoreState(nextState)
    this._emitHistoryChanged()

    return true
  }

  canUndo(): boolean {
    return !this._isRestoring && this.undoStack.length > 1
  }

  canRedo(): boolean {
    return !this._isRestoring && this.redoStack.length > 0
  }

  private _serializeCanvas(): string {
    const bgImage = this._getBackgroundImage?.()
    const canvasObjects = this.canvas.getObjects()
    const canvasData = this.canvas.toObject(SERIALIZATION_PROPERTIES)

    canvasData.objects = canvasData.objects.filter(
      (obj: { customType?: string }, index: number) => {
        const fabricObj = canvasObjects[index]
        if (bgImage && fabricObj === bgImage) return false
        if (obj.customType && this._excludeTypes.includes(obj.customType)) return false
        return true
      }
    )

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

    importFromJSON(
      this.canvas,
      state,
      this.eventBus,
      this._getHelpersVisible?.() ?? false,
      this._getCurrentToolName || undefined
    )
      .then(() => {
        if (bgImage) {
          this.canvas.add(bgImage)
          this.canvas.sendObjectToBack(bgImage)
        }
        excludedObjects.forEach(obj => this.canvas.add(obj))
        this.canvas.renderAll()
      })
      .finally(() => {
        this._isRestoring = false
        this._emitHistoryChanged()
      })
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this._saveInitialState()
    this._emitHistoryChanged()
  }

  getUndoCount(): number {
    return this.undoStack.length
  }

  getRedoCount(): number {
    return this.redoStack.length
  }
}
