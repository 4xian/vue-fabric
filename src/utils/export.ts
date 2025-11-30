import * as fabric from 'fabric'
import type { Canvas } from 'fabric'
import type { AreaCustomData, ExportImageOptions } from '../../types'
import EventBus from '../core/EventBus'

export function exportToJSON(canvas: Canvas, _additionalProperties: string[] = []): string {
  return JSON.stringify(canvas.toJSON())
}

export function importFromJSON(canvas: Canvas, json: string | object, eventBus: EventBus): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      canvas.loadFromJSON(data).then(() => {
        rebindObjectEvents(canvas, eventBus)
        canvas.renderAll()
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

function rebindObjectEvents(canvas: Canvas, eventBus: EventBus): void {
  canvas.getObjects().forEach((obj) => {
    const customObj = obj as fabric.FabricObject & { customType?: string; customData?: AreaCustomData }
    if (customObj.customType === 'area' && customObj.customData) {
      obj.on('selected', () => {
        showHelpers(customObj, canvas)
        eventBus.emit('area:selected', {
          areaId: customObj.customData!.areaId,
          points: customObj.customData!.points,
          distances: customObj.customData!.distances
        })
      })

      obj.on('deselected', () => {
        hideHelpers(customObj)
        canvas.renderAll()
      })
    }
  })
}

function showHelpers(obj: fabric.FabricObject & { customData?: AreaCustomData }, canvas: Canvas): void {
  const { circles, labels } = obj.customData || {}
  if (circles) {
    circles.forEach((circle) => {
      circle.set({ visible: true })
    })
  }
  if (labels) {
    labels.forEach((label) => {
      label.set({ visible: true })
    })
  }
  canvas.renderAll()
}

function hideHelpers(obj: fabric.FabricObject & { customData?: AreaCustomData }): void {
  const { circles, labels } = obj.customData || {}
  if (circles) {
    circles.forEach((circle) => {
      circle.set({ visible: false })
    })
  }
  if (labels) {
    labels.forEach((label) => {
      label.set({ visible: false })
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
  canvas.getObjects().forEach((obj) => {
    const customObj = obj as fabric.FabricObject & { customType?: string; customData?: AreaCustomData }
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
  canvas.getObjects().forEach((obj) => {
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
