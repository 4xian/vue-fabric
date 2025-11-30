import * as fabric from 'fabric'
import type { Canvas, TPointerEventInfo, TPointerEvent, BasicTransformEvent, FabricObject } from 'fabric'
import type { CanvasManagerOptions } from '../../types'
import { throttle } from '../utils/throttle'
import EventBus from './EventBus'

const ZOOM_STEP = 1.1
const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const EXPAND_MARGIN = 50
const EXPAND_SIZE = 200

type ObjectMovingEvent = BasicTransformEvent<TPointerEvent> & { target: FabricObject }

export default class CanvasManager {
  private canvas: Canvas
  private eventBus: EventBus
  private options: CanvasManagerOptions
  private isDragging: boolean
  private lastPosX: number
  private lastPosY: number
  private _throttledObjectMoving: (opt: ObjectMovingEvent) => void

  constructor(canvas: Canvas, eventBus: EventBus, options: CanvasManagerOptions = {}) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.options = options
    this.isDragging = false
    this.lastPosX = 0
    this.lastPosY = 0
    this._throttledObjectMoving = throttle(this._checkCanvasExpand.bind(this), 100)
    this._bindEvents()
  }

  private _bindEvents(): void {
    this.canvas.on('mouse:wheel', this._onMouseWheel.bind(this))
    this.canvas.on('mouse:down', this._onMouseDown.bind(this))
    this.canvas.on('mouse:move', this._onMouseMove.bind(this))
    this.canvas.on('mouse:up', this._onMouseUp.bind(this))
    this.canvas.on('object:moving', this._onObjectMoving.bind(this) as (opt: ObjectMovingEvent) => void)
  }

  private _onMouseWheel(opt: TPointerEventInfo<WheelEvent>): void {
    const delta = opt.e.deltaY
    let zoom = this.canvas.getZoom()
    zoom *= Math.pow(0.999, delta)
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
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

    if (
      bounds.left < EXPAND_MARGIN ||
      bounds.top < EXPAND_MARGIN ||
      bounds.left + bounds.width > canvasWidth - EXPAND_MARGIN ||
      bounds.top + bounds.height > canvasHeight - EXPAND_MARGIN
    ) {
      this._expandCanvas(bounds)
    }
  }

  private _expandCanvas(bounds: { left: number; top: number; width: number; height: number }): void {
    const canvasWidth = this.canvas.getWidth()
    const canvasHeight = this.canvas.getHeight()
    let newWidth = canvasWidth
    let newHeight = canvasHeight

    if (bounds.left < EXPAND_MARGIN || bounds.left + bounds.width > canvasWidth - EXPAND_MARGIN) {
      newWidth += EXPAND_SIZE
    }
    if (bounds.top < EXPAND_MARGIN || bounds.top + bounds.height > canvasHeight - EXPAND_MARGIN) {
      newHeight += EXPAND_SIZE
    }

    if (newWidth !== canvasWidth || newHeight !== canvasHeight) {
      this.canvas.setDimensions({ width: newWidth, height: newHeight })
      this.eventBus.emit('canvas:expanded', { width: newWidth, height: newHeight })
    }
  }

  zoomIn(): void {
    const center = this._getCanvasCenter()
    let zoom = this.canvas.getZoom() * ZOOM_STEP
    zoom = Math.min(zoom, MAX_ZOOM)
    this.canvas.zoomToPoint(new fabric.Point(center.x, center.y), zoom)
    this.eventBus.emit('canvas:zoomed', zoom)
  }

  zoomOut(): void {
    const center = this._getCanvasCenter()
    let zoom = this.canvas.getZoom() / ZOOM_STEP
    zoom = Math.max(zoom, MIN_ZOOM)
    this.canvas.zoomToPoint(new fabric.Point(center.x, center.y), zoom)
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

  setZoom(zoom: number): void {
    const center = this._getCanvasCenter()
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
    this.canvas.zoomToPoint(new fabric.Point(center.x, center.y), zoom)
    this.eventBus.emit('canvas:zoomed', zoom)
  }

  getZoom(): number {
    return this.canvas.getZoom()
  }
}
