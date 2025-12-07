import * as fabric from 'fabric'
import type { Canvas, Group, Circle, Polyline, Path } from 'fabric'
import type { Point, PersonData, TrajectoryOptions } from '../../types'
import EventBus from '../core/EventBus'

const DEFAULT_RADIUS = 5
const DEFAULT_STROKE_WIDTH = 2
const DEFAULT_FONT_SIZE = 12
const DEFAULT_ANIMATION_SPEED = 0.05
const DEFAULT_TEXT_COLOR = '#333'
const DEFAULT_LINE_WIDTH = 2
const DEFAULT_PATH_TYPE: 'line' | 'curve' = 'line'

interface PersonMarker {
  group: Group
  circle: Circle
  text: fabric.FabricText
}

interface TrajectoryData {
  pathLine: Polyline | Path
  startMarker: PersonMarker
  endMarker: PersonMarker
  movingMarker: PersonMarker
  animationId: number | null
  trajectory: Point[]
  curvePoints?: Point[]
}

export default class PersonTracker {
  private canvas: Canvas
  private eventBus: EventBus
  private persons: Map<string, PersonMarker> = new Map()
  private trajectories: Map<string, TrajectoryData> = new Map()
  private options: {
    radius: number
    strokeWidth: number
    fontSize: number
    animationSpeed: number
    textColor: string
    lineWidth: number
    pathType: 'line' | 'curve'
  }

