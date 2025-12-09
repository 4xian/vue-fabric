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
import { SERIALIZATION_PROPERTIES } from './settings'

export function exportToJSON(canvas: Canvas, additionalProperties: string[] = []): string {
  const propertiesToInclude = [...SERIALIZATION_PROPERTIES, ...additionalProperties]
  return JSON.stringify(canvas.toObject(propertiesToInclude))
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
      case 'area':
        rebindAreaEvents(customObj as Polygon & { customData: AreaCustomData }, canvas, eventBus)
        applyHelperVisibility(customObj as Polygon & { customData: AreaCustomData }, helpersVisible)
        break
      case 'line':
        rebindLineEvents(customObj as Line & { customData: LineCustomData }, canvas, eventBus)
        applyLineHelperVisibility(
          customObj as Line & { customData: LineCustomData },
          helpersVisible
        )
        break
      case 'curve':
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
      case 'text':
        rebindTextEvents(customObj as IText & { customData: TextCustomData }, canvas, eventBus)
        break
      case 'customImage':
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

  // 收集所有主对象和辅助元素
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
      customData?: AreaCustomData | LineCustomData | CurveCustomData
      areaId?: string
      lineId?: string
      curveId?: string
    }

    if (!customObj.customType) return

    switch (customObj.customType) {
      case 'area':
        // eslint-disable-next-line
        const areaData = customObj.customData as AreaCustomData
        if (areaData?.areaId) {
          areas.set(areaData.areaId, customObj as Polygon & { customData: AreaCustomData })
          if (!areaHelpers.has(areaData.areaId)) {
            areaHelpers.set(areaData.areaId, { circles: [], labels: [], lines: [] })
          }
        }
        break

      case 'line':
        // eslint-disable-next-line
        const lineData = customObj.customData as LineCustomData
        if (lineData?.lineId) {
          lines.set(lineData.lineId, customObj as Line & { customData: LineCustomData })
          if (!lineHelpers.has(lineData.lineId)) {
            lineHelpers.set(lineData.lineId, {})
          }
        }
        break

      case 'curve':
        // eslint-disable-next-line
        const curveData = customObj.customData as CurveCustomData
        if (curveData?.curveId) {
          curves.set(
            curveData.curveId,
            customObj as fabric.FabricObject & { customData: CurveCustomData }
          )
          if (!curveHelpers.has(curveData.curveId)) {
            curveHelpers.set(curveData.curveId, { circles: [], labels: [] })
          }
        }
        break

      case 'areaPoint':
        // eslint-disable-next-line
        const areaPointId = customObj.areaId
        if (areaPointId) {
          if (!areaHelpers.has(areaPointId)) {
            areaHelpers.set(areaPointId, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaPointId)!.circles.push(obj as fabric.Circle)
        }
        break

      case 'areaLine':
        // eslint-disable-next-line
        const areaLineId = customObj.areaId
        if (areaLineId) {
          if (!areaHelpers.has(areaLineId)) {
            areaHelpers.set(areaLineId, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaLineId)!.lines.push(obj as fabric.Line)
        }
        break

      case 'areaLabel':
        // eslint-disable-next-line
        const areaLabelId = customObj.areaId
        if (areaLabelId) {
          if (!areaHelpers.has(areaLabelId)) {
            areaHelpers.set(areaLabelId, { circles: [], labels: [], lines: [] })
          }
          areaHelpers.get(areaLabelId)!.labels.push(obj as fabric.Text)
        }
        break

      case 'lineHelper':
        // eslint-disable-next-line
        const lineHelperId = customObj.lineId
        if (lineHelperId) {
          if (!lineHelpers.has(lineHelperId)) {
            lineHelpers.set(lineHelperId, {})
          }
          const helper = lineHelpers.get(lineHelperId)!
          if (!helper.startCircle) {
            helper.startCircle = obj as fabric.Circle
          } else {
            helper.endCircle = obj as fabric.Circle
          }
        }
        break

      case 'lineHelperLabel':
        // eslint-disable-next-line
        const lineLabelId = customObj.lineId
        if (lineLabelId) {
          if (!lineHelpers.has(lineLabelId)) {
            lineHelpers.set(lineLabelId, {})
          }
          lineHelpers.get(lineLabelId)!.label = obj as fabric.Text
        }
        break

      case 'curveHelper':
        // eslint-disable-next-line
        const curveHelperId = customObj.curveId
        if (curveHelperId) {
          if (!curveHelpers.has(curveHelperId)) {
            curveHelpers.set(curveHelperId, { circles: [], labels: [] })
          }
          curveHelpers.get(curveHelperId)!.circles.push(obj as fabric.Circle)
        }
        break

      case 'curveHelperLabel':
        // eslint-disable-next-line
        const curveLabelId = customObj.curveId
        if (curveLabelId) {
          if (!curveHelpers.has(curveLabelId)) {
            curveHelpers.set(curveLabelId, { circles: [], labels: [] })
          }
          curveHelpers.get(curveLabelId)!.labels.push(obj as fabric.Text)
        }
        break
    }
  })

  // 重新关联 area 的辅助元素
  areas.forEach((area, areaId) => {
    const helpers = areaHelpers.get(areaId)
    if (helpers && area.customData) {
      area.customData.circles = helpers.circles.length > 0 ? helpers.circles : undefined
      area.customData.labels = helpers.labels.length > 0 ? helpers.labels : undefined
      area.customData.lines = helpers.lines.length > 0 ? helpers.lines : undefined
    }
  })

  // 重新关联 line 的辅助元素
  lines.forEach((line, lineId) => {
    const helpers = lineHelpers.get(lineId)
    if (helpers && line.customData) {
      line.customData.startCircle = helpers.startCircle
      line.customData.endCircle = helpers.endCircle
      line.customData.label = helpers.label
    }
  })

  // 重新关联 curve 的辅助元素
  curves.forEach((curve, curveId) => {
    const helpers = curveHelpers.get(curveId)
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
      areaId: polygon.customData.areaId,
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
      lineId: line.customData.lineId,
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
      curveId: curve.customData.curveId,
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
      textId: textObj.customData.textId,
      text: textObj.text
    })
  })

  textObj.on('mousedown', () => {
    eventBus.emit('text:clicked', {
      textId: textObj.customData.textId,
      text: textObj.text,
      object: textObj
    })
  })

  textObj.on('selected', () => {
    eventBus.emit('text:selected', {
      textId: textObj.customData.textId,
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
      id: imageObj.customData.customImageId,
      object: imageObj
    })
  })

  imageObj.on('selected', () => {
    eventBus.emit('custom:selected', {
      type: 'image',
      id: imageObj.customData.customImageId,
      object: imageObj
    })
  })

  imageObj.on('modified', () => {
    eventBus.emit('image:modified', {
      id: imageObj.customData.customImageId,
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
    if (customObj.customType === 'area' && customObj.customData) {
      areas.push({
        areaId: customObj.customData.areaId,
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
  textId: string
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
    const customObj = obj as fabric.IText & { customType?: string; customData?: { textId: string } }
    if (customObj.customType === 'text' && customObj.customData) {
      texts.push({
        textId: customObj.customData.textId,
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
