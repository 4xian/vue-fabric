import { describe, it, expect, beforeEach, vi } from 'vitest'
import ColorPicker from '../../../src/ui/ColorPicker'

describe('ColorPicker', () => {
  let colorPicker: ColorPicker
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  describe('构造函数', () => {
    it('应该使用默认配置创建', () => {
      colorPicker = new ColorPicker()
      expect(colorPicker).toBeDefined()
      expect(colorPicker.getElement()).toBeDefined()
    })

    it('应该使用自定义颜色创建', () => {
      colorPicker = new ColorPicker({ defaultColor: 'rgba(255, 0, 0, 1)' })
      expect(colorPicker.getColor()).toBe('rgba(255, 0, 0, 1)')
    })

    it('应该接受 onChange 回调', () => {
      const onChange = vi.fn()
      colorPicker = new ColorPicker({ onChange })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('显示和隐藏', () => {
    beforeEach(() => {
      colorPicker = new ColorPicker()
      container.appendChild(colorPicker.getElement()!)
    })

    it('初始状态应该是隐藏的', () => {
      const element = colorPicker.getElement()
      expect(element?.style.display).toBe('none')
    })

    it('show() 应该显示颜色选择器', () => {
      colorPicker.show()
      const element = colorPicker.getElement()
      expect(element?.style.display).toBe('block')
    })

    it('hide() 应该隐藏颜色选择器', () => {
      colorPicker.show()
      colorPicker.hide()
      const element = colorPicker.getElement()
      expect(element?.style.display).toBe('none')
    })

    it('toggle() 应该切换显示状态', () => {
      colorPicker.toggle()
      expect(colorPicker.getElement()?.style.display).toBe('block')
      colorPicker.toggle()
      expect(colorPicker.getElement()?.style.display).toBe('none')
    })
  })

  describe('颜色设置', () => {
    beforeEach(() => {
      colorPicker = new ColorPicker()
    })

    it('setColor() 应该更新颜色', () => {
      colorPicker.setColor('rgba(100, 150, 200, 0.5)')
      const color = colorPicker.getColor()
      expect(color).toContain('100')
      expect(color).toContain('150')
      expect(color).toContain('200')
    })

    it('getColor() 应该返回当前颜色', () => {
      const color = colorPicker.getColor()
      expect(color).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)/)
    })
  })

  describe('元素管理', () => {
    beforeEach(() => {
      colorPicker = new ColorPicker()
    })

    it('getElement() 应该返回 DOM 元素', () => {
      const element = colorPicker.getElement()
      expect(element).toBeInstanceOf(HTMLDivElement)
      expect(element?.className).toBe('color-picker-panel')
    })

    it('元素可以被添加到容器', () => {
      const element = colorPicker.getElement()
      container.appendChild(element!)
      expect(container.contains(element!)).toBe(true)
    })
  })

  describe('销毁', () => {
    beforeEach(() => {
      colorPicker = new ColorPicker()
      const element = colorPicker.getElement()
      container.appendChild(element!)
    })

    it('destroy() 应该移除元素', () => {
      const element = colorPicker.getElement()
      colorPicker.destroy()
      expect(container.contains(element!)).toBe(false)
    })
  })
})