  constructor(canvas: Canvas, eventBus: EventBus, options?: Partial<TrajectoryOptions>) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.options = {
      radius: options?.radius ?? DEFAULT_RADIUS,
      strokeWidth: options?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      fontSize: options?.fontSize ?? DEFAULT_FONT_SIZE,
      animationSpeed: options?.animationSpeed ?? DEFAULT_ANIMATION_SPEED,
      textColor: options?.textColor ?? DEFAULT_TEXT_COLOR,
      lineWidth: options?.lineWidth ?? DEFAULT_LINE_WIDTH,
      pathType: options?.pathType ?? DEFAULT_PATH_TYPE
    }
  }

  setPersons(persons: PersonData[]): void {
    const currentIds = new Set(this.persons.keys())
    const newIds = new Set(persons.map(p => p.id))

    currentIds.forEach(id => {
      if (!newIds.has(id)) {
        this.removePerson(id)
      }
    })

    persons.forEach(person => {
      if (this.persons.has(person.id)) {
        this._updatePersonMarker(person)
      } else {
        this._createPersonMarker(person)
      }
    })

    this.canvas.renderAll()
    this.eventBus.emit('persons:updated', { count: persons.length })
  }

  updatePerson(id: string, data: Partial<PersonData>): boolean {
    const marker = this.persons.get(id)
    if (!marker) return false

    if (data.x !== undefined || data.y !== undefined) {
      const x = data.x ?? marker.group.left ?? 0
      const y = data.y ?? marker.group.top ?? 0
      marker.group.set({ left: x, top: y })
      marker.group.setCoords()
    }

    if (data.lineColor !== undefined) {
      marker.circle.set({ stroke: data.lineColor })
    }

    if (data.name !== undefined) {
      marker.text.set({ text: data.name })
    }

    this.canvas.renderAll()
    this.eventBus.emit('person:updated', { id })
    return true
  }

  removePerson(id: string): boolean {
    const marker = this.persons.get(id)
    if (!marker) return false

    this.canvas.remove(marker.group)
    this.persons.delete(id)
    this.canvas.renderAll()
    this.eventBus.emit('person:removed', { id })
    return true
  }

  clearAll(): void {
    this.trajectories.forEach((_, id) => this.hideTrajectory(id))
    this.persons.forEach(marker => this.canvas.remove(marker.group))
    this.persons.clear()
    this.canvas.renderAll()
    this.eventBus.emit('persons:cleared')
  }

  showTrajectory(id: string, person: PersonData, trajectory: Point[]): void {
    if (trajectory.length < 2) return

    this.hideTrajectory(id)

    const isCurve = this.options.pathType === 'curve'
    const pathLine = isCurve
      ? this._createCurvePath(trajectory, person.lineColor)
      : this._createPathLine(trajectory, person.lineColor)

    const curvePoints = isCurve ? this._generateCurvePoints(trajectory, 100) : undefined

    const startMarker = this._createMarkerGroup(
      trajectory[0].x,
      trajectory[0].y,
      person.name,
      person.lineColor
    )
    const endMarker = this._createMarkerGroup(
      trajectory[trajectory.length - 1].x,
      trajectory[trajectory.length - 1].y,
      person.name,
      person.lineColor
    )
    const movingMarker = this._createMarkerGroup(
      trajectory[0].x,
      trajectory[0].y,
      person.name,
      person.lineColor
    )

    this.canvas.add(pathLine)
    this.canvas.add(startMarker.group)
    this.canvas.add(endMarker.group)
    this.canvas.add(movingMarker.group)

    const trajectoryData: TrajectoryData = {
      pathLine,
      startMarker,
      endMarker,
      movingMarker,
      animationId: null,
      trajectory,
      curvePoints
    }

    this.trajectories.set(id, trajectoryData)
    this._startTrajectoryAnimation(id)
    this.canvas.renderAll()
    this.eventBus.emit('trajectory:shown', { id })
  }

  hideTrajectory(id: string): void {
    const data = this.trajectories.get(id)
    if (!data) return

    if (data.animationId !== null) {
      cancelAnimationFrame(data.animationId)
    }

    this.canvas.remove(data.pathLine)
    this.canvas.remove(data.startMarker.group)
    this.canvas.remove(data.endMarker.group)
    this.canvas.remove(data.movingMarker.group)

    this.trajectories.delete(id)
    this.canvas.renderAll()
    this.eventBus.emit('trajectory:hidden', { id })
  }

  getPersonById(id: string): PersonMarker | undefined {
    return this.persons.get(id)
  }

  getAllPersonIds(): string[] {
    return Array.from(this.persons.keys())
  }

  private _createPersonMarker(person: PersonData): void {
    const marker = this._createMarkerGroup(person.x, person.y, person.name, person.lineColor)
    this.canvas.add(marker.group)
    this.persons.set(person.id, marker)
    this.eventBus.emit('person:created', { id: person.id })
  }

  private _updatePersonMarker(person: PersonData): void {
    const marker = this.persons.get(person.id)
    if (!marker) return

    marker.group.set({ left: person.x, top: person.y })
    marker.circle.set({ stroke: person.lineColor })
    marker.text.set({ text: person.name })
    marker.group.setCoords()
  }

  private _createMarkerGroup(
    x: number,
    y: number,
    name: string,
    lineColor: string
  ): PersonMarker {
    const circle = new fabric.Circle({
      radius: this.options.radius,
      fill: 'transparent',
      stroke: lineColor,
      strokeWidth: this.options.strokeWidth,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0
    })

    const text = new fabric.FabricText(name, {
      fontSize: this.options.fontSize,
      fill: this.options.textColor,
      originX: 'center',
      originY: 'top',
      left: 0,
      top: this.options.radius + 4
    })

    const group = new fabric.Group([circle, text], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false
    })

    ;(group as Group & { customType: string }).customType = 'personMarker'

    return { group, circle, text }
  }

  private _createPathLine(points: Point[], color: string): Polyline {
    const fabricPoints = points.map(p => ({ x: p.x, y: p.y }))
    const polyline = new fabric.Polyline(fabricPoints, {
      fill: 'transparent',
      stroke: color,
      strokeWidth: this.options.lineWidth,
      selectable: false,
      evented: false
    })
    ;(polyline as Polyline & { customType: string }).customType = 'trajectoryPath'
    return polyline
  }

  private _createCurvePath(points: Point[], color: string): Path {
    const pathData = this._generateSmoothPathData(points)
    const path = new fabric.Path(pathData, {
      fill: 'transparent',
      stroke: color,
      strokeWidth: this.options.lineWidth,
      selectable: false,
      evented: false
    })
    ;(path as Path & { customType: string }).customType = 'trajectoryPath'
    return path
  }

  private _generateSmoothPathData(points: Point[]): string {
    if (points.length < 2) return ''
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    }

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }

    return path
  }

  private _generateCurvePoints(controlPoints: Point[], segments: number): Point[] {
    if (controlPoints.length < 2) return controlPoints
    if (controlPoints.length === 2) {
      const result: Point[] = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        result.push({
          x: controlPoints[0].x + (controlPoints[1].x - controlPoints[0].x) * t,
          y: controlPoints[0].y + (controlPoints[1].y - controlPoints[0].y) * t
        })
      }
      return result
    }

    const result: Point[] = []
    const segmentsPerSection = Math.ceil(segments / (controlPoints.length - 1))

    for (let i = 0; i < controlPoints.length - 1; i++) {
      const p0 = controlPoints[i === 0 ? i : i - 1]
      const p1 = controlPoints[i]
      const p2 = controlPoints[i + 1]
      const p3 = controlPoints[i + 2 < controlPoints.length ? i + 2 : i + 1]

      for (let j = 0; j < segmentsPerSection; j++) {
        const t = j / segmentsPerSection
        const point = this._catmullRom(p0, p1, p2, p3, t)
        result.push(point)
      }
    }

    result.push(controlPoints[controlPoints.length - 1])
    return result
  }

  private _catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const t2 = t * t
    const t3 = t2 * t

    return {
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    }
  }

  private _startTrajectoryAnimation(id: string): void {
    const data = this.trajectories.get(id)
    if (!data || data.trajectory.length < 2) return

    const animationPoints = data.curvePoints || data.trajectory
    const totalLength = this._calculateTotalLength(animationPoints)
    const segmentLengths = this._calculateSegmentLengths(animationPoints)
    const speed = this.options.animationSpeed

    let lastTime: number | null = null
    let currentDistance = 0

    const animate = (timestamp: number) => {
      if (!this.trajectories.has(id)) return

      if (lastTime === null) lastTime = timestamp
      const deltaTime = timestamp - lastTime
      lastTime = timestamp

      currentDistance += speed * deltaTime
      if (currentDistance >= totalLength) {
        currentDistance = currentDistance % totalLength
      }

      const position = this._getPositionAtDistance(animationPoints, segmentLengths, currentDistance)
      data.movingMarker.group.set({ left: position.x, top: position.y })
      data.movingMarker.group.setCoords()
      this.canvas.renderAll()

      data.animationId = requestAnimationFrame(animate)
    }

    data.animationId = requestAnimationFrame(animate)
  }

  private _calculateTotalLength(points: Point[]): number {
    let total = 0
    for (let i = 1; i < points.length; i++) {
      total += this._distance(points[i - 1], points[i])
    }
    return total
  }

  private _calculateSegmentLengths(points: Point[]): number[] {
    const lengths: number[] = []
    for (let i = 1; i < points.length; i++) {
      lengths.push(this._distance(points[i - 1], points[i]))
    }
    return lengths
  }

  private _distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  }

  private _getPositionAtDistance(
    points: Point[],
    segmentLengths: number[],
    distance: number
  ): Point {
    let accumulated = 0

    for (let i = 0; i < segmentLengths.length; i++) {
      if (accumulated + segmentLengths[i] >= distance) {
        const segmentProgress = (distance - accumulated) / segmentLengths[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        return {
          x: p1.x + (p2.x - p1.x) * segmentProgress,
          y: p1.y + (p2.y - p1.y) * segmentProgress
        }
      }
      accumulated += segmentLengths[i]
    }

    return points[points.length - 1]
  }

  destroy(): void {
    this.clearAll()
  }
}
