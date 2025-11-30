import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Path } from 'fabric'
import type { Point, CurveCustomData } from '../../types'
import BaseTool from './BaseTool'

export default class CurveTool extends BaseTool {
  private points: Point[]
  private circles: Circle[]
  private previewPath: Path | null
  private isDrawing: boolean
  private tension: number

  constructor() {
    super('curve')
    this.points = []
    this.circles = []
    this.previewPath = null
    this.isDrawing = false
    this.tension = 0.5
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'crosshair'
    this.canvas.selection = false
    this.canvas.forEachObject((obj) => {
      obj.set({ selectable: false, evented: false })
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'default'
    this.canvas.selection = true
    this.canvas.forEachObject((obj) => {
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
        Math.pow(pointer.x - firstPoint.x, 2) +
        Math.pow(pointer.y - firstPoint.y, 2)
      )
      if (distance < 15) {
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

    this.points.push({ x: point.x, y: point.y })

    const circle = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: 5,
      fill: 'red',
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    })
    ;(circle as Circle & { customType: string }).customType = 'curveHelper'

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
        x: p1.x + (p2.x - p0.x) * this.tension / 3,
        y: p1.y + (p2.y - p0.y) * this.tension / 3
      }
      const cp2 = {
        x: p2.x - (p3.x - p1.x) * this.tension / 3,
        y: p2.y - (p3.y - p1.y) * this.tension / 3
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

  setTension(value: number): void {
    this.tension = Math.max(0, Math.min(1, value))
  }
}
