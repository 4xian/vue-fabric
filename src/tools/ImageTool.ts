import * as fabric from 'fabric'
import type { FabricImage, FabricObject } from 'fabric'
import type { ImageToolOptions, AddImageOptions, ImageCustomData } from '../../types'
import BaseTool from './BaseTool'
import { DEFAULT_IMAGETOOL_OPTIONS, CustomType } from '../utils/settings'
import { generateDrawId } from '../utils/generateId'

export interface CreateImageResult {
  imageObj: FabricImage & { customType: string; customData: ImageCustomData }
  customData: ImageCustomData
}

export default class ImageTool extends BaseTool {
  protected override options: Required<ImageToolOptions>
  private _fileInput: HTMLInputElement | null

  constructor(options: ImageToolOptions = {}) {
    super('image', options)
    this.options = { ...DEFAULT_IMAGETOOL_OPTIONS, ...options } as Required<ImageToolOptions>
    this._fileInput = null
  }

  private _isBase64(str: string): boolean {
    return str.startsWith('data:')
  }

  private _convertToBase64(img: HTMLImageElement): string {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      return canvas.toDataURL('image/png')
    }
    return ''
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.selection = false
    this.canvas.forEachObject((obj: FabricObject & { customType?: string }) => {
      if (obj.customType !== CustomType.Image) {
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
  }

  openFileDialog(): void {
    if (!this._fileInput) {
      this._fileInput = document.createElement('input')
      this._fileInput.type = 'file'
      this._fileInput.accept = 'image/*'
      this._fileInput.style.display = 'none'
      document.body.appendChild(this._fileInput)

      this._fileInput.addEventListener('change', e => {
        const target = e.target as HTMLInputElement
        const file = target.files?.[0]
        if (file) {
          this._loadImageFromFile(file)
        }
        target.value = ''
      })
    }
    this._fileInput.click()
  }

  private _loadImageFromFile(file: File): void {
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target?.result as string
      if (src && this.canvas) {
        const canvasWidth = this.canvas.width || 800
        const canvasHeight = this.canvas.height || 600
        this.addImageAt({
          x: canvasWidth / 2,
          y: canvasHeight / 2,
          src
        })
      }
    }
    reader.readAsDataURL(file)
  }

  addImageAt(options: AddImageOptions): Promise<CreateImageResult | null> {
    return new Promise(resolve => {
      if (!this.canvas || !this.paintBoard || !this.eventBus) {
        resolve(null)
        return
      }

      const {
        id,
        x,
        y,
        src,
        base64,
        width,
        height,
        selectable = this.options.defaultSelectable,
        hasControls = this.options.defaultHasControls,
        hasBorders = this.options.defaultHasBorders,
        lockMovementX = this.options.defaultLockMovement,
        lockMovementY = this.options.defaultLockMovement,
        lockScalingX = this.options.defaultLockScaling,
        lockScalingY = this.options.defaultLockScaling,
        angle = 0,
        scaleX = 1,
        scaleY = 1,
        opacity = 1
      } = options

      const imageSource = base64 || src
      if (!imageSource) {
        console.error('Either src or base64 must be provided')
        resolve(null)
        return
      }

      const isBase64Input = base64 || this._isBase64(imageSource)

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        let finalScaleX = scaleX
        let finalScaleY = scaleY

        if (width && !height) {
          finalScaleX = width / img.width
          finalScaleY = finalScaleX
        } else if (height && !width) {
          finalScaleY = height / img.height
          finalScaleX = finalScaleY
        } else if (width && height) {
          finalScaleX = width / img.width
          finalScaleY = height / img.height
        }

        const fabricImg = new fabric.FabricImage(img, {
          left: x,
          top: y,
          angle,
          scaleX: finalScaleX,
          scaleY: finalScaleY,
          opacity,
          selectable,
          hasControls,
          lockMovementX,
          lockMovementY,
          lockScalingX,
          lockScalingY,
          hasBorders,
          lockScalingFlip: true,
          hoverCursor: 'pointer',
          originX: 'center',
          originY: 'center'
        })

        const base64Data = isBase64Input ? imageSource : this._convertToBase64(img)

        const customData: ImageCustomData = {
          drawId: id || generateDrawId(),
          createdAt: Date.now(),
          base64: base64Data
        }

        ;(
          fabricImg as FabricImage & { customType: string; customData: ImageCustomData }
        ).customType = CustomType.Image
        ;(
          fabricImg as FabricImage & { customType: string; customData: ImageCustomData }
        ).customData = customData

        this._bindImageEvents(fabricImg as FabricImage & { customData: ImageCustomData })

        this.canvas!.add(fabricImg)
        this.canvas!.renderAll()

        this.eventBus!.emit('image:created', {
          drawId: customData.drawId,
          x,
          y,
          base64: base64Data
        })

        resolve({
          imageObj: fabricImg as FabricImage & { customType: string; customData: ImageCustomData },
          customData
        })
      }

      img.onerror = () => {
        console.error('Failed to load image')
        resolve(null)
      }

      img.src = imageSource
    })
  }

