import * as fabric from 'fabric'
import type { Canvas, Line, Polygon, IText, FabricImage, Rect, Polyline } from 'fabric'
import type {
  AreaCustomData,
  LineCustomData,
  PolylineCustomData,
  CurveCustomData,
  TextCustomData,
  ImageCustomData,
  RectCustomData,
  ExportImageOptions,
  CustomData,
  TextData,
  ZoomInvariantBase
} from '../../types'
import EventBus from '../core/EventBus'
import {
  SERIALIZATION_PROPERTIES,
  CustomType,
  CUSTOM_TYPE_HELPER_MAP,
  DEFAULT_AREATOOL_OPTIONS,
  DEFAULT_RECTTOOL_OPTIONS,
  type MainCustomType
} from './settings'
import type { ExportJSONOptions } from '../../types'
import { setupRectEvents } from './rectEvents'
import { setupAreaEvents, configureControls, setAreaHelpersVisibility } from './areaEvents'

type SerializedZoomInvariantNode = {
  customType?: string
  zoomInvariantBase?: ZoomInvariantBase
  strokeWidth?: number
  radius?: number
  fontSize?: number
  scaleX?: number
  scaleY?: number
  [key: string]: unknown
}

function normalizeZoomInvariantNode<T>(value: T, visited = new WeakSet<object>()): T | undefined {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeZoomInvariantNode(item, visited))
      .filter(item => item !== undefined) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (visited.has(value as object)) {
    return undefined
  }

  visited.add(value as object)

  const normalized: SerializedZoomInvariantNode = {}
  Object.entries(value as Record<string, unknown>).forEach(([key, childValue]) => {
    const normalizedChild = normalizeZoomInvariantNode(childValue, visited)
    if (normalizedChild !== undefined) {
      normalized[key] = normalizedChild
    }
  })

  applyZoomInvariantBase(normalized)
  return normalized as T
}

function applyZoomInvariantBase(node: SerializedZoomInvariantNode): void {
  const base = node.zoomInvariantBase
  if (!base) return

  if (typeof base.strokeWidth === 'number') {
    node.strokeWidth = base.strokeWidth
  }
  if (typeof base.radius === 'number') {
    node.radius = base.radius
  }
  if (typeof base.fontSize === 'number') {
    node.fontSize = base.fontSize
  }
  if (typeof base.scaleX === 'number') {
    node.scaleX = base.scaleX
  }
  if (typeof base.scaleY === 'number') {
    node.scaleY = base.scaleY
  }
}

type SerializableCustomData = Record<string, unknown>

function buildSerializableCustomData(
  customType: string,
  customData: SerializableCustomData
): SerializableCustomData | undefined {
  switch (customType) {
    case CustomType.Area:
      return {
        drawId: customData.drawId,
        points: customData.points,
        distances: customData.distances,
        lineColor: customData.lineColor,
        fillColor: customData.fillColor,
        originalOptions: customData.originalOptions
      }
    case CustomType.Line:
      return {
        drawId: customData.drawId,
        startPoint: customData.startPoint,
        endPoint: customData.endPoint,
        distance: customData.distance,
        lineColor: customData.lineColor
      }
    case CustomType.Polyline:
      return {
        drawId: customData.drawId,
        points: customData.points,
        distances: customData.distances,
        lineColor: customData.lineColor
      }
    case CustomType.Curve:
      return {
        drawId: customData.drawId,
        points: customData.points,
        isClosed: customData.isClosed,
        lineColor: customData.lineColor,
        fillColor: customData.fillColor,
        distances: customData.distances
      }
    case CustomType.Rect:
      return {
        drawId: customData.drawId,
        startPoint: customData.startPoint,
        endPoint: customData.endPoint,
        width: customData.width,
        height: customData.height,
        lineColor: customData.lineColor,
        fillColor: customData.fillColor,
        originalOptions: customData.originalOptions
      }
    default:
      return undefined
  }
}

function sanitizeCanvasDataForExport(canvasData: SerializedZoomInvariantNode): void {
  if (!Array.isArray(canvasData.objects)) return

  canvasData.objects = canvasData.objects.map(obj => sanitizeSerializedObject(obj))
}

