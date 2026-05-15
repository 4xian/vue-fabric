import type {
  Canvas,
  TPointerEventInfo,
  TPointerEvent,
  BasicTransformEvent,
  FabricObject
} from 'fabric'
import type { FabricPaintOptions, ZoomOrigin, ZoomScale } from '../../types'
import { throttle } from '../utils/throttle'
import EventBus from './EventBus'
import { DEFAULT_VUEFABRIC_OPTIONS } from '../utils/settings'

type ObjectMovingEvent = BasicTransformEvent<TPointerEvent> & { target: FabricObject }
type ViewportResetMode = 'preserveContentAnchor' | 'resetToDisplayAnchor'
type ViewportTransform = [number, number, number, number, number, number]
type CanvasManagerRuntimeOptions = Required<
  Pick<
    FabricPaintOptions,
    | 'zoomStep'
    | 'minZoom'
    | 'maxZoom'
    | 'expandMargin'
    | 'expandSize'
    | 'zoomOrigin'
    | 'zoomAnimationDuration'
    | 'enableWheelZoom'
    | 'autoResize'
    | 'autoResizeMode'
    | 'autoResizeFit'
  >
> &
  Pick<FabricPaintOptions, 'referenceSize'>

export default class CanvasManager {
  private canvas: Canvas
  private eventBus: EventBus
  public options: CanvasManagerRuntimeOptions
  private isDragging: boolean
  private lastPosX: number
  private lastPosY: number
  private _throttledObjectMoving: (opt: ObjectMovingEvent) => void
  private _zoomAnimationFrame: number | null

