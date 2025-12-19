import * as fabric from 'fabric'
import type { Canvas, Group, Circle, Polyline, Path } from 'fabric'
import type { Point, PersonData, TraceOptions } from '../../types'
import EventBus from '../core/EventBus'
import { DEFAULT_PERSON_TRACKER_OPTIONS, CustomType } from '../utils/settings'

interface PersonMarker {
  group: Group
  circle: Circle
  text: fabric.FabricText
  blinkAnimationId?: number
  rippleCircle?: Circle
  rippleAnimationId?: number
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
  private renderVersion = 0

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
      displayDuration: options?.displayDuration ?? DEFAULT_PERSON_TRACKER_OPTIONS.displayDuration!,
      batchSize: options?.batchSize ?? DEFAULT_PERSON_TRACKER_OPTIONS.batchSize!,
      blinkList: options?.blinkList ?? DEFAULT_PERSON_TRACKER_OPTIONS.blinkList!,
      deleteOld: options?.deleteOld ?? DEFAULT_PERSON_TRACKER_OPTIONS.deleteOld!,
      fillColor: options?.fillColor ?? DEFAULT_PERSON_TRACKER_OPTIONS.fillColor!
    }
  }

  async createMultiplePersons(persons: PersonData[]): Promise<void> {
    this.abortRendering()
    const currentVersion = this.renderVersion

    const currentIds = new Set(this.persons.keys())
    const newIds = new Set(persons.map(p => p.id))

    const toDelete: string[] = []
    const toUpdate: PersonData[] = []
    const toCreate: PersonData[] = []

    if (this.options.deleteOld) {
      currentIds.forEach(id => {
        if (!newIds.has(id)) {
          toDelete.push(id)
        }
      })
    }

    persons.forEach(person => {
      if (this.persons.has(person.id)) {
        toUpdate.push(person)
      } else {
        toCreate.push(person)
      }
    })

    for (let i = 0; i < toDelete.length; i += this.options.batchSize) {
      if (this.renderVersion !== currentVersion) return
      const batch = toDelete.slice(i, i + this.options.batchSize)
      batch.forEach(id => this._removePersonWithoutRender(id))
      if (i + this.options.batchSize < toDelete.length) {
        await this._nextFrame()
      }
    }

    for (let i = 0; i < toUpdate.length; i += this.options.batchSize) {
      if (this.renderVersion !== currentVersion) return
      const batch = toUpdate.slice(i, i + this.options.batchSize)
      batch.forEach(person => {
        this._updatePersonMarker(person)
        this._startDisplayTimer(person)
      })
      if (i + this.options.batchSize < toUpdate.length) {
        await this._nextFrame()
      }
    }

    for (let i = 0; i < toCreate.length; i += this.options.batchSize) {
      if (this.renderVersion !== currentVersion) return
      const batch = toCreate.slice(i, i + this.options.batchSize)
      batch.forEach(person => this._createPersonMarkerWithoutRender(person))
      if (i + this.options.batchSize < toCreate.length) {
        await this._nextFrame()
      }
    }

    if (this.renderVersion !== currentVersion) return

    this.canvas.renderAll()
  }

  createSinglePerson(person: PersonData): void {
    if (this.persons.has(person.id)) {
      this._updatePersonMarker(person)
      this._startDisplayTimer(person)
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

  private _removePersonWithoutRender(id: string): boolean {
    const marker = this.persons.get(id)
    if (!marker) return false

    this._stopDisplayTimer(id)
    this._stopBlinkAnimation(id)
    this.canvas.remove(marker.group)
    this.persons.delete(id)
    this.eventBus.emit('person:removed', { id })
    return true
  }

  clearAll(): void {
    this.abortRendering()
    this.traces.forEach((_, id) => this.hideTrace(id))
    this.persons.forEach((_, id) => this._stopDisplayTimer(id))
    this.persons.forEach((_, id) => this._stopBlinkAnimation(id))
    this.persons.forEach(marker => this.canvas.remove(marker.group))
    this.persons.clear()
    this.canvas.renderAll()
    this.eventBus.emit('persons:allCleared')
  }

  clearAllPersons(): void {
    this.abortRendering()
    this.persons.forEach((_, id) => this._stopDisplayTimer(id))
    this.persons.forEach((_, id) => this._stopBlinkAnimation(id))
    this.persons.forEach(marker => this.canvas.remove(marker.group))
    this.persons.clear()
    this.canvas.renderAll()
    this.eventBus.emit('persons:cleared')
  }

  clearAllTraces(): void {
    this.traces.forEach((_, id) => this.hideTrace(id))
    this.canvas.renderAll()
    this.eventBus.emit('traces:cleared')
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
      this.eventBus.emit('person:clicked', { ...person })
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
      this.eventBus.emit('person:clicked', { ...person })
    })

    if (this._shouldBlink(person.status)) {
      this._startBlinkAnimation(person.id)
    }

    this._startDisplayTimer(person)

    this.eventBus.emit('person:created', { ...person })
  }

  private _createPersonMarkerWithoutRender(person: PersonData): void {
    const marker = this._createMarkerGroup(person.x, person.y, person.name, person.lineColor, true)
    marker.personData = person
    this.canvas.add(marker.group)
    this.persons.set(person.id, marker)

    marker.group.on('mousedown', () => {
      this.eventBus.emit('person:clicked', { ...person })
    })

    if (this._shouldBlink(person.status)) {
      this._startBlinkAnimation(person.id)
      this.eventBus.emit('person:statusChange', {
        ...person
      })
    }

    this._startDisplayTimer(person)
    this.eventBus.emit('person:created', { ...person })
  }

  private _updatePersonMarker(person: PersonData): void {
    const marker = this.persons.get(person.id)
    if (!marker) return

    marker.group.set({ left: person.x, top: person.y })
    marker.circle.set({ stroke: person.lineColor })
    marker.text.set({ text: person.name })
    marker.group.setCoords()

    if (marker.rippleCircle) {
      marker.rippleCircle.set({ left: person.x, top: person.y })
      marker.rippleCircle.setCoords()
    }

    const prevStatus = marker.personData?.status
    marker.personData = person

    const prevShouldBlink = this._shouldBlink(prevStatus)
    const nowShouldBlink = this._shouldBlink(person.status)

    if (nowShouldBlink && !prevShouldBlink) {
      this._startBlinkAnimation(person.id)
      this.eventBus.emit('person:statusChange', {
        ...person
      })
    } else if (!nowShouldBlink && prevShouldBlink) {
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
      fill: this.options.fillColor || lineColor,
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

    ;(group as Group & { customType: string }).customType = CustomType.PersonMarker

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
    ;(polyline as Polyline & { customType: string }).customType = CustomType.TracePath
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
    ;(path as Path & { customType: string }).customType = CustomType.TracePath
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

  abortRendering(): void {
    this.renderVersion++
  }

  private _startBlinkAnimation(id: string): void {
    const marker = this.persons.get(id)
    if (!marker) return
    // this._stopBlinkAnimation(id)
    this._startRippleAnimation(id)
    // let visible = true
    // marker.blinkAnimationId = window.setInterval(() => {
    //   visible = !visible
    //   marker.group.set({ opacity: visible ? 1 : 0 })
    //   this.canvas.renderAll()
    // }, DEFAULT_PERSON_TRACKER_OPTIONS.blinkInterval!)
  }

  private _stopBlinkAnimation(id: string): void {
    this._stopRippleAnimation(id)
    const marker = this.persons.get(id)
    if (!marker || !marker.blinkAnimationId) return
    clearInterval(marker.blinkAnimationId)
    marker.blinkAnimationId = undefined
    marker.group.set({ opacity: 1 })
    this.canvas.renderAll()
  }

  private _startRippleAnimation(id: string): void {
    this._stopRippleAnimation(id)
    const marker = this.persons.get(id)
    if (!marker || !marker.personData) return

    const lineColor = marker.personData.lineColor
    const baseRadius = this.options.radius
    const maxRadius = baseRadius * 5
    let currentRadius = baseRadius

    const groupCenter = marker.group.getCenterPoint()

    const rippleCircle = new fabric.Circle({
      radius: currentRadius,
      fill: this._colorWithOpacity(lineColor, 0.5),
      stroke: 'transparent',
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      left: groupCenter.x,
      top: groupCenter.y,
      selectable: false,
      evented: false
    })

    this.canvas.add(rippleCircle)
    this.canvas.sendObjectToBack(rippleCircle)
    marker.rippleCircle = rippleCircle

    marker.rippleAnimationId = window.setInterval(() => {
      currentRadius += 1.5
      if (currentRadius > maxRadius) {
        currentRadius = baseRadius
      }
      const progress = (currentRadius - baseRadius) / (maxRadius - baseRadius)
      const opacity = 0.5 * (1 - progress)
      rippleCircle.set({
        radius: currentRadius,
        fill: this._colorWithOpacity(lineColor, opacity)
      })
      this.canvas.renderAll()
    }, 100)
  }

  private _stopRippleAnimation(id: string): void {
    const marker = this.persons.get(id)
    if (!marker) return

    if (marker.rippleAnimationId) {
      clearInterval(marker.rippleAnimationId)
      marker.rippleAnimationId = undefined
    }

    if (marker.rippleCircle) {
      this.canvas.remove(marker.rippleCircle)
      marker.rippleCircle = undefined
    }
  }

  private _colorWithOpacity(color: string, opacity: number): string {
    if (color.startsWith('rgba(')) {
      return color.replace(/,\s*[\d.]+\)$/, `, ${opacity})`)
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`)
    }
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      let r: number, g: number, b: number
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16)
        g = parseInt(hex[1] + hex[1], 16)
        b = parseInt(hex[2] + hex[2], 16)
      } else {
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
      }
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
    return `rgba(0, 167, 240, ${opacity})`
  }

  private _shouldBlink(status?: string): boolean {
    return this.options.blinkList.includes(status || '')
  }

  private _nextFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  }

  private _startDisplayTimer(person: PersonData): void {
    this._stopDisplayTimer(person.id)

    if (this.options.displayDuration <= 0) return
    const time = this._shouldBlink(person.status)
      ? this.options.displayDuration * 2
      : this.options.displayDuration
    const timerId = window.setTimeout(() => {
      this.removePerson(person.id)
    }, time)
    this.displayTimers.set(person.id, timerId)
  }

  private _stopDisplayTimer(id: string): void {
    const timerId = this.displayTimers.get(id)
    if (timerId !== undefined) {
      clearTimeout(timerId)
      this.displayTimers.delete(id)
    }
  }
}
