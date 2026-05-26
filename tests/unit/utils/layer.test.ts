import { describe, expect, it } from 'vitest'
import type { Canvas } from 'fabric'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { applyLayerToObjects, reflowCanvasLayers } from '../../../src/utils/layer'
import { CustomType } from '../../../src/utils/settings'

describe('layer utils', () => {
  it('keeps background images at the back and reorders area families by layer rank', () => {
    const canvas = createMockCanvas()

    const background: any = {
      type: 'image',
      excludeFromExport: true,
      selectable: false,
      evented: false
    }
    const text: any = {
      customType: CustomType.Text,
      customData: { drawId: 'text-1' }
    }
    const image: any = {
      customType: CustomType.Image,
      customData: { drawId: 'image-1' }
    }
    const area: any = {
      customType: CustomType.Area,
      customData: { drawId: 'area-1' }
    }
    const areaLine: any = {
      customType: CustomType.AreaLine,
      customData: { drawPid: 'area-1' }
    }
    const areaPoint: any = {
      customType: CustomType.AreaPoint,
      customData: { drawPid: 'area-1' }
    }
    const areaLabel: any = {
      customType: CustomType.AreaLabel,
      customData: { drawPid: 'area-1' }
    }

    canvas.add(text, areaPoint, image, areaLabel, background, area, areaLine)

    applyLayerToObjects(canvas as unknown as Canvas, [text], 2)
    applyLayerToObjects(canvas as unknown as Canvas, [image], 1)
    applyLayerToObjects(canvas as unknown as Canvas, [area, areaLine, areaPoint, areaLabel], 1)

    expect(canvas._objects[0]).toBe(background)
    expect(canvas._objects[canvas._objects.length - 1]).toBe(text)
    expect(canvas._objects.indexOf(areaLine)).toBeLessThan(canvas._objects.indexOf(area))
    expect(canvas._objects.indexOf(area)).toBeLessThan(canvas._objects.indexOf(areaPoint))
    expect(canvas._objects.indexOf(areaPoint)).toBeLessThan(canvas._objects.indexOf(areaLabel))
    expect(canvas._objects.indexOf(image)).toBeGreaterThan(canvas._objects.indexOf(areaLabel))
  })

  it('orders tracker families as path, ripple, marker group within the same layer', () => {
    const canvas = createMockCanvas()

    const text: any = {
      customType: CustomType.Text,
      customData: { drawId: 'text-1', layer: 2 }
    }
    const markerGroup: any = {
      customType: CustomType.PersonMarker,
      customData: { familyId: 'trace:1', role: 'group' }
    }
    const ripple: any = {
      customType: CustomType.PersonMarker,
      customData: { familyId: 'trace:1', rawRadius: 12, role: 'ripple' }
    }
    const path: any = {
      customType: CustomType.TracePath,
      customData: { familyId: 'trace:1', role: 'path' }
    }

    canvas.add(markerGroup, text, ripple, path)

    applyLayerToObjects(canvas as unknown as Canvas, [text], 2)
    applyLayerToObjects(canvas as unknown as Canvas, [path, ripple, markerGroup], 3)
    reflowCanvasLayers(canvas as unknown as Canvas)

    expect(canvas._objects).toEqual([text, path, ripple, markerGroup])
  })
})
