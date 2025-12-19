import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, IText, FabricObject } from 'fabric'
import type { TextCustomData, TextToolOptions, AddTextOptions } from '../../types'
import BaseTool from './BaseTool'
import { DEFAULT_TEXTTOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

export interface CreateTextResult {
  textObj: IText & { customType: string; customData: TextCustomData }
  customData: TextCustomData
}

export default class TextTool extends BaseTool {
  protected override options: Required<TextToolOptions>

  constructor(options: TextToolOptions = {}) {
    super('text', options)
    this.options = { ...DEFAULT_TEXTTOOL_OPTIONS, ...options } as Required<TextToolOptions>
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
    this.canvas.forEachObject((obj: FabricObject & { customType?: string }) => {
      if (obj.customType !== CustomType.Text) {
        obj.set({ selectable: false, evented: false })
      }
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.selection = true
    this.canvas.forEachObject(obj => {
      obj.set({ selectable: true, evented: true })
    })
    this._exitAllEditing()
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const target = opt.target as FabricObject & { customType?: string }
    if (target && target.customType === CustomType.Text) {
      return
    }

    this._exitAllEditing()

    const pointer = this.getPointer(opt)
    this._createText(pointer)
  }

  private _createText(pointer: { x: number; y: number }): void {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return

    const text = new fabric.IText('文本', {
      left: pointer.x,
      top: pointer.y,
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      fill: this.options.fill,
      editable: true,
      selectable: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'text',
      moveCursor: 'text'
    })

    const customData: TextCustomData = {
      drawId: generateDrawId(),
      createdAt: Date.now()
    }

    ;(text as IText & { customType: string; customData: TextCustomData }).customType =
      CustomType.Text
    ;(text as IText & { customType: string; customData: TextCustomData }).customData = customData

    this.canvas.add(text)
    this.canvas.setActiveObject(text)
    text.enterEditing()
    text.selectAll()
    this.canvas.renderAll()

    this._bindTextEvents(text as IText & { customType: string; customData: TextCustomData })

    this.eventBus.emit('text:created', {
      drawId: customData.drawId,
      text: text.text
    })
  }

  private _bindTextEvents(textObj: IText & { customData: TextCustomData }): void {
    if (!this.canvas || !this.eventBus) return

    textObj.on('editing:exited', () => {
      if (textObj.text?.trim() === '') {
        this.canvas!.remove(textObj)
        this.canvas!.renderAll()
      }
    })

    textObj.on('changed', () => {
      this.eventBus!.emit('text:changed', {
        drawId: textObj.customData.drawId,
        text: textObj.text
      })
    })

    textObj.on('mousedown', () => {
      this.eventBus!.emit('text:clicked', {
        drawId: textObj.customData.drawId,
        text: textObj.text,
        object: textObj
      })
    })

    textObj.on('selected', () => {
      this.eventBus!.emit('text:selected', {
        drawId: textObj.customData.drawId,
        text: textObj.text,
        object: textObj
      })
    })
  }

  private _exitAllEditing(): void {
    if (!this.canvas) return
    this.canvas.getObjects().forEach(obj => {
      const itext = obj as IText
      if (itext.type === 'i-text' && itext.isEditing) {
        itext.exitEditing()
      }
    })
    this.canvas.renderAll()
  }

  setFontSize(size: number): void {
    if (!this.canvas) return
    this.options.fontSize = size
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === CustomType.Text) {
      activeObject.set('fontSize', size)
      this.canvas.renderAll()
    }
  }

  setFontFamily(family: string): void {
    if (!this.canvas) return
    this.options.fontFamily = family
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === CustomType.Text) {
      activeObject.set('fontFamily', family)
      this.canvas.renderAll()
    }
  }

  setTextColor(color: string): void {
    if (!this.canvas) return
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === CustomType.Text) {
      activeObject.set('fill', color)
      this.canvas.renderAll()
    }
  }

  createTextAt(options: AddTextOptions): CreateTextResult | null {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return null

    const {
      x,
      y,
      text,
      editable = false,
      fontSize = options.fontSize || this.options.fontSize,
      fontFamily = this.options.fontFamily,
      fill = options.fill || this.options.fill,
      fontWeight = 'normal',
      fontStyle = 'normal',
      textAlign = 'left',
      selectable = true,
      hasControls = false,
      hasBorders = false,
      perPixelTargetFind = this.options.perPixelTargetFind,
      textOrigin = 'left'
    } = options

    const textObj = new fabric.IText(text, {
      left: x,
      top: y,
      fontSize,
      fontFamily,
      fill,
      fontWeight,
      fontStyle,
      textAlign,
      editable,
      selectable,
      hasControls,
      hasBorders,
      lockScalingFlip: true,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: editable ? 'text' : 'pointer',
      moveCursor: editable ? 'text' : 'move',
      perPixelTargetFind,
      originX: textOrigin
    })

    const customData: TextCustomData = {
      ...options,
      drawId: options.id || generateDrawId()
    }

    ;(textObj as IText & { customType: string; customData: TextCustomData }).customType =
      CustomType.Text
    ;(textObj as IText & { customType: string; customData: TextCustomData }).customData = customData

    this.canvas.add(textObj)
    this.canvas.renderAll()

    this._bindTextEvents(textObj as IText & { customType: string; customData: TextCustomData })

    this.eventBus.emit('text:created', {
      ...customData
    })

    return {
      textObj: textObj as IText & { customType: string; customData: TextCustomData },
      customData
    }
  }

  createTextWithoutRender(options: AddTextOptions): CreateTextResult | null {
    if (!this.canvas || !this.paintBoard || !this.eventBus) return null

    const {
      x,
      y,
      text,
      editable = false,
      fontSize = this.options.fontSize,
      fontFamily = this.options.fontFamily,
      fill = options.fill || this.options.fill,
      fontWeight = 'normal',
      fontStyle = 'normal',
      textAlign = 'left',
      selectable = true,
      hasControls = false,
      hasBorders = false,
      perPixelTargetFind = this.options.perPixelTargetFind,
      textOrigin = 'left'
    } = options

    const textObj = new fabric.IText(text, {
      left: x,
      top: y,
      fontSize,
      fontFamily,
      fill,
      fontWeight,
      fontStyle,
      textAlign,
      editable,
      selectable,
      hasControls,
      hasBorders,
      lockScalingFlip: true,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: editable ? 'text' : 'pointer',
      moveCursor: editable ? 'text' : 'move',
      perPixelTargetFind,
      originX: textOrigin
    })

    const customData: TextCustomData = {
      ...options,
      drawId: options.id || generateDrawId()
    }

    ;(textObj as IText & { customType: string; customData: TextCustomData }).customType =
      CustomType.Text
    ;(textObj as IText & { customType: string; customData: TextCustomData }).customData = customData

    this.canvas.add(textObj)
    this._bindTextEvents(textObj as IText & { customType: string; customData: TextCustomData })

    return {
      textObj: textObj as IText & { customType: string; customData: TextCustomData },
      customData
    }
  }
}
