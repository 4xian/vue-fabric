import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Line, Text, Polygon } from 'fabric'
import type { Point, AreaCustomData } from '../../types'
import BaseTool from './BaseTool'
import { calculateDistance, getMidPoint } from '../utils/geometry'

const CLOSE_THRESHOLD = 15
const POINT_RADIUS = 4

export default class LineTool extends BaseTool {
  private isDrawing: boolean
  private points: Point[]
  private circles: Circle[]
  private lines: Line[]
  private labels: Text[]
  private distances: number[]
  private previewLine: Line | null
  private previewLabel: Text | null

  constructor() {
    super('line')
    this.isDrawing = false
    this.points = []
    this.circles = []
    this.lines = []
    this.labels = []
    this.distances = []
    this.previewLine = null
    this.previewLabel = null
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'crosshair'
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'default'
    this.canvas.selection = true
    this._clearPreview()
    if (this.isDrawing) {
      this._cancelDrawing()
    }
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const evt = opt.e as MouseEvent
    if (evt.button !== 0) return
    const target = opt.target as fabric.FabricObject & { customType?: string }
    if (target && target.customType === 'area') return

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
    if (!this.isDrawing || this.points.length === 0) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._cancelDrawing()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      this._undoLastPoint()
    }
  }

  private _addPoint(point: Point): void {
    if (!this.canvas || !this.paintBoard) return

    if (this.points.length > 0) {
      const lastPoint = this.points[this.points.length - 1]
      if (lastPoint.x === point.x && lastPoint.y === point.y) return
    }

    this.isDrawing = true
    this.points.push(point)

    const circle = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: POINT_RADIUS,
      fill: 'red',
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    })
    ;(circle as Circle & { customType: string }).customType = 'point'
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
      strokeWidth: 2,
      selectable: false,
      evented: false
    })
    ;(line as Line & { customType: string }).customType = 'line'
    this.canvas.add(line)
    this.lines.push(line)

    const distance = calculateDistance(p1, p2)
    this.distances.push(distance)

    const midPoint = getMidPoint(p1, p2)
    const label = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: 12,
      fill: '#333',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    })
    ;(label as Text & { customType: string }).customType = 'label'
    this.canvas.add(label)
    this.labels.push(label)
  }

  private _updatePreview(pointer: Point): void {
    if (!this.canvas || !this.paintBoard) return
    this._clearPreview()

    const lastPoint = this.points[this.points.length - 1]

    this.previewLine = new fabric.Line(
      [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
      {
        stroke: this.paintBoard.lineColor,
        strokeWidth: 2,
        selectable: false,
        evented: false
      }
    )
    this.canvas.add(this.previewLine)

    const distance = calculateDistance(lastPoint, pointer)
    const midPoint = getMidPoint(lastPoint, pointer)

    this.previewLabel = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: 12,
      fill: '#666',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
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
    return distance < CLOSE_THRESHOLD
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
        fill: this.paintBoard.fillColor,
        stroke: this.paintBoard.lineColor,
        strokeWidth: 2,
        selectable: true,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'pointer',
        moveCursor: 'pointer'
      }
    )

    const customData: AreaCustomData = {
      areaId: `area-${Date.now()}`,
      points: [...this.points],
      distances: [...this.distances],
      lineColor: this.paintBoard.lineColor,
      fillColor: this.paintBoard.fillColor,
      circles: [...this.circles],
      labels: [...this.labels],
      lines: [...this.lines]
    }

    ;(polygon as Polygon & { customType: string; customData: AreaCustomData }).customType = 'area'
    ;(polygon as Polygon & { customType: string; customData: AreaCustomData }).customData = customData

    this._hideHelpers()

    this.canvas.add(polygon)

    this._setupAreaEvents(polygon as Polygon & { customType: string; customData: AreaCustomData })

    this.eventBus.emit('area:created', {
      areaId: customData.areaId,
      points: customData.points,
      distances: customData.distances
    })

    this._reset()
    this.canvas.renderAll()
  }

  private _setupAreaEvents(polygon: Polygon & { customData: AreaCustomData }): void {
    if (!this.eventBus) return

    let lastLeft = polygon.left || 0
    let lastTop = polygon.top || 0

    polygon.on('selected', () => {
      this._showAreaHelpers(polygon)
      lastLeft = polygon.left || 0
      lastTop = polygon.top || 0
      this.eventBus!.emit('area:selected', {
        areaId: polygon.customData.areaId,
        points: polygon.customData.points,
        distances: polygon.customData.distances
      })
    })

    polygon.on('deselected', () => {
      this._hideAreaHelpers(polygon)
    })

    polygon.on('moving', () => {
      const dx = (polygon.left || 0) - lastLeft
      const dy = (polygon.top || 0) - lastTop
      this._moveAreaHelpers(polygon, dx, dy)
      lastLeft = polygon.left || 0
      lastTop = polygon.top || 0
    })
  }

  private _moveAreaHelpers(polygon: Polygon & { customData: AreaCustomData }, dx: number, dy: number): void {
    if (!this.canvas) return
    const data = polygon.customData

    data.circles?.forEach(circle => {
      circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
    })

    data.lines?.forEach(line => {
      line.set({
        x1: (line.x1 || 0) + dx,
        y1: (line.y1 || 0) + dy,
        x2: (line.x2 || 0) + dx,
        y2: (line.y2 || 0) + dy
      })
    })

    data.labels?.forEach(label => {
      label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
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
      circle.set({ visible: true, opacity: 1 })
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

  private _undoLastPoint(): void {
    if (!this.canvas) return
    if (this.points.length === 0) return

    this.points.pop()

    if (this.circles.length > 0) {
      const lastCircle = this.circles.pop()!
      this.canvas.remove(lastCircle)
    }

    if (this.lines.length > 0) {
      const lastLine = this.lines.pop()!
      this.canvas.remove(lastLine)
    }

    if (this.labels.length > 0) {
      const lastLabel = this.labels.pop()!
      this.canvas.remove(lastLabel)
    }

    if (this.distances.length > 0) {
      this.distances.pop()
    }

    if (this.points.length === 0) {
      this.isDrawing = false
    }

    this._clearPreview()
    this.canvas.renderAll()
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this._clearPreview()

    this.circles.forEach(c => this.canvas!.remove(c))
    this.lines.forEach(l => this.canvas!.remove(l))
    this.labels.forEach(l => this.canvas!.remove(l))

    this._reset()
    this.canvas.renderAll()
  }

  private _reset(): void {
    this.isDrawing = false
    this.points = []
    this.circles = []
    this.lines = []
    this.labels = []
    this.distances = []
  }

  destroy(): void {
    this._cancelDrawing()
    super.destroy()
  }
}
