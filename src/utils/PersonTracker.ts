import * as fabric from 'fabric'
import type { Canvas, Group, Circle, Polyline, Path } from 'fabric'
import type { Point, PersonData, TraceOptions } from '../../types'
import EventBus from '../core/EventBus'
import { DEFAULT_PERSON_TRACKER_OPTIONS, SHOULD_BLINK_LIST } from '../utils/settings'

interface PersonMarker {
  group: Group
  circle: Circle
  text: fabric.FabricText
  blinkAnimationId?: number
  personData?: PersonData
}

interface TraceData {
  pathLine: Polyline | Path
  startMarker: PersonMarker
  endMarker: PersonMarker
  movingMarker: PersonMarker
  animationId: number | null
  traces: Point[]
  curvePoints?: Point[]
}

export default class PersonTracker {
  private canvas: Canvas
  private eventBus: EventBus
  private persons: Map<string, PersonMarker> = new Map()
  private traces: Map<string, TraceData> = new Map()
  private displayTimers: Map<string, number> = new Map()
  private options: Required<TraceOptions>

  constructor(canvas: Canvas, eventBus: EventBus, options?: Partial<TraceOptions>) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.options = {
      radius: options?.radius ?? DEFAULT_PERSON_TRACKER_OPTIONS.radius!,
      strokeWidth: options?.strokeWidth ?? DEFAULT_PERSON_TRACKER_OPTIONS.strokeWidth!,
      fontSize: options?.fontSize ?? DEFAULT_PERSON_TRACKER_OPTIONS.fontSize!,
      animationSpeed: options?.animationSpeed ?? DEFAULT_PERSON_TRACKER_OPTIONS.animationSpeed!,
      textColor: options?.textColor ?? DEFAULT_PERSON_TRACKER_OPTIONS.textColor!,
      lineWidth: options?.lineWidth ?? DEFAULT_PERSON_TRACKER_OPTIONS.lineWidth!,
      pathType: options?.pathType ?? DEFAULT_PERSON_TRACKER_OPTIONS.pathType!,
      blinkInterval: options?.blinkInterval ?? DEFAULT_PERSON_TRACKER_OPTIONS.blinkInterval!,
      displayDuration: options?.displayDuration ?? DEFAULT_PERSON_TRACKER_OPTIONS.displayDuration!
    }
  }

  createMultiplePersons(persons: PersonData[]): void {
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
        this._startDisplayTimer(person.id)
      } else {
        this._createPersonMarker(person)
      }
    })

    this.canvas.renderAll()
  }

  createSinglePerson(person: PersonData): void {
    if (this.persons.has(person.id)) {
      this._updatePersonMarker(person)
      this._startDisplayTimer(person.id)
    } else {
      this._createPersonMarker(person)
    }
    this.canvas.renderAll()
  }

  removePerson(id: string): boolean {
    const marker = this.persons.get(id)
    if (!marker) return false

    this._stopDisplayTimer(id)
    this._stopBlinkAnimation(id)
    this.canvas.remove(marker.group)
    this.persons.delete(id)
    this.canvas.renderAll()
    this.eventBus.emit('person:removed', { id })
    return true
  }

  clearAll(): void {
    this.traces.forEach((_, id) => this.hideTrace(id))
    this.persons.forEach((_, id) => this._stopDisplayTimer(id))
    this.persons.forEach((_, id) => this._stopBlinkAnimation(id))
    this.persons.forEach(marker => this.canvas.remove(marker.group))
    this.persons.clear()
    this.canvas.renderAll()
    this.eventBus.emit('persons:cleared')
  }

  showTrace(id: string, person: PersonData, traces: Point[]): void {
    if (traces.length < 2) return

    this.hideTrace(id)

    const isCurve = this.options.pathType === 'curve'
    const pathLine = isCurve
      ? this._createCurvePath(traces, person.lineColor)
      : this._createPathLine(traces, person.lineColor)

    const curvePoints = isCurve ? this._generateCurvePoints(traces, 100) : undefined

    const startMarker = this._createMarkerGroup(
      traces[0].x,
      traces[0].y,
      person.name,
      person.lineColor,
      true
    )
    const endMarker = this._createMarkerGroup(
      traces[traces.length - 1].x,
      traces[traces.length - 1].y,
      person.name,
      person.lineColor,
      true
    )
    const movingMarker = this._createMarkerGroup(
      traces[0].x,
      traces[0].y,
      person.name,
      person.lineColor
    )

    const clickHandler = () => {
      this.eventBus.emit('person:click', { ...person })
    }
    startMarker.group.on('mousedown', clickHandler)
    endMarker.group.on('mousedown', clickHandler)

    this.canvas.add(pathLine)
    this.canvas.add(startMarker.group)
    this.canvas.add(endMarker.group)
    this.canvas.add(movingMarker.group)

    const traceData: TraceData = {
      pathLine,
      startMarker,
      endMarker,
      movingMarker,
      animationId: null,
      traces,
      curvePoints
    }

    this.traces.set(id, traceData)
    this._startTraceAnimation(id)
    this.canvas.renderAll()
    this.eventBus.emit('trace:shown', { id })
  }

  hideTrace(id: string): void {
    const data = this.traces.get(id)
    if (!data) return

    if (data.animationId !== null) {
      cancelAnimationFrame(data.animationId)
    }

    this.canvas.remove(data.pathLine)
    this.canvas.remove(data.startMarker.group)
    this.canvas.remove(data.endMarker.group)
    this.canvas.remove(data.movingMarker.group)

    this.traces.delete(id)
    this.canvas.renderAll()
    this.eventBus.emit('trace:hidden', { id })
  }

  getPersonById(id: string): PersonMarker | undefined {
    return this.persons.get(id)
  }

  getAllPersonIds(): string[] {
    return Array.from(this.persons.keys())
  }

  private _createPersonMarker(person: PersonData): void {
    const marker = this._createMarkerGroup(person.x, person.y, person.name, person.lineColor, true)
    marker.personData = person
    this.canvas.add(marker.group)
    this.persons.set(person.id, marker)

    marker.group.on('mousedown', () => {
      this.eventBus.emit('person:click', { ...person })
    })

    if (this._shouldBlink(person.status)) {
      this._startBlinkAnimation(person.id)
    }

    this._startDisplayTimer(person.id)

    this.eventBus.emit('person:created', { ...person })
  }

  private _updatePersonMarker(person: PersonData): void {
    const marker = this.persons.get(person.id)
    if (!marker) return

    marker.group.set({ left: person.x, top: person.y })
    marker.circle.set({ stroke: person.lineColor })
    marker.text.set({ text: person.name })
    marker.group.setCoords()

    const prevStatus = marker.personData?.status
    marker.personData = person

    if (this._shouldBlink(person.status) && !this._shouldBlink(prevStatus)) {
      this._startBlinkAnimation(person.id)
    } else if (!this._shouldBlink(person.status) && this._shouldBlink(prevStatus)) {
      this._stopBlinkAnimation(person.id)
    }
    this.eventBus.emit('person:updated', { ...person })
  }

  private _createMarkerGroup(
    x: number,
    y: number,
    name: string,
    lineColor: string,
    evented: boolean = false
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
      evented: evented,
      hasBorders: false,
      hasControls: false,
      hoverCursor: 'pointer'
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

  private _startTraceAnimation(id: string): void {
    const data = this.traces.get(id)
    if (!data || data.traces.length < 2) return

    const animationPoints = data.curvePoints || data.traces
    const totalLength = this._calculateTotalLength(animationPoints)
    const segmentLengths = this._calculateSegmentLengths(animationPoints)
    const speed = this.options.animationSpeed

    let lastTime: number | null = null
    let currentDistance = 0

    const animate = (timestamp: number) => {
      if (!this.traces.has(id)) return

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

  private _startBlinkAnimation(id: string): void {
    const marker = this.persons.get(id)
    if (!marker) return
    this._stopBlinkAnimation(id)

    let visible = true

    marker.blinkAnimationId = window.setInterval(() => {
      visible = !visible
      marker.group.set({ opacity: visible ? 1 : 0 })
      this.canvas.renderAll()
    }, DEFAULT_PERSON_TRACKER_OPTIONS.blinkInterval!)
  }

  private _stopBlinkAnimation(id: string): void {
    const marker = this.persons.get(id)
    if (!marker || !marker.blinkAnimationId) return

    clearInterval(marker.blinkAnimationId)
    marker.blinkAnimationId = undefined
    marker.group.set({ opacity: 1 })
    this.canvas.renderAll()
  }

  private _shouldBlink(status?: string): boolean {
    return SHOULD_BLINK_LIST.includes(status || '')
  }

  private _startDisplayTimer(id: string): void {
    this._stopDisplayTimer(id)

    if (this.options.displayDuration <= 0) return

    const timerId = window.setTimeout(() => {
      this.removePerson(id)
    }, this.options.displayDuration)

    this.displayTimers.set(id, timerId)
  }

  private _stopDisplayTimer(id: string): void {
    const timerId = this.displayTimers.get(id)
    if (timerId !== undefined) {
      clearTimeout(timerId)
      this.displayTimers.delete(id)
    }
  }
}
