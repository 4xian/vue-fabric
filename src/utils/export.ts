import * as fabric from 'fabric'
import type { Canvas, Line, Polygon, IText, FabricImage } from 'fabric'
import type {
  AreaCustomData,
  LineCustomData,
  CurveCustomData,
  TextCustomData,
  CustomImageData,
  ExportImageOptions
} from '../../types'
import EventBus from '../core/EventBus'
import {
  SERIALIZATION_PROPERTIES,
  CustomType,
  CUSTOM_TYPE_HELPER_MAP,
  type MainCustomType
} from './settings'
import type { ExportJSONOptions } from '../../types'

export function exportToJSON(canvas: Canvas, options: ExportJSONOptions | string[] = []): string {
  const normalizedOptions: ExportJSONOptions = Array.isArray(options)
    ? { additionalProperties: options }
    : options

  const { additionalProperties = [], excludeTypes = ['text', 'image'] } = normalizedOptions
  const propertiesToInclude = [...SERIALIZATION_PROPERTIES, ...additionalProperties]
  const canvasData = canvas.toObject(propertiesToInclude)

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
  helpersVisible = false
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      canvas.loadFromJSON(data).then(() => {
        rebindObjectEvents(canvas, eventBus, helpersVisible)
        canvas.renderAll()
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

function rebindObjectEvents(canvas: Canvas, eventBus: EventBus, helpersVisible: boolean): void {
  relinkHelperElements(canvas)

  canvas.getObjects().forEach(obj => {
    const customObj = obj as fabric.FabricObject & {
      customType?: string
      customData?:
        | AreaCustomData
        | LineCustomData
        | CurveCustomData
        | TextCustomData
        | CustomImageData
    }

    if (!customObj.customType) return

    switch (customObj.customType) {
      case CustomType.Area:
        rebindAreaEvents(customObj as Polygon & { customData: AreaCustomData }, canvas, eventBus)
        applyHelperVisibility(customObj as Polygon & { customData: AreaCustomData }, helpersVisible)
        break
      case CustomType.Line:
        rebindLineEvents(customObj as Line & { customData: LineCustomData }, canvas, eventBus)
        applyLineHelperVisibility(
          customObj as Line & { customData: LineCustomData },
          helpersVisible
        )
        break
      case CustomType.Curve:
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
      case CustomType.Text:
        rebindTextEvents(customObj as IText & { customData: TextCustomData }, canvas, eventBus)
        break
      case CustomType.Image:
        rebindImageEvents(
          customObj as FabricImage & { customData: CustomImageData },
          canvas,
          eventBus
        )
        break
    }
  })
}

function applyHelperVisibility(
  obj: Polygon & { customData: AreaCustomData },
  visible: boolean
): void {
  const { circles, labels, lines } = obj.customData || {}
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
  if (lines && Array.isArray(lines)) {
    lines.forEach(line => {
      if (line && typeof line.set === 'function') {
        line.set({ visible })
      }
    })
  }
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

function relinkHelperElements(canvas: Canvas): void {
  const objects = canvas.getObjects()

  const areas: Map<string, Polygon & { customData: AreaCustomData }> = new Map()
  const lines: Map<string, Line & { customData: LineCustomData }> = new Map()
  const curves: Map<string, fabric.FabricObject & { customData: CurveCustomData }> = new Map()

  const areaHelpers: Map<
    string,
    { circles: fabric.Circle[]; labels: fabric.Text[]; lines: fabric.Line[] }
  > = new Map()
  const lineHelpers: Map<
    string,
    { startCircle?: fabric.Circle; endCircle?: fabric.Circle; label?: fabric.Text }
  > = new Map()
  const curveHelpers: Map<string, { circles: fabric.Circle[]; labels: fabric.Text[] }> = new Map()

  objects.forEach(obj => {
    const customObj = obj as fabric.FabricObject & {
      customType?: string
      customData?:
        | AreaCustomData
        | LineCustomData
        | CurveCustomData
        | { drawId?: string; drawPid?: string }
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
    }
  })

  areas.forEach((area, drawId) => {
    const helpers = areaHelpers.get(drawId)
    if (helpers && area.customData) {
      area.customData.circles = helpers.circles.length > 0 ? helpers.circles : undefined
      area.customData.labels = helpers.labels.length > 0 ? helpers.labels : undefined
      area.customData.lines = helpers.lines.length > 0 ? helpers.lines : undefined
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

  curves.forEach((curve, drawId) => {
    const helpers = curveHelpers.get(drawId)
    if (helpers && curve.customData) {
      curve.customData.circles = helpers.circles.length > 0 ? helpers.circles : undefined
      curve.customData.labels = helpers.labels.length > 0 ? helpers.labels : undefined
    }
  })
}

function rebindAreaEvents(
  polygon: Polygon & { customData: AreaCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  let lastLeft = polygon.left || 0
  let lastTop = polygon.top || 0

  polygon.on('selected', () => {
    lastLeft = polygon.left || 0
    lastTop = polygon.top || 0
    showHelpers(polygon, canvas)
    eventBus.emit('area:selected', {
      drawId: polygon.customData.drawId,
      points: polygon.customData.points,
      distances: polygon.customData.distances
    })
  })

  polygon.on('deselected', () => {
    hideHelpers(polygon)
    canvas.renderAll()
  })

  polygon.on('moving', () => {
    const dx = (polygon.left || 0) - lastLeft
    const dy = (polygon.top || 0) - lastTop
    moveAreaHelpers(polygon, dx, dy, canvas)
    lastLeft = polygon.left || 0
    lastTop = polygon.top || 0
  })
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

  line.on('moving', () => {
    const dx = (line.left || 0) - lastLeft
    const dy = (line.top || 0) - lastTop
    moveLineHelpers(line, dx, dy, canvas)
    lastLeft = line.left || 0
    lastTop = line.top || 0
  })
}

function rebindCurveEvents(
  curve: fabric.FabricObject & { customData: CurveCustomData },
  canvas: Canvas,
  eventBus: EventBus
): void {
  let lastLeft = curve.left || 0
  let lastTop = curve.top || 0

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
  imageObj: FabricImage & { customData: CustomImageData },
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
    eventBus.emit('custom:selected', {
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

function moveAreaHelpers(
  polygon: Polygon & { customData: AreaCustomData },
  dx: number,
  dy: number,
  canvas: Canvas
): void {
  const data = polygon.customData
  if (data.circles && Array.isArray(data.circles)) {
    data.circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
        circle.setCoords()
      }
    })
  }
  if (data.lines && Array.isArray(data.lines)) {
    data.lines.forEach(line => {
      if (line && typeof line.set === 'function') {
        line.set({
          x1: (line.x1 || 0) + dx,
          y1: (line.y1 || 0) + dy,
          x2: (line.x2 || 0) + dx,
          y2: (line.y2 || 0) + dy
        })
        line.setCoords()
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

function showHelpers(
  obj: fabric.FabricObject & { customData?: AreaCustomData },
  canvas: Canvas
): void {
  const { circles, labels } = obj.customData || {}
  if (circles && Array.isArray(circles)) {
    circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ visible: true })
      }
    })
  }
  if (labels && Array.isArray(labels)) {
    labels.forEach(label => {
      if (label && typeof label.set === 'function') {
        label.set({ visible: true })
      }
    })
  }
  canvas.renderAll()
}

function hideHelpers(obj: fabric.FabricObject & { customData?: AreaCustomData }): void {
  const { circles, labels } = obj.customData || {}
  if (circles && Array.isArray(circles)) {
    circles.forEach(circle => {
      if (circle && typeof circle.set === 'function') {
        circle.set({ visible: false })
      }
    })
  }
  if (labels && Array.isArray(labels)) {
    labels.forEach(label => {
      if (label && typeof label.set === 'function') {
        label.set({ visible: false })
      }
    })
  }
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

interface TextData {
  drawId: string
  text: string
  left: number
  top: number
  fontSize: number
  fontFamily: string
  fill: string
}

export function getTextsData(canvas: Canvas): TextData[] {
  const texts: TextData[] = []
  canvas.getObjects().forEach(obj => {
    const customObj = obj as fabric.IText & { customType?: string; customData?: { drawId: string } }
    if (customObj.customType === CustomType.Text && customObj.customData) {
      texts.push({
        drawId: customObj.customData.drawId,
        text: customObj.text || '',
        left: customObj.left || 0,
        top: customObj.top || 0,
        fontSize: customObj.fontSize || 16,
        fontFamily: customObj.fontFamily || 'Arial',
        fill: (customObj.fill as string) || '#000'
      })
    }
  })
  return texts
}