function sanitizeSerializedObject(object: unknown): unknown {
  if (!object || typeof object !== 'object') return object

  const serializedObject = object as SerializedZoomInvariantNode
  if (!serializedObject.customType || !serializedObject.customData) {
    return serializedObject
  }

  const sanitized = buildSerializableCustomData(
    serializedObject.customType,
    serializedObject.customData as SerializableCustomData
  )
  if (sanitized) {
    serializedObject.customData = sanitized
  }

  return serializedObject
}

function createSerializableCanvasSnapshot(canvas: Canvas, propertiesToInclude: string[]) {
  const mutatedObjects: Array<{
    object: fabric.FabricObject & { customType?: string; customData?: SerializableCustomData }
    customData: SerializableCustomData
  }> = []

  try {
    canvas.getObjects().forEach(obj => {
      const customObj = obj as fabric.FabricObject & {
        customType?: string
        customData?: SerializableCustomData
      }
      if (!customObj.customType || !customObj.customData) return

      const sanitized = buildSerializableCustomData(customObj.customType, customObj.customData)
      if (!sanitized) return

      mutatedObjects.push({ object: customObj, customData: customObj.customData })
      customObj.customData = sanitized
    })

    return canvas.toObject(propertiesToInclude)
  } finally {
    mutatedObjects.forEach(({ object, customData }) => {
      object.customData = customData
    })
  }
}

export function exportToJSON(canvas: Canvas, options: ExportJSONOptions | string[] = []): string {
  const normalizedOptions: ExportJSONOptions = Array.isArray(options)
    ? { additionalProperties: options }
    : options

  const { additionalProperties = [], excludeTypes = ['text', 'image'] } = normalizedOptions
  const propertiesToInclude = [...SERIALIZATION_PROPERTIES, ...additionalProperties]
  const rawCanvasData = createSerializableCanvasSnapshot(canvas, propertiesToInclude)
  const canvasData = normalizeZoomInvariantNode(rawCanvasData) || rawCanvasData

  sanitizeCanvasDataForExport(canvasData)

  if (excludeTypes.length > 0) {
    const typesToExclude = new Set<string>()
    excludeTypes.forEach(type => {
      typesToExclude.add(type)
      const helpers = CUSTOM_TYPE_HELPER_MAP[type as MainCustomType]
      if (helpers) {
        helpers.forEach(helper => typesToExclude.add(helper))
      }
    })

    canvasData.objects = canvasData.objects.filter(
      (obj: { customType?: string }) => !obj.customType || !typesToExclude.has(obj.customType)
    )
  }

  return JSON.stringify(canvasData)
}

