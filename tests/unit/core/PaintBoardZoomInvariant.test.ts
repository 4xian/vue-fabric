import { describe, it, expect, vi } from 'vitest'
import VueFabric from '../../../src/core/PaintBoard'
import { createMockCanvas } from '../../fixtures/mockCanvas'

describe('VueFabric zoom invariant background transform', () => {
  it('uses viewport-aware background transform when backgroundVpt is false', () => {
    const board = new VueFabric('#fake', {
      width: 800,
      height: 600,
      lockObjectVisualSizeOnZoom: true
    })
    const canvas = createMockCanvas({ width: 800, height: 600, zoom: 2 }) as any
    canvas.width = 800
    canvas.height = 600
    canvas.viewportTransform = [2, 0, 0, 2, 30, 40]
    canvas.getZoom = vi.fn(() => 2)

    const image = {
      width: 400,
      height: 200,
      set: vi.fn(),
      setCoords: vi.fn()
    }

    ;(board as any).canvas = canvas
    ;(board as any)._backgroundImage = image
    ;(board as any)._bgImageOptions = {
      source: 'mock',
      scaleMode: 'fit',
      backgroundVpt: false
    }

    ;(board as any)._updateBackgroundImageTransform()

    expect(image.set).toHaveBeenCalledWith({
      scaleX: 1,
      scaleY: 1,
      left: -15,
      top: 30
    })
  })

  it('keeps background image on viewport when backgroundVpt is true', () => {
    const board = new VueFabric('#fake', {
      width: 800,
      height: 600,
      lockObjectVisualSizeOnZoom: true
    })
    const canvas = createMockCanvas({ width: 800, height: 600, zoom: 2 }) as any
    canvas.width = 800
    canvas.height = 600
    canvas.viewportTransform = [2, 0, 0, 2, 30, 40]
    canvas.getZoom = vi.fn(() => 2)

    const image = {
      width: 400,
      height: 200,
      set: vi.fn(),
      setCoords: vi.fn()
    }

    ;(board as any).canvas = canvas
    ;(board as any)._backgroundImage = image
    ;(board as any)._bgImageOptions = {
      source: 'mock',
      scaleMode: 'fit',
      backgroundVpt: true
    }

    ;(board as any)._updateBackgroundImageTransform()

    expect(image.set).toHaveBeenCalledWith({
      scaleX: 2,
      scaleY: 2,
      left: 0,
      top: 100
    })
  })

  it('forces background image to stay locked and at the back', () => {
    const board = new VueFabric('#fake', {
      width: 800,
      height: 600,
      lockObjectVisualSizeOnZoom: true
    })
    const canvas = createMockCanvas({ width: 800, height: 600, zoom: 1 }) as any
    const image = {
      set: vi.fn(),
      setCoords: vi.fn()
    }

    canvas.getActiveObject = vi.fn(() => image)
    ;(board as any).canvas = canvas
    ;(board as any)._backgroundImage = image

    ;(board as any)._ensureBackgroundImageLocked()

    expect(canvas.discardActiveObject).toHaveBeenCalled()
    expect(image.set).toHaveBeenCalledWith({
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hoverCursor: 'default',
      moveCursor: 'default',
      excludeFromExport: true
    })
    expect(canvas.sendObjectToBack).toHaveBeenCalledWith(image)
  })
})
