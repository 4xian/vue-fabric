import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Polyline, Text } from 'fabric'
import type { Point, PolylineToolOptions, PolylineCustomData } from '../../types'
import BaseTool from './BaseTool'
import { calculateDistance, getMidPoint } from '../utils/geometry'
import { DEFAULT_POLYLINETOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

interface PolylinePointUndoState {
  point: Point
  circle: Circle
  label: Text | null
  distance: number | null
}

export default class PolylineTool extends BaseTool {
  protected override options: Required<PolylineToolOptions>
  private isDrawingState: boolean
  private points: Point[]
  private circles: Circle[]
  private labels: Text[]
  private distances: number[]
  private previewPath: Polyline | null
  private previewLabel: Text | null
  private _drawingRedoStack: PolylinePointUndoState[]

  constructor(options: PolylineToolOptions = {}) {
    super('polyline', options)
    this.options = { ...DEFAULT_POLYLINETOOL_OPTIONS, ...options } as Required<PolylineToolOptions>
    this.isDrawingState = false
    this.points = []
    this.circles = []
    this.labels = []
    this.distances = []
    this.previewPath = null
    this.previewLabel = null
    this._drawingRedoStack = []
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.selection = true
    this._cancelDrawing()
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const evt = opt.e as MouseEvent
    if (evt.button === 2) {
      evt.preventDefault()
      if (this.isDrawingState) {
        this._finishDrawing()
      }
      return
    }

    if (evt.button !== 0) return

    const pointer = this.getPointer(opt)
    if (!pointer || isNaN(pointer.x) || isNaN(pointer.y)) return

    this._addPoint({ x: pointer.x, y: pointer.y })
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isDrawingState || this.points.length === 0) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._cancelDrawing()
    } else if (e.key === 'Enter' && this.isDrawingState) {
      e.preventDefault()
      this._finishDrawing()
    }
  }

  override isDrawing(): boolean {
    return this.isDrawingState
  }

  override canUndoTool(): boolean {
    return this.isDrawingState && this.points.length > 0
  }

  override canRedoTool(): boolean {
    return this._drawingRedoStack.length > 0
  }

  override undo(): boolean {
    if (this.isDrawingState && this.points.length > 0) {
      this._undoLastPoint()
      return true
    }
    return false
  }

  override redo(): boolean {
    if (this._drawingRedoStack.length > 0) {
      this._redoLastPoint()
      return true
    }
    return false
  }

  private _addPoint(point: Point): void {
    if (!this.canvas || !this.paintBoard) return

    const lastPoint = this.points[this.points.length - 1]
    if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return

    if (!this.isDrawingState) {
      this.paintBoard.pauseHistory()
      this.isDrawingState = true
    }

    this._drawingRedoStack = []
    this.points.push({ ...point })

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
      evented: false,
      hasBorders: false,
      hasControls: false
    })
    ;(circle as Circle & { customType: string }).customType = CustomType.PolylineHelper
    this.canvas.add(circle)
    this.circles.push(circle)

    let label: Text | null = null
    let distance: number | null = null

    if (this.points.length >= 2) {
      const prevPoint = this.points[this.points.length - 2]
      distance = calculateDistance(prevPoint, point)
      this.distances.push(distance)
      const midPoint = getMidPoint(prevPoint, point)

      label = new fabric.Text(`${distance.toFixed(1)}`, {
        left: midPoint.x,
        top: midPoint.y,
        fontSize: this.options.labelFontSize,
        fill: this.options.labelFillColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false
      })
      ;(label as Text & { customType: string }).customType = CustomType.PolylineHelperLabel
      this.canvas.add(label)
      this.labels.push(label)
    }

    this._updatePreview()
    this.canvas.renderAll()
  }

  private _undoLastPoint(): void {
    if (!this.canvas || this.points.length === 0) return

    const point = this.points.pop()!
    const circle = this.circles.pop()!
    const label = this.labels.length > 0 ? this.labels.pop()! : null
    const distance = this.distances.length > 0 ? this.distances.pop()! : null

    this._drawingRedoStack.push({ point, circle, label, distance })

    this.canvas.remove(circle)
    if (label) this.canvas.remove(label)

    if (this.points.length === 0) {
      this.isDrawingState = false
      this.paintBoard?.resumeHistory()
    }

    this._updatePreview()
    this.canvas.renderAll()
  }

  private _redoLastPoint(): void {
    if (!this.canvas || !this.paintBoard || this._drawingRedoStack.length === 0) return

    const state = this._drawingRedoStack.pop()!

    if (!this.isDrawingState) {
      this.paintBoard.pauseHistory()
      this.isDrawingState = true
    }

    this.points.push({ ...state.point })
    this.circles.push(state.circle)
    this.canvas.add(state.circle)

    if (state.label) {
      this.labels.push(state.label)
      this.canvas.add(state.label)
    }
    if (state.distance !== null) {
      this.distances.push(state.distance)
    }

    this._updatePreview()
    this.canvas.renderAll()
  }

  private _finishDrawing(): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return

    if (this.points.length < 2) {
      this._cancelDrawing()
      if (!this.options.continueDraw) {
        this.paintBoard.setTool('select')
      }
      return
    }

    this._clearPreview()
    const drawId = generateDrawId()

    this.circles.forEach((circle, index) => {
      ;(
        circle as Circle & {
          customType: string
          customData: { drawId: string; drawPid: string; index: number }
        }
      ).customData = {
        drawId: generateDrawId(),
        drawPid: drawId,
        index
      }
    })

    this.labels.forEach((label, index) => {
      ;(
        label as Text & {
          customType: string
          customData: { drawId: string; drawPid: string; index: number }
        }
      ).customData = {
        drawId: generateDrawId(),
        drawPid: drawId,
        index
      }
    })

    const polyline = new fabric.Polyline(
      this.points.map(point => ({ x: point.x, y: point.y })),
      {
        fill: 'transparent',
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
        perPixelTargetFind: this.options.perPixelTargetFind
      }
    )

    const customData: PolylineCustomData = {
      drawId,
      points: this.points.map(point => ({ ...point })),
      distances: [...this.distances],
      lineColor: this.paintBoard.lineColor,
      circles: [...this.circles],
      labels: [...this.labels],
      polyline
    }

    ;(polyline as Polyline & { customType: string; customData: PolylineCustomData }).customType =
      CustomType.Polyline
    ;(polyline as Polyline & { customType: string; customData: PolylineCustomData }).customData =
      customData

    this.canvas.add(polyline)

    if (this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()) {
      this._bringHelpersToFront(customData)
    } else {
      this._hideHelpers(customData)
    }

    this._setupPolylineEvents(
      polyline as Polyline & { customType: string; customData: PolylineCustomData }
    )

    this.eventBus.emit('polyline:created', {
      drawId: customData.drawId,
      points: customData.points,
      distances: customData.distances
    })

    this._reset()
    this.paintBoard.resumeHistory()
    this.canvas.renderAll()
    if (!this.options.continueDraw) {
      this.paintBoard.setTool('select')
    }
  }

  private _setupPolylineEvents(polyline: Polyline & { customData: PolylineCustomData }): void {
    if (!this.eventBus) return

    let lastLeft = polyline.left || 0
    let lastTop = polyline.top || 0

    polyline.on('selected', () => {
      lastLeft = polyline.left || 0
      lastTop = polyline.top || 0
      this.eventBus!.emit('polyline:selected', {
        drawId: polyline.customData.drawId,
        points: polyline.customData.points,
        distances: polyline.customData.distances
      })
    })

    polyline.on('mousedown', () => {
      lastLeft = polyline.left || 0
      lastTop = polyline.top || 0
      this.eventBus!.emit('polyline:clicked', {
        drawId: polyline.customData.drawId,
        points: polyline.customData.points,
        distances: polyline.customData.distances
      })
    })

    polyline.on('moving', () => {
      const dx = (polyline.left || 0) - lastLeft
      const dy = (polyline.top || 0) - lastTop
      this._movePolylineHelpers(polyline, dx, dy)
      lastLeft = polyline.left || 0
      lastTop = polyline.top || 0
    })
  }

  private _movePolylineHelpers(
    polyline: Polyline & { customData: PolylineCustomData },
    dx: number,
    dy: number
  ): void {
    if (!this.canvas) return

    polyline.customData.circles?.forEach(circle => {
      circle.set({
        left: (circle.left || 0) + dx,
        top: (circle.top || 0) + dy
      })
      circle.setCoords()
    })

    polyline.customData.labels?.forEach(label => {
      label.set({
        left: (label.left || 0) + dx,
        top: (label.top || 0) + dy
      })
      label.setCoords()
    })

    polyline.customData.points = polyline.customData.points.map(point => ({
      x: point.x + dx,
      y: point.y + dy
    }))

    this.canvas.renderAll()
  }

  private _updatePreview(pointer?: Point): void {
    if (!this.canvas || !this.paintBoard || this.points.length === 0) return

    this._clearPreview()

    const previewPoints = this.points.map(point => ({ x: point.x, y: point.y }))
    if (pointer) {
      previewPoints.push({ x: pointer.x, y: pointer.y })
    }

    if (previewPoints.length >= 2) {
      this.previewPath = new fabric.Polyline(previewPoints, {
        fill: 'transparent',
        stroke: this.paintBoard.lineColor,
        strokeWidth: this.options.strokeWidth,
        selectable: false,
        evented: false,
        hasBorders: false,
        hasControls: false
      })
      this.canvas.add(this.previewPath)
    }

    if (!pointer) return

    const lastPoint = this.points[this.points.length - 1]
    const distance = calculateDistance(lastPoint, pointer)
    const midPoint = getMidPoint(lastPoint, pointer)

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
      hasControls: false
    })
    this.canvas.add(this.previewLabel)
  }

  private _bringHelpersToFront(data: PolylineCustomData): void {
    if (!this.canvas) return

    data.circles?.forEach(circle => {
      circle.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(circle)
    })
    data.labels?.forEach(label => {
      label.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(label)
    })
  }

  private _hideHelpers(data: PolylineCustomData): void {
    data.circles?.forEach(circle => {
      circle.set({ visible: false })
    })
    data.labels?.forEach(label => {
      label.set({ visible: false })
    })
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

  private _cancelDrawing(): void {
    if (!this.canvas) return

    this._clearPreview()
    this.circles.forEach(circle => this.canvas!.remove(circle))
    this.labels.forEach(label => this.canvas!.remove(label))

    if (this.isDrawingState) {
      this.paintBoard?.resumeHistory()
    }

    this._reset()
    this.canvas.renderAll()
  }

  private _reset(): void {
    this.isDrawingState = false
    this.points = []
    this.circles = []
    this.labels = []
    this.distances = []
    this.previewPath = null
    this.previewLabel = null
    this._drawingRedoStack = []
  }

  destroy(): void {
    this._cancelDrawing()
    super.destroy()
  }
}
