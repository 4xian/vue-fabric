import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Line, Text, Polygon, Rect } from 'fabric'
import type { Point, AreaCustomData, AreaToolOptions } from '../../types'
import BaseTool from './BaseTool'
import { calculateDistance, getMidPoint } from '../utils/geometry'
import { DEFAULT_AREATOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

interface UndoState {
  point: Point
  circle: Circle
  line: Line | null
  label: Text | null
  distance: number | null
}

export default class AreaTool extends BaseTool {
  protected override options: Required<AreaToolOptions>
  private isDrawingState: boolean
  private points: Point[]
  private circles: Circle[]
  private lines: Line[]
  private labels: Text[]
  private distances: number[]
  private previewLine: Line | null
  private previewLabel: Text | null
  private _hoverRect: Rect | null
  private _undoStack: UndoState[]

  constructor(options: AreaToolOptions) {
    super('area', options)
    this.options = { ...DEFAULT_AREATOOL_OPTIONS, ...options } as Required<AreaToolOptions>
    this.isDrawingState = false
    this.points = []
    this.circles = []
    this.lines = []
    this.labels = []
    this.distances = []
    this.previewLine = null
    this.previewLabel = null
    this._hoverRect = null
    this._undoStack = []
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.selection = true
    this._clearPreview()
    if (this.isDrawingState) {
      this._cancelDrawing()
    }
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const evt = opt.e as MouseEvent
    if (evt.button !== 0) return
    const target = opt.target as fabric.FabricObject & {
      customType?: string
      customData?: AreaCustomData
    }

    if (target && target.customType === CustomType.Area) {
      if (!this.options.allowOverlap) {
        this.canvas?.setActiveObject(target)
        this.canvas?.renderAll()
        return
      }
      this.canvas?.discardActiveObject()
    }

    if (target && target.customType === CustomType.AreaPoint) {
      const circleTarget = target as Circle
      const point: Point = { x: circleTarget.left || 0, y: circleTarget.top || 0 }

      if (this.points.length > 2 && this._isNearFirstPoint(point)) {
        this._closePolygon()
        return
      }

      this._addPoint(point)
      return
    }

    const pointer = this.getPointer(opt)
    if (!pointer || isNaN(pointer.x) || isNaN(pointer.y)) return

    const point: Point = { x: pointer.x, y: pointer.y }

    if (this.points.length > 2 && this._isNearFirstPoint(point)) {
      this._closePolygon()
      return
    }

    this._addPoint(point)
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isDrawingState || this.points.length === 0) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  // onKeyDown(e: KeyboardEvent): void {
  //   if (e.key === 'Escape') {
  //     this._cancelDrawing()
  //   } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
  //     e.preventDefault()
  //     this._undoLastPoint()
  //   }
  // }

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
    this.isDrawingState = true
    this.points.push(point)

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
      CustomType.AreaPoint
    ;(circle as Circle & { customType: string; isStartPoint?: boolean }).isStartPoint = isFirstPoint
    if (isFirstPoint) {
      this._bindCircleHoverEvents(circle)
    }
    this.canvas.add(circle)
    this.circles.push(circle)

    if (this.points.length >= 2) {
      const prevPoint = this.points[this.points.length - 2]
      this._addLine(prevPoint, point)
    }

    this.canvas.renderAll()
  }

  private _addLine(p1: Point, p2: Point): void {
    if (!this.canvas || !this.paintBoard) return

    const line = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true
    })
    ;(line as Line & { customType: string }).customType = CustomType.AreaLine
    this.canvas.add(line)
    this.lines.push(line)

    const distance = calculateDistance(p1, p2)
    this.distances.push(distance)

    const midPoint = getMidPoint(p1, p2)
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
    ;(label as Text & { customType: string }).customType = CustomType.AreaLabel
    this.canvas.add(label)
    this.labels.push(label)
  }

  private _updatePreview(pointer: Point): void {
    if (!this.canvas || !this.paintBoard) return
    this._clearPreview()

    const lastPoint = this.points[this.points.length - 1]

    this.previewLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true
    })
    this.canvas.add(this.previewLine)

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
      hasControls: false,
      lockMovementX: true,
      lockMovementY: true
    })
    this.canvas.add(this.previewLabel)

    this.canvas.renderAll()
  }

  private _clearPreview(): void {
    if (!this.canvas) return
    if (this.previewLine) {
      this.canvas.remove(this.previewLine)
      this.previewLine = null
    }
    if (this.previewLabel) {
      this.canvas.remove(this.previewLabel)
      this.previewLabel = null
    }
  }

  private _isNearFirstPoint(point: Point): boolean {
    if (this.points.length < 3) return false
    const firstPoint = this.points[0]
    const distance = calculateDistance(point, firstPoint)
    return distance < this.options.closeThreshold
  }

  private _closePolygon(): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return
    if (this.points.length < 3) return

    this._clearPreview()

    const firstPoint = this.points[0]
    const lastPoint = this.points[this.points.length - 1]
    this._addLine(lastPoint, firstPoint)

    const polygon = new fabric.Polygon(
      this.points.map(p => ({ x: p.x, y: p.y })),
      {
        fill: this.options.enableFill ? this.paintBoard.fillColor : 'transparent',
        stroke: this.paintBoard.lineColor,
        strokeWidth: this.options.strokeWidth,
        selectable: true,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'pointer',
        moveCursor: 'pointer',
        perPixelTargetFind: this.options.perPixelTargetFind ?? false
      }
    )

    const drawId = generateDrawId()

    const customData: AreaCustomData = {
      drawId,
      points: [...this.points],
      distances: [...this.distances],
      lineColor: this.paintBoard.lineColor,
      fillColor: this.options.enableFill ? this.paintBoard.fillColor : 'transparent',
      circles: [...this.circles],
      labels: [...this.labels],
      lines: [...this.lines]
    }

    ;(polygon as Polygon & { customType: string; customData: AreaCustomData }).customType =
      CustomType.Area
    ;(polygon as Polygon & { customType: string; customData: AreaCustomData }).customData =
      customData

    this.circles.forEach(c => {
      const circleData = { drawId: generateDrawId(), drawPid: drawId }
      ;(c as any).customData = circleData
    })
    this.lines.forEach(l => {
      const lineData = { drawId: generateDrawId(), drawPid: drawId }
      ;(l as any).customData = lineData
    })
    this.labels.forEach(l => {
      const labelData = { drawId: generateDrawId(), drawPid: drawId }
      ;(l as any).customData = labelData
    })

    this.canvas.add(polygon)

    const shouldShowHelpers = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()
    if (shouldShowHelpers) {
      this._bringHelpersToFront()
    } else {
      this._hideHelpers()
    }

    this._setupAreaEvents(polygon as Polygon & { customType: string; customData: AreaCustomData })

    this.eventBus.emit('area:created', {
      drawId: customData.drawId,
      points: customData.points,
      distances: customData.distances
    })

    this._reset()
    this.paintBoard.resumeHistory()
    this.canvas.renderAll()
  }

  private _setupAreaEvents(polygon: Polygon & { customData: AreaCustomData }): void {
    if (!this.eventBus) return

    let lastLeft = polygon.left || 0
    let lastTop = polygon.top || 0

    polygon.on('selected', () => {
      lastLeft = polygon.left || 0
      lastTop = polygon.top || 0
      this.eventBus!.emit('area:selected', {
        drawId: polygon.customData.drawId,
        points: polygon.customData.points,
        distances: polygon.customData.distances
      })
    })

    polygon.on('moving', () => {
      const dx = (polygon.left || 0) - lastLeft
      const dy = (polygon.top || 0) - lastTop
      this._moveAreaHelpers(polygon, dx, dy)
      lastLeft = polygon.left || 0
      lastTop = polygon.top || 0
    })
  }

  private _moveAreaHelpers(
    polygon: Polygon & { customData: AreaCustomData },
    dx: number,
    dy: number
  ): void {
    if (!this.canvas) return
    const data = polygon.customData

    data.circles?.forEach(circle => {
      circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
      circle.setCoords()
    })

    data.lines?.forEach(line => {
      line.set({
        x1: (line.x1 || 0) + dx,
        y1: (line.y1 || 0) + dy,
        x2: (line.x2 || 0) + dx,
        y2: (line.y2 || 0) + dy
      })
      line.setCoords()
    })

    data.labels?.forEach(label => {
      label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
      label.setCoords()
    })

    data.points = data.points.map(p => ({ x: p.x + dx, y: p.y + dy }))

    this.canvas.renderAll()
  }

  private _showAreaHelpers(polygon: Polygon & { customData: AreaCustomData }): void {
    if (!this.canvas) return
    const data = polygon.customData

    data.lines?.forEach(line => {
      line.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(line)
    })
    data.circles?.forEach(circle => {
      circle.set({ visible: true, opacity: 1, evented: true, hoverCursor: 'pointer' })
      this.canvas!.bringObjectToFront(circle)
    })
    data.labels?.forEach(label => {
      label.set({ visible: true, opacity: 1 })
      this.canvas!.bringObjectToFront(label)
    })

    this.canvas.renderAll()
  }

  private _hideAreaHelpers(polygon: Polygon & { customData: AreaCustomData }): void {
    if (!this.canvas) return
    const data = polygon.customData

    data.circles?.forEach(circle => {
      circle.set({ visible: false })
    })
    data.labels?.forEach(label => {
      label.set({ visible: false })
    })
    data.lines?.forEach(line => {
      line.set({ visible: false })
    })

    this.canvas.renderAll()
  }

  private _hideHelpers(): void {
    this.circles.forEach(circle => {
      circle.set({ visible: false })
    })
    this.labels.forEach(label => {
      label.set({ visible: false })
    })
    this.lines.forEach(line => {
      line.set({ visible: false })
    })
  }

  private _bringHelpersToFront(): void {
    if (!this.canvas) return
    this.lines.forEach(line => {
      this.canvas!.bringObjectToFront(line)
    })
    this.circles.forEach(circle => {
      this.canvas!.bringObjectToFront(circle)
    })
    this.labels.forEach(label => {
      this.canvas!.bringObjectToFront(label)
    })
  }

  private _undoLastPoint(): void {
    if (!this.canvas) return
    if (this.points.length === 0) return

    const point = this.points.pop()!
    const circle = this.circles.pop()!
    const line = this.lines.length > 0 ? this.lines.pop()! : null
    const label = this.labels.length > 0 ? this.labels.pop()! : null
    const distance = this.distances.length > 0 ? this.distances.pop()! : null

    this._undoStack.push({ point, circle, line, label, distance })

    this.canvas.remove(circle)
    if (line) this.canvas.remove(line)
    if (label) this.canvas.remove(label)

    if (this.points.length === 0) {
      this.isDrawingState = false
    }

    this._clearPreview()
    this.canvas.renderAll()
  }

  private _redoLastPoint(): void {
    if (!this.canvas || !this.paintBoard) return
    if (this._undoStack.length === 0) return

    const state = this._undoStack.pop()!
    const { point, circle, line, label, distance } = state

    if (this.points.length === 0) {
      this.isDrawingState = true
      this.paintBoard.pauseHistory()
    }

    this.points.push(point)
    this.circles.push(circle)
    this.canvas.add(circle)

    if (line) {
      this.lines.push(line)
      this.canvas.add(line)
    }
    if (label) {
      this.labels.push(label)
      this.canvas.add(label)
    }
    if (distance !== null) {
      this.distances.push(distance)
    }

    this.canvas.renderAll()
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this._clearPreview()

    this.circles.forEach(c => this.canvas!.remove(c))
    this.lines.forEach(l => this.canvas!.remove(l))
    this.labels.forEach(l => this.canvas!.remove(l))

    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _reset(): void {
    this.isDrawingState = false
    this.points = []
    this.circles = []
    this.lines = []
    this.labels = []
    this.distances = []
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

  destroy(): void {
    this._cancelDrawing()
    super.destroy()
  }
}
