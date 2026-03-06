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
  getObjects: () => FabricObject[]
  add: (...objects: FabricObject[]) => void
  remove: (...objects: FabricObject[]) => void
  sendObjectToBack: (object: FabricObject) => void
  bringObjectToFront: (object: FabricObject) => void
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
  let viewportTransform = [1, 0, 0, 1, 0, 0]

  const canvas: MockCanvas = {
    getWidth: vi.fn(() => width),
    getHeight: vi.fn(() => height),
    getZoom: vi.fn(() => zoom),
    setZoom: vi.fn((z: number) => {
      zoom = z
    }),
    zoomToPoint: vi.fn((point: { x: number; y: number }, z: number) => {
      zoom = z
    }),
    setViewportTransform: vi.fn((transform: number[]) => {
      viewportTransform = [...transform]
    }),
    viewportTransform,
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
    sendObjectToBack: vi.fn(),
    bringObjectToFront: vi.fn(),
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
    setDimensions: vi.fn((dimensions: { width: number; height: number }) => {
      width = dimensions.width
      height = dimensions.height
    }),
    _eventHandlers: eventHandlers,
    _objects: objects,
    _zoom: zoom,
    _width: width,
    _height: height
  }

  return canvas
}
