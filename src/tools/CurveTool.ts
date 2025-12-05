import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Path, Rect } from 'fabric'
import type { Point, CurveCustomData, CurveToolOptions } from '../../types'
import BaseTool from './BaseTool'

const DEFAULT_TENSION = 0.5
const DEFAULT_POINT_RADIUS = 5
const DEFAULT_CLOSE_THRESHOLD = 15
const DEFAULT_POINT_FILL_COLOR = 'red'
const DEFAULT_POINT_HOVER_COLOR = '#ff6600'

export default class CurveTool extends BaseTool {
  protected override options: Required<CurveToolOptions>
  private points: Point[]
  private circles: Circle[]
  private previewPath: Path | null
  private isDrawing: boolean
  private _hoverRect: Rect | null

  constructor(options: CurveToolOptions = {}) {
    super('curve', options)
    this.options = {
      activeCursor: options.activeCursor ?? 'crosshair',
      deactiveCursor: options.deactiveCursor ?? 'default',
      tension: options.tension ?? DEFAULT_TENSION,
      pointRadius: options.pointRadius ?? DEFAULT_POINT_RADIUS,
      closeThreshold: options.closeThreshold ?? DEFAULT_CLOSE_THRESHOLD,
      labelFontSize: options.labelFontSize ?? 12,
      pointFillColor: options.pointFillColor ?? DEFAULT_POINT_FILL_COLOR,
      pointHoverColor: options.pointHoverColor ?? DEFAULT_POINT_HOVER_COLOR
    }
    this.points = []
    this.circles = []
    this.previewPath = null
    this.isDrawing = false
    this._hoverRect = null
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
    this.canvas.forEachObject(obj => {
      obj.set({ selectable: false, evented: false })
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.selection = true
    this.canvas.forEachObject(obj => {
      obj.set({ selectable: true, evented: true })
    })
    this._cancelDrawing()
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const pointer = this.getPointer(opt)
    if (!pointer || isNaN(pointer.x) || isNaN(pointer.y)) return

    if (!this.isDrawing) {
      this.isDrawing = true
      this.points = []
      this.circles = []
    }

    if (this.points.length >= 3) {
      const firstPoint = this.points[0]
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + Math.pow(pointer.y - firstPoint.y, 2)
      )
      if (distance < this.options.closeThreshold) {
        this._closeCurve()
        return
      }
    }

    this._addPoint(pointer)
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isDrawing || this.points.length === 0) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._cancelDrawing()
    } else if (e.ctrlKey && e.key === 'z') {
      this._undoLastPoint()
    } else if (e.key === 'Enter') {
      this._finishCurve()
    }
  }

  private _addPoint(point: Point): void {
    if (!this.canvas || !this.paintBoard) return

    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1]
      if (lastPoint.x === point.x && lastPoint.y === point.y) return
    }

    const isFirstPoint = this.points.length === 0
    this.points.push({ x: point.x, y: point.y })

    const circle = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: this.options.pointRadius,
      fill: this.options.pointFillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: true,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer'
    })
    ;(circle as Circle & { customType: string; isStartPoint?: boolean }).customType = 'curveHelper'
    ;(circle as Circle & { customType: string; isStartPoint?: boolean }).isStartPoint = isFirstPoint
    if (isFirstPoint) {
      this._bindCircleHoverEvents(circle)
    }

    this.canvas.add(circle)
    this.circles.push(circle)

    if (this.points.length > 1) {
      this._updatePreview()
    }

    this.canvas.renderAll()
  }

  private _updatePreview(mousePoint?: Point): void {
    if (!this.canvas || !this.paintBoard) return

    if (this.previewPath) {
      this.canvas.remove(this.previewPath)
    }

    const previewPoints = [...this.points]
    if (mousePoint) {
      previewPoints.push(mousePoint)
    }

    if (previewPoints.length < 2) return

    const pathData = this._generateSmoothPath(previewPoints)

    this.previewPath = new fabric.Path(pathData, {
      fill: '',
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      selectable: false,
      evented: false
    })
    ;(this.previewPath as Path & { customType: string }).customType = 'curvePreview'

    this.canvas.add(this.previewPath)
    this.canvas.renderAll()
  }

  private _generateSmoothPath(points: Point[]): string {
    if (points.length < 2) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    if (points.length === 2) {
      path += ` L ${points[1].x} ${points[1].y}`
      return path
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(points.length - 1, i + 2)]

      const cp1 = {
        x: p1.x + ((p2.x - p0.x) * this.options.tension) / 3,
        y: p1.y + ((p2.y - p0.y) * this.options.tension) / 3
      }
      const cp2 = {
        x: p2.x - ((p3.x - p1.x) * this.options.tension) / 3,
        y: p2.y - ((p3.y - p1.y) * this.options.tension) / 3
      }

      path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
    }

    return path
  }

  private _closeCurve(): void {
    if (this.points.length < 3) return

    this.points.push({ ...this.points[0] })

    this._finishCurve(true)
  }

  private _finishCurve(isClosed = false): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return

    if (this.points.length < 2) {
      this._cancelDrawing()
      return
    }

    if (this.previewPath) {
      this.canvas.remove(this.previewPath)
    }

    const pathData = this._generateSmoothPath(this.points)

    const curve = new fabric.Path(pathData, {
      fill: isClosed ? 'transparent' : '',
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      selectable: true,
      evented: true,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
      moveCursor: 'pointer'
    })

    const customData: CurveCustomData = {
      curveId: `curve-${Date.now()}`,
      points: [...this.points],
      isClosed: isClosed,
      lineColor: this.paintBoard.lineColor,
      fillColor: isClosed ? 'transparent' : null
    }

    ;(curve as Path & { customType: string; customData: CurveCustomData }).customType = 'curve'
    ;(curve as Path & { customType: string; customData: CurveCustomData }).customData = customData

    this._hideHelpers()

    this.canvas.add(curve)
    this.canvas.renderAll()

    this.eventBus.emit('curve:created', {
      curveId: customData.curveId,
      points: customData.points,
      isClosed
    })

    this._reset()
  }

  private _undoLastPoint(): void {
    if (!this.canvas) return
    if (this.points.length === 0) return

    this.points.pop()

    if (this.circles.length > 0) {
      const lastCircle = this.circles.pop()!
      this.canvas.remove(lastCircle)
    }

    if (this.points.length > 1) {
      this._updatePreview()
    } else if (this.previewPath) {
      this.canvas.remove(this.previewPath)
      this.previewPath = null
    }

    this.canvas.renderAll()
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this.circles.forEach(circle => this.canvas!.remove(circle))

    if (this.previewPath) {
      this.canvas.remove(this.previewPath)
    }

    this._reset()
    this.canvas.renderAll()
  }

  private _hideHelpers(): void {
    this.circles.forEach(circle => {
      circle.set({ visible: false })
    })
  }

  private _reset(): void {
    this.points = []
    this.circles = []
    this.previewPath = null
    this.isDrawing = false
  }

  private _bindCircleHoverEvents(circle: Circle): void {
    const hoverColor = this.options.pointHoverColor
    const rectSize = this.options.pointRadius * 2

    circle.on('mouseover', () => {
      if (this._hoverRect) {
        this.canvas?.remove(this._hoverRect)
      }
      this._hoverRect = new fabric.Rect({
        left: circle.left,
        top: circle.top,
        width: rectSize,
        height: rectSize,
        fill: 'transparent',
        stroke: hoverColor,
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      })
      this.canvas?.add(this._hoverRect)
      this.canvas?.renderAll()
    })

    circle.on('mouseout', () => {
      if (this._hoverRect) {
        this.canvas?.remove(this._hoverRect)
        this._hoverRect = null
        this.canvas?.renderAll()
      }
    })
  }

  setTension(value: number): void {
    this.options.tension = Math.max(0, Math.min(1, value))
  }
}
