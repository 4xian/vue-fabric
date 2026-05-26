import type {
  Canvas,
  FabricObject,
  FabricImage,
  Group,
  Line,
  Path,
  Polyline,
  Rect,
  Text
} from 'fabric'
import type {
  AreaCustomData,
  CurveCustomData,
  ImageCustomData,
  LineCustomData,
  PolylineCustomData,
  RectCustomData,
  TextCustomData
} from '../../types'
import { CustomType } from './settings'

type LayerCustomData = {
  layer?: number
  drawId?: string
  drawPid?: string
  familyId?: string
  rawRadius?: number
}

export type LayerableObject = FabricObject & {
  customType?: string
  customData?: LayerCustomData
}

type FamilyType =
  | 'area'
  | 'line'
  | 'polyline'
  | 'curve'
  | 'rect'
  | 'text'
  | 'image'
  | 'tracker'
  | 'other'

type FamilyEntry = {
  key: string
  type: FamilyType
  members: Array<{ object: LayerableObject; index: number }>
}

export const DEFAULT_LAYER = 0

function isFiniteLayer(layer: unknown): layer is number {
  return typeof layer === 'number' && Number.isFinite(layer)
}

export function normalizeLayer(layer?: number): number {
  return isFiniteLayer(layer) ? layer : DEFAULT_LAYER
}

export function getObjectLayer(object: LayerableObject | null | undefined): number {
  return normalizeLayer(object?.customData?.layer)
}

export function setObjectLayer(object: LayerableObject | null | undefined, layer?: number): void {
  if (!object) return
  object.customData = {
    ...(object.customData || {}),
    layer: normalizeLayer(layer)
  }
}

export function setObjectsLayer(
  objects: Array<LayerableObject | null | undefined>,
  layer?: number
): void {
  const normalizedLayer = normalizeLayer(layer)
  objects.forEach(object => {
    setObjectLayer(object, normalizedLayer)
  })
}

function isBackgroundImageObject(object: LayerableObject): object is FabricImage & LayerableObject {
  return (
    !object.customType &&
    object.type === 'image' &&
    (object as FabricImage).excludeFromExport === true &&
    (object as FabricImage).selectable === false &&
    (object as FabricImage).evented === false
  )
}

function getTrackerFamilyId(object: LayerableObject): string | null {
  if (
    (object.customType === CustomType.PersonMarker || object.customType === CustomType.TracePath) &&
    typeof object.customData?.familyId === 'string' &&
    object.customData.familyId
  ) {
    return object.customData.familyId
  }
  return null
}