  private _bindImageEvents(imageObj: FabricImage & { customData: ImageCustomData }): void {
    if (!this.canvas || !this.eventBus) return

    imageObj.on('mousedown', () => {
      this.eventBus!.emit('image:clicked', {
        id: imageObj.customData.drawId,
        object: imageObj
      })
    })

    imageObj.on('selected', () => {
      this.eventBus!.emit('image:selected', {
        type: 'image',
        id: imageObj.customData.drawId,
        object: imageObj
      })
    })

    imageObj.on('modified', () => {
      this.eventBus!.emit('image:modified', {
        id: imageObj.customData.drawId,
        object: imageObj
      })
    })
  }

  setAngle(id: string, angle: number): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set('angle', angle)
    this.canvas?.renderAll()
    this.eventBus?.emit('image:updated', { id, property: 'angle', value: angle })
    return true
  }

  setOpacity(id: string, opacity: number): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set('opacity', Math.max(0, Math.min(1, opacity)))
    this.canvas?.renderAll()
    this.eventBus?.emit('image:updated', { id, property: 'opacity', value: opacity })
    return true
  }

  setPosition(id: string, x: number, y: number): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set({ left: x, top: y })
    this.canvas?.renderAll()
    this.eventBus?.emit('image:updated', { id, property: 'position', value: { x, y } })
    return true
  }

  setScale(id: string, scaleX: number, scaleY?: number): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set({ scaleX, scaleY: scaleY ?? scaleX })
    this.canvas?.renderAll()
    this.eventBus?.emit('image:updated', {
      id,
      property: 'scale',
      value: { scaleX, scaleY: scaleY ?? scaleX }
    })
    return true
  }

  setSize(id: string, width: number, height?: number): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false

    const imgWidth = imageObj.width || 1
    const imgHeight = imageObj.height || 1

    const scaleX = width / imgWidth
    const scaleY = height ? height / imgHeight : scaleX

    imageObj.set({ scaleX, scaleY })
    this.canvas?.renderAll()
    this.eventBus?.emit('image:updated', {
      id,
      property: 'size',
      value: { width, height: height ?? width * (imgHeight / imgWidth) }
    })
    return true
  }

  setSelectable(id: string, selectable: boolean): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set('selectable', selectable)
    this.canvas?.renderAll()
    return true
  }

  setLockMovement(id: string, locked: boolean): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set({ lockMovementX: locked, lockMovementY: locked })
    this.canvas?.renderAll()
    return true
  }

  setLockScaling(id: string, locked: boolean): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set({ lockScalingX: locked, lockScalingY: locked })
    this.canvas?.renderAll()
    return true
  }

  setControls(id: string, hasControls: boolean, hasBorders?: boolean): boolean {
    const imageObj = this._findImageById(id)
    if (!imageObj) return false
    imageObj.set({
      hasControls,
      hasBorders: hasBorders ?? hasControls
    })
    this.canvas?.renderAll()
    return true
  }

  private _findImageById(id: string): FabricImage | null {
    if (!this.canvas) return null

    const objects = this.canvas.getObjects()
    for (const obj of objects) {
      const customObj = obj as FabricObject & { customType?: string; customData?: ImageCustomData }
      if (customObj.customType === CustomType.Image && customObj.customData?.drawId === id) {
        return obj as FabricImage
      }
    }
    return null
  }

  getImageById(id: string): FabricImage | null {
    return this._findImageById(id)
  }

  destroy(): void {
    if (this._fileInput && this._fileInput.parentNode) {
      this._fileInput.parentNode.removeChild(this._fileInput)
      this._fileInput = null
    }
    super.destroy()
  }
}
