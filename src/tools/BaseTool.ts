import type { Canvas, TPointerEventInfo, TPointerEvent } from 'fabric'
import type { Point } from '../../types'
import EventBus from '../core/EventBus'
import type PaintBoard from '../core/PaintBoard'

export default class BaseTool {
  name: string
  canvas: Canvas | null
  eventBus: EventBus | null
  paintBoard: PaintBoard | null
  isActive: boolean

  protected _onMouseDown!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onMouseMove!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onMouseUp!: (opt: TPointerEventInfo<TPointerEvent>) => void
  protected _onKeyDown!: (e: KeyboardEvent) => void

  constructor(name: string) {
    this.name = name
    this.canvas = null
    this.eventBus = null
    this.paintBoard = null
    this.isActive = false
    this._bindHandlers()
  }

  private _bindHandlers(): void {
    this._onMouseDown = this._handleMouseDown.bind(this)
    this._onMouseMove = this._handleMouseMove.bind(this)
    this._onMouseUp = this._handleMouseUp.bind(this)
    this._onKeyDown = this._handleKeyDown.bind(this)
  }

  bindCanvas(canvas: Canvas, eventBus: EventBus, paintBoard: PaintBoard): void {
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
    this.onActivate()
  }

  deactivate(): void {
    if (!this.canvas) return
    this.isActive = false
    this.canvas.off('mouse:down', this._onMouseDown)
    this.canvas.off('mouse:move', this._onMouseMove)
    this.canvas.off('mouse:up', this._onMouseUp)
    document.removeEventListener('keydown', this._onKeyDown)
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
