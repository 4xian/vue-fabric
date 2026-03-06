import type { FabricObject } from 'fabric'

export function createMockFabricObject(options: {
  customType?: string
  customData?: any
  [key: string]: any
} = {}): FabricObject {
  return {
    customType: options.customType,
    customData: options.customData,
    ...options
  } as FabricObject
}

export function createMockLine(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'line',
    customType: 'line',
    ...options
  })
}

export function createMockCircle(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'circle',
    ...options
  })
}

export function createMockPolygon(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'polygon',
    customType: 'area',
    ...options
  })
}

export function createMockPath(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'path',
    customType: 'curve',
    ...options
  })
}

export function createMockText(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'text',
    customType: 'text',
    ...options
  })
}

export function createMockRect(options: any = {}): FabricObject {
  return createMockFabricObject({
    type: 'rect',
    customType: 'rect',
    ...options
  })
}
