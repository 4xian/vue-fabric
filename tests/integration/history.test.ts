import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VueFabric from '../../src/core/PaintBoard'
import AreaTool from '../../src/tools/AreaTool'
import LineTool from '../../src/tools/LineTool'
import RectTool from '../../src/tools/RectTool'
import SelectTool from '../../src/tools/SelectTool'

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function createContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '600px'
  document.body.appendChild(container)
  return container
}

async function flushRestore(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

/** 模拟立即加载成功的浏览器图片，并返回恢复函数。 */
function mockLoadedImage(): () => void {
  const OriginalImage = global.Image
  global.Image = function MockImage() {
    const image = document.createElement('img')
    let source = ''
    Object.defineProperties(image, {
      width: { value: 100, configurable: true },
      height: { value: 80, configurable: true },
      naturalWidth: { value: 100, configurable: true },
      naturalHeight: { value: 80, configurable: true },
      src: {
        configurable: true,
        get: () => source,
        set: (value: string) => {
          source = value
          image.onload?.call(image, new Event('load'))
        }
      }
    })
    return image
  } as any
  return () => {
    global.Image = OriginalImage
  }
}

describe('history integration', () => {
  let container: HTMLDivElement
  let board: VueFabric
  let OriginalResizeObserver: typeof ResizeObserver

  beforeEach(() => {
    OriginalResizeObserver = global.ResizeObserver
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
    container = createContainer()
    board = new VueFabric(container, {
      width: 800,
      height: 600,
      lockObjectVisualSizeOnZoom: true,
      defaultShowHelpers: false,
      autoResize: true,
      autoResizeMode: 'viewport',
      autoResizeFit: 'stretch',
      zoomAnimationDuration: 0
    })
    board.init()
    board.registerTool('select', new SelectTool())
    board.registerTool('area', new AreaTool())
    board.registerTool('line', new LineTool())
    board.registerTool('rect', new RectTool())
    board.canvas!.renderOnAddRemove = false
    vi.spyOn(board.canvas!, 'renderAll').mockReturnValue(board.canvas!)
    vi.spyOn(board.canvas!, 'requestRenderAll').mockReturnValue(board.canvas!)
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
    global.ResizeObserver = OriginalResizeObserver
  })

  it('undoes and redoes completed drawings one shape at a time', async () => {
    const points = [
      { x: 10, y: 10 },
      { x: 100, y: 100 },
      { x: 120, y: 120 },
      { x: 220, y: 220 }
    ]
    const getPointer = vi.spyOn(board.canvas!, 'getPointer')
    const click = () => board.currentTool!.onMouseDown({ e: new MouseEvent('mousedown') } as any)

    board.setTool('line')
    getPointer.mockReturnValue(points[0])
    click()
    getPointer.mockReturnValue(points[1])
    click()
    expect(board.canvas!.getObjects()).toHaveLength(4)

    board.setTool('line')
    getPointer.mockReturnValue(points[2])
    click()
    getPointer.mockReturnValue(points[3])
    click()
    expect(board.canvas!.getObjects()).toHaveLength(8)

    expect(board.undo()).toBe(true)
    await flushRestore()
    expect(board.canvas!.getObjects()).toHaveLength(4)

    expect(board.redo()).toBe(true)
    await flushRestore()
    expect(board.canvas!.getObjects()).toHaveLength(8)
  })

  it('undoes and redoes drawings one at a time after setting a background image', async () => {
    const restoreImage = mockLoadedImage()
    const points = [
      { x: 10, y: 10 },
      { x: 100, y: 100 },
      { x: 120, y: 120 },
      { x: 220, y: 220 }
    ]
    const getPointer = vi.spyOn(board.canvas!, 'getPointer')
    const click = () => board.currentTool!.onMouseDown({ e: new MouseEvent('mousedown') } as any)

    try {
      await board.setBackgroundImage({
        source: 'data:image/png;base64,mock',
        scaleMode: 'stretch'
      })
      board.resetZoom()

      board.setTool('line')
      getPointer.mockReturnValue(points[0])
      click()
      getPointer.mockReturnValue(points[1])
      click()

      board.setTool('line')
      getPointer.mockReturnValue(points[2])
      click()
      getPointer.mockReturnValue(points[3])
      click()
      expect(board.canvas!.getObjects()).toHaveLength(9)

      expect(board.undo()).toBe(true)
      await flushRestore()
      expect(board.canvas!.getObjects()).toHaveLength(5)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)

      expect(board.redo()).toBe(true)
      await flushRestore()
      expect(board.canvas!.getObjects()).toHaveLength(9)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)
    } finally {
      restoreImage()
    }
  })

  it('undoes and redoes areas one at a time after setting a background image', async () => {
    const restoreImage = mockLoadedImage()
    const getPointer = vi.spyOn(board.canvas!, 'getPointer')
    const drawArea = (points: Array<{ x: number; y: number }>) => {
      board.setTool('area')
      points.forEach(point => {
        getPointer.mockReturnValue(point)
        board.currentTool!.onMouseDown({
          e: new MouseEvent('mousedown', { button: 0 }),
          target: null
        } as any)
      })
      const startPoint = [...board.canvas!.getObjects()].reverse().find(obj => {
        const areaPoint = obj as typeof obj & { customType?: string; isStartPoint?: boolean }
        return areaPoint.customType === 'areaPoint' && areaPoint.isStartPoint
      })
      getPointer.mockReturnValue(points[0])
      board.currentTool!.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 }),
        target: startPoint
      } as any)
    }
    const getAreaCount = () =>
      board
        .canvas!.getObjects()
        .filter(obj => (obj as typeof obj & { customType?: string }).customType === 'area').length

    try {
      await board.setBackgroundImage({
        source: 'data:image/png;base64,mock',
        scaleMode: 'stretch'
      })
      board.resetZoom()
      drawArea([
        { x: 10, y: 10 },
        { x: 100, y: 10 },
        { x: 100, y: 100 }
      ])
      drawArea([
        { x: 120, y: 120 },
        { x: 220, y: 120 },
        { x: 220, y: 220 }
      ])
      expect(getAreaCount()).toBe(2)

      expect(board.undo()).toBe(true)
      await flushRestore()
      expect(getAreaCount()).toBe(1)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)

      expect(board.redo()).toBe(true)
      await flushRestore()
      expect(getAreaCount()).toBe(2)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)
    } finally {
      restoreImage()
    }
  })

  it('undoes and redoes rectangles one at a time after setting a background image', async () => {
    const restoreImage = mockLoadedImage()
    const getPointer = vi.spyOn(board.canvas!, 'getPointer')
    const click = (point: { x: number; y: number }) => {
      getPointer.mockReturnValue(point)
      board.currentTool!.onMouseDown({
        e: new MouseEvent('mousedown', { button: 0 })
      } as any)
    }
    const getRectCount = () =>
      board
        .canvas!.getObjects()
        .filter(obj => (obj as typeof obj & { customType?: string }).customType === 'rect').length

    try {
      await board.setBackgroundImage({
        source: 'data:image/png;base64,mock',
        scaleMode: 'stretch'
      })
      board.resetZoom()

      board.setTool('rect')
      click({ x: 10, y: 10 })
      click({ x: 100, y: 100 })
      board.setTool('rect')
      click({ x: 120, y: 120 })
      click({ x: 220, y: 220 })
      expect(getRectCount()).toBe(2)

      expect(board.undo()).toBe(true)
      await flushRestore()
      expect(getRectCount()).toBe(1)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)

      expect(board.redo()).toBe(true)
      await flushRestore()
      expect(getRectCount()).toBe(2)
      expect(
        board.canvas!.getObjects().filter(obj => obj === board.getBackgroundImage())
      ).toHaveLength(1)
    } finally {
      restoreImage()
    }
  })
})