export function importFromJSON(
  canvas: Canvas,
  json: string | object,
  eventBus: EventBus,
  helpersVisible = false,
  getCurrentToolName?: () => string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      canvas.loadFromJSON(data).then(() => {
        rebindObjectEvents(canvas, eventBus, helpersVisible, getCurrentToolName)
        canvas.renderAll()
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

function rebindObjectEvents(
  canvas: Canvas,
  eventBus: EventBus,
  helpersVisible: boolean,
  getCurrentToolName?: () => string
): void {
  relinkHelperElements(canvas)

  canvas.getObjects().forEach(obj => {
    const customObj = obj as fabric.FabricObject & {
      customType?: string
      customData?: CustomData
    }

    if (!customObj.customType) return

    switch (customObj.customType) {
      case CustomType.Area:
        hydrateAreaRuntimeData(customObj as Polygon & { customData: AreaCustomData })
        rebindAreaEvents(
          customObj as Polygon & { customData: AreaCustomData },
          canvas,
          eventBus,
          getCurrentToolName
        )
        applyAreaHelperVisibility(
          customObj as Polygon & { customData: AreaCustomData },
          helpersVisible,
          canvas
        )
        break
      case CustomType.Line:
        rebindLineEvents(customObj as Line & { customData: LineCustomData }, canvas, eventBus)
        applyLineHelperVisibility(
          customObj as Line & { customData: LineCustomData },
          helpersVisible
        )
        break
      case CustomType.Polyline:
        hydratePolylineRuntimeData(customObj as Polyline & { customData: PolylineCustomData })
        rebindPolylineEvents(
          customObj as Polyline & { customData: PolylineCustomData },
          canvas,
          eventBus
        )
        applyPolylineHelperVisibility(
          customObj as Polyline & { customData: PolylineCustomData },
          helpersVisible
        )
        break
      case CustomType.Curve:
        hydrateCurveRuntimeData(customObj as fabric.FabricObject & { customData: CurveCustomData })
        rebindCurveEvents(
          customObj as fabric.FabricObject & { customData: CurveCustomData },
          canvas,
          eventBus
        )
        applyCurveHelperVisibility(
          customObj as fabric.FabricObject & { customData: CurveCustomData },
          helpersVisible
        )
        break
      case CustomType.Rect:
        hydrateRectRuntimeData(customObj as Rect & { customData: RectCustomData })
        rebindRectEvents(
          customObj as Rect & { customData: RectCustomData },
          canvas,
          eventBus,
          getCurrentToolName
        )
        applyRectHelperVisibility(
          customObj as Rect & { customData: RectCustomData },
          helpersVisible,
          canvas
        )
        break
      case CustomType.Text:
        rebindTextEvents(customObj as IText & { customData: TextCustomData }, canvas, eventBus)
        break
      case CustomType.Image:
        rebindImageEvents(
          customObj as FabricImage & { customData: ImageCustomData },
          canvas,
          eventBus
        )
        break
    }
  })
}

function hydrateAreaRuntimeData(obj: Polygon & { customData: AreaCustomData }): void {
  obj.customData = {
    ...obj.customData,
    originalOptions: {
      ...DEFAULT_AREATOOL_OPTIONS,
      ...(obj.customData?.originalOptions || {})
    }
  }
}

function hydratePolylineRuntimeData(obj: Polyline & { customData: PolylineCustomData }): void {
  obj.customData = {
    ...obj.customData,
    polyline: obj
  }
}

function hydrateCurveRuntimeData(obj: fabric.FabricObject & { customData: CurveCustomData }): void {
  obj.customData = {
    ...obj.customData
  }
}

function hydrateRectRuntimeData(obj: Rect & { customData: RectCustomData }): void {
  obj.customData = {
    ...obj.customData,
    originalOptions: {
      ...DEFAULT_RECTTOOL_OPTIONS,
      ...(obj.customData?.originalOptions || {})
    }
  }
}

function applyAreaHelperVisibility(
  obj: Polygon & { customData: AreaCustomData },
  visible: boolean,
  canvas: Canvas
): void {
  setAreaHelpersVisibility(obj, canvas, visible)
}

function applyLineHelperVisibility(
  obj: Line & { customData: LineCustomData },
  visible: boolean
): void {
  const { startCircle, endCircle, label } = obj.customData || {}
  if (startCircle && typeof startCircle.set === 'function') {
    startCircle.set({ visible })
  }
  if (endCircle && typeof endCircle.set === 'function') {
    endCircle.set({ visible })
  }
  if (label && typeof label.set === 'function') {
    label.set({ visible })
  }
}

function applyPolylineHelperVisibility(
  obj: Polyline & { customData: PolylineCustomData },
  visible: boolean
): void {
  const { circles, labels } = obj.customData || {}
  if (circles && Array.isArray(circles)) {
    circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ visible })
      }
    })
  }
  if (labels && Array.isArray(labels)) {
    labels.forEach(label => {
      if (label && typeof label.set === 'function') {
        label.set({ visible })
      }
    })
  }
}

function applyCurveHelperVisibility(
  obj: fabric.FabricObject & { customData: CurveCustomData },
  visible: boolean
): void {
  const { circles, labels } = obj.customData || {}
  if (circles && Array.isArray(circles)) {
    circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ visible })
      }
    })
  }
  if (labels && Array.isArray(labels)) {
    labels.forEach(label => {
      if (label && typeof label.set === 'function') {
        label.set({ visible })
      }
    })
  }
}

