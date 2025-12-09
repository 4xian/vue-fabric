import type { Canvas, TPointerEventInfo, TPointerEvent } from 'fabric'
import type { Point, BaseToolOptions } from '../../types'
import EventBus from '../core/EventBus'
import type VueFabric from '../core/PaintBoard'
import { DEFAULT_BASETOOL_OPTIONS } from '../utils/settings'

export default class BaseTool {
  name: string
  canvas: Canvas | null
  eventBus: EventBus | null
  paintBoard: VueFabric | null
  isActive: boolean
  protected options: Required<BaseToolOptions>

  protected _onMouseDown!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onMouseMove!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onMouseUp!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onKeyDown!: (e: KeyboardEvent) => void

  constructor(name: string, options: BaseToolOptions) {
    this.name = name
    this.canvas = null
    this.eventBus = null
    this.paintBoard = null
    this.isActive = false
    this.options = { ...DEFAULT_BASETOOL_OPTIONS, ...options } as Required<BaseToolOptions>
    this._bindHandlers()
  }

  private _bindHandlers(): void {
    this._onMouseDown = this._handleMouseDown.bind(this)
    this._onMouseMove = this._handleMouseMove.bind(this)
    this._onMouseUp = this._handleMouseUp.bind(this)
    this._onKeyDown = this._handleKeyDown.bind(this)
  }

  bindCanvas(canvas: Canvas, eventBus: EventBus, paintBoard: VueFabric): void {
    this.canvas = canvas
    this.eventBus = eventBus
    this.paintBoard = paintBoard
  }

  activate(): void {
    if (!this.canvas) return
    this.isActive = true
    this.canvas.on('mouse:down', this._onMouseDown)
    this.canvas.on('mouse:move', this._onMouseMove)
    this.canvas.on('mouse:up', this._onMouseUp)
    document.addEventListener('keydown', this._onKeyDown)
    this.canvas.defaultCursor = this.options.activeCursor
    this.onActivate()
  }

  deactivate(): void {
    if (!this.canvas) return
    this.isActive = false
    this.canvas.off('mouse:down', this._onMouseDown)
    this.canvas.off('mouse:move', this._onMouseMove)
    this.canvas.off('mouse:up', this._onMouseUp)
    document.removeEventListener('keydown', this._onKeyDown)
    this.canvas.defaultCursor = this.options.deactiveCursor
    this.onDeactivate()
  }

  onActivate(): void {}
  onDeactivate(): void {}

  private _handleMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isActive) return
    this.onMouseDown(opt)
  }

  private _handleMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isActive) return
    this.onMouseMove(opt)
  }

  private _handleMouseUp(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isActive) return
    this.onMouseUp(opt)
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this.isActive) return
    this.onKeyDown(e)
  }

  onMouseDown(_opt: TPointerEventInfo<TPointerEvent>): void {}
  onMouseMove(_opt: TPointerEventInfo<TPointerEvent>): void {}
  onMouseUp(_opt: TPointerEventInfo<TPointerEvent>): void {}
  onKeyDown(_e: KeyboardEvent): void {}

  isDrawing(): boolean {
    return false
  }

  canUndoTool(): boolean {
    return false
  }

  canRedoTool(): boolean {
    return false
  }

  undo(): boolean {
    return false
  }

  redo(): boolean {
    return false
  }

  getPointer(opt: TPointerEventInfo<TPointerEvent>): Point {
    return this.canvas!.getPointer(opt.e)
  }

  destroy(): void {
    this.deactivate()
    this.canvas = null
    this.eventBus = null
    this.paintBoard = null
  }
}
