import * as fabric from 'fabric'
import type { TPointerEventInfo, TPointerEvent, IText, FabricObject } from 'fabric'
import type { TextCustomData } from '../../types'
import BaseTool from './BaseTool'

export default class TextTool extends BaseTool {
  private defaultFontSize: number
  private defaultFontFamily: string

  constructor() {
    super('text')
    this.defaultFontSize = 16
    this.defaultFontFamily = 'Arial'
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'text'
    this.canvas.selection = false
    this.canvas.forEachObject((obj: FabricObject & { customType?: string }) => {
      if (obj.customType !== 'text') {
        obj.set({ selectable: false, evented: false })
      }
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = 'default'
    this.canvas.selection = true
    this.canvas.forEachObject((obj) => {
      obj.set({ selectable: true, evented: true })
    })
    this._exitAllEditing()
  }

  onMouseDown(opt: TPointerEventInfo<TPointerEvent>): void {
    const target = opt.target as FabricObject & { customType?: string }
    if (target && target.customType === 'text') {
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
      fontSize: this.defaultFontSize,
      fontFamily: this.defaultFontFamily,
      fill: this.paintBoard.lineColor,
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
      textId: `text-${Date.now()}`,
      createdAt: Date.now()
    }

    ;(text as IText & { customType: string; customData: TextCustomData }).customType = 'text'
    ;(text as IText & { customType: string; customData: TextCustomData }).customData = customData

    this.canvas.add(text)
    this.canvas.setActiveObject(text)
    text.enterEditing()
    text.selectAll()
    this.canvas.renderAll()

    this._bindTextEvents(text as IText & { customType: string; customData: TextCustomData })

    this.eventBus.emit('text:created', {
      textId: customData.textId,
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
        textId: textObj.customData.textId,
        text: textObj.text
      })
    })
  }

  private _exitAllEditing(): void {
    if (!this.canvas) return
    this.canvas.getObjects().forEach((obj) => {
      const itext = obj as IText
      if (itext.type === 'i-text' && itext.isEditing) {
        itext.exitEditing()
      }
    })
    this.canvas.renderAll()
  }

  setFontSize(size: number): void {
    if (!this.canvas) return
    this.defaultFontSize = size
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === 'text') {
      activeObject.set('fontSize', size)
      this.canvas.renderAll()
    }
  }

  setFontFamily(family: string): void {
    if (!this.canvas) return
    this.defaultFontFamily = family
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === 'text') {
      activeObject.set('fontFamily', family)
      this.canvas.renderAll()
    }
  }

  setTextColor(color: string): void {
    if (!this.canvas) return
    const activeObject = this.canvas.getActiveObject() as FabricObject & { customType?: string }
    if (activeObject && activeObject.customType === 'text') {
      activeObject.set('fill', color)
      this.canvas.renderAll()
    }
  }
}
