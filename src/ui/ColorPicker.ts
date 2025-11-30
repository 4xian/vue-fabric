import type { ColorPickerOptions, ColorState } from '../../types'

export default class ColorPicker {
  private options: Required<ColorPickerOptions>
  private element: HTMLDivElement | null
  private isVisible: boolean
  private currentColor: ColorState
  private _cleanupFns: (() => void)[]

  private saturationEl!: HTMLDivElement
  private saturationPointer!: HTMLDivElement
  private hueEl!: HTMLDivElement
  private huePointer!: HTMLDivElement
  private alphaEl!: HTMLDivElement
  private alphaPointer!: HTMLDivElement
  private alphaGradient!: HTMLDivElement
  private previewColor!: HTMLDivElement
  private inputR!: HTMLInputElement
  private inputG!: HTMLInputElement
  private inputB!: HTMLInputElement
  private inputA!: HTMLInputElement
  private inputHex!: HTMLInputElement

  constructor(options: ColorPickerOptions = {}) {
    this.options = {
      defaultColor: options.defaultColor || 'rgba(2, 167, 240, 1)',
      onChange: options.onChange || (() => {})
    }
    this.element = null
    this.isVisible = false
    this.currentColor = this._parseColor(this.options.defaultColor)
    this._cleanupFns = []
    this._init()
  }

  private _init(): void {
    this.element = document.createElement('div')
    this.element.className = 'color-picker-panel'
    this.element.style.display = 'none'
    this._createContent()
    this._bindEvents()
  }

  private _createContent(): void {
    if (!this.element) return

    this.element.innerHTML = `
      <div class="color-picker-main">
        <div class="color-picker-saturation">
          <div class="saturation-white"></div>
          <div class="saturation-black"></div>
          <div class="saturation-pointer"></div>
        </div>
        <div class="color-picker-hue">
          <div class="hue-pointer"></div>
        </div>
        <div class="color-picker-alpha">
          <div class="alpha-bg"></div>
          <div class="alpha-gradient"></div>
          <div class="alpha-pointer"></div>
        </div>
      </div>
      <div class="color-picker-inputs">
        <div class="input-group">
          <label>R</label>
          <input type="number" class="input-r" min="0" max="255" value="${this.currentColor.r}">
        </div>
        <div class="input-group">
          <label>G</label>
          <input type="number" class="input-g" min="0" max="255" value="${this.currentColor.g}">
        </div>
        <div class="input-group">
          <label>B</label>
          <input type="number" class="input-b" min="0" max="255" value="${this.currentColor.b}">
        </div>
        <div class="input-group">
          <label>A</label>
          <input type="number" class="input-a" min="0" max="100" step="1" value="${Math.round(this.currentColor.a * 100)}">
        </div>
      </div>
      <div class="color-picker-preview">
        <div class="preview-color"></div>
        <input type="text" class="preview-hex" value="${this._rgbaToHex(this.currentColor)}">
      </div>
    `

    this.saturationEl = this.element.querySelector('.color-picker-saturation')!
    this.saturationPointer = this.element.querySelector('.saturation-pointer')!
    this.hueEl = this.element.querySelector('.color-picker-hue')!
    this.huePointer = this.element.querySelector('.hue-pointer')!
    this.alphaEl = this.element.querySelector('.color-picker-alpha')!
    this.alphaPointer = this.element.querySelector('.alpha-pointer')!
    this.alphaGradient = this.element.querySelector('.alpha-gradient')!
    this.previewColor = this.element.querySelector('.preview-color')!
    this.inputR = this.element.querySelector('.input-r')!
    this.inputG = this.element.querySelector('.input-g')!
    this.inputB = this.element.querySelector('.input-b')!
    this.inputA = this.element.querySelector('.input-a')!
    this.inputHex = this.element.querySelector('.preview-hex')!

    this._updateUI()
  }

  private _bindEvents(): void {
    let isDraggingSaturation = false
    let isDraggingHue = false
    let isDraggingAlpha = false

    const onSaturationMove = (e: MouseEvent) => {
      if (!isDraggingSaturation) return
      this._handleSaturationChange(e)
    }

    const onHueMove = (e: MouseEvent) => {
      if (!isDraggingHue) return
      this._handleHueChange(e)
    }

    const onAlphaMove = (e: MouseEvent) => {
      if (!isDraggingAlpha) return
      this._handleAlphaChange(e)
    }

    const onMouseUp = () => {
      isDraggingSaturation = false
      isDraggingHue = false
      isDraggingAlpha = false
    }

    this.saturationEl.addEventListener('mousedown', (e) => {
      isDraggingSaturation = true
      this._handleSaturationChange(e)
    })

    this.hueEl.addEventListener('mousedown', (e) => {
      isDraggingHue = true
      this._handleHueChange(e)
    })

    this.alphaEl.addEventListener('mousedown', (e) => {
      isDraggingAlpha = true
      this._handleAlphaChange(e)
    })

    document.addEventListener('mousemove', onSaturationMove)
    document.addEventListener('mousemove', onHueMove)
    document.addEventListener('mousemove', onAlphaMove)
    document.addEventListener('mouseup', onMouseUp)

    this._cleanupFns = [
      () => document.removeEventListener('mousemove', onSaturationMove),
      () => document.removeEventListener('mousemove', onHueMove),
      () => document.removeEventListener('mousemove', onAlphaMove),
      () => document.removeEventListener('mouseup', onMouseUp)
    ]

    this.inputR.addEventListener('input', () => this._handleRGBInput())
    this.inputG.addEventListener('input', () => this._handleRGBInput())
    this.inputB.addEventListener('input', () => this._handleRGBInput())
    this.inputA.addEventListener('input', () => this._handleAlphaInput())
    this.inputHex.addEventListener('change', () => this._handleHexInput())
  }