function getFamilyDescriptor(
  object: LayerableObject,
  fallbackIndex: number
): { key: string; type: FamilyType } {
  const customType = object.customType
  const customData = object.customData || {}
  const trackerFamilyId = getTrackerFamilyId(object)

  if (trackerFamilyId) {
    return { key: `tracker:${trackerFamilyId}`, type: 'tracker' }
  }

  switch (customType) {
    case CustomType.Area:
      return customData.drawId
        ? { key: `area:${customData.drawId}`, type: 'area' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.AreaPoint:
    case CustomType.AreaLine:
    case CustomType.AreaLabel:
      return customData.drawPid
        ? { key: `area:${customData.drawPid}`, type: 'area' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Line:
      return customData.drawId
        ? { key: `line:${customData.drawId}`, type: 'line' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.LineHelper:
    case CustomType.LineHelperLabel:
      return customData.drawPid
        ? { key: `line:${customData.drawPid}`, type: 'line' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Polyline:
      return customData.drawId
        ? { key: `polyline:${customData.drawId}`, type: 'polyline' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.PolylineHelper:
    case CustomType.PolylineHelperLabel:
      return customData.drawPid
        ? { key: `polyline:${customData.drawPid}`, type: 'polyline' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Curve:
      return customData.drawId
        ? { key: `curve:${customData.drawId}`, type: 'curve' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.CurveHelper:
    case CustomType.CurveHelperLabel:
      return customData.drawPid
        ? { key: `curve:${customData.drawPid}`, type: 'curve' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Rect:
      return customData.drawId
        ? { key: `rect:${customData.drawId}`, type: 'rect' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.RectLabel:
      return customData.drawPid
        ? { key: `rect:${customData.drawPid}`, type: 'rect' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Text:
      return customData.drawId
        ? { key: `text:${customData.drawId}`, type: 'text' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    case CustomType.Image:
      return customData.drawId
        ? { key: `image:${customData.drawId}`, type: 'image' }
        : { key: `other:${fallbackIndex}`, type: 'other' }
    default:
      return { key: `other:${fallbackIndex}`, type: 'other' }
  }
}

function getFamilyMemberRank(type: FamilyType, object: LayerableObject): number {
  switch (type) {
    case 'area':
      switch (object.customType) {
        case CustomType.AreaLine:
          return 0
        case CustomType.Area:
          return 1
        case CustomType.AreaPoint:
          return 2
        case CustomType.AreaLabel:
          return 3
        default:
          return 4
      }
    case 'line':
      switch (object.customType) {
        case CustomType.Line:
          return 0
        case CustomType.LineHelper:
          return 1
        case CustomType.LineHelperLabel:
          return 2
        default:
          return 3
      }
    case 'polyline':
      switch (object.customType) {
        case CustomType.Polyline:
          return 0
        case CustomType.PolylineHelper:
          return 1
        case CustomType.PolylineHelperLabel:
          return 2
        default:
          return 3
      }
    case 'curve':
      switch (object.customType) {
        case CustomType.Curve:
          return 0
        case CustomType.CurveHelper:
          return 1
        case CustomType.CurveHelperLabel:
          return 2
        default:
          return 3
      }
    case 'rect':
      switch (object.customType) {
        case CustomType.Rect:
          return 0
        case CustomType.RectLabel:
          return 1
        default:
          return 2
      }
    case 'tracker':
      if (object.customType === CustomType.TracePath) return 0
      if (
        object.customType === CustomType.PersonMarker &&
        isFiniteLayer(object.customData?.rawRadius)
      ) {
        return 1
      }
      if (object.customType === CustomType.PersonMarker) return 2
      return 3
    default:
      return 0
  }
}

function isPreferredLayerAnchor(type: FamilyType, object: LayerableObject): boolean {
  switch (type) {
    case 'area':
      return object.customType === CustomType.Area
    case 'line':
      return object.customType === CustomType.Line
    case 'polyline':
      return object.customType === CustomType.Polyline
    case 'curve':
      return object.customType === CustomType.Curve
    case 'rect':
      return object.customType === CustomType.Rect
    case 'text':
      return object.customType === CustomType.Text
    case 'image':
      return object.customType === CustomType.Image
    case 'tracker':
      if (object.customType === CustomType.TracePath) return true
      if (object.customType !== CustomType.PersonMarker) return false
      return !isFiniteLayer(object.customData?.rawRadius)
    default:
      return false
  }
}

function getFamilyAnchorIndex(family: FamilyEntry): number {
  const preferred = family.members.find(member =>
    isPreferredLayerAnchor(family.type, member.object)
  )
  return preferred?.index ?? family.members[0]?.index ?? 0
}

function getFamilyLayer(family: FamilyEntry): number {
  const preferred = family.members.find(member =>
    isPreferredLayerAnchor(family.type, member.object)
  )
  if (preferred) {
    return getObjectLayer(preferred.object)
  }

  const explicit = family.members.find(member => isFiniteLayer(member.object.customData?.layer))
  if (explicit) {
    return getObjectLayer(explicit.object)
  }

  return DEFAULT_LAYER
}

function moveObjectToIndex(canvas: Canvas, object: LayerableObject, index: number): void {
  const layerCanvas = canvas as Canvas & {
    moveObjectTo?: (target: FabricObject, index: number) => boolean
    _objects?: FabricObject[]
  }

  if (typeof layerCanvas.moveObjectTo === 'function') {
    layerCanvas.moveObjectTo(object, index)
    return
  }

  if (!Array.isArray(layerCanvas._objects)) return

  const currentIndex = layerCanvas._objects.indexOf(object)
  if (currentIndex < 0 || currentIndex === index) return

  layerCanvas._objects.splice(currentIndex, 1)
  layerCanvas._objects.splice(index, 0, object)
}

export function reflowCanvasLayers(canvas: Canvas | null | undefined): void {
  if (!canvas) return

  const objects = canvas.getObjects() as LayerableObject[]
  if (objects.length <= 1) return

  const backgroundObjects = objects.filter(isBackgroundImageObject)
  const familyMap = new Map<string, FamilyEntry>()

  objects.forEach((object, index) => {
    if (isBackgroundImageObject(object)) return

    const descriptor = getFamilyDescriptor(object, index)
    const family = familyMap.get(descriptor.key)

    if (family) {
      family.members.push({ object, index })
      return
    }

    familyMap.set(descriptor.key, {
      key: descriptor.key,
      type: descriptor.type,
      members: [{ object, index }]
    })
  })

  const families = Array.from(familyMap.values()).sort((a, b) => {
    const layerDiff = getFamilyLayer(a) - getFamilyLayer(b)
    if (layerDiff !== 0) return layerDiff

    return getFamilyAnchorIndex(a) - getFamilyAnchorIndex(b)
  })

  let targetIndex = 0

  backgroundObjects.forEach(object => {
    moveObjectToIndex(canvas, object, targetIndex)
    targetIndex += 1
  })

  families.forEach(family => {
    const orderedMembers = [...family.members].sort((a, b) => {
      const rankDiff =
        getFamilyMemberRank(family.type, a.object) - getFamilyMemberRank(family.type, b.object)
      if (rankDiff !== 0) return rankDiff

      return a.index - b.index
    })

    orderedMembers.forEach(member => {
      moveObjectToIndex(canvas, member.object, targetIndex)
      targetIndex += 1
    })
  })
}

export function applyLayerToObjects(
  canvas: Canvas | null | undefined,
  objects: Array<LayerableObject | null | undefined>,
  layer?: number
): void {
  if (!canvas) return
  setObjectsLayer(objects, layer)
  reflowCanvasLayers(canvas)
}

export function applyLayerToCanvasObject(
  canvas: Canvas | null | undefined,
  object: LayerableObject | null | undefined,
  layer?: number
): void {
  if (!canvas || !object) return
  applyLayerToObjects(canvas, [object], layer)
}
