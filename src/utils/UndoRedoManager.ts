import type { Canvas } from 'fabric'
import type { HistoryState } from '../../types'
import EventBus from '../core/EventBus'

const MAX_HISTORY = 50

export default class UndoRedoManager {
  private canvas: Canvas
  private eventBus: EventBus
  private undoStack: string[]
  private redoStack: string[]
  private _isRestoring: boolean

  constructor(canvas: Canvas, eventBus: EventBus) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.undoStack = []
    this.redoStack = []
    this._isRestoring = false
    this._bindEvents()
  }

  private _bindEvents(): void {
    this.canvas.on('object:added', () => this._onCanvasChanged())
    this.canvas.on('object:removed', () => this._onCanvasChanged())
    this.canvas.on('object:modified', () => this._onCanvasChanged())
  }

  private _onCanvasChanged(): void {
    if (this._isRestoring) return
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
    if (!this.canUndo()) return false

    const currentState = this._serializeCanvas()
    this.redoStack.push(currentState)

    const previousState = this.undoStack.pop()!
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
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  private _serializeCanvas(): string {
    return JSON.stringify(this.canvas.toJSON())
  }

  private _restoreState(state: string): void {
    this._isRestoring = true

    const data = JSON.parse(state)

    this.canvas.loadFromJSON(data).then(() => {
      this.canvas.renderAll()
      this._isRestoring = false
    })
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
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