  private _handleSaturationChange(e: MouseEvent): void {
    const rect = this.saturationEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))

    this.currentColor.s = x / rect.width
    this.currentColor.v = 1 - y / rect.height

    this._updateFromHSV()
  }

  private _handleHueChange(e: MouseEvent): void {
    const rect = this.hueEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))

    this.currentColor.h = (x / rect.width) * 360

    this._updateFromHSV()
  }

  private _handleAlphaChange(e: MouseEvent): void {
    const rect = this.alphaEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))

    this.currentColor.a = x / rect.width

    this._updateUI()
    this._emitChange()
  }

  private _handleRGBInput(): void {
    const r = parseInt(this.inputR.value) || 0
    const g = parseInt(this.inputG.value) || 0
    const b = parseInt(this.inputB.value) || 0

    this.currentColor.r = Math.max(0, Math.min(255, r))
    this.currentColor.g = Math.max(0, Math.min(255, g))
    this.currentColor.b = Math.max(0, Math.min(255, b))

    const hsv = this._rgbToHsv(this.currentColor.r, this.currentColor.g, this.currentColor.b)
    this.currentColor.h = hsv.h
    this.currentColor.s = hsv.s
    this.currentColor.v = hsv.v

    this._updateUI()
    this._emitChange()
  }

  private _handleAlphaInput(): void {
    const a = parseInt(this.inputA.value) || 0
    this.currentColor.a = Math.max(0, Math.min(100, a)) / 100

    this._updateUI()
    this._emitChange()
  }

  private _handleHexInput(): void {
    const hex = this.inputHex.value.trim()
    const rgb = this._hexToRgb(hex)
    if (rgb) {
      this.currentColor.r = rgb.r
      this.currentColor.g = rgb.g
      this.currentColor.b = rgb.b

      const hsv = this._rgbToHsv(rgb.r, rgb.g, rgb.b)
      this.currentColor.h = hsv.h
      this.currentColor.s = hsv.s
      this.currentColor.v = hsv.v

      this._updateUI()
      this._emitChange()
    }
  }

  private _updateFromHSV(): void {
    const rgb = this._hsvToRgb(this.currentColor.h, this.currentColor.s, this.currentColor.v)
    this.currentColor.r = rgb.r
    this.currentColor.g = rgb.g
    this.currentColor.b = rgb.b

    this._updateUI()
    this._emitChange()
  }

  private _updateUI(): void {
    const { h, s, v, r, g, b, a } = this.currentColor

    const hueColor = this._hsvToRgb(h, 1, 1)
    this.saturationEl.style.backgroundColor = `rgb(${hueColor.r}, ${hueColor.g}, ${hueColor.b})`

    this.saturationPointer.style.left = `${s * 100}%`
    this.saturationPointer.style.top = `${(1 - v) * 100}%`

    this.huePointer.style.left = `${(h / 360) * 100}%`

    this.alphaGradient.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`
    this.alphaPointer.style.left = `${a * 100}%`

    this.previewColor.style.backgroundColor = `rgba(${r},${g},${b},${a})`

    this.inputR.value = String(r)
    this.inputG.value = String(g)
    this.inputB.value = String(b)
    this.inputA.value = String(Math.round(a * 100))
    this.inputHex.value = this._rgbaToHex(this.currentColor)
  }

  private _emitChange(): void {
    if (this.options.onChange) {
      const { r, g, b, a } = this.currentColor
      this.options.onChange(`rgba(${r}, ${g}, ${b}, ${a})`)
    }
  }

  private _parseColor(color: string): ColorState {
    const result: ColorState = { r: 0, g: 0, b: 0, a: 1, h: 0, s: 0, v: 0 }

    if (color.startsWith('rgba')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/)
      if (match) {
        result.r = parseInt(match[1])
        result.g = parseInt(match[2])
        result.b = parseInt(match[3])
        result.a = match[4] !== undefined ? parseFloat(match[4]) : 1
      }
    } else if (color.startsWith('rgb')) {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (match) {
        result.r = parseInt(match[1])
        result.g = parseInt(match[2])
        result.b = parseInt(match[3])
      }
    } else if (color.startsWith('#')) {
      const rgb = this._hexToRgb(color)
      if (rgb) {
        result.r = rgb.r
        result.g = rgb.g
        result.b = rgb.b
      }
    }

    const hsv = this._rgbToHsv(result.r, result.g, result.b)
    result.h = hsv.h
    result.s = hsv.s
    result.v = hsv.v

    return result
  }

  private _rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    let h = 0
    const s = max === 0 ? 0 : d / max
    const v = max

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return { h: h * 360, s, v }
  }

  private _hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    h /= 360
    let r = 0, g = 0, b = 0
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)

    switch (i % 6) {
      case 0: r = v; g = t; b = p; break
      case 1: r = q; g = v; b = p; break
      case 2: r = p; g = v; b = t; break
      case 3: r = p; g = q; b = v; break
      case 4: r = t; g = p; b = v; break
      case 5: r = v; g = p; b = q; break
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    }
  }

  private _rgbaToHex(color: ColorState): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
  }

  private _hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  getElement(): HTMLDivElement | null {
    return this.element
  }

  show(): void {
    if (this.element) {
      this.element.style.display = 'block'
      this.isVisible = true
    }
  }

  hide(): void {
    if (this.element) {
      this.element.style.display = 'none'
      this.isVisible = false
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide()
    } else {
      this.show()
    }
  }

  setColor(color: string): void {
    this.currentColor = this._parseColor(color)
    this._updateUI()
  }

  getColor(): string {
    const { r, g, b, a } = this.currentColor
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  destroy(): void {
    if (this._cleanupFns) {
      this._cleanupFns.forEach(fn => fn())
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
  }
}
