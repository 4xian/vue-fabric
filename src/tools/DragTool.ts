import type { TPointerEventInfo, TPointerEvent } from 'fabric'
import type { BaseToolOptions } from '../../types'
import BaseTool from './BaseTool'
import { DEFAULT_DRAGTOOL_OPTIONS } from '../utils/settings'

export default class DragTool extends BaseTool {
  protected override options: Required<BaseToolOptions>
  private isDragging: boolean
  private lastPosX: number
  private lastPosY: number

  constructor(options: BaseToolOptions = {}) {
    super('drag', options)
    this.options = { ...DEFAULT_DRAGTOOL_OPTIONS, ...options } as Required<BaseToolOptions>
    this.isDragging = false
    this.lastPosX = 0
    this.lastPosY = 0
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'grab'
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.isDragging = false
    this.canvas.defaultCursor = this.options.deactiveCursor
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.canvas) return
    const evt = opt.e as MouseEvent
    this.isDragging = true
    this.canvas.selection = false
    this.lastPosX = evt.clientX
    this.lastPosY = evt.clientY
    this.canvas.setCursor('grabbing')
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.canvas || !this.isDragging) return
    const e = opt.e as MouseEvent
    const vpt = this.canvas.viewportTransform
    if (vpt) {
      vpt[4] += e.clientX - this.lastPosX
      vpt[5] += e.clientY - this.lastPosY
      this.canvas.requestRenderAll()
      this.lastPosX = e.clientX
      this.lastPosY = e.clientY
    }
  }

  onMouseUp(): void {
    if (!this.canvas) return
    if (this.isDragging) {
      this.canvas.setViewportTransform(this.canvas.viewportTransform!)
      this.isDragging = false
      this.canvas.setCursor('grab')
      this.eventBus?.emit('canvas:panned')
    }
  }
}
