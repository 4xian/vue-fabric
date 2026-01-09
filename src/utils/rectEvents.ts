import type { Canvas, Rect, TPointerEvent, TPointerEventInfo } from 'fabric'
import type { RectCustomData } from '../../types'
import type EventBus from '../core/EventBus'
import { TOOL_MAPS } from './settings'

type RectWithCustomData = Rect & { customData: RectCustomData }

export function handleRectSelected(rect: RectWithCustomData, eventBus: EventBus): void {
  eventBus.emit('rect:selected', { ...rect.customData })
}

export function handleRectMouseDown(
  rect: RectWithCustomData,
  event: TPointerEventInfo<TPointerEvent>,
  canvas: Canvas,
  eventBus: EventBus,
  getCurrentToolName?: () => string
): void {
  const isCtrl = (event.e as MouseEvent).ctrlKey || (event.e as MouseEvent).metaKey
  const isDragTool = getCurrentToolName?.() === TOOL_MAPS.DRAG
  const config = rect.customData.originalOptions

  rect.set({
    hasControls: !isCtrl && isDragTool && config?.hasControls,
    hasBorders: !isCtrl && isDragTool && config?.hasBorders,
    lockMovementX: isCtrl || !isDragTool || config?.lockMovementX,
    lockMovementY: isCtrl || !isDragTool || config?.lockMovementY
  })
  canvas.renderAll()

  if (isDragTool) return
  eventBus.emit('rect:clicked', { ...rect.customData })
}

export function handleRectMoving(rect: RectWithCustomData, canvas: Canvas): void {
  const newLeft = rect.left || 0
  const newTop = rect.top || 0
  const width = rect.customData.width
  const height = rect.customData.height

  rect.customData.startPoint = { x: newLeft, y: newTop }
  rect.customData.endPoint = { x: newLeft + width, y: newTop + height }

  if (rect.customData.widthLabel) {
    rect.customData.widthLabel.set({ left: newLeft + width / 2, top: newTop })
    rect.customData.widthLabel.setCoords()
  }
  if (rect.customData.heightLabel) {
    rect.customData.heightLabel.set({ left: newLeft, top: newTop + height / 2 })
    rect.customData.heightLabel.setCoords()
  }

  canvas.renderAll()
}

export function handleRectScaling(rect: RectWithCustomData, canvas: Canvas): void {
  const scaleX = rect.scaleX || 1
  const scaleY = rect.scaleY || 1
  const newWidth = (rect.width || 0) * scaleX
  const newHeight = (rect.height || 0) * scaleY
  const newLeft = rect.left || 0
  const newTop = rect.top || 0

  rect.customData.width = newWidth
  rect.customData.height = newHeight
  rect.customData.startPoint = { x: newLeft, y: newTop }
  rect.customData.endPoint = { x: newLeft + newWidth, y: newTop + newHeight }

  if (rect.customData.widthLabel) {
    rect.customData.widthLabel.set({
      left: newLeft + newWidth / 2,
      top: newTop,
      text: `${newWidth.toFixed(1)}`
    })
    rect.customData.widthLabel.setCoords()
  }
  if (rect.customData.heightLabel) {
    rect.customData.heightLabel.set({
      left: newLeft,
      top: newTop + newHeight / 2,
      text: `${newHeight.toFixed(1)}`
    })
    rect.customData.heightLabel.setCoords()
  }

  canvas.renderAll()
}

export function handleRectModified(rect: RectWithCustomData, canvas: Canvas): void {
  const scaleX = rect.scaleX || 1
  const scaleY = rect.scaleY || 1
  const newWidth = (rect.width || 0) * scaleX
  const newHeight = (rect.height || 0) * scaleY

  rect.set({ width: newWidth, height: newHeight, scaleX: 1, scaleY: 1 })
  rect.setCoords()
  rect.customData.width = newWidth
  rect.customData.height = newHeight
  canvas.renderAll()
}

export function setupRectEvents(
  rect: RectWithCustomData,
  canvas: Canvas,
  eventBus: EventBus,
  getCurrentToolName?: () => string
): void {
  rect.on('selected', () => handleRectSelected(rect, eventBus))
  rect.on('mousedown', (event: TPointerEventInfo<TPointerEvent>) =>
    handleRectMouseDown(rect, event, canvas, eventBus, getCurrentToolName)
  )
  rect.on('moving', () => handleRectMoving(rect, canvas))
  rect.on('scaling', () => handleRectScaling(rect, canvas))
  rect.on('modified', () => handleRectModified(rect, canvas))
}
