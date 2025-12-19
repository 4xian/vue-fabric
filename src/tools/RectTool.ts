import * as fabric from 'fabric'
import type { Rect, Text, TPointerEvent, TPointerEventInfo } from 'fabric'
import type { Point, RectToolOptions, RectCustomData } from '../../types'
import BaseTool from './BaseTool'
import { CustomType, DEFAULT_RECTTOOL_OPTIONS } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

interface RectUndoState {
  type: 'drawing' | 'complete'
  startPoint: Point
  endPoint?: Point
  rect?: Rect & { customType: string; customData: RectCustomData }
  widthLabel?: Text
  heightLabel?: Text
  drawId?: string
}

export default class RectTool extends BaseTool {
  protected override options: Required<RectToolOptions>
  private isDrawingState: boolean
  private startPoint: Point | null
  private endPoint: Point | null
  private previewRect: Rect | null
  private previewWidthLabel: Text | null
  private previewHeightLabel: Text | null
  private _undoStack: RectUndoState[]
  private _redoStack: RectUndoState[]

  constructor(options: RectToolOptions = {}) {
    super('rect', options)
    this.options = { ...DEFAULT_RECTTOOL_OPTIONS, ...options } as Required<RectToolOptions>
    this.isDrawingState = false
    this.startPoint = null
    this.endPoint = null
    this.previewRect = null
    this.previewWidthLabel = null
    this.previewHeightLabel = null
    this._undoStack = []
    this._redoStack = []
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.selection = true
    this._clearPreview()
    if (this.isDrawingState) {
      this._cancelDrawing()
    }
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const evt = opt.e as MouseEvent
    if (evt.button !== 0) return

    const pointer = this.getPointer(opt)
    if (!pointer || isNaN(pointer.x) || isNaN(pointer.y)) return

    const point: Point = { x: pointer.x, y: pointer.y }

    if (!this.isDrawingState) {
      if (this._isPointInsideExistingRect(point)) {
        return
      }
      this._startDrawing(point)
    } else {
      this._finishDrawing(point)
    }
  }

