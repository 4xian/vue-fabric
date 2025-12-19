import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, Circle, Line, Text, Rect } from 'fabric'
import type { Point, LineToolOptions, LineCustomData } from '../../types'
import BaseTool from './BaseTool'
import { calculateDistance, getMidPoint } from '../utils/geometry'
import { DEFAULT_LINETOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

interface LineUndoState {
  type: 'drawing' | 'complete'
  startPoint: Point
  endPoint?: Point
  startCircle: Circle
  endCircle?: Circle
  line?: Line & { customType: string; customData: LineCustomData }
  label?: Text
  drawId?: string
}

export default class LineTool extends BaseTool {
  protected override options: Required<LineToolOptions>
  private isDrawingState: boolean
  private startPoint: Point | null
  private endPoint: Point | null
  private startCircle: Circle | null
  private endCircle: Circle | null
  private previewLine: Line | null
  private previewLabel: Text | null
  private _hoverRect: Rect | null
  private _undoStack: LineUndoState[]
  private _redoStack: LineUndoState[]

  constructor(options: LineToolOptions = {}) {
    super('line', options)
    this.options = { ...DEFAULT_LINETOOL_OPTIONS, ...options } as Required<LineToolOptions>
    this.isDrawingState = false
    this.startPoint = null
    this.endPoint = null
    this.startCircle = null
    this.endCircle = null
    this.previewLine = null
    this.previewLabel = null
    this._hoverRect = null
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
    this._undoCompletedLine()
    return true
  }

  override redo(): boolean {
    if (this._redoStack.length === 0) return false
    this._redoLine()
    return true
  }

  private _undoDrawingStart(): void {
    if (!this.canvas || !this.startCircle || !this.startPoint) return

    this._clearPreview()
    const state: LineUndoState = {
      type: 'drawing',
      startPoint: { ...this.startPoint },
      startCircle: this.startCircle
    }
    this._redoStack.push(state)

    this.canvas.remove(this.startCircle)
    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _undoCompletedLine(): void {
    if (!this.canvas) return

    const state = this._undoStack.pop()!
    this._redoStack.push(state)

    if (state.line) this.canvas.remove(state.line)
    this.canvas.remove(state.startCircle)
    if (state.endCircle) this.canvas.remove(state.endCircle)
    if (state.label) this.canvas.remove(state.label)

    this.canvas.renderAll()
  }

  private _redoLine(): void {
    if (!this.canvas || !this.paintBoard) return

    const state = this._redoStack.pop()!

    if (state.type === 'drawing') {
      this.paintBoard.pauseHistory()
      this.isDrawingState = true
      this.startPoint = state.startPoint
      this.startCircle = state.startCircle
      this.canvas.add(this.startCircle)
      this.canvas.renderAll()
    } else {
      this._undoStack.push(state)
      this.canvas.add(state.startCircle)
      if (state.endCircle) this.canvas.add(state.endCircle)
      if (state.label) this.canvas.add(state.label)
      if (state.line) {
        this.canvas.add(state.line)
        state.line.customData.startCircle = state.startCircle
        state.line.customData.endCircle = state.endCircle!
        state.line.customData.label = state.label!
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

    this.startCircle = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: this.options.pointRadius,
      fill: this.options.pointFillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.helperStrokeWidth,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false
    })
    ;(this.startCircle as Circle & { customType: string }).customType = CustomType.LineHelper
    this.canvas.add(this.startCircle)
    this.canvas.renderAll()
  }

  private _updatePreview(pointer: Point): void {
    if (!this.canvas || !this.paintBoard || !this.startPoint) return
    this._clearPreview()

    this.previewLine = new fabric.Line(
      [this.startPoint.x, this.startPoint.y, pointer.x, pointer.y],
      {
        stroke: this.paintBoard.lineColor,
        strokeWidth: this.options.strokeWidth,
        selectable: false,
        evented: false
      }
    )
    this.canvas.add(this.previewLine)

    const distance = calculateDistance(this.startPoint, pointer)
    const midPoint = getMidPoint(this.startPoint, pointer)

    this.previewLabel = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    })
    this.canvas.add(this.previewLabel)
    this.canvas.renderAll()
  }

  private _clearPreview(): void {
    if (!this.canvas) return
    if (this.previewLine) {
      this.canvas.remove(this.previewLine)
      this.previewLine = null
    }
    if (this.previewLabel) {
      this.canvas.remove(this.previewLabel)
      this.previewLabel = null
    }
  }

  private _finishDrawing(point: Point): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus || !this.startPoint) return

    this._clearPreview()
    this.endPoint = point
    const drawId = generateDrawId()

    const line = new fabric.Line(
      [this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y],
      {
        stroke: this.paintBoard.lineColor,
        strokeWidth: this.options.strokeWidth,
        selectable: true,
        evented: true,
        hasBorders: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true,
        hoverCursor: 'pointer',
        moveCursor: 'pointer',
        perPixelTargetFind: this.options.perPixelTargetFind
      }
    )

    ;(
      this.startCircle as Circle & {
        customType: string
        customData: { drawId: string; drawPid: string }
      }
    ).customData = {
      drawId: generateDrawId(),
      drawPid: drawId
    }

    this.endCircle = new fabric.Circle({
      left: this.endPoint.x,
      top: this.endPoint.y,
      radius: this.options.pointRadius,
      fill: this.options.pointFillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: this.options.helperStrokeWidth,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false
    })
    ;(
      this.endCircle as Circle & {
        customType: string
        customData: { drawId: string; drawPid: string }
      }
    ).customType = CustomType.LineHelper
    ;(
      this.endCircle as Circle & {
        customType: string
        customData: { drawId: string; drawPid: string }
      }
    ).customData = {
      drawId: generateDrawId(),
      drawPid: drawId
    }
    this.canvas.add(this.endCircle)

    const distance = calculateDistance(this.startPoint, this.endPoint)
    const midPoint = getMidPoint(this.startPoint, this.endPoint)

    const label = new fabric.Text(`${distance.toFixed(1)}`, {
      left: midPoint.x,
      top: midPoint.y,
      fontSize: this.options.labelFontSize,
      fill: this.options.labelFillColor,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasBorders: false,
      hasControls: false
    })
    ;(
      label as Text & { customType: string; customData: { drawId: string; drawPid: string } }
    ).customType = CustomType.LineHelperLabel
    ;(
      label as Text & { customType: string; customData: { drawId: string; drawPid: string } }
    ).customData = {
      drawId: generateDrawId(),
      drawPid: drawId
    }
    this.canvas.add(label)

    const customData: LineCustomData = {
      drawId,
      startPoint: { ...this.startPoint },
      endPoint: { ...this.endPoint },
      distance,
      lineColor: this.paintBoard.lineColor,
      startCircle: this.startCircle!,
      endCircle: this.endCircle,
      label
    }

    ;(line as Line & { customType: string; customData: LineCustomData }).customType =
      CustomType.Line
    ;(line as Line & { customType: string; customData: LineCustomData }).customData = customData

    this.canvas.add(line)

    const shouldShowHelpers = this.options.defaultShowHelpers || this.paintBoard.isHelpersVisible()
    if (shouldShowHelpers) {
      this._bringHelpersToFront(customData)
    } else {
      this._hideHelpers(customData)
    }

    this._setupLineEvents(line as Line & { customType: string; customData: LineCustomData })

    this.eventBus.emit('line:created', {
      drawId: customData.drawId,
      startPoint: customData.startPoint,
      endPoint: customData.endPoint,
      distance: customData.distance
    })

    const completedState: LineUndoState = {
      type: 'complete',
      startPoint: { ...this.startPoint },
      endPoint: { ...this.endPoint },
      startCircle: this.startCircle!,
      endCircle: this.endCircle!,
      line: line as Line & { customType: string; customData: LineCustomData },
      label,
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

  private _setupLineEvents(line: Line & { customData: LineCustomData }): void {
    if (!this.eventBus) return

    let lastLeft = line.left || 0
    let lastTop = line.top || 0

    line.on('selected', () => {
      lastLeft = line.left || 0
      lastTop = line.top || 0
      this.eventBus!.emit('line:selected', {
        drawId: line.customData.drawId,
        startPoint: line.customData.startPoint,
        endPoint: line.customData.endPoint,
        distance: line.customData.distance
      })
    })

    line.on('mousedown', () => {
      lastLeft = line.left || 0
      lastTop = line.top || 0
      this.eventBus!.emit('line:clicked', {
        drawId: line.customData.drawId,
        startPoint: line.customData.startPoint,
        endPoint: line.customData.endPoint,
        distance: line.customData.distance
      })
    })

    line.on('moving', () => {
      const dx = (line.left || 0) - lastLeft
      const dy = (line.top || 0) - lastTop
      this._moveLineHelpers(line, dx, dy)
      lastLeft = line.left || 0
      lastTop = line.top || 0
    })
  }

  private _moveLineHelpers(
    line: Line & { customData: LineCustomData },
    dx: number,
    dy: number
  ): void {
    if (!this.canvas) return
    const data = line.customData

    if (data.startCircle) {
      data.startCircle.set({
        left: (data.startCircle.left || 0) + dx,
        top: (data.startCircle.top || 0) + dy
      })
      data.startCircle.setCoords()
    }

    if (data.endCircle) {
      data.endCircle.set({
        left: (data.endCircle.left || 0) + dx,
        top: (data.endCircle.top || 0) + dy
      })
      data.endCircle.setCoords()
    }

    if (data.label) {
      data.label.set({
        left: (data.label.left || 0) + dx,
        top: (data.label.top || 0) + dy
      })
      data.label.setCoords()
    }

    data.startPoint = {
      x: data.startPoint.x + dx,
      y: data.startPoint.y + dy
    }
    data.endPoint = {
      x: data.endPoint.x + dx,
      y: data.endPoint.y + dy
    }

    this.canvas.renderAll()
  }

  private _bringHelpersToFront(data: LineCustomData): void {
    if (!this.canvas) return
    if (data.startCircle) {
      data.startCircle.set({ visible: true, opacity: 1 })
      this.canvas.bringObjectToFront(data.startCircle)
    }
    if (data.endCircle) {
      data.endCircle.set({ visible: true, opacity: 1 })
      this.canvas.bringObjectToFront(data.endCircle)
    }
    if (data.label) {
      data.label.set({ visible: true, opacity: 1 })
      this.canvas.bringObjectToFront(data.label)
    }
  }

  private _hideHelpers(data: LineCustomData): void {
    if (data.startCircle) {
      data.startCircle.set({ visible: false })
    }
    if (data.endCircle) {
      data.endCircle.set({ visible: false })
    }
    if (data.label) {
      data.label.set({ visible: false })
    }
  }

  private _cancelDrawing(): void {
    if (!this.canvas) return
    this._clearPreview()

    if (this.startCircle) {
      this.canvas.remove(this.startCircle)
      this.startCircle = null
    }

    this._reset()
    this.paintBoard?.resumeHistory()
    this.canvas.renderAll()
  }

  private _reset(): void {
    this.isDrawingState = false
    this.startPoint = null
    this.endPoint = null
    this.startCircle = null
    this.endCircle = null
  }

  destroy(): void {
    this._cancelDrawing()
    super.destroy()
  }
}
