import { type Canvas, type Polygon, type TPointerEvent, type TPointerEventInfo } from 'fabric'
import * as fabric from 'fabric'
import type { AreaCustomData, Point } from '../../types'
import type EventBus from '../core/EventBus'
import { TOOL_MAPS } from './settings'
import { calculateDistance, getMidPoint } from './geometry'

type PolygonWithCustomData = Polygon & { customData: AreaCustomData }

export function handleAreaSelected(
  polygon: PolygonWithCustomData,
  eventBus: EventBus,
  lastPosition: { left: number; top: number }
): void {
  lastPosition.left = polygon.left || 0
  lastPosition.top = polygon.top || 0
  eventBus.emit('area:selected', {
    drawId: polygon.customData.drawId,
    points: polygon.customData.points,
    distances: polygon.customData.distances
  })
}

export function handleAreaMouseDown(
  polygon: PolygonWithCustomData,
  event: TPointerEventInfo<TPointerEvent>,
  canvas: Canvas,
  eventBus: EventBus,
  lastPosition: { left: number; top: number },
  getCurrentToolName?: () => string
): void {
  // const isCtrl = (event.e as MouseEvent).ctrlKey || (event.e as MouseEvent).metaKey
  const isDragTool = getCurrentToolName?.() === TOOL_MAPS.DRAG
  // const config = polygon.customData.originalOptions

  // polygon.set({
  //   hasControls: !isCtrl && isDragTool && config?.hasControls,
  //   // hasBorders: !isCtrl && isDragTool && config?.hasBorders,
  //   lockMovementX: isCtrl || !isDragTool || config?.lockMovementX,
  //   lockMovementY: isCtrl || !isDragTool || config?.lockMovementY
  // })

  lastPosition.left = polygon.left || 0
  lastPosition.top = polygon.top || 0
  canvas.renderAll()

  if (isDragTool) return
  eventBus.emit('area:clicked', {
    drawId: polygon.customData.drawId,
    points: polygon.customData.points,
    distances: polygon.customData.distances
  })
}

export function handleAreaMoving(
  polygon: PolygonWithCustomData,
  canvas: Canvas,
  lastPosition: { left: number; top: number }
): void {
  const dx = (polygon.left || 0) - lastPosition.left
  const dy = (polygon.top || 0) - lastPosition.top

  const data = polygon.customData

  data.circles?.forEach(circle => {
    circle.set({ left: (circle.left || 0) + dx, top: (circle.top || 0) + dy })
    circle.setCoords()
  })

  data.lines?.forEach(line => {
    line.set({
      x1: (line.x1 || 0) + dx,
      y1: (line.y1 || 0) + dy,
      x2: (line.x2 || 0) + dx,
      y2: (line.y2 || 0) + dy
    })
    line.setCoords()
  })

  data.labels?.forEach(label => {
    label.set({ left: (label.left || 0) + dx, top: (label.top || 0) + dy })
    label.setCoords()
  })

  data.points = data.points.map(p => ({ x: p.x + dx, y: p.y + dy }))

  lastPosition.left = polygon.left || 0
  lastPosition.top = polygon.top || 0

  canvas.renderAll()
}

export function handleAreaScaling(polygon: PolygonWithCustomData, canvas: Canvas): void {
  const data = polygon.customData
  // const scaleX = polygon.scaleX || 1
  // const scaleY = polygon.scaleY || 1
  const polygonPoints = polygon.points || []
  const pathOffset = polygon.pathOffset || { x: 0, y: 0 }

  const matrix = polygon.calcTransformMatrix()

  const newPoints: Point[] = polygonPoints.map(pt => {
    const localX = pt.x - pathOffset.x
    const localY = pt.y - pathOffset.y
    const x = matrix[0] * localX + matrix[2] * localY + matrix[4]
    const y = matrix[1] * localX + matrix[3] * localY + matrix[5]
    return { x, y }
  })

  data.circles?.forEach((circle, index) => {
    if (newPoints[index]) {
      circle.set({
        left: newPoints[index].x,
        top: newPoints[index].y,
        scaleX: 1,
        scaleY: 1
      })
      circle.setCoords()
    }
  })

  const newDistances: number[] = []
  data.lines?.forEach((line, index) => {
    const p1 = newPoints[index]
    const p2 = newPoints[(index + 1) % newPoints.length]
    if (p1 && p2) {
      line.set({
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        scaleX: 1,
        scaleY: 1
      })
      line.setCoords()
      newDistances.push(calculateDistance(p1, p2))
    }
  })

  data.labels?.forEach((label, index) => {
    const p1 = newPoints[index]
    const p2 = newPoints[(index + 1) % newPoints.length]
    if (p1 && p2) {
      const midPoint = getMidPoint(p1, p2)
      const distance = calculateDistance(p1, p2)
      label.set({
        left: midPoint.x,
        top: midPoint.y,
        text: `${distance.toFixed(1)}`,
        scaleX: 1,
        scaleY: 1
      })
      label.setCoords()
    }
  })

  data.points = newPoints
  if (newDistances.length > 0) {
    data.distances = newDistances
  }

  canvas.renderAll()
}

export function handleAreaModified(_polygon: PolygonWithCustomData, _canvas: Canvas): void {}

export function configureControls(polygon: Polygon, options: Partial<Polygon>): void {
  // polygon.setControlsVisibility({
  //   mtr: false
  // })
  polygon.set({
    cornerStyle: options.cornerStyle,
    cornerSize: options.cornerSize,
    cornerColor: options.cornerColor,
    borderColor: options.cornerColor,
    borderScaleFactor: options.borderScaleFactor,
    padding: options.padding
  })
  polygon.hasBorders = false
  polygon.controls = fabric.controlsUtils.createPolyControls(polygon)
}

export function setupAreaEvents(
  polygon: PolygonWithCustomData,
  canvas: Canvas,
  eventBus: EventBus,
  getCurrentToolName?: () => string
): void {
  const lastPosition = { left: polygon.left || 0, top: polygon.top || 0 }

  polygon.on('selected', () => handleAreaSelected(polygon, eventBus, lastPosition))

  polygon.on('mousedown', (event: TPointerEventInfo<TPointerEvent>) =>
    handleAreaMouseDown(polygon, event, canvas, eventBus, lastPosition, getCurrentToolName)
  )

  polygon.on('moving', () => handleAreaMoving(polygon, canvas, lastPosition))

  polygon.on('scaling', () => handleAreaScaling(polygon, canvas))

  // polygon.on('modified', () => handleAreaModified(polygon, canvas))

  const onCanvasMouseMove = () => {
    const transform = (
      canvas as Canvas & { _currentTransform?: { target?: Polygon; action?: string } }
    )._currentTransform
    if (transform?.target === polygon && transform?.action === 'modifyPoly') {
      handleAreaScaling(polygon, canvas)
    }
  }
  canvas.on('mouse:move', onCanvasMouseMove)

  polygon.on('removed', () => {
    canvas.off('mouse:move', onCanvasMouseMove)
  })
}
