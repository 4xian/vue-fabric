import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Path, Rect, Text } from 'fabric'
import type { Point, CurveCustomData, CurveToolOptions } from '../../types'
import BaseTool from './BaseTool'
import { DEFAULT_CURVETOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

interface CurveUndoState {
  point: Point
  circle: Circle
  label: Text | null
  distance: number | null
}

const svgNS = 'http://www.w3.org/2000/svg'

export default class CurveTool extends BaseTool {
  protected override options: Required<CurveToolOptions>
  private points: Point[]
  private circles: Circle[]
  private labels: Text[]
  private distances: number[]
  private previewPath: Path | null
  private previewLabel: Text | null
  private isDrawingState: boolean
  private _hoverRect: Rect | null
  private _undoStack: CurveUndoState[]

  constructor(options: CurveToolOptions = {}) {
    super('curve', options)
    this.options = { ...DEFAULT_CURVETOOL_OPTIONS, ...options } as Required<CurveToolOptions>
    this.points = []
    this.circles = []
    this.labels = []
    this.distances = []
    this.previewPath = null
    this.previewLabel = null
    this.isDrawingState = false
    this._hoverRect = null
    this._undoStack = []
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

    if (!this.isDrawingState) {
      this.isDrawingState = true
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
    if (!this.isDrawingState || this.points.length === 0) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._cancelDrawing()
    }
    // else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    //   e.preventDefault()
    //   this._undoLastPoint()
    // }
    else if (e.key === 'Enter') {
      this._finishCurve()
    }
  }

  override isDrawing(): boolean {
    return this.isDrawingState
  }

  override canUndoTool(): boolean {
    return this.isDrawingState && this.points.length > 0
  }

  override canRedoTool(): boolean {
    return this._undoStack.length > 0
  }

  override undo(): boolean {
    if (!this.isDrawingState) return false
    if (this.points.length === 0) return false
    this._undoLastPoint()
    return true
  }

  override redo(): boolean {
    if (!this.isDrawingState && this._undoStack.length === 0) return false
    if (this._undoStack.length === 0) return false
    this._redoLastPoint()
    return true
  }

  private _addPoint(point: Point): void {
    if (!this.canvas || !this.paintBoard) return

    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1]
      if (lastPoint.x === point.x && lastPoint.y === point.y) return
    }

    const isFirstPoint = this.points.length === 0
    if (isFirstPoint) {
      this.paintBoard.pauseHistory()
    }
    this._undoStack = []
    this.points.push({ x: point.x, y: point.y })

    const circle = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: this.options.pointRadius,
      fill: this.options.pointFillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.helperStrokeWidth,
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
    ;(circle as Circle & { customType: string; isStartPoint?: boolean }).customType =
      CustomType.CurveHelper
    ;(circle as Circle & { customType: string; isStartPoint?: boolean }).isStartPoint = isFirstPoint
    if (isFirstPoint) {
      this._bindCircleHoverEvents(circle)
    }

    this.canvas.add(circle)
    this.circles.push(circle)

    if (this.points.length >= 2) {
      this._addDistanceLabel()
    }

    if (this.points.length > 1) {
      this._updatePreview()
    }

    this.canvas.renderAll()
  }

  private _addDistanceLabel(): void {
    if (!this.canvas || !this.paintBoard || this.points.length < 2) return

    const segmentIndex = this.points.length - 2

    const segmentPath = this._generateSegmentPath(segmentIndex)
    const distance = this._calculatePathLength(segmentPath)
    this.distances.push(distance)

    const midPoint = this._getSegmentMidPoint(segmentIndex)

    const label = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default'
    })
    ;(label as Text & { customType: string }).customType = CustomType.CurveHelperLabel
    this.canvas.add(label)
    this.labels.push(label)
  }

  private _addClosingDistanceLabel(): void {
    if (!this.canvas || !this.paintBoard || this.points.length < 3) return

    const segmentPath = this._generateClosingSegmentPath()
    const distance = this._calculatePathLength(segmentPath)
    this.distances.push(distance)

    const midPoint = this._getClosingSegmentMidPoint()

    const label = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'default'
    })
    ;(label as Text & { customType: string }).customType = CustomType.CurveHelperLabel
    this.canvas.add(label)
    this.labels.push(label)
  }

  private _generateClosingSegmentPath(): string {
    if (this.points.length < 4) return ''

    const n = this.points.length
    const p0 = this.points[n - 3]
    const p1 = this.points[n - 2]
    const p2 = this.points[n - 1]
    const p3 = this.points[1]

    const cp1 = {
      x: p1.x + ((p2.x - p0.x) * this.options.tension) / 3,
      y: p1.y + ((p2.y - p0.y) * this.options.tension) / 3
    }
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) * this.options.tension) / 3,
      y: p2.y - ((p3.y - p1.y) * this.options.tension) / 3
    }

    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
  }

  private _getClosingSegmentMidPoint(): Point {
    const pathData = this._generateClosingSegmentPath()
    const svg = document.createElementNS(svgNS, 'svg')
    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', pathData)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const length = path.getTotalLength()
    const midPoint = path.getPointAtLength(length / 2)
    document.body.removeChild(svg)
    return { x: midPoint.x, y: midPoint.y }
  }

  private _generateSegmentPath(segmentIndex: number): string {
    if (this.points.length < 2) return ''

    const i = segmentIndex
    const p0 = this.points[Math.max(0, i - 1)]
    const p1 = this.points[i]
    const p2 = this.points[i + 1]
    const p3 = this.points[Math.min(this.points.length - 1, i + 2)]

    const cp1 = {
      x: p1.x + ((p2.x - p0.x) * this.options.tension) / 3,
      y: p1.y + ((p2.y - p0.y) * this.options.tension) / 3
    }
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) * this.options.tension) / 3,
      y: p2.y - ((p3.y - p1.y) * this.options.tension) / 3
    }

    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
  }

  private _calculatePathLength(pathData: string): number {
    const svg = document.createElementNS(svgNS, 'svg')
    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', pathData)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const length = path.getTotalLength()
    document.body.removeChild(svg)
    return length
  }

  private _getSegmentMidPoint(segmentIndex: number): Point {
    const pathData = this._generateSegmentPath(segmentIndex)
    const svg = document.createElementNS(svgNS, 'svg')
    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', pathData)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const length = path.getTotalLength()
    const midPoint = path.getPointAtLength(length / 2)
    document.body.removeChild(svg)
    return { x: midPoint.x, y: midPoint.y }
  }

  private _updatePreview(mousePoint?: Point): void {
    if (!this.canvas || !this.paintBoard) return

    this._clearPreview()

    const previewPoints = [...this.points]
    if (mousePoint) {
      previewPoints.push(mousePoint)
    }

    if (previewPoints.length < 2) return

    const pathData = this._generateSmoothPath(previewPoints)

    this.previewPath = new fabric.Path(pathData, {
      fill: '',
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: false,
      evented: false
    })
    ;(this.previewPath as Path & { customType: string }).customType = CustomType.CurvePreview
    this.canvas.add(this.previewPath)

    if (mousePoint && this.points.length >= 1) {
      const previewSegmentPath = this._generatePreviewSegmentPath(mousePoint)
      const distance = this._calculatePathLength(previewSegmentPath)
      const midPoint = this._getPreviewSegmentMidPoint(previewSegmentPath)

      this.previewLabel = new fabric.Text(`${distance.toFixed(1)}`, {
        left: midPoint.x,
        top: midPoint.y,
        fontSize: this.options.labelFontSize,
        fill: this.options.labelFillColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true
      })
      this.canvas.add(this.previewLabel)
    }

    this.canvas.renderAll()
  }

  private _clearPreview(): void {
    if (!this.canvas) return
    if (this.previewPath) {
      this.canvas.remove(this.previewPath)
      this.previewPath = null
    }
    if (this.previewLabel) {
      this.canvas.remove(this.previewLabel)
      this.previewLabel = null
    }
  }

  private _generatePreviewSegmentPath(mousePoint: Point): string {
    const n = this.points.length
    if (n === 0) return ''

    if (n === 1) {
      const p1 = this.points[0]
      return `M ${p1.x} ${p1.y} L ${mousePoint.x} ${mousePoint.y}`
    }

    const p0 = this.points[Math.max(0, n - 2)]
    const p1 = this.points[n - 1]
    const p2 = mousePoint
    const p3 = mousePoint

    const cp1 = {
      x: p1.x + ((p2.x - p0.x) * this.options.tension) / 3,
      y: p1.y + ((p2.y - p0.y) * this.options.tension) / 3
    }
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) * this.options.tension) / 3,
      y: p2.y - ((p3.y - p1.y) * this.options.tension) / 3
    }

    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
  }

  private _getPreviewSegmentMidPoint(pathData: string): Point {
    const svg = document.createElementNS(svgNS, 'svg')
    const path = document.createElementNS(svgNS, 'path')
    path.setAttribute('d', pathData)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const length = path.getTotalLength()
    const midPoint = path.getPointAtLength(length / 2)
    document.body.removeChild(svg)
    return { x: midPoint.x, y: midPoint.y }
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

    this._clearPreview()

    const pathData = this._generateSmoothPath(this.points)
    const fillColor =
      isClosed && this.options.enableFill ? this.paintBoard.fillColor : 'transparent'

    const curve = new fabric.Path(pathData, {
      fill: fillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: true,
      evented: true,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
      moveCursor: 'pointer',
      perPixelTargetFind: this.options.perPixelTargetFind ?? false
    })

    if (isClosed && this.points.length > 2) {
      this._addClosingDistanceLabel()
    }

    const drawId = generateDrawId()

    const customData: CurveCustomData = {
      drawId,
      points: [...this.points],
      isClosed: isClosed,
      lineColor: this.paintBoard.lineColor,
      fillColor: fillColor,
      circles: [...this.circles],
      labels: [...this.labels],
      distances: [...this.distances]
    }

    ;(curve as Path & { customType: string; customData: CurveCustomData }).customType =
      CustomType.Curve
    ;(curve as Path & { customType: string; customData: CurveCustomData }).customData = customData

    this.circles.forEach(c => {
      const circleData = { drawId: generateDrawId(), drawPid: drawId }
      ;(c as any).customData = circleData
    })
    this.labels.forEach(l => {
      const labelData = { drawId: generateDrawId(), drawPid: drawId }
      ;(l as any).customData = labelData
    })

    this.canvas.add(curve)

    const shouldShowHelpers = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()
    if (shouldShowHelpers) {
      this._bringHelpersToFront()
    } else {
      this._hideCurveHelpers()
    }

    this._setupCurveEvents(curve as Path & { customType: string; customData: CurveCustomData })

    this.eventBus.emit('curve:created', {
      drawId: customData.drawId,
      points: customData.points,
      isClosed
    })

    this._reset()
    this.paintBoard.resumeHistory()
    this.canvas.renderAll()
    this._removeCircleHover()
    if (!this.options.continueDraw) {
      this.paintBoard.setTool('select')
    }
  }

  private _undoLastPoint(): void {
    if (!this.canvas) return
    if (this.points.length === 0) return

    const point = this.points.pop()!
    const circle = this.circles.pop()!
    const label = this.labels.length > 0 ? this.labels.pop()! : null
    const distance = this.distances.length > 0 ? this.distances.pop()! : null

    this._undoStack.push({ point, circle, label, distance })

    this.canvas.remove(circle)
    if (label) this.canvas.remove(label)

    if (this.points.length > 1) {
      this._updatePreview()
    } else if (this.previewPath) {
      this.canvas.remove(this.previewPath)
      this.previewPath = null
    }

    if (this.points.length === 0) {
      this.isDrawingState = false
    }

    this.canvas.renderAll()
  }

  private _redoLastPoint(): void {
    if (!this.canvas || !this.paintBoard) return
    if (this._undoStack.length === 0) return

    const state = this._undoStack.pop()!
    const { point, circle, label, distance } = state

    if (this.points.length === 0) {
      this.isDrawingState = true
      this.paintBoard.pauseHistory()
    }

    this.points.push(point)
    this.circles.push(circle)
    this.canvas.add(circle)

    if (label) {
      this.labels.push(label)
      this.canvas.add(label)
    }
    if (distance !== null) {
      this.distances.push(distance)
    }

    if (this.points.length > 1) {
      this._updatePreview()
    }

    this.canvas.renderAll()
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this.circles.forEach(circle => this.canvas!.remove(circle))
    this.labels.forEach(label => this.canvas!.remove(label))

    this._clearPreview()

    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _setupCurveEvents(curve: Path & { customData: CurveCustomData }): void {
    if (!this.eventBus) return

    let lastLeft = curve.left || 0
    let lastTop = curve.top || 0

    curve.on('selected', () => {
      lastLeft = curve.left || 0
      lastTop = curve.top || 0
      this.eventBus!.emit('curve:selected', {
        drawId: curve.customData.drawId,
        points: curve.customData.points,
        isClosed: curve.customData.isClosed
      })
    })

    curve.on('mousedown', () => {
      lastLeft = curve.left || 0
      lastTop = curve.top || 0
      this.eventBus!.emit('curve:clicked', {
        drawId: curve.customData.drawId,
        points: curve.customData.points,
        isClosed: curve.customData.isClosed
      })
    })

    curve.on('moving', () => {
      const dx = (curve.left || 0) - lastLeft
      const dy = (curve.top || 0) - lastTop
      this._moveCurveHelpers(curve, dx, dy)
      lastLeft = curve.left || 0
      lastTop = curve.top || 0
    })
  }

  private _moveCurveHelpers(
    curve: Path & { customData: CurveCustomData },
    dx: number,
    dy: number
  ): void {
    if (!this.canvas) return
    const data = curve.customData

    data.circles?.forEach(circle => {
      circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
      circle.setCoords()
    })

    data.labels?.forEach(label => {
      label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
      label.setCoords()
    })

    data.points = data.points.map(p => ({ x: p.x + dx, y: p.y + dy }))

    this.canvas.renderAll()
  }

  private _bringHelpersToFront(): void {
    if (!this.canvas) return
    this.circles.forEach(circle => {
      circle.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(circle)
    })
    this.labels.forEach(label => {
      label.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(label)
    })
  }

  private _hideCurveHelpers(): void {
    this.circles.forEach(circle => {
      circle.set({ visible: false })
    })
    this.labels.forEach(label => {
      label.set({ visible: false })
    })
  }

  private _reset(): void {
    this.points = []
    this.circles = []
    this.labels = []
    this.distances = []
    this.previewPath = null
    this.previewLabel = null
    this.isDrawingState = false
    this._undoStack = []
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
        strokeWidth: this.options.helperStrokeWidth,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true
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

  private _removeCircleHover(): void {
    if (this._hoverRect) {
      this.canvas?.remove(this._hoverRect)
      this._hoverRect = null
      this.canvas?.renderAll()
    }
  }
}
