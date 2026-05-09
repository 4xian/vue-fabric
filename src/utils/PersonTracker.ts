import * as fabric from 'fabric'
import type { Canvas, Group, Circle, Polyline, Path, FabricImage } from 'fabric'
import type { Point, PersonData, TraceOptions } from '../../types'
import EventBus from '../core/EventBus'
import { DEFAULT_PERSON_TRACKER_OPTIONS, CustomType } from '../utils/settings'

type ZoomInvariantFabricObject = fabric.FabricObject & {
  customType?: string
  zoomInvariantBase?: {
    strokeWidth?: number
    radius?: number
    scaleX?: number
    scaleY?: number
  }
  customData?: Record<string, unknown>
}

interface ZoomInvariantAdapter {
  isEnabled: () => boolean
  getZoomFactor: () => number
  isExcludedType: (customType?: string) => boolean
}

interface PersonMarker {
  group: Group
  circle: Circle
  image?: FabricImage
  text: fabric.FabricText
  blinkAnimationId?: number
  rippleCircle?: Circle
  rippleAnimating?: boolean
  personData?: PersonData
  isAnimating?: boolean
  isInitialized?: boolean
  moveAnimationFrameId?: number
}

interface TraceData {
  pathLine: Polyline | Path
  startMarker: PersonMarker
  endMarker: PersonMarker
  movingMarker?: PersonMarker
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
  private zoomInvariantAdapter?: ZoomInvariantAdapter
  private readonly _onCanvasZoomed: () => void
  private readonly _onCanvasPanned: () => void