  onMouseMove(opt: TPointerEventInfo<TPointerEvent>): void {
    if (!this.isDrawingState || !this.startPoint) return

    const pointer = this.getPointer(opt)
    this._updatePreview(pointer)
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._cancelDrawing()
    }
    // else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    //   e.preventDefault()
    //   this._cancelDrawing()
    // }
  }

  override isDrawing(): boolean {
    return this.isDrawingState
  }

  override canUndoTool(): boolean {
    return this.isDrawingState || this._undoStack.length > 0
  }

  override canRedoTool(): boolean {
    return this._redoStack.length > 0
  }

  override undo(): boolean {
    if (this.isDrawingState) {
      this._undoDrawingStart()
      return true
    }
    if (this._undoStack.length === 0) return false
    this._undoCompletedRect()
    return true
  }

  override redo(): boolean {
    if (this._redoStack.length === 0) return false
    this._redoRect()
    return true
  }

  private _isPointInsideExistingRect(point: Point): boolean {
    if (!this.canvas) return false

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as Rect & { customType?: string; customData?: RectCustomData }
      if (customObj.customType === CustomType.Rect && customObj.customData) {
        const data = customObj.customData
        const cornerSize = customObj.cornerSize || 5
        const expandSize = cornerSize / 2

        if (
          point.x >= data.startPoint.x - expandSize &&
          point.x <= data.endPoint.x + expandSize &&
          point.y >= data.startPoint.y - expandSize &&
          point.y <= data.endPoint.y + expandSize
        ) {
          this.eventBus?.emit('rect:clicked', {
            drawId: data.drawId,
            startPoint: data.startPoint,
            endPoint: data.endPoint,
            width: data.width,
            height: data.height
          })
          return true
        }
      }
    }
    return false
  }

  private _undoDrawingStart(): void {
    if (!this.canvas || !this.startPoint) return

    this._clearPreview()
    const state: RectUndoState = {
      type: 'drawing',
      startPoint: { ...this.startPoint }
    }
    this._redoStack.push(state)

    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _undoCompletedRect(): void {
    if (!this.canvas) return

    const state = this._undoStack.pop()!
    this._redoStack.push(state)

    if (state.rect) {
      if (state.widthLabel) this.canvas.remove(state.widthLabel)
      if (state.heightLabel) this.canvas.remove(state.heightLabel)
      this.canvas.remove(state.rect)
    }

    this.canvas.renderAll()
  }

  private _redoRect(): void {
    if (!this.canvas || !this.paintBoard) return

    const state = this._redoStack.pop()!

    if (state.type === 'drawing') {
      this.paintBoard.pauseHistory()
      this.isDrawingState = true
      this.startPoint = state.startPoint
      this.canvas.renderAll()
    } else {
      this._undoStack.push(state)
      if (state.rect) {
        this.canvas.add(state.rect)
        if (state.widthLabel) this.canvas.add(state.widthLabel)
        if (state.heightLabel) this.canvas.add(state.heightLabel)
        const shouldShow = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()
        if (shouldShow) {
          this._showHelpers(state.rect.customData)
        } else {
          this._hideHelpers(state.rect.customData)
        }
      }
      this.canvas.renderAll()
    }
  }

  private _startDrawing(point: Point): void {
    if (!this.canvas || !this.paintBoard) return

    this._redoStack = []
    this.paintBoard.pauseHistory()
    this.isDrawingState = true
    this.startPoint = point
  }

  private _updatePreview(pointer: Point): void {
    if (!this.canvas || !this.paintBoard || !this.startPoint) return
    this._clearPreview()

    const left = Math.min(this.startPoint.x, pointer.x)
    const top = Math.min(this.startPoint.y, pointer.y)
    const width = Math.abs(pointer.x - this.startPoint.x)
    const height = Math.abs(pointer.y - this.startPoint.y)

    this.previewRect = new fabric.Rect({
      left,
      top,
      width,
      height,
      fill: 'transparent',
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: false,
      evented: false
    })
    this.canvas.add(this.previewRect)

    const shouldShowHelpers = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()

    if (shouldShowHelpers) {
      this.previewWidthLabel = new fabric.Text(`${width.toFixed(1)}`, {
        left: left + width / 2,
        top: top,
        fontSize: this.options.labelFontSize,
        fill: this.options.labelFillColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      })
      this.canvas.add(this.previewWidthLabel)

      this.previewHeightLabel = new fabric.Text(`${height.toFixed(1)}`, {
        left: left,
        top: top + height / 2,
        fontSize: this.options.labelFontSize,
        fill: this.options.labelFillColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        angle: -90
      })
      this.canvas.add(this.previewHeightLabel)
    }

    this.canvas.renderAll()
  }

  private _clearPreview(): void {
    if (!this.canvas) return
    if (this.previewRect) {
      this.canvas.remove(this.previewRect)
      this.previewRect = null
    }
    if (this.previewWidthLabel) {
      this.canvas.remove(this.previewWidthLabel)
      this.previewWidthLabel = null
    }
    if (this.previewHeightLabel) {
      this.canvas.remove(this.previewHeightLabel)
      this.previewHeightLabel = null
    }
  }

  private _finishDrawing(point: Point): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus || !this.startPoint) return

    this._clearPreview()
    this.endPoint = point
    const drawId = generateDrawId()

    const left = Math.min(this.startPoint.x, this.endPoint.x)
    const top = Math.min(this.startPoint.y, this.endPoint.y)
    const width = Math.abs(this.endPoint.x - this.startPoint.x)
    const height = Math.abs(this.endPoint.y - this.startPoint.y)

    const fillColor = this.options.enableFill ? this.paintBoard.fillColor : null

    const rect = new fabric.Rect({
      left,
      top,
      width,
      height,
      fill: fillColor || 'transparent',
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      selectable: true,
      evented: true,
      hasBorders: this.options.hasBorders,
      hasControls: this.options.hasBorders,
      lockRotation: true,
      lockMovementX: this.options.lockMovementX,
      lockMovementY: this.options.lockMovementY,
      hoverCursor: 'pointer',
      moveCursor: 'pointer',
      perPixelTargetFind: this.options.perPixelTargetFind
    })

    this._configureControls(rect)

    const widthLabel = new fabric.Text(`${width.toFixed(1)}`, {
      left: left + width / 2,
      top: top,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    })
    ;(
      widthLabel as Text & {
        customType: string
        customData: { drawId: string; drawPid: string; labelType: string }
      }
    ).customType = CustomType.RectLabel
    ;(
      widthLabel as Text & {
        customType: string
        customData: { drawId: string; drawPid: string; labelType: string }
      }
    ).customData = {
      drawId: generateDrawId(),
      drawPid: drawId,
      labelType: 'width'
    }
    this.canvas.add(widthLabel)

    const heightLabel = new fabric.Text(`${height.toFixed(1)}`, {
      left: left,
      top: top + height / 2,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      angle: -90
    })
    ;(
      heightLabel as Text & {
        customType: string
        customData: { drawId: string; drawPid: string; labelType: string }
      }
    ).customType = CustomType.RectLabel
    ;(
      heightLabel as Text & {
        customType: string
        customData: { drawId: string; drawPid: string; labelType: string }
      }
    ).customData = {
      drawId: generateDrawId(),
      drawPid: drawId,
      labelType: 'height'
    }
    this.canvas.add(heightLabel)

    const customData: RectCustomData = {
      drawId,
      startPoint: { x: left, y: top },
      endPoint: { x: left + width, y: top + height },
      width,
      height,
      lineColor: this.paintBoard.lineColor,
      fillColor,
      widthLabel,
      heightLabel
    }

    ;(rect as Rect & { customType: string; customData: RectCustomData }).customType =
      CustomType.Rect
    ;(rect as Rect & { customType: string; customData: RectCustomData }).customData = customData

    this.canvas.add(rect)

    const shouldShowHelpers = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()
    if (shouldShowHelpers) {
      this._showHelpers(customData)
    } else {
      this._hideHelpers(customData)
    }

    this._setupRectEvents(rect as Rect & { customType: string; customData: RectCustomData })

    this.eventBus.emit('rect:created', {
      drawId: customData.drawId,
      startPoint: customData.startPoint,
      endPoint: customData.endPoint,
      width: customData.width,
      height: customData.height
    })

    const completedState: RectUndoState = {
      type: 'complete',
      startPoint: { ...this.startPoint },
      endPoint: { ...this.endPoint },
      rect: rect as Rect & { customType: string; customData: RectCustomData },
      widthLabel,
      heightLabel,
      drawId
    }
    this._undoStack.push(completedState)

    this._reset()
    this.paintBoard.resumeHistory()
    this.canvas.renderAll()
    if (!this.options.continueDraw) {
      this.paintBoard.setTool('select')
    }
  }

  private _configureControls(rect: Rect): void {
    rect.setControlsVisibility({
      mtr: false,
      ml: true,
      mr: true,
      mt: true,
      mb: true,
      tl: true,
      tr: true,
      bl: true,
      br: true
    })
    rect.set({
      cornerStyle: this.options.cornerStyle,
      cornerSize: this.options.cornerSize
    })
  }

  private _showHelpers(data: RectCustomData): void {
    if (!this.canvas) return
    if (data.widthLabel) {
      data.widthLabel.set({ visible: true, opacity: 1 })
      this.canvas.bringObjectToFront(data.widthLabel)
    }
    if (data.heightLabel) {
      data.heightLabel.set({ visible: true, opacity: 1 })
      this.canvas.bringObjectToFront(data.heightLabel)
    }
  }

  private _hideHelpers(data: RectCustomData): void {
    if (data.widthLabel) {
      data.widthLabel.set({ visible: false })
    }
    if (data.heightLabel) {
      data.heightLabel.set({ visible: false })
    }
  }

  private _setupRectEvents(rect: Rect & { customData: RectCustomData }): void {
    if (!this.eventBus) return

    rect.on('selected', () => {
      this.eventBus!.emit('rect:selected', {
        drawId: rect.customData.drawId,
        startPoint: rect.customData.startPoint,
        endPoint: rect.customData.endPoint,
        width: rect.customData.width,
        height: rect.customData.height
      })
    })

    rect.on('mousedown', () => {
      this.eventBus!.emit('rect:clicked', {
        drawId: rect.customData.drawId,
        startPoint: rect.customData.startPoint,
        endPoint: rect.customData.endPoint,
        width: rect.customData.width,
        height: rect.customData.height
      })
    })

    rect.on('moving', () => {
      const newLeft = rect.left || 0
      const newTop = rect.top || 0
      const width = rect.customData.width
      const height = rect.customData.height

      rect.customData.startPoint = { x: newLeft, y: newTop }
      rect.customData.endPoint = { x: newLeft + width, y: newTop + height }

      if (rect.customData.widthLabel) {
        rect.customData.widthLabel.set({
          left: newLeft + width / 2,
          top: newTop
        })
        rect.customData.widthLabel.setCoords()
      }
      if (rect.customData.heightLabel) {
        rect.customData.heightLabel.set({
          left: newLeft,
          top: newTop + height / 2
        })
        rect.customData.heightLabel.setCoords()
      }

      this.canvas?.renderAll()
    })

    rect.on('scaling', () => {
      const scaleX = rect.scaleX || 1
      const scaleY = rect.scaleY || 1
      const newWidth = (rect.width || 0) * scaleX
      const newHeight = (rect.height || 0) * scaleY
      const newLeft = rect.left || 0
      const newTop = rect.top || 0

      rect.customData.width = newWidth
      rect.customData.height = newHeight
      rect.customData.startPoint = { x: newLeft, y: newTop }
      rect.customData.endPoint = {
        x: newLeft + newWidth,
        y: newTop + newHeight
      }

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

      this.canvas?.renderAll()
    })

    rect.on('modified', () => {
      const scaleX = rect.scaleX || 1
      const scaleY = rect.scaleY || 1
      const newWidth = (rect.width || 0) * scaleX
      const newHeight = (rect.height || 0) * scaleY

      rect.set({
        width: newWidth,
        height: newHeight,
        scaleX: 1,
        scaleY: 1
      })
      rect.setCoords()

      rect.customData.width = newWidth
      rect.customData.height = newHeight

      this.canvas?.renderAll()
    })
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this._clearPreview()
    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _reset(): void {
    this.isDrawingState = false
    this.startPoint = null
    this.endPoint = null
  }

  destroy(): void {
    this._cancelDrawing()
    super.destroy()
  }
}
