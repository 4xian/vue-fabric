import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Canvas } from 'fabric'
import { exportToJSON, importFromJSON } from '../../../src/utils/export'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { CustomType } from '../../../src/utils/settings'

describe('export utils', () => {
  let canvas: any
  let eventBus: EventBus

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
  })

  describe('exportToJSON', () => {
    it('应该导出画布 JSON 字符串', () => {
      const result = exportToJSON(canvas as unknown as Canvas)
      expect(typeof result).toBe('string')
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('应该接受数组形式的选项', () => {
      const result = exportToJSON(canvas as unknown as Canvas, ['customProp'])
      expect(typeof result).toBe('string')
    })

    it('应该接受对象形式的选项', () => {
      const result = exportToJSON(canvas as unknown as Canvas, {
        additionalProperties: ['customProp'],
        excludeTypes: ['text']
      })
      expect(typeof result).toBe('string')
    })
  })

  describe('importFromJSON', () => {
    it('应该从 JSON 字符串导入', async () => {
      const json = '{"objects":[],"background":""}'
      await expect(importFromJSON(canvas as unknown as Canvas, json, eventBus)).resolves.toBeUndefined()
    })

    it('应该从对象导入', async () => {
      const data = { objects: [], background: '' }
      await expect(importFromJSON(canvas as unknown as Canvas, data, eventBus)).resolves.toBeUndefined()
    })

    it('无效 JSON 应该抛出错误', async () => {
      await expect(importFromJSON(canvas as unknown as Canvas, 'invalid', eventBus)).rejects.toThrow()
    })

    it('应该在导入时重建折线 helper 关联并绑定事件', async () => {
      const polylineObj: any = {
        customType: CustomType.Polyline,
        customData: {
          drawId: 'polyline-1',
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 20 },
            { x: 30, y: 10 }
          ],
          distances: [14.1, 14.1],
          lineColor: '#f00'
        },
        on: vi.fn(),
        set: vi.fn(),
        left: 0,
        top: 0
      }

      const circle0: any = {
        customType: CustomType.PolylineHelper,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn(),
        setCoords: vi.fn()
      }
      const circle1: any = {
        customType: CustomType.PolylineHelper,
        customData: { drawPid: 'polyline-1', index: 1 },
        set: vi.fn(),
        setCoords: vi.fn()
      }
      const circle2: any = {
        customType: CustomType.PolylineHelper,
        customData: { drawPid: 'polyline-1', index: 2 },
        set: vi.fn(),
        setCoords: vi.fn()
      }
      const label0: any = {
        customType: CustomType.PolylineHelperLabel,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn(),
        setCoords: vi.fn()
      }
      const label1: any = {
        customType: CustomType.PolylineHelperLabel,
        customData: { drawPid: 'polyline-1', index: 1 },
        set: vi.fn(),
        setCoords: vi.fn()
      }

      await importFromJSON(
        canvas as unknown as Canvas,
        {
          objects: [polylineObj, circle2, label1, circle0, label0, circle1],
          background: ''
        },
        eventBus
      )

      expect(polylineObj.on).toHaveBeenCalledTimes(3)
      expect(polylineObj.customData.polyline).toBe(polylineObj)
      expect(polylineObj.customData.circles).toEqual([circle0, circle1, circle2])
      expect(polylineObj.customData.labels).toEqual([label0, label1])
    })
  })
})
