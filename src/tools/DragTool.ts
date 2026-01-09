import type { TPointerEventInfo, TPointerEvent, Rect } from 'fabric'
import type { BaseToolOptions } from '../../types'
import BaseTool from './BaseTool'
import { CustomType, DEFAULT_DRAGTOOL_OPTIONS } from '../utils/settings'

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
    this.canvas.defaultCursor = this.options.defaultCursor
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.isDragging = false
    this.canvas.defaultCursor = this.options.defaultCursor
    this._hideAllRectControls()
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.canvas) return
    const evt = opt.e as MouseEvent

    if (evt.ctrlKey || evt.metaKey) {
      this.isDragging = true
      this.canvas.selection = false
      this.lastPosX = evt.clientX
      this.lastPosY = evt.clientY
      this.canvas.setCursor(this.options.activeCursor)
      return
    }
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.canvas) return

    const e = opt.e as MouseEvent

    if (e.ctrlKey || e.metaKey) {
      if (!this.isDragging) {
        this.canvas.setCursor('grab')
      }
    } else {
      this._stopDragging()
    }

    if (!this.isDragging) return

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
    this._stopDragging()
  }

  onKeyDown(e: KeyboardEvent): void {
    if (!this.canvas) return
    if (e.key === 'Control' || e.key === 'Meta') {
      if (!this.isDragging) {
        this.canvas.setCursor('grab')
      }
    }
  }

  onKeyUp(e: KeyboardEvent): void {
    if (!this.canvas) return
    if (e.key === 'Control' || e.key === 'Meta') {
      if (!this.isDragging) {
        this.canvas.setCursor(this.options.activeCursor)
      }
    }
  }

  private _hideAllRectControls(): void {
    if (!this.canvas) return

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as Rect & { customType?: string }
      if (customObj.customType === CustomType.Rect) {
        customObj.set({
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true
        })
      }
    }
  }

  private _stopDragging(): void {
    if (!this.canvas) return
    if (this.isDragging) {
      this.canvas.setViewportTransform(this.canvas.viewportTransform!)
      this.isDragging = false
      this.canvas.setCursor(this.options.defaultCursor)
      this.eventBus?.emit('canvas:panned')
    }
  }
}
