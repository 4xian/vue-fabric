import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fabric from 'fabric'
import VueFabric from '../../src/core/PaintBoard'
import { CustomType } from '../../src/utils/settings'

function createContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '600px'
  document.body.appendChild(container)
  return container
}

describe('VueFabric zoom invariant integration', () => {
  let container: HTMLDivElement
  let board: VueFabric

  beforeEach(() => {
    container = createContainer()
    board = new VueFabric(container, {
      width: 800,
      height: 600,
      autoResize: false,
      lockObjectVisualSizeOnZoom: true
    })
    board.init()
    board.canvas!.renderAll = vi.fn(() => board.canvas!) as typeof board.canvas.renderAll
    board.canvas!.requestRenderAll = vi.fn(() => board.canvas!) as typeof board.canvas.requestRenderAll
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
  })

  it('keeps object visual sizes stable while preserving geometry positions', () => {
    const line = new fabric.Line([10, 20, 110, 20], {
      stroke: '#000',
      strokeWidth: 2
    })
    ;(line as fabric.Line & { customType: string }).customType = CustomType.Line

    const point = new fabric.Circle({
      left: 50,
      top: 60,
      radius: 3,
      stroke: '#000',
      strokeWidth: 2
    })
    ;(point as fabric.Circle & { customType: string }).customType = CustomType.PolylineHelper

    const text = new fabric.IText('A', {
      left: 30,
      top: 40,
      fontSize: 12,
      objectCaching: false
    })
    ;(text as fabric.IText & { customType: string }).customType = CustomType.Text

    board.canvas!.add(line)
    board.canvas!.add(point)
    board.canvas!.add(text)

    const lineStart = { x1: line.x1, x2: line.x2 }
    const pointPosition = { left: point.left, top: point.top }
    const textPosition = { left: text.left, top: text.top }

    board.setZoom(2)

    expect(line.strokeWidth).toBeCloseTo(1)
    expect(point.radius).toBeCloseTo(1.5)
    expect(point.strokeWidth).toBeCloseTo(1)
    expect(text.fontSize).toBeCloseTo(6)
    expect(line.x1).toBe(lineStart.x1)
    expect(line.x2).toBe(lineStart.x2)
    expect(point.left).toBe(pointPosition.left)
    expect(point.top).toBe(pointPosition.top)
    expect(text.left).toBe(textPosition.left)
    expect(text.top).toBe(textPosition.top)
  })

  it('normalizes zoom invariant values during export and restores them after import', async () => {
    const line = new fabric.Line([0, 0, 100, 0], {
      stroke: '#000',
      strokeWidth: 2
    })
    ;(line as fabric.Line & { customType: string }).customType = CustomType.Line
    board.canvas!.add(line)

    board.setZoom(2)

    const json = board.exportToJSON({ excludeTypes: [] })
    const exported = JSON.parse(json)
    expect(exported.objects[0].strokeWidth).toBe(2)
    expect(exported.objects[0].zoomInvariantBase.strokeWidth).toBe(2)

    board.clear()
    await board.importFromJSON(json)

    const importedLine = board.canvas!.getObjects()[0] as fabric.Line & {
      zoomInvariantBase?: { strokeWidth?: number }
    }
    expect(importedLine.zoomInvariantBase?.strokeWidth).toBe(2)

    board.setZoom(2)
    expect(importedLine.strokeWidth).toBeCloseTo(1)
  })

  it('skips compensation for configured custom types', () => {
    const line = new fabric.Line([0, 0, 100, 0], {
      stroke: '#000',
      strokeWidth: 2
    })
    ;(line as fabric.Line & { customType: string }).customType = CustomType.Line

    const text = new fabric.IText('A', {
      left: 30,
      top: 40,
      fontSize: 12,
      objectCaching: false
    })
    ;(text as fabric.IText & { customType: string }).customType = CustomType.Text

    const imageElement = document.createElement('img')
    imageElement.width = 20
    imageElement.height = 20
    const image = new fabric.FabricImage(imageElement, {
      left: 50,
      top: 60,
      scaleX: 1,
      scaleY: 1,
      originX: 'center',
      originY: 'center'
    })
    ;(image as fabric.FabricImage & { customType: string }).customType = CustomType.Image

    const selectiveBoard = new VueFabric(container, {
      width: 800,
      height: 600,
      autoResize: false,
      lockObjectVisualSizeOnZoom: true,
      zoomInvariantExcludeTypes: [CustomType.Text, CustomType.Image]
    })
    selectiveBoard.init()
    selectiveBoard.canvas!.renderAll = vi.fn(
      () => selectiveBoard.canvas!
    ) as typeof selectiveBoard.canvas.renderAll

    selectiveBoard.canvas!.add(line)
    selectiveBoard.canvas!.add(text)
    selectiveBoard.canvas!.add(image)

    selectiveBoard.setZoom(2)

    expect(line.strokeWidth).toBeCloseTo(1)
    expect(text.fontSize).toBe(12)
    expect(image.scaleX).toBe(1)
    expect(image.scaleY).toBe(1)

    selectiveBoard.destroy()
  })

  it('re-applies zoom invariant visuals after resize fitViewport recalculation', () => {
    const line = new fabric.Line([0, 0, 100, 0], {
      stroke: '#000',
      strokeWidth: 2
    })
    ;(line as fabric.Line & { customType: string }).customType = CustomType.Line

    board.canvas!.add(line)
    board.resize(1000, 700)

    expect(line.strokeWidth).toBeCloseTo(2 / (700 / 600))
    expect(line.x1).toBe(0)
    expect(line.x2).toBe(100)
  })
})