  constructor(canvas: Canvas, eventBus: EventBus, options: FabricPaintOptions = {}) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.options = {
      zoomStep: options.zoomStep ?? DEFAULT_VUEFABRIC_OPTIONS.zoomStep!,
      minZoom: options.minZoom ?? DEFAULT_VUEFABRIC_OPTIONS.minZoom!,
      maxZoom: options.maxZoom ?? DEFAULT_VUEFABRIC_OPTIONS.maxZoom!,
      expandMargin: options.expandMargin ?? DEFAULT_VUEFABRIC_OPTIONS.expandMargin!,
      expandSize: options.expandSize ?? DEFAULT_VUEFABRIC_OPTIONS.expandSize!,
      zoomOrigin: options.zoomOrigin ?? DEFAULT_VUEFABRIC_OPTIONS.zoomOrigin!,
      zoomAnimationDuration:
        options.zoomAnimationDuration ?? DEFAULT_VUEFABRIC_OPTIONS.zoomAnimationDuration!,
      enableWheelZoom: options.enableWheelZoom ?? DEFAULT_VUEFABRIC_OPTIONS.enableWheelZoom!,
      autoResize: options.autoResize ?? DEFAULT_VUEFABRIC_OPTIONS.autoResize!,
      autoResizeMode: options.autoResizeMode ?? DEFAULT_VUEFABRIC_OPTIONS.autoResizeMode!,
      autoResizeFit: options.autoResizeFit ?? DEFAULT_VUEFABRIC_OPTIONS.autoResizeFit!,
      referenceSize: options.referenceSize ?? DEFAULT_VUEFABRIC_OPTIONS.referenceSize
    }
    this.isDragging = false
    this.lastPosX = 0
    this.lastPosY = 0
    this._throttledObjectMoving = throttle(this._checkCanvasExpand.bind(this), 100)
    this._zoomAnimationFrame = null
    this._bindEvents()
  }

  private _bindEvents(): void {
    if (this.options.enableWheelZoom) {
      this.canvas.on('mouse:wheel', this._onMouseWheel.bind(this))
    }
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
    let zoom = this.getZoom()
    zoom *= Math.pow(0.999, delta)
    zoom = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom))
    this.setZoom(zoom)
    opt.e.preventDefault()
    opt.e.stopPropagation()
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
    let zoom = this.getZoom() * (1 + this.options.zoomStep)
    zoom = Math.min(zoom, this.options.maxZoom)
    this.setZoom(zoom, origin)
  }

  zoomOut(origin?: ZoomOrigin): void {
    let zoom = this.getZoom() / (1 + this.options.zoomStep)
    zoom = Math.max(zoom, this.options.minZoom)
    this.setZoom(zoom, origin)
  }

  resetZoom(zoom: number | ZoomScale = 1, origin?: ZoomOrigin): void {
    const { scale, payload } = this._normalizeZoomInput(zoom)
    this.setViewportTransform(
      this._buildViewportTransform(scale, origin, 'resetToDisplayAnchor'),
      payload
    )
  }

  private _getCanvasDisplaySize(): { width: number; height: number } {
    const lowerCanvas = this.canvas.lowerCanvasEl
    const wrapper = this.canvas.wrapperEl
    const resolveStyleSize = (value?: string): number => {
      if (!value) return 0
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const width =
      lowerCanvas?.clientWidth ||
      resolveStyleSize(lowerCanvas?.style?.width) ||
      wrapper?.clientWidth ||
      resolveStyleSize(wrapper?.style?.width) ||
      this.canvas.getWidth()
    const height =
      lowerCanvas?.clientHeight ||
      resolveStyleSize(lowerCanvas?.style?.height) ||
      wrapper?.clientHeight ||
      resolveStyleSize(wrapper?.style?.height) ||
      this.canvas.getHeight()

    return { width, height }
  }

  private _getLogicalCanvasSize(): { width: number; height: number } {
    const reference = this._isViewportAutoResize() ? this.options.referenceSize : undefined
    return {
      width: reference?.width && reference.width > 0 ? reference.width : this.canvas.getWidth(),
      height: reference?.height && reference.height > 0 ? reference.height : this.canvas.getHeight()
    }
  }

  private _isViewportAutoResize(): boolean {
    return !!this.options.autoResize && this.options.autoResizeMode === 'viewport'
  }

  private _getFitScale(): ZoomScale {
    const logical = this._getLogicalCanvasSize()
    const display = this._getCanvasDisplaySize()

    if (logical.width <= 0 || logical.height <= 0) {
      return { x: 1, y: 1 }
    }

    const scaleX = display.width / logical.width
    const scaleY = display.height / logical.height

    if (this._isViewportAutoResize()) {
      if (this.options.autoResizeFit === 'cover') {
        const scale = Math.max(scaleX, scaleY)
        return { x: scale, y: scale }
      }
      if (this.options.autoResizeFit === 'stretch') {
        return { x: scaleX, y: scaleY }
      }
    }

    const scale = Math.min(scaleX, scaleY)
    return { x: scale, y: scale }
  }

  private _getRelativeZoomScale(): ZoomScale {
    const fitScale = this._getFitScale()
    const vpt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]

    return {
      x: vpt[0] / (fitScale.x || 1),
      y: vpt[3] / (fitScale.y || 1)
    }
  }

  private _clampZoomValue(zoom: number): number {
    return Math.max(this.options.minZoom, Math.min(this.options.maxZoom, zoom))
  }

  private _normalizeZoomInput(zoom: number | ZoomScale): {
    scale: ZoomScale
    payload: number | ZoomScale
  } {
    if (typeof zoom === 'number') {
      const scale = this._clampZoomValue(zoom)
      return {
        scale: { x: scale, y: scale },
        payload: scale
      }
    }

    const scale = {
      x: this._clampZoomValue(zoom.x),
      y: this._clampZoomValue(zoom.y)
    }

    return {
      scale,
      payload: scale
    }
  }

  private _getRelativeZoomScaleFromTransform(transform: ViewportTransform): ZoomScale {
    const fitScale = this._getFitScale()

    return {
      x: transform[0] / (fitScale.x || 1),
      y: transform[3] / (fitScale.y || 1)
    }
  }

  private _resolveZoomPayload(
    transform: ViewportTransform,
    zoomPayload?: number | ZoomScale
  ): number | ZoomScale {
    if (zoomPayload !== undefined) {
      return zoomPayload
    }

    const scale = this._getRelativeZoomScaleFromTransform(transform)
    return scale.x === scale.y ? scale.x : scale
  }

  private _resolveAnimatedZoomPayload(
    transform: ViewportTransform,
    zoomPayload?: number | ZoomScale
  ): number | ZoomScale {
    const scale = this._getRelativeZoomScaleFromTransform(transform)
    return typeof zoomPayload === 'number' ? scale.x : scale
  }

  private _applyViewportTransformImmediately(
    transform: ViewportTransform,
    zoomPayload?: number | ZoomScale,
    onComplete?: () => void
  ): void {
    this.canvas.setViewportTransform(transform)
    this.eventBus.emit('canvas:zoomed', this._resolveZoomPayload(transform, zoomPayload))
    onComplete?.()
  }

  private _requestAnimationFrame(callback: (timestamp: number) => void): number {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      return globalThis.requestAnimationFrame(callback)
    }

    return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number
  }

  private _cancelAnimationFrame(frameId: number): void {
    if (typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(frameId)
      return
    }

    globalThis.clearTimeout(frameId)
  }

  private _cancelZoomAnimation(): void {
    if (this._zoomAnimationFrame === null) return

    this._cancelAnimationFrame(this._zoomAnimationFrame)
    this._zoomAnimationFrame = null
  }

  private _isSameViewportTransform(
    from: ViewportTransform,
    to: ViewportTransform,
    epsilon = 0.0001
  ): boolean {
    return from.every((value, index) => Math.abs(value - to[index]) < epsilon)
  }

  private _easeZoomProgress(progress: number): number {
    return 1 - Math.pow(1 - progress, 3)
  }

  private _interpolateViewportTransform(
    from: ViewportTransform,
    to: ViewportTransform,
    progress: number
  ): ViewportTransform {
    return from.map((value, index) => value + (to[index] - value) * progress) as ViewportTransform
  }

  private _animateViewportTransform(
    target: ViewportTransform,
    zoomPayload?: number | ZoomScale,
    onComplete?: () => void
  ): void {
    const duration = this.options.zoomAnimationDuration
    const from = (this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]) as ViewportTransform

    this._cancelZoomAnimation()

    if (duration <= 0 || this._isSameViewportTransform(from, target)) {
      this._applyViewportTransformImmediately(target, zoomPayload, onComplete)
      return
    }

    const startTime =
      typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now()

    const tick = (timestamp: number): void => {
      const elapsed = timestamp - startTime
      const rawProgress = Math.max(0, Math.min(1, elapsed / duration))

      if (rawProgress >= 1) {
        this._zoomAnimationFrame = null
        this._applyViewportTransformImmediately(target, zoomPayload, onComplete)
        return
      }

      const nextTransform = this._interpolateViewportTransform(
        from,
        target,
        this._easeZoomProgress(rawProgress)
      )

      this.canvas.setViewportTransform(nextTransform)
      this.eventBus.emit(
        'canvas:zooming',
        this._resolveAnimatedZoomPayload(nextTransform, zoomPayload)
      )
      this._zoomAnimationFrame = this._requestAnimationFrame(tick)
    }

    this._zoomAnimationFrame = this._requestAnimationFrame(tick)
  }

  setViewportTransform(
    transform: ViewportTransform,
    zoomPayload?: number | ZoomScale,
    onComplete?: () => void
  ): void {
    this._animateViewportTransform(transform, zoomPayload, onComplete)
  }

  private _buildViewportTransform(
    zoom: ZoomScale,
    origin: ZoomOrigin = this.options.zoomOrigin,
    resetMode: ViewportResetMode = 'preserveContentAnchor'
  ): ViewportTransform {
    const logical = this._getLogicalCanvasSize()
    const display = this._getCanvasDisplaySize()
    const vpt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
    const fitScale = this._getFitScale()
    const scaleX = fitScale.x * zoom.x
    const scaleY = fitScale.y * zoom.y
    const isTopLeft = origin === 'topLeft'
    const currentContentAnchor = isTopLeft
      ? { x: vpt[4], y: vpt[5] }
      : {
          x: vpt[4] + (logical.width * vpt[0]) / 2,
          y: vpt[5] + (logical.height * vpt[3]) / 2
        }
    const displayAnchor = isTopLeft
      ? { x: 0, y: 0 }
      : { x: display.width / 2, y: display.height / 2 }
    const anchor = resetMode === 'preserveContentAnchor' ? currentContentAnchor : displayAnchor
    const tx = isTopLeft ? anchor.x : anchor.x - (logical.width * scaleX) / 2
    const ty = isTopLeft ? anchor.y : anchor.y - (logical.height * scaleY) / 2
    return [scaleX, 0, 0, scaleY, tx, ty]
  }

  setZoom(zoom: number | ZoomScale, origin?: ZoomOrigin): void {
    const { scale, payload } = this._normalizeZoomInput(zoom)
    this.setViewportTransform(this._buildViewportTransform(scale, origin), payload)
  }

  getZoom(): number {
    return this._getRelativeZoomScale().x
  }

  destroy(): void {
    this._cancelZoomAnimation()
  }
}