  constructor(
    canvas: Canvas,
    eventBus: EventBus,
    options?: Partial<TraceOptions>,
    zoomInvariantAdapter?: ZoomInvariantAdapter
  ) {
    this.canvas = canvas
    this.eventBus = eventBus
    this.zoomInvariantAdapter = zoomInvariantAdapter
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
      blinkReasons: options?.blinkReasons ?? DEFAULT_PERSON_TRACKER_OPTIONS.blinkReasons!,
      deleteOld: options?.deleteOld ?? DEFAULT_PERSON_TRACKER_OPTIONS.deleteOld!,
      fillColor: options?.fillColor ?? DEFAULT_PERSON_TRACKER_OPTIONS.fillColor!,
      moveAnimationSpeed:
        options?.moveAnimationSpeed ?? DEFAULT_PERSON_TRACKER_OPTIONS.moveAnimationSpeed!,
      maxMoveAnimationDuration:
        options?.maxMoveAnimationDuration ??
        DEFAULT_PERSON_TRACKER_OPTIONS.maxMoveAnimationDuration!,
      minMoveAnimationDuration:
        options?.minMoveAnimationDuration ??
        DEFAULT_PERSON_TRACKER_OPTIONS.minMoveAnimationDuration!,
      markerBase64: options?.markerBase64 ?? DEFAULT_PERSON_TRACKER_OPTIONS.markerBase64!,
      showMovingMarker:
        options?.showMovingMarker ?? DEFAULT_PERSON_TRACKER_OPTIONS.showMovingMarker!
    }
    this._onCanvasZoomed = () => {
      this._applyZoomInvariantState()
      this.canvas.renderAll()
    }
    this._onCanvasPanned = () => {
      this._applyZoomInvariantState()
      this.canvas.renderAll()
    }
    this.eventBus.on('canvas:zoomed', this._onCanvasZoomed)
    this.eventBus.on('canvas:panned', this._onCanvasPanned)
  }

  async createMultiplePersons(persons: PersonData[]): Promise<void> {
    this.abortRendering()
    const currentVersion = this.renderVersion

    const currentIds = new Set(this.persons.keys())
    const newIds = new Set(persons.map(p => p.id))
    const retainedIds = new Set<string>()

    const toDelete: string[] = []
    const toUpdate: PersonData[] = []
    const toCreate: PersonData[] = []
    const toTransform: Array<{ sourceId: string; person: PersonData }> = []
    const transformedSourceIds = new Set<string>()

    persons.forEach(person => {
      retainedIds.add(person.id)
      if (person.yid) {
        retainedIds.add(person.yid)
      }
    })

    if (this.options.deleteOld) {
      currentIds.forEach(id => {
        if (!retainedIds.has(id)) {
          toDelete.push(id)
        }
      })
    }

    persons.forEach(person => {
      if (person.x != 0 && person.y != 0) {
        if (this.persons.has(person.id)) {
          toUpdate.push(person)
        } else {
          const sourceId = person.yid?.trim()
          const canTransform =
            !!sourceId &&
            sourceId !== person.id &&
            !newIds.has(sourceId) &&
            this.persons.has(sourceId) &&
            !transformedSourceIds.has(sourceId)

          if (canTransform) {
            transformedSourceIds.add(sourceId)
            toTransform.push({ sourceId, person })
          } else {
            toCreate.push(person)
          }
        }
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

    for (let i = 0; i < toCreate.length; i += this.options.batchSize) {
      if (this.renderVersion !== currentVersion) return
      const batch = toCreate.slice(i, i + this.options.batchSize)
      await Promise.all(batch.map(person => this._createPersonMarkerWithoutRender(person)))
      if (i + this.options.batchSize < toCreate.length) {
        await this._nextFrame()
      }
    }

    for (let i = 0; i < toTransform.length; i += this.options.batchSize) {
      if (this.renderVersion !== currentVersion) return
      const batch = toTransform.slice(i, i + this.options.batchSize)
      batch.forEach(({ sourceId, person }) => {
        this._transformPersonMarker(sourceId, person)
        this._startDisplayTimer(person)
      })
      if (i + this.options.batchSize < toTransform.length) {
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

    if (this.renderVersion !== currentVersion) return

    this.canvas.renderAll()
  }

  async createSinglePerson(person: PersonData): Promise<void> {
    if (this.persons.has(person.id)) {
      this._updatePersonMarker(person)
      this._startDisplayTimer(person)
    } else {
      await this._createPersonMarker(person)
    }
    this.canvas.renderAll()
  }

  private _isZoomInvariantEnabled(): boolean {
    return this.zoomInvariantAdapter?.isEnabled() ?? false
  }

  private _getZoomInvariantFactor(): number {
    const zoom = this.zoomInvariantAdapter?.getZoomFactor() ?? 1
    return zoom > 0 ? zoom : 1
  }

  private _isZoomInvariantExcluded(customType?: string): boolean {
    return this.zoomInvariantAdapter?.isExcludedType(customType) ?? false
  }

  private _getMarkerAnchor(marker: PersonMarker): Point {
    const customData = ((marker.group as Group & { customData?: Record<string, unknown> })
      .customData || {}) as Record<string, unknown>

    if (typeof customData.anchorX === 'number' && typeof customData.anchorY === 'number') {
      return {
        x: customData.anchorX,
        y: customData.anchorY
      }
    }

    return this._getMarkerCircleCenter(marker)
  }

  private _setMarkerAnchor(
    marker: PersonMarker,
    x: number,
    y: number,
    persistAnchor: boolean = true
  ): void {
    const group = marker.group as Group & { customData?: Record<string, unknown> }
    group.customData = {
      ...(group.customData || {}),
      ...(persistAnchor ? { anchorX: x, anchorY: y } : {})
    }

    group.set({ left: x, top: y })
    group.setCoords()

    const circleCenter = this._getMarkerCircleCenter(marker)
    group.set({
      left: (group.left ?? 0) + (x - circleCenter.x),
      top: (group.top ?? 0) + (y - circleCenter.y)
    })
    group.setCoords()

    if (marker.rippleCircle) {
      const nextCenter = this._getMarkerCircleCenter(marker)
      marker.rippleCircle.set({ left: nextCenter.x, top: nextCenter.y })
      marker.rippleCircle.setCoords()
    }
  }

  private _applyZoomInvariantToPath(pathLine?: Polyline | Path): void {
    if (!pathLine) return

    const target = pathLine as Polyline & {
      customType?: string
      zoomInvariantBase?: { strokeWidth?: number }
    }
    const baseStrokeWidth = target.zoomInvariantBase?.strokeWidth ?? this.options.lineWidth
    const zoom =
      this._isZoomInvariantEnabled() && !this._isZoomInvariantExcluded(target.customType)
        ? this._getZoomInvariantFactor()
        : 1

    pathLine.set({ strokeWidth: baseStrokeWidth / zoom })
    pathLine.setCoords()
  }

  private _applyZoomInvariantToRipple(marker: PersonMarker): void {
    if (!marker.rippleCircle) return

    const ripple = marker.rippleCircle as Circle & {
      customType?: string
      zoomInvariantBase?: { radius?: number }
      customData?: Record<string, unknown>
    }
    const rawRadius =
      typeof ripple.customData?.rawRadius === 'number'
        ? ripple.customData.rawRadius
        : ripple.zoomInvariantBase?.radius || this.options.radius
    const zoom =
      this._isZoomInvariantEnabled() && !this._isZoomInvariantExcluded(ripple.customType)
        ? this._getZoomInvariantFactor()
        : 1

    ripple.customData = {
      ...(ripple.customData || {}),
      rawRadius
    }
    ripple.set({ radius: rawRadius / zoom })
    ripple.setCoords()
  }

  private _applyZoomInvariantToMarker(marker: PersonMarker): void {
    const group = marker.group as Group & {
      customType?: string
      zoomInvariantBase?: { scaleX?: number; scaleY?: number }
    }
    const baseScaleX = group.zoomInvariantBase?.scaleX ?? 1
    const baseScaleY = group.zoomInvariantBase?.scaleY ?? 1
    const shouldCompensateMarker =
      this._isZoomInvariantEnabled() && !this._isZoomInvariantExcluded(group.customType)
    const zoom = shouldCompensateMarker ? this._getZoomInvariantFactor() : 1

    group.set({
      scaleX: baseScaleX / zoom,
      scaleY: baseScaleY / zoom
    })

    const textBaseScaleX =
      (marker.text as fabric.FabricText & { zoomInvariantBase?: { scaleX?: number } })
        .zoomInvariantBase?.scaleX ?? 1
    const textBaseScaleY =
      (marker.text as fabric.FabricText & { zoomInvariantBase?: { scaleY?: number } })
        .zoomInvariantBase?.scaleY ?? 1
    const textScaleFactor =
      shouldCompensateMarker && this._isZoomInvariantExcluded(CustomType.Text) ? zoom : 1
    marker.text.set({
      scaleX: textBaseScaleX * textScaleFactor,
      scaleY: textBaseScaleY * textScaleFactor
    })

    if (marker.image) {
      const image = marker.image as FabricImage & {
        zoomInvariantBase?: { scaleX?: number; scaleY?: number }
      }
      const imageScaleFactor =
        shouldCompensateMarker && this._isZoomInvariantExcluded(CustomType.Image) ? zoom : 1

      image.set({
        scaleX: (image.zoomInvariantBase?.scaleX ?? image.scaleX ?? 1) * imageScaleFactor,
        scaleY: (image.zoomInvariantBase?.scaleY ?? image.scaleY ?? 1) * imageScaleFactor
      })
    }

    const anchor = this._getMarkerAnchor(marker)
    this._setMarkerAnchor(marker, anchor.x, anchor.y, false)
    this._applyZoomInvariantToRipple(marker)
    this.canvas.bringObjectToFront(marker.group)
  }

  private _applyZoomInvariantState(): void {
    this.persons.forEach(marker => {
      this._applyZoomInvariantToMarker(marker)
    })

    this.traces.forEach(trace => {
      this._applyZoomInvariantToPath(trace.pathLine)
      this._applyZoomInvariantToMarker(trace.startMarker)
      this._applyZoomInvariantToMarker(trace.endMarker)
      if (trace.movingMarker) {
        this._applyZoomInvariantToMarker(trace.movingMarker)
      }
    })
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
    this.traces.forEach((_, id) => this.removePersonTraces(id))
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
    this.traces.forEach((_, id) => this.removePersonTraces(id))
    this.canvas.renderAll()
    this.eventBus.emit('traces:cleared')
  }

  async createPersonTraces(id: string, person: PersonData, traces: Point[]): Promise<void> {
    if (traces.length < 2) return

    this.removePersonTraces(id)

    const isCurve = this.options.pathType === 'curve'
    const pathLine = isCurve
      ? this._createCurvePath(traces, person.lineColor)
      : this._createPathLine(traces, person.lineColor)

    const curvePoints = isCurve ? this._generateCurvePoints(traces, 100) : undefined

    const startMarker = await this._createMarkerGroup(
      traces[0].x,
      traces[0].y,
      person.name,
      person.lineColor,
      true,
      person.base64
    )
    const endMarker = await this._createMarkerGroup(
      traces[traces.length - 1].x,
      traces[traces.length - 1].y,
      person.name,
      person.lineColor,
      true,
      person.base64
    )
    let movingMarker = null
    if (this.options.showMovingMarker) {
      movingMarker = await this._createMarkerGroup(
        traces[0].x,
        traces[0].y,
        person.name,
        person.lineColor,
        false,
        person.base64
      )
    }

    const clickHandler = () => {
      this.eventBus.emit('person:clicked', { ...person })
    }
    startMarker.group.on('mousedown', clickHandler)
    endMarker.group.on('mousedown', clickHandler)

    this.canvas.add(pathLine)
    this.canvas.add(startMarker.group)
    this.canvas.add(endMarker.group)
    if (this.options.showMovingMarker && movingMarker) {
      this.canvas.add(movingMarker.group)
    }
    this._applyZoomInvariantToPath(pathLine)
    this._applyZoomInvariantToMarker(startMarker)
    this._setMarkerAnchor(startMarker, traces[0].x, traces[0].y)
    this._applyZoomInvariantToMarker(endMarker)
    this._setMarkerAnchor(endMarker, traces[traces.length - 1].x, traces[traces.length - 1].y)
    if (this.options.showMovingMarker && movingMarker) {
      this._applyZoomInvariantToMarker(movingMarker)
      this._setMarkerAnchor(movingMarker, traces[0].x, traces[0].y)
    }

    const traceData: TraceData = {
      pathLine,
      startMarker,
      endMarker,
      animationId: null,
      traces,
      curvePoints
    }

    if (this.options.showMovingMarker && movingMarker) {
      traceData.movingMarker = movingMarker
    }

    this.traces.set(id, traceData)
    if (this.options.showMovingMarker && movingMarker) {
      this._startTraceAnimation(id)
    }
    this.canvas.renderAll()
    this.eventBus.emit('trace:shown', { id })
  }

  removePersonTraces(id: string): void {
    const data = this.traces.get(id)
    if (!data) return

    if (data.animationId !== null) {
      cancelAnimationFrame(data.animationId)
    }

    this.canvas.remove(data.pathLine)
    this.canvas.remove(data.startMarker.group)
    this.canvas.remove(data.endMarker.group)
    if (data.movingMarker) {
      this.canvas.remove(data.movingMarker.group)
    }

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

  private async _createPersonMarker(person: PersonData): Promise<void> {
    const marker = await this._createMarkerGroup(
      person.x,
      person.y,
      person.name,
      person.lineColor,
      true,
      person.base64
    )
    marker.personData = person
    marker.isInitialized = true
    this.canvas.add(marker.group)
    this.persons.set(person.id, marker)
    this._bindMarkerClickHandler(marker)
    this._applyZoomInvariantToMarker(marker)
    this._setMarkerAnchor(marker, person.x, person.y)

    if (this._shouldBlink(person.status)) {
      this._startBlinkAnimation(person.id)
    }

    this._startDisplayTimer(person)

    this.eventBus.emit('person:created', { ...person })
  }

  private async _createPersonMarkerWithoutRender(person: PersonData): Promise<void> {
    const marker = await this._createMarkerGroup(
      person.x,
      person.y,
      person.name,
      person.lineColor,
      true,
      person.base64
    )
    marker.personData = person
    marker.isInitialized = true
    this.canvas.add(marker.group)
    this.persons.set(person.id, marker)
    this._bindMarkerClickHandler(marker)
    this._applyZoomInvariantToMarker(marker)
    this._setMarkerAnchor(marker, person.x, person.y)

    if (this._shouldBlink(person.status)) {
      this._startBlinkAnimation(person.id)
      this.eventBus.emit('person:statusChange', {
        ...person
      })
    }

    this._startDisplayTimer(person)
    this.eventBus.emit('person:created', { ...person })
  }

  private _transformPersonMarker(sourceId: string, person: PersonData): void {
    const marker = this.persons.get(sourceId)
    if (!marker) return

    this._stopDisplayTimer(sourceId)
    this.persons.delete(sourceId)
    this.persons.set(person.id, marker)
    this._bindMarkerClickHandler(marker)
    this._updatePersonMarker(person)
  }

  private _bindMarkerClickHandler(marker: PersonMarker): void {
    marker.group.off('mousedown')
    marker.group.on('mousedown', () => {
      if (!marker.personData) return
      this.eventBus.emit('person:clicked', { ...marker.personData })
    })
  }

  private _updatePersonMarker(person: PersonData): void {
    const marker = this.persons.get(person.id)
    if (!marker) return

    marker.circle.set({ stroke: person.lineColor })
    marker.text.set({ text: person.name })
    this._applyZoomInvariantToMarker(marker)

    const prevStatus = marker.personData?.status
    marker.personData = person
    const currentAnchor = this._getMarkerAnchor(marker)
    const targetLeft = person.x
    const targetTop = person.y

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

    // const needsAnimation = Math.abs(targetLeft - currentAnchor.x) > 1 || Math.abs(targetTop - currentAnchor.y) > 1
    // console.log(111, targetLeft, targetTop)
    if (marker.isInitialized && this.options.maxMoveAnimationDuration > 0) {
      const distance = Math.sqrt(
        Math.pow(targetLeft - currentAnchor.x, 2) + Math.pow(targetTop - currentAnchor.y, 2)
      )

      if (distance <= 1) {
        this._setMarkerAnchor(marker, targetLeft, targetTop)
        return
      }

      const calculatedDuration = distance / this.options.moveAnimationSpeed
      const minDuration = this.options.minMoveAnimationDuration
      const maxDuration = this.options.maxMoveAnimationDuration
      const duration = Math.min(maxDuration, Math.max(minDuration, calculatedDuration))
      this._animateMarkerPosition(
        marker,
        currentAnchor.x,
        currentAnchor.y,
        targetLeft,
        targetTop,
        duration
      )
    } else {
      if (marker.moveAnimationFrameId) {
        cancelAnimationFrame(marker.moveAnimationFrameId)
        marker.moveAnimationFrameId = undefined
      }
      marker.isAnimating = false
      this._setMarkerAnchor(marker, targetLeft, targetTop)
    }

    this.eventBus.emit('person:updated', { ...person })
  }

  private _animateMarkerPosition(
    marker: PersonMarker,
    startLeft: number,
    startTop: number,
    targetLeft: number,
    targetTop: number,
    duration: number
  ): void {
    if (marker.moveAnimationFrameId) {
      cancelAnimationFrame(marker.moveAnimationFrameId)
    }

    marker.isAnimating = true
    const startTime = performance.now()

    const renderFrame = (progress: number) => {
      const nextLeft = startLeft + (targetLeft - startLeft) * progress
      const nextTop = startTop + (targetTop - startTop) * progress

      this._setMarkerAnchor(marker, nextLeft, nextTop)
      this.canvas.renderAll()
    }

    const step = (timestamp: number) => {
      const elapsed = Math.min(timestamp - startTime, duration)
      const easedProgress = fabric.util.ease.easeInOutQuad(elapsed, 0, 1, duration)

      renderFrame(easedProgress)

      if (elapsed >= duration) {
        marker.isAnimating = false
        marker.moveAnimationFrameId = undefined
        renderFrame(1)
        return
      }

      marker.moveAnimationFrameId = requestAnimationFrame(step)
    }

    marker.moveAnimationFrameId = requestAnimationFrame(step)
  }

  private async _createMarkerGroup(
    x: number,
    y: number,
    name: string,
    lineColor: string,
    evented: boolean = false,
    base64?: string
  ): Promise<PersonMarker> {
    const imageSource = base64 || this.options.markerBase64
    const maxSize = this.options.radius * 3

    let img: FabricImage | null = null
    let scaledHeight = maxSize

    if (imageSource) {
      try {
        img = await fabric.FabricImage.fromURL(imageSource)
        const originalWidth = img.width || maxSize
        const originalHeight = img.height || maxSize
        const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight)
        scaledHeight = originalHeight * scale

        img.set({
          originX: 'center',
          originY: 'center',
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale
        })
        ;(img as FabricImage & { customType: string }).customType = CustomType.Image
        ;(
          img as FabricImage & { zoomInvariantBase: { scaleX: number; scaleY: number } }
        ).zoomInvariantBase = {
          scaleX: scale,
          scaleY: scale
        }
      } catch {
        img = null
      }
    }

    const circle = new fabric.Circle({
      radius: this.options.radius,
      fill: this.options.fillColor || lineColor,
      stroke: lineColor,
      strokeWidth: this.options.strokeWidth,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      visible: !img
    })
    ;(circle as Circle & { customType: string }).customType = CustomType.PersonMarker

    // 文字在 circle/图片 下方
    const textTopOffset = img ? scaledHeight / 2 + 4 : this.options.radius + 4
    const text = new fabric.FabricText(name, {
      fontSize: this.options.fontSize,
      fill: this.options.textColor,
      originX: 'center',
      originY: 'top',
      left: 0,
      top: textTopOffset
    })
    ;(text as fabric.FabricText & { customType: string }).customType = CustomType.Text
    ;(
      text as fabric.FabricText & { zoomInvariantBase: { scaleX: number; scaleY: number } }
    ).zoomInvariantBase = {
      scaleX: text.scaleX || 1,
      scaleY: text.scaleY || 1
    }

    const groupItems: (Circle | fabric.FabricText | FabricImage)[] = img
      ? [img, circle, text]
      : [circle, text]

    // 计算 group 偏移量：使 circle/图片 中心位于传入的 (x, y) 坐标
    const textHeight = text.height || this.options.fontSize
    const groupOffsetY = (textTopOffset + textHeight) / 2

    const group = new fabric.Group(groupItems, {
      left: x,
      top: y + groupOffsetY,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: evented,
      hasBorders: false,
      hasControls: false,
      hoverCursor: 'pointer'
    })

    ;(group as Group & { customType: string }).customType = CustomType.PersonMarker
    ;(group as Group & { customData: any }).customData = { textHeight, anchorX: x, anchorY: y }
    ;(
      group as Group & { zoomInvariantBase: { scaleX: number; scaleY: number } }
    ).zoomInvariantBase = {
      scaleX: group.scaleX || 1,
      scaleY: group.scaleY || 1
    }

    const marker: PersonMarker = { group, circle, text }
    if (img) {
      marker.image = img
    }

    return marker
  }

  // 保留一个同步版本用于不需要等待的场景
  private _createMarkerGroupSync(
    x: number,
    y: number,
    name: string,
    lineColor: string,
    evented: boolean = false
  ): PersonMarker {
    // circle 在 group 内部坐标 (0, 0)
    const circle = new fabric.Circle({
      radius: this.options.radius,
      fill: this.options.fillColor || lineColor,
      stroke: lineColor,
      strokeWidth: this.options.strokeWidth,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      visible: true
    })
    ;(circle as Circle & { customType: string }).customType = CustomType.PersonMarker

    // 文字在 circle 下方
    const text = new fabric.FabricText(name, {
      fontSize: this.options.fontSize,
      fill: this.options.textColor,
      originX: 'center',
      originY: 'top',
      left: 0,
      top: this.options.radius + 4
    })
    ;(text as fabric.FabricText & { customType: string }).customType = CustomType.Text
    ;(
      text as fabric.FabricText & { zoomInvariantBase: { scaleX: number; scaleY: number } }
    ).zoomInvariantBase = {
      scaleX: text.scaleX || 1,
      scaleY: text.scaleY || 1
    }

    // 计算 group 偏移量
    const textHeight = text.height || this.options.fontSize
    const groupOffsetY = (4 + textHeight) / 2

    const group = new fabric.Group([circle, text], {
      left: x,
      top: y + groupOffsetY,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: evented,
      hasBorders: false,
      hasControls: false,
      hoverCursor: 'pointer'
    })

    ;(group as Group & { customType: string }).customType = CustomType.PersonMarker
    ;(group as Group & { customData: any }).customData = { anchorX: x, anchorY: y }
    ;(
      group as Group & { zoomInvariantBase: { scaleX: number; scaleY: number } }
    ).zoomInvariantBase = {
      scaleX: group.scaleX || 1,
      scaleY: group.scaleY || 1
    }

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
    ;(polyline as Polyline & { zoomInvariantBase: { strokeWidth: number } }).zoomInvariantBase = {
      strokeWidth: this.options.lineWidth
    }
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
    ;(path as Path & { zoomInvariantBase: { strokeWidth: number } }).zoomInvariantBase = {
      strokeWidth: this.options.lineWidth
    }
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
      if (data.movingMarker) {
        this._setMarkerAnchor(data.movingMarker, position.x, position.y)
      }

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
    this.eventBus.off('canvas:zoomed', this._onCanvasZoomed)
    this.eventBus.off('canvas:panned', this._onCanvasPanned)
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
    const maxRadius = baseRadius * 6

    const circleCenter = this._getMarkerCircleCenter(marker)

    const rippleCircle = new fabric.Circle({
      radius: baseRadius,
      fill: this._colorWithOpacity(lineColor, 0.7),
      stroke: 'transparent',
      strokeWidth: 0,
      originX: 'center',
      originY: 'center',
      left: circleCenter.x,
      top: circleCenter.y,
      selectable: false,
      evented: false
    })
    ;(rippleCircle as Circle & { customType: string }).customType = CustomType.PersonMarker
    ;(rippleCircle as Circle & { zoomInvariantBase: { radius: number } }).zoomInvariantBase = {
      radius: baseRadius
    }
    ;(rippleCircle as Circle & { customData: Record<string, unknown> }).customData = {
      rawRadius: baseRadius
    }

    this.canvas.add(rippleCircle)
    marker.rippleCircle = rippleCircle
    marker.rippleAnimating = true
    this._applyZoomInvariantToRipple(marker)
    this.canvas.bringObjectToFront(marker.group)

    const animateRipple = () => {
      if (!marker.rippleAnimating || !marker.rippleCircle) return

      fabric.util.animate({
        startValue: 0,
        endValue: maxRadius,
        duration: this.options.blinkInterval,
        onChange: (value: number) => {
          if (!marker.rippleAnimating || !marker.rippleCircle) return
          const progress = (value - baseRadius) / (maxRadius - baseRadius)
          const opacity = 0.8 * (1 - progress)
          ;(marker.rippleCircle as Circle & { customData?: Record<string, unknown> }).customData = {
            ...((marker.rippleCircle as Circle & { customData?: Record<string, unknown> })
              .customData || {}),
            rawRadius: value
          }
          marker.rippleCircle.set({
            fill: this._colorWithOpacity('#ff0000', opacity)
          })
          this._applyZoomInvariantToRipple(marker)
          this.canvas.renderAll()
        },
        onComplete: () => {
          if (marker.rippleAnimating && marker.rippleCircle) {
            ;(marker.rippleCircle as Circle & { customData?: Record<string, unknown> }).customData =
              {
                ...((marker.rippleCircle as Circle & { customData?: Record<string, unknown> })
                  .customData || {}),
                rawRadius: baseRadius
              }
            marker.rippleCircle.set({
              fill: this._colorWithOpacity('#ff0000', 1)
            })
            this._applyZoomInvariantToRipple(marker)
            animateRipple()
          }
        }
      })
    }

    animateRipple()
  }

  private _stopRippleAnimation(id: string): void {
    const marker = this.persons.get(id)
    if (!marker) return

    marker.rippleAnimating = false

    if (marker.rippleCircle) {
      this.canvas.remove(marker.rippleCircle)
      marker.rippleCircle = undefined
    }
  }

  private _getMarkerCircleCenter(marker: PersonMarker): Point {
    const center = marker.circle.getCenterPoint()
    return {
      x: center.x,
      y: center.y
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
    return this.options.blinkReasons.includes(status || '')
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
