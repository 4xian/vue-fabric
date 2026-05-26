import { vi } from 'vitest'
import type { Canvas, FabricObject } from 'fabric'

export interface MockCanvas {
  getWidth: () => number
  getHeight: () => number
  getZoom: () => number
  setZoom: (zoom: number) => void
  zoomToPoint: (point: { x: number; y: number }, zoom: number) => void
  setViewportTransform: (transform: number[]) => void
  viewportTransform: number[]
  lowerCanvasEl?: { clientWidth: number; clientHeight: number; style?: Record<string, string> }
  upperCanvasEl?: { clientWidth: number; clientHeight: number; style?: Record<string, string> }
  wrapperEl?: { clientWidth: number; clientHeight: number; style?: Record<string, string> }
  getObjects: () => FabricObject[]
  add: (...objects: FabricObject[]) => void
  remove: (...objects: FabricObject[]) => void
  sendObjectToBack: (object: FabricObject) => void
  bringObjectToFront: (object: FabricObject) => void
  moveObjectTo: (object: FabricObject, index: number) => boolean
  forEachObject: (callback: (obj: FabricObject) => void) => void
  discardActiveObject: () => void
  getActiveObject: () => FabricObject | null
  getActiveObjects: () => FabricObject[]
  getPointer: (e: any) => { x: number; y: number }
  toObject: (properties?: string[]) => any
  loadFromJSON: (json: string | object) => Promise<Canvas>
  renderAll: () => void
  on: (event: string, handler: (...args: unknown[]) => void) => void
  off: (event: string, handler?: (...args: unknown[]) => void) => void
  fire: (event: string, options?: any) => void
  setCursor: (cursor: string) => void
  selection: boolean
  defaultCursor: string
  requestRenderAll: () => void
  setDimensions: (dimensions: { width: number; height: number }) => void
  _eventHandlers: Map<string, Set<(...args: unknown[]) => void>>
  _objects: FabricObject[]
  _zoom: number
  _width: number
  _height: number
  _displayWidth: number
  _displayHeight: number
}

export function createMockCanvas(options: {
  width?: number
  height?: number
  zoom?: number
} = {}): MockCanvas {
  const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>()
  const objects: FabricObject[] = []
  let zoom = options.zoom ?? 1
  let width = options.width ?? 800
  let height = options.height ?? 800
  let displayWidth = width
  let displayHeight = height
  let viewportTransform = [1, 0, 0, 1, 0, 0]

  const moveObjectToIndex = (object: FabricObject, index: number): boolean => {
    const currentIndex = objects.indexOf(object)
    if (currentIndex < 0) return false

    const normalizedIndex = Math.max(0, Math.min(index, objects.length - 1))
    if (currentIndex === normalizedIndex) return true

    objects.splice(currentIndex, 1)
    objects.splice(normalizedIndex, 0, object)
    return true
  }

  const canvas: MockCanvas = {
    getWidth: vi.fn(() => width),
    getHeight: vi.fn(() => height),
    getZoom: vi.fn(() => zoom),
    setZoom: vi.fn((z: number) => {
      zoom = z
      canvas._zoom = z
    }),
    zoomToPoint: vi.fn((point: { x: number; y: number }, z: number) => {
      zoom = z
      canvas._zoom = z
    }),
    setViewportTransform: vi.fn((transform: number[]) => {
      viewportTransform = [...transform]
      zoom = transform[0]
      canvas._zoom = zoom
      canvas.viewportTransform = [...transform]
    }),
    viewportTransform,
    lowerCanvasEl: { clientWidth: displayWidth, clientHeight: displayHeight, style: {} },
    upperCanvasEl: { clientWidth: displayWidth, clientHeight: displayHeight, style: {} },
    wrapperEl: { clientWidth: displayWidth, clientHeight: displayHeight, style: {} },
    getObjects: vi.fn(() => objects),
    add: vi.fn((...objs: FabricObject[]) => {
      objects.push(...objs)
    }),
    remove: vi.fn((...objs: FabricObject[]) => {
      objs.forEach(obj => {
        const index = objects.indexOf(obj)
        if (index > -1) objects.splice(index, 1)
      })
    }),
    sendObjectToBack: vi.fn((object: FabricObject) => {
      moveObjectToIndex(object, 0)
    }),
    bringObjectToFront: vi.fn((object: FabricObject) => {
      moveObjectToIndex(object, objects.length - 1)
    }),
    moveObjectTo: vi.fn((object: FabricObject, index: number) => moveObjectToIndex(object, index)),
    forEachObject: vi.fn((callback: (obj: FabricObject) => void) => {
      objects.forEach(callback)
    }),
    discardActiveObject: vi.fn(),
    getActiveObject: vi.fn(() => null),
    getActiveObjects: vi.fn(() => []),
    getPointer: vi.fn((_e: any) => ({ x: 0, y: 0 })),
    toObject: vi.fn((_properties?: string[]) => ({
      version: '6.0.0',
      objects: objects.map(obj => ({ type: 'rect', ...obj }))
    })),
    loadFromJSON: vi.fn((json: string | object) => {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      objects.length = 0
      if (data.objects) {
        objects.push(...data.objects)
      }
      return Promise.resolve(canvas as unknown as Canvas)
    }),
    renderAll: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
      }
      eventHandlers.get(event)!.add(handler)
    }),
    off: vi.fn((event: string, handler?: (...args: unknown[]) => void) => {
      if (!eventHandlers.has(event)) return
      if (handler) {
        eventHandlers.get(event)!.delete(handler)
      } else {
        eventHandlers.delete(event)
      }
    }),
    fire: vi.fn((event: string, options?: any) => {
      if (!eventHandlers.has(event)) return
      eventHandlers.get(event)!.forEach(handler => handler(options))
    }),
    setCursor: vi.fn(),
    selection: true,
    defaultCursor: 'default',
    requestRenderAll: vi.fn(),
    setDimensions: vi.fn(
      (
        dimensions: { width: number; height: number },
        options?: { cssOnly?: boolean; backstoreOnly?: boolean }
      ) => {
        if (!options?.cssOnly) {
          width = dimensions.width
          height = dimensions.height
          canvas._width = width
          canvas._height = height
        }
        if (!options?.backstoreOnly) {
          displayWidth = dimensions.width
          displayHeight = dimensions.height
          canvas._displayWidth = displayWidth
          canvas._displayHeight = displayHeight
          if (canvas.lowerCanvasEl) {
            canvas.lowerCanvasEl.clientWidth = displayWidth
            canvas.lowerCanvasEl.clientHeight = displayHeight
          }
          if (canvas.upperCanvasEl) {
            canvas.upperCanvasEl.clientWidth = displayWidth
            canvas.upperCanvasEl.clientHeight = displayHeight
          }
          if (canvas.wrapperEl) {
            canvas.wrapperEl.clientWidth = displayWidth
            canvas.wrapperEl.clientHeight = displayHeight
          }
        }
      }
    ),
    _eventHandlers: eventHandlers,
    _objects: objects,
    _zoom: zoom,
    _width: width,
    _height: height,
    _displayWidth: displayWidth,
    _displayHeight: displayHeight
  }

  return canvas
}