function applyRectHelperVisibility(
  obj: Rect & { customData: RectCustomData },
  visible: boolean,
  canvas: Canvas
): void {
  const { widthLabel, heightLabel } = obj.customData || {}
  if (widthLabel && typeof widthLabel.set === 'function') {
    widthLabel.set({ visible })
    if (visible) canvas.bringObjectToFront(widthLabel)
  }
  if (heightLabel && typeof heightLabel.set === 'function') {
    heightLabel.set({ visible })
    if (visible) canvas.bringObjectToFront(heightLabel)
  }
}

function relinkHelperElements(canvas: Canvas): void {
  const objects = canvas.getObjects()

  const areas: Map<string, Polygon & { customData: AreaCustomData }> = new Map()
  const lines: Map<string, Line & { customData: LineCustomData }> = new Map()
  const polylines: Map<string, Polyline & { customData: PolylineCustomData }> = new Map()
  const curves: Map<string, fabric.FabricObject & { customData: CurveCustomData }> = new Map()
  const rects: Map<string, Rect & { customData: RectCustomData }> = new Map()

  const areaHelpers: Map<
    string,
    { circles: fabric.Circle[]; labels: fabric.Text[]; lines: fabric.Line[] }
  > = new Map()
  const lineHelpers: Map<
    string,
    { startCircle?: fabric.Circle; endCircle?: fabric.Circle; label?: fabric.Text }
  > = new Map()
  const polylineHelpers: Map<string, { circles: fabric.Circle[]; labels: fabric.Text[] }> =
    new Map()
  const curveHelpers: Map<string, { circles: fabric.Circle[]; labels: fabric.Text[] }> = new Map()
  const rectHelpers: Map<string, { widthLabel?: fabric.Text; heightLabel?: fabric.Text }> =
    new Map()

  objects.forEach(obj => {
    const customObj = obj as fabric.FabricObject & {
      customType?: string
      customData?: CustomData | { drawId?: string; drawPid?: string }
    }

    if (!customObj.customType) return

    switch (customObj.customType) {
      case CustomType.Area:
        // eslint-disable-next-line
        const areaData = customObj.customData as AreaCustomData
        if (areaData?.drawId) {
          areas.set(areaData.drawId, customObj as Polygon & { customData: AreaCustomData })
          if (!areaHelpers.has(areaData.drawId)) {
            areaHelpers.set(areaData.drawId, { circles: [], labels: [], lines: [] })
          }
        }
        break

      case CustomType.Line:
        // eslint-disable-next-line
        const lineData = customObj.customData as LineCustomData
        if (lineData?.drawId) {
          lines.set(lineData.drawId, customObj as Line & { customData: LineCustomData })
          if (!lineHelpers.has(lineData.drawId)) {
            lineHelpers.set(lineData.drawId, {})
          }
        }
        break

      case CustomType.Polyline:
        // eslint-disable-next-line
        const polylineData = customObj.customData as PolylineCustomData
        if (polylineData?.drawId) {
          polylines.set(
            polylineData.drawId,
            customObj as Polyline & { customData: PolylineCustomData }
          )
          if (!polylineHelpers.has(polylineData.drawId)) {
            polylineHelpers.set(polylineData.drawId, { circles: [], labels: [] })
          }
        }
        break

      case CustomType.Curve:
        // eslint-disable-next-line
        const curveData = customObj.customData as CurveCustomData
        if (curveData?.drawId) {
          curves.set(
            curveData.drawId,
            customObj as fabric.FabricObject & { customData: CurveCustomData }
          )
          if (!curveHelpers.has(curveData.drawId)) {
            curveHelpers.set(curveData.drawId, { circles: [], labels: [] })
          }
        }
        break

      case CustomType.AreaPoint:
        // eslint-disable-next-line
        const areaPointPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (areaPointPid) {
          if (!areaHelpers.has(areaPointPid)) {
            areaHelpers.set(areaPointPid, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaPointPid)!.circles.push(obj as fabric.Circle)
        }
        break

      case CustomType.AreaLine:
        // eslint-disable-next-line
        const areaLinePid = (customObj.customData as { drawPid?: string })?.drawPid
        if (areaLinePid) {
          if (!areaHelpers.has(areaLinePid)) {
            areaHelpers.set(areaLinePid, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaLinePid)!.lines.push(obj as fabric.Line)
        }
        break

      case CustomType.AreaLabel:
        // eslint-disable-next-line
        const areaLabelPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (areaLabelPid) {
          if (!areaHelpers.has(areaLabelPid)) {
            areaHelpers.set(areaLabelPid, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaLabelPid)!.labels.push(obj as fabric.Text)
        }
        break

      case CustomType.LineHelper:
        // eslint-disable-next-line
        const lineHelperPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (lineHelperPid) {
          if (!lineHelpers.has(lineHelperPid)) {
            lineHelpers.set(lineHelperPid, {})
          }
          const helper = lineHelpers.get(lineHelperPid)!
          if (!helper.startCircle) {
            helper.startCircle = obj as fabric.Circle
          } else {
            helper.endCircle = obj as fabric.Circle
          }
        }
        break

      case CustomType.LineHelperLabel:
        // eslint-disable-next-line
        const lineLabelPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (lineLabelPid) {
          if (!lineHelpers.has(lineLabelPid)) {
            lineHelpers.set(lineLabelPid, {})
          }
          lineHelpers.get(lineLabelPid)!.label = obj as fabric.Text
        }
        break

      case CustomType.PolylineHelper:
        // eslint-disable-next-line
        const polylineHelperPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (polylineHelperPid) {
          if (!polylineHelpers.has(polylineHelperPid)) {
            polylineHelpers.set(polylineHelperPid, { circles: [], labels: [] })
          }
          polylineHelpers.get(polylineHelperPid)!.circles.push(obj as fabric.Circle)
        }
        break

      case CustomType.PolylineHelperLabel:
        // eslint-disable-next-line
        const polylineLabelPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (polylineLabelPid) {
          if (!polylineHelpers.has(polylineLabelPid)) {
            polylineHelpers.set(polylineLabelPid, { circles: [], labels: [] })
          }
          polylineHelpers.get(polylineLabelPid)!.labels.push(obj as fabric.Text)
        }
        break

      case CustomType.CurveHelper:
        // eslint-disable-next-line
        const curveHelperPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (curveHelperPid) {
          if (!curveHelpers.has(curveHelperPid)) {
            curveHelpers.set(curveHelperPid, { circles: [], labels: [] })
          }
          curveHelpers.get(curveHelperPid)!.circles.push(obj as fabric.Circle)
        }
        break

      case CustomType.CurveHelperLabel:
        // eslint-disable-next-line
        const curveLabelPid = (customObj.customData as { drawPid?: string })?.drawPid
        if (curveLabelPid) {
          if (!curveHelpers.has(curveLabelPid)) {
            curveHelpers.set(curveLabelPid, { circles: [], labels: [] })
          }
          curveHelpers.get(curveLabelPid)!.labels.push(obj as fabric.Text)
        }
        break

      case CustomType.Rect:
        // eslint-disable-next-line
        const rectData = customObj.customData as RectCustomData
        if (rectData?.drawId) {
          rects.set(rectData.drawId, customObj as Rect & { customData: RectCustomData })
          if (!rectHelpers.has(rectData.drawId)) {
            rectHelpers.set(rectData.drawId, {})
          }
        }
        break

      case CustomType.RectLabel:
        // eslint-disable-next-line
        const rectLabelData = customObj.customData as { drawPid?: string; labelType?: string }
        if (rectLabelData?.drawPid) {
          if (!rectHelpers.has(rectLabelData.drawPid)) {
            rectHelpers.set(rectLabelData.drawPid, {})
          }
          const helper = rectHelpers.get(rectLabelData.drawPid)!
          if (rectLabelData.labelType === 'width') {
            helper.widthLabel = obj as fabric.Text
          } else if (rectLabelData.labelType === 'height') {
            helper.heightLabel = obj as fabric.Text
          }
        }
        break
    }
  })

  areas.forEach((area, drawId) => {
    const helpers = areaHelpers.get(drawId)
    if (helpers && area.customData) {
      area.customData = {
        ...area.customData,
        circles: helpers.circles.length > 0 ? helpers.circles : undefined,
        labels: helpers.labels.length > 0 ? helpers.labels : undefined,
        lines: helpers.lines.length > 0 ? helpers.lines : undefined,
        originalOptions: {
          ...DEFAULT_AREATOOL_OPTIONS,
          ...(area.customData.originalOptions || {})
        }
      }
    }
  })

  lines.forEach((line, drawId) => {
    const helpers = lineHelpers.get(drawId)
    if (helpers && line.customData) {
      line.customData.startCircle = helpers.startCircle
      line.customData.endCircle = helpers.endCircle
      line.customData.label = helpers.label
    }
  })

  polylines.forEach((polyline, drawId) => {
    const helpers = polylineHelpers.get(drawId)
    if (helpers && polyline.customData) {
      polyline.customData = {
        ...polyline.customData,
        circles: sortHelpersByIndex(helpers.circles),
        labels: sortHelpersByIndex(helpers.labels),
        polyline
      }
    }
  })

  curves.forEach((curve, drawId) => {
    const helpers = curveHelpers.get(drawId)
    if (helpers && curve.customData) {
      curve.customData = {
        ...curve.customData,
        circles: helpers.circles.length > 0 ? helpers.circles : undefined,
        labels: helpers.labels.length > 0 ? helpers.labels : undefined
      }
    }
  })

  rects.forEach((rect, drawId) => {
    const helpers = rectHelpers.get(drawId)
    if (helpers && rect.customData) {
      rect.customData = {
        ...rect.customData,
        widthLabel: helpers.widthLabel,
        heightLabel: helpers.heightLabel,
        originalOptions: {
          ...DEFAULT_RECTTOOL_OPTIONS,
          ...(rect.customData.originalOptions || {})
        }
      }
    }
  })
}

function rebindAreaEvents(
  polygon: Polygon & { customData: AreaCustomData },
  canvas: Canvas,
  eventBus: EventBus,
  getCurrentToolName?: () => string
): void {
  configureControls(polygon, {
    cornerStyle: polygon.cornerStyle,
    cornerSize: polygon.cornerSize,
    cornerColor: polygon.cornerColor,
    borderColor: polygon.cornerColor,
    borderScaleFactor: polygon.borderScaleFactor,
    padding: polygon.padding
  })
  polygon.hasBorders = false
  polygon.controls = fabric.controlsUtils.createPolyControls(polygon)
  polygon.setCoords()
  setupAreaEvents(polygon, canvas, eventBus, getCurrentToolName)
}

function rebindLineEvents(
  line: Line & { customData: LineCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  let lastLeft = line.left || 0
  let lastTop = line.top || 0

  line.on('selected', () => {
    lastLeft = line.left || 0
    lastTop = line.top || 0
    eventBus.emit('line:selected', {
      drawId: line.customData.drawId,
      startPoint: line.customData.startPoint,
      endPoint: line.customData.endPoint,
      distance: line.customData.distance
    })
  })

  line.on('mousedown', () => {
    lastLeft = line.left || 0
    lastTop = line.top || 0
    eventBus.emit('line:clicked', {
      drawId: line.customData.drawId,
      startPoint: line.customData.startPoint,
      endPoint: line.customData.endPoint,
      distance: line.customData.distance
    })
  })

  line.on('moving', () => {
    const dx = (line.left || 0) - lastLeft
    const dy = (line.top || 0) - lastTop
    moveLineHelpers(line, dx, dy, canvas)
    lastLeft = line.left || 0
    lastTop = line.top || 0
  })
}

function rebindPolylineEvents(
  polyline: Polyline & { customData: PolylineCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  let lastLeft = polyline.left || 0
  let lastTop = polyline.top || 0

  polyline.on('selected', () => {
    lastLeft = polyline.left || 0
    lastTop = polyline.top || 0
    eventBus.emit('polyline:selected', {
      drawId: polyline.customData.drawId,
      points: polyline.customData.points,
      distances: polyline.customData.distances
    })
  })

  polyline.on('mousedown', () => {
    lastLeft = polyline.left || 0
    lastTop = polyline.top || 0
    eventBus.emit('polyline:clicked', {
      drawId: polyline.customData.drawId,
      points: polyline.customData.points,
      distances: polyline.customData.distances
    })
  })

  polyline.on('moving', () => {
    const dx = (polyline.left || 0) - lastLeft
    const dy = (polyline.top || 0) - lastTop
    movePolylineHelpers(polyline, dx, dy, canvas)
    lastLeft = polyline.left || 0
    lastTop = polyline.top || 0
  })
}

function rebindCurveEvents(
  curve: fabric.FabricObject & { customData: CurveCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  let lastLeft = curve.left || 0
  let lastTop = curve.top || 0

  curve.on('mousedown', () => {
    lastLeft = curve.left || 0
    lastTop = curve.top || 0
    eventBus.emit('curve:clicked', {
      drawId: curve.customData.drawId,
      points: curve.customData.points,
      isClosed: curve.customData.isClosed
    })
  })

  curve.on('selected', () => {
    lastLeft = curve.left || 0
    lastTop = curve.top || 0
    eventBus.emit('curve:selected', {
      drawId: curve.customData.drawId,
      points: curve.customData.points,
      isClosed: curve.customData.isClosed
    })
  })

  curve.on('moving', () => {
    const dx = (curve.left || 0) - lastLeft
    const dy = (curve.top || 0) - lastTop
    moveCurveHelpers(curve, dx, dy, canvas)
    lastLeft = curve.left || 0
    lastTop = curve.top || 0
  })
}

function rebindRectEvents(
  rect: Rect & { customData: RectCustomData },
  canvas: Canvas,
  eventBus: EventBus,
  getCurrentToolName?: () => string
): void {
  rect.setControlsVisibility({ mtr: false })
  setupRectEvents(rect, canvas, eventBus, getCurrentToolName)
}

function rebindTextEvents(
  textObj: IText & { customData: TextCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  textObj.set({ evented: true })

  textObj.on('editing:exited', () => {
    if (textObj.text?.trim() === '') {
      canvas.remove(textObj)
      canvas.renderAll()
    }
  })

  textObj.on('changed', () => {
    eventBus.emit('text:changed', {
      drawId: textObj.customData.drawId,
      text: textObj.text
    })
  })

  textObj.on('mousedown', () => {
    eventBus.emit('text:clicked', {
      drawId: textObj.customData.drawId,
      text: textObj.text,
      object: textObj
    })
  })

  textObj.on('selected', () => {
    eventBus.emit('text:selected', {
      drawId: textObj.customData.drawId,
      text: textObj.text,
      object: textObj
    })
  })
}

function rebindImageEvents(
  imageObj: FabricImage & { customData: ImageCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  imageObj.set({ evented: true })

  imageObj.on('mousedown', () => {
    eventBus.emit('image:clicked', {
      id: imageObj.customData.drawId,
      object: imageObj
    })
  })

  imageObj.on('selected', () => {
    eventBus.emit('image:selected', {
      type: 'image',
      id: imageObj.customData.drawId,
      object: imageObj
    })
  })

  imageObj.on('modified', () => {
    eventBus.emit('image:modified', {
      id: imageObj.customData.drawId,
      object: imageObj
    })
  })
}

function moveLineHelpers(
  line: Line & { customData: LineCustomData },
  dx: number,
  dy: number,
  canvas: Canvas
): void {
  const data = line.customData
  if (data.startCircle && typeof data.startCircle.set === 'function') {
    data.startCircle.set({
      left: (data.startCircle.left || 0) + dx,
      top: (data.startCircle.top || 0) + dy
    })
    data.startCircle.setCoords()
  }
  if (data.endCircle && typeof data.endCircle.set === 'function') {
    data.endCircle.set({
      left: (data.endCircle.left || 0) + dx,
      top: (data.endCircle.top || 0) + dy
    })
    data.endCircle.setCoords()
  }
  if (data.label && typeof data.label.set === 'function') {
    data.label.set({
      left: (data.label.left || 0) + dx,
      top: (data.label.top || 0) + dy
    })
    data.label.setCoords()
  }
  data.startPoint = { x: data.startPoint.x + dx, y: data.startPoint.y + dy }
  data.endPoint = { x: data.endPoint.x + dx, y: data.endPoint.y + dy }
  canvas.renderAll()
}

function movePolylineHelpers(
  polyline: Polyline & { customData: PolylineCustomData },
  dx: number,
  dy: number,
  canvas: Canvas
): void {
  const data = polyline.customData
  data.circles?.forEach(circle => {
    if (circle && typeof circle.set === 'function') {
      circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
      circle.setCoords()
    }
  })
  data.labels?.forEach(label => {
    if (label && typeof label.set === 'function') {
      label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
      label.setCoords()
    }
  })
  data.points = data.points.map(point => ({ x: point.x + dx, y: point.y + dy }))
  canvas.renderAll()
}

function sortHelpersByIndex<T extends fabric.FabricObject>(helpers: T[]): T[] {
  return [...helpers].sort((a, b) => {
    const aIndex = (a as T & { customData?: { index?: number } }).customData?.index ?? 0
    const bIndex = (b as T & { customData?: { index?: number } }).customData?.index ?? 0
    return aIndex - bIndex
  })
}

function moveCurveHelpers(
  curve: fabric.FabricObject & { customData: CurveCustomData },
  dx: number,
  dy: number,
  canvas: Canvas
): void {
  const data = curve.customData
  if (data.circles && Array.isArray(data.circles)) {
    data.circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
        circle.setCoords()
      }
    })
  }
  if (data.labels && Array.isArray(data.labels)) {
    data.labels.forEach(label => {
      if (label && typeof label.set === 'function') {
        label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
        label.setCoords()
      }
    })
  }
  data.points = data.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
  canvas.renderAll()
}

export function exportToImage(canvas: Canvas, options: ExportImageOptions | string = {}): string {
  if (typeof options === 'string') {
    options = { format: options as 'png' | 'jpeg' | 'webp' }
  }

  const {
    format = 'png',
    quality = 1.0,
    multiplier = 2,
    download = true,
    filename = `paint-${Date.now()}`
  } = options

  const dataURL = canvas.toDataURL({
    format,
    quality,
    multiplier
  })

  if (download) {
    const link = document.createElement('a')
    link.href = dataURL
    link.download = `${filename}.${format}`
    link.click()
  }

  return dataURL
}

export function exportToSVG(canvas: Canvas): string {
  return canvas.toSVG()
}

export function getAreasData(canvas: Canvas): AreaCustomData[] {
  const areas: AreaCustomData[] = []
  canvas.getObjects().forEach(obj => {
    const customObj = obj as fabric.FabricObject & {
      customType?: string
      customData?: AreaCustomData
    }
    if (customObj.customType === CustomType.Area && customObj.customData) {
      areas.push({
        drawId: customObj.customData.drawId,
        points: customObj.customData.points,
        distances: customObj.customData.distances,
        lineColor: customObj.customData.lineColor,
        fillColor: customObj.customData.fillColor
      })
    }
  })
  return areas
}

export function getTextsData(canvas: Canvas): TextData[] {
  const texts: TextData[] = []
  canvas.getObjects().forEach(obj => {
    const customObj = obj as fabric.IText & {
      customType?: string
      customData?: { drawId: string }
      zoomInvariantBase?: ZoomInvariantBase
    }
    if (customObj.customType === CustomType.Text && customObj.customData) {
      texts.push({
        drawId: customObj.customData.drawId,
        text: customObj.text || '',
        left: customObj.left || 0,
        top: customObj.top || 0,
        fontSize: customObj.zoomInvariantBase?.fontSize || customObj.fontSize || 16,
        fontFamily: customObj.fontFamily || 'Arial',
        fill: (customObj.fill as string) || '#000'
      })
    }
  })
  return texts
}
