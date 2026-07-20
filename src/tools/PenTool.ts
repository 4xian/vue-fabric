import * as fabric from 'fabric'
import type { FabricObject, Path } from 'fabric'
import type { PenCustomData, PenToolOptions } from '../../types'
import BaseTool from './BaseTool'
import { DEFAULT_PENTOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'
import { applyLayerToObjects, normalizeLayer } from '../utils/layer'

type PenPath = Path & { customType?: string; customData?: PenCustomData }
type PathCreatedEvent = { path?: FabricObject }
type MouseBeforeEvent = { e?: Event }

export default class PenTool extends BaseTool {
  protected override options: Required<PenToolOptions>
  private _onBeforePathCreated: (event: PathCreatedEvent) => void
  private _onPathCreated: (event: PathCreatedEvent) => void
  private _onMouseDownBefore: (event: MouseBeforeEvent) => void
  private _historyPausedByPen: boolean

  constructor(options: PenToolOptions = {}) {
    super('pen', options)
    this.options = { ...DEFAULT_PENTOOL_OPTIONS, ...options } as Required<PenToolOptions>
    this._onBeforePathCreated = this._handleBeforePathCreated.bind(this)
    this._onPathCreated = this._handlePathCreated.bind(this)
    this._onMouseDownBefore = this._handleMouseDownBefore.bind(this)
    this._historyPausedByPen = false
  }

  onActivate(): void {
    if (!this.canvas) return

    this.canvas.selection = false
    this.canvas.isDrawingMode = true
    this._syncBrush()

    this.canvas.on('mouse:down:before', this._onMouseDownBefore)
    this.canvas.on('before:path:created', this._onBeforePathCreated)
    this.canvas.on('path:created', this._onPathCreated)

    this.canvas.forEachObject((obj: FabricObject & { customType?: string }) => {
      obj.set({ selectable: false, evented: false })
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return

    this.canvas.off('mouse:down:before', this._onMouseDownBefore)
    this.canvas.off('before:path:created', this._onBeforePathCreated)
    this.canvas.off('path:created', this._onPathCreated)
    this.canvas.isDrawingMode = false
    this.canvas.freeDrawingBrush = undefined
    this.canvas.selection = true

    const backgroundImage = this.paintBoard?.getBackgroundImage?.()
    this.canvas.forEachObject(obj => {
      if (obj === backgroundImage) return
      obj.set({ selectable: true, evented: true })
    })

    if (this._historyPausedByPen) {
      this.paintBoard?.resumeHistory()
      this._historyPausedByPen = false
    }
  }

  private _handleMouseDownBefore(event: MouseBeforeEvent): void {
    const mouseEvent = event.e as MouseEvent | undefined
    if (mouseEvent && mouseEvent.button !== 0) return
    this._syncBrush()
  }

  private _syncBrush(): void {
    if (!this.canvas || !this.paintBoard) return

    const brush =
      this.canvas.freeDrawingBrush instanceof fabric.PencilBrush
        ? this.canvas.freeDrawingBrush
        : new fabric.PencilBrush(this.canvas)

    brush.color = this.paintBoard.lineColor
    brush.width = this.options.strokeWidth
    brush.decimate = this.options.decimate
    brush.strokeLineCap = 'round'
    brush.strokeLineJoin = 'round'
    this.canvas.freeDrawingBrush = brush
  }

  setStrokeWidth(width: number): void {
    this.options.strokeWidth = width
    this._syncBrush()
  }

  private _handleBeforePathCreated(event: PathCreatedEvent): void {
    if (!this.paintBoard) return

    const path = event.path as PenPath | undefined
    if (!path) return

    if (!this.paintBoard.isHistoryPaused()) {
      this.paintBoard.pauseHistory()
      this._historyPausedByPen = true
    }

    const layer = normalizeLayer(this.options.defaultLayer)
    const customData: PenCustomData = {
      drawId: generateDrawId(),
      layer,
      lineColor: this.paintBoard.lineColor,
      strokeWidth: this.options.strokeWidth,
      createdAt: Date.now()
    }

    path.customType = CustomType.Pen
    path.customData = customData
    path.set({
      selectable: true,
      evented: true,
      hasBorders: this.options.hasBorders,
      hasControls: this.options.hasControls,
      lockMovementX: this.options.lockMovementX,
      lockMovementY: this.options.lockMovementY,
      perPixelTargetFind: this.options.perPixelTargetFind,
      hoverCursor: 'pointer',
      moveCursor: 'pointer'
    })
  }

  private _handlePathCreated(event: PathCreatedEvent): void {
    if (!this.canvas || !this.eventBus) return

    const path = event.path as PenPath | undefined
    if (path?.customData) {
      applyLayerToObjects(this.canvas, [path], path.customData.layer)
      this._bindPenEvents(path as PenPath & { customData: PenCustomData })
      this.eventBus.emit('pen:created', {
        drawId: path.customData.drawId,
        lineColor: path.customData.lineColor,
        strokeWidth: path.customData.strokeWidth,
        object: path
      })
    }

    if (this._historyPausedByPen) {
      this.paintBoard?.resumeHistory()
      this._historyPausedByPen = false
    }

    this.canvas.renderAll()
  }

  private _bindPenEvents(path: PenPath & { customData: PenCustomData }): void {
    if (!this.eventBus) return

    path.on('mousedown', () => {
      this.eventBus?.emit('pen:clicked', {
        drawId: path.customData.drawId,
        object: path
      })
    })

    path.on('selected', () => {
      this.eventBus?.emit('pen:selected', {
        drawId: path.customData.drawId,
        object: path
      })
    })

    path.on('modified', () => {
      this.eventBus?.emit('pen:modified', {
        drawId: path.customData.drawId,
        object: path
      })
    })
  }
}
