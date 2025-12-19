import * as fabric from 'fabric'
import type {
  Canvas,
  TPointerEventInfo,
  TPointerEvent,
  BasicTransformEvent,
  FabricObject
} from 'fabric'
import type { CanvasManagerOptions, ZoomOrigin, ZoomScale } from '../../types'
import { throttle } from '../utils/throttle'
import EventBus from './EventBus'
import { DEFAULT_CANVAS_MANAGER_OPTIONS } from '../utils/settings'

type ObjectMovingEvent = BasicTransformEvent<TPointerEvent> & { target: FabricObject }

export default class CanvasManager {
  private canvas: Canvas
  private eventBus: EventBus
  public options: Required<
    Pick<
      CanvasManagerOptions,
      'zoomStep' | 'minZoom' | 'maxZoom' | 'expandMargin' | 'expandSize' | 'zoomOrigin'
    >
  >
  private isDragging: boolean
  private lastPosX: number
  private lastPosY: number
  private _throttledObjectMoving: (opt: ObjectMovingEvent) => void

  constructor(canvas: Canvas, eventBus: EventBus, options: CanvasManagerOptions = {}) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.options = {
      zoomStep: options.zoomStep ?? DEFAULT_CANVAS_MANAGER_OPTIONS.zoomStep!,
      minZoom: options.minZoom ?? DEFAULT_CANVAS_MANAGER_OPTIONS.minZoom!,
      maxZoom: options.maxZoom ?? DEFAULT_CANVAS_MANAGER_OPTIONS.maxZoom!,
      expandMargin: options.expandMargin ?? DEFAULT_CANVAS_MANAGER_OPTIONS.expandMargin!,
      expandSize: options.expandSize ?? DEFAULT_CANVAS_MANAGER_OPTIONS.expandSize!,
      zoomOrigin: options.zoomOrigin ?? DEFAULT_CANVAS_MANAGER_OPTIONS.zoomOrigin!
    }
    this.isDragging = false
    this.lastPosX = 0
    this.lastPosY = 0
    this._throttledObjectMoving = throttle(this._checkCanvasExpand.bind(this), 100)
    this._bindEvents()
  }

  private _bindEvents(): void {
    // this.canvas.on('mouse:wheel', this._onMouseWheel.bind(this))
    // this.canvas.on('mouse:down', this._onMouseDown.bind(this))
    // this.canvas.on('mouse:move', this._onMouseMove.bind(this))
    // this.canvas.on('mouse:up', this._onMouseUp.bind(this))
    // this.canvas.on(
    //   'object:moving',
    //   this._onObjectMoving.bind(this) as (opt: ObjectMovingEvent) => void
    // )
  }

  private _onMouseWheel(opt: TPointerEventInfo<WheelEvent>): void {
    const delta = opt.e.deltaY
    let zoom = this.canvas.getZoom()
    zoom *= Math.pow(0.999, delta)
    zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom))
    this.canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom)
    opt.e.preventDefault()
    opt.e.stopPropagation()
    this.eventBus.emit('canvas:zoomed', zoom)
  }

  private _onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const evt = opt.e as MouseEvent
    if (evt.altKey === true || evt.button === 1) {
      this.isDragging = true
      this.canvas.selection = false
      this.lastPosX = evt.clientX
      this.lastPosY = evt.clientY
      this.canvas.setCursor('grabbing')
    }
  }

  private _onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (this.isDragging) {
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
  }

  private _onMouseUp(): void {
    if (this.isDragging) {
      this.canvas.setViewportTransform(this.canvas.viewportTransform!)
      this.isDragging = false
      this.canvas.selection = true
      this.canvas.setCursor('default')
      this.eventBus.emit('canvas:panned')
    }
  }

  private _onObjectMoving(opt: ObjectMovingEvent): void {
    this._throttledObjectMoving(opt)
  }

  private _checkCanvasExpand(opt: ObjectMovingEvent): void {
    const obj = opt.target
    if (!obj) return
    const bounds = obj.getBoundingRect()
    const canvasWidth = this.canvas.getWidth()
    const canvasHeight = this.canvas.getHeight()
    const margin = this.options.expandMargin

    if (
      bounds.left < margin ||
      bounds.top < margin ||
      bounds.left + bounds.width > canvasWidth - margin ||
      bounds.top + bounds.height > canvasHeight - margin
    ) {
      this._expandCanvas(bounds)
    }
  }

  private _expandCanvas(bounds: {
    left: number
    top: number
    width: number
    height: number
  }): void {
    const canvasWidth = this.canvas.getWidth()
    const canvasHeight = this.canvas.getHeight()
    let newWidth = canvasWidth
    let newHeight = canvasHeight
    const margin = this.options.expandMargin
    const size = this.options.expandSize

    if (bounds.left < margin || bounds.left + bounds.width > canvasWidth - margin) {
      newWidth += size
    }
    if (bounds.top < margin || bounds.top + bounds.height > canvasHeight - margin) {
      newHeight += size
    }

    if (newWidth !== canvasWidth || newHeight !== canvasHeight) {
      this.canvas.setDimensions({ width: newWidth, height: newHeight })
      this.eventBus.emit('canvas:expanded', { width: newWidth, height: newHeight })
    }
  }

  zoomIn(origin?: ZoomOrigin): void {
    const point = this._getZoomPoint(origin)
    let zoom = this.canvas.getZoom() * this.options.zoomStep
    zoom = Math.min(zoom, this.options.maxZoom)
    this.canvas.zoomToPoint(new fabric.Point(point.x, point.y), zoom)
    this.eventBus.emit('canvas:zoomed', zoom)
  }

  zoomOut(origin?: ZoomOrigin): void {
    const point = this._getZoomPoint(origin)
    let zoom = this.canvas.getZoom() / this.options.zoomStep
    zoom = Math.max(zoom, this.options.minZoom)
    this.canvas.zoomToPoint(new fabric.Point(point.x, point.y), zoom)
    this.eventBus.emit('canvas:zoomed', zoom)
  }

  resetZoom(): void {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    this.eventBus.emit('canvas:zoomed', 1)
  }

  private _getCanvasCenter(): { x: number; y: number } {
    return {
      x: this.canvas.getWidth() / 2,
      y: this.canvas.getHeight() / 2
    }
  }

  private _getZoomPoint(origin?: ZoomOrigin): { x: number; y: number } {
    const effectiveOrigin = origin ?? this.options.zoomOrigin
    if (effectiveOrigin === 'topLeft') {
      return { x: 0, y: 0 }
    }
    return this._getCanvasCenter()
  }

  setZoom(zoom: number | ZoomScale, origin?: ZoomOrigin): void {
    const point = this._getZoomPoint(origin)

    if (typeof zoom === 'number') {
      zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom))
      this.canvas.zoomToPoint(new fabric.Point(point.x, point.y), zoom)
      this.eventBus.emit('canvas:zoomed', zoom)
    } else {
      const scaleX = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom.x))
      const scaleY = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom.y))

      const vpt = this.canvas.viewportTransform
      if (vpt) {
        const newVpt: [number, number, number, number, number, number] = [...vpt]
        newVpt[0] = scaleX
        newVpt[3] = scaleY
        newVpt[4] = point.x - point.x * scaleX
        newVpt[5] = point.y - point.y * scaleY
        this.canvas.setViewportTransform(newVpt)
      }
      this.eventBus.emit('canvas:zoomed', { x: scaleX, y: scaleY })
    }
  }

  getZoom(): number {
    return this.canvas.getZoom()
  }
}
