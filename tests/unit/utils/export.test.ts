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

    it('遇到 customData 循环引用时不应导出爆栈', () => {
      const cyclicObject: any = {
        customType: CustomType.Line,
        strokeWidth: 1
      }
      cyclicObject.customData = { self: cyclicObject }
      cyclicObject.zoomInvariantBase = { strokeWidth: 2 }

      canvas.toObject = vi.fn(() => ({
        version: '6.0.0',
        objects: [cyclicObject]
      }))

      const json = exportToJSON(canvas as unknown as Canvas, {
        excludeTypes: []
      })
      const data = JSON.parse(json)

      expect(data.objects[0].strokeWidth).toBe(2)
      expect(data.objects[0].customData.self).toBeUndefined()
    })

    it('导出主对象时应剥离运行时 helper 引用，只保留逻辑真值', () => {
      canvas.toObject = vi.fn(() => ({
        version: '6.0.0',
        objects: [
          {
            customType: CustomType.Rect,
            customData: {
              drawId: 'rect-1',
              startPoint: { x: 10, y: 10 },
              endPoint: { x: 110, y: 60 },
              width: 100,
              height: 50,
              lineColor: '#f00',
              fillColor: '#0f0',
              widthLabel: { customType: CustomType.RectLabel },
              heightLabel: { customType: CustomType.RectLabel }
            }
          },
          {
            customType: CustomType.Polyline,
            customData: {
              drawId: 'polyline-1',
              points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
              distances: [14.1],
              lineColor: '#f00',
              circles: [{ customType: CustomType.PolylineHelper }],
              labels: [{ customType: CustomType.PolylineHelperLabel }],
              polyline: { customType: CustomType.Polyline }
            }
          },
          {
            customType: CustomType.Area,
            customData: {
              drawId: 'area-1',
              points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
              distances: [10, 10, 14.1],
              lineColor: '#f00',
              fillColor: '#0f0',
              lines: [{ customType: CustomType.AreaLine }],
              circles: [{ customType: CustomType.AreaPoint }],
              labels: [{ customType: CustomType.AreaLabel }]
            }
          }
        ]
      }))

      const json = exportToJSON(canvas as unknown as Canvas, {
        excludeTypes: []
      })
      const data = JSON.parse(json)

      expect(data.objects[0].customData.widthLabel).toBeUndefined()
      expect(data.objects[0].customData.heightLabel).toBeUndefined()
      expect(data.objects[1].customData.circles).toBeUndefined()
      expect(data.objects[1].customData.labels).toBeUndefined()
      expect(data.objects[1].customData.polyline).toBeUndefined()
      expect(data.objects[2].customData.lines).toBeUndefined()
      expect(data.objects[2].customData.circles).toBeUndefined()
      expect(data.objects[2].customData.labels).toBeUndefined()
    })

    it('导出前应先裁掉 live 对象上的 helper 引用，避免 toObject 因运行时引用炸栈', () => {
      const originalCustomData = {
        drawId: 'area-1',
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
        distances: [10, 10, 14.1],
        lineColor: '#f00',
        fillColor: '#0f0',
        lines: [{ customType: CustomType.AreaLine }],
        circles: [{ customType: CustomType.AreaPoint }],
        labels: [{ customType: CustomType.AreaLabel }]
      }
      const liveAreaObject: any = {
        customType: CustomType.Area,
        customData: originalCustomData
      }

      canvas.getObjects = vi.fn(() => [liveAreaObject])
      canvas.toObject = vi.fn(() => {
        if ('lines' in liveAreaObject.customData) {
          throw new RangeError('Maximum call stack size exceeded')
        }
        return {
          version: '6.0.0',
          objects: [
            {
              customType: CustomType.Area,
              customData: { ...liveAreaObject.customData }
            }
          ]
        }
      })

      expect(() =>
        exportToJSON(canvas as unknown as Canvas, {
          excludeTypes: []
        })
      ).not.toThrow()
      expect(liveAreaObject.customData).toBe(originalCustomData)
      expect(canvas.toObject).toHaveBeenCalledTimes(1)
    })

    it('should export pen customData without runtime-only fields', () => {
      canvas.toObject = vi.fn(() => ({
        version: '6.0.0',
        objects: [
          {
            customType: CustomType.Pen,
            customData: {
              drawId: 'pen-1',
              layer: 2,
              lineColor: '#f00',
              strokeWidth: 3,
              createdAt: 100,
              runtimeObject: {}
            }
          }
        ]
      }))

      const json = exportToJSON(canvas as unknown as Canvas)
      const data = JSON.parse(json)

      expect(data.objects[0].customData).toEqual({
        drawId: 'pen-1',
        layer: 2,
        lineColor: '#f00',
        strokeWidth: 3,
        createdAt: 100
      })
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

    it('导入后 rect 缺 originalOptions 也应补齐运行时字段，不再点击炸掉', async () => {
      const handlers: Record<string, Function> = {}
      const rectObj: any = {
        customType: CustomType.Rect,
        customData: {
          drawId: 'rect-1',
          startPoint: { x: 10, y: 10 },
          endPoint: { x: 110, y: 60 },
          width: 100,
          height: 50,
          lineColor: '#f00',
          fillColor: '#0f0'
        },
        on: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler
        }),
        set: vi.fn(),
        setControlsVisibility: vi.fn()
      }

      await importFromJSON(
        canvas as unknown as Canvas,
        {
          objects: [rectObj],
          background: ''
        },
        eventBus
      )

      expect(rectObj.customData.originalOptions).toEqual(
        expect.objectContaining({
          hasControls: true,
          hasBorders: true,
          lockMovementX: false,
          lockMovementY: false
        })
      )
      expect(() =>
        handlers.mousedown({
          e: new MouseEvent('mousedown', { button: 0 })
        })
      ).not.toThrow()
      expect(rectObj.set).toHaveBeenCalled()
    })

    it('导入后应重建 polyline / curve / area 的 helper 引用与 runtime customData', async () => {
      const polylineObj: any = {
        customType: CustomType.Polyline,
        customData: {
          drawId: 'polyline-1',
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          distances: [14.1],
          lineColor: '#f00'
        },
        on: vi.fn(),
        set: vi.fn(),
        left: 0,
        top: 0
      }
      const curveObj: any = {
        customType: CustomType.Curve,
        customData: {
          drawId: 'curve-1',
          points: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
          isClosed: false,
          lineColor: '#0f0',
          fillColor: null
        },
        on: vi.fn(),
        set: vi.fn(),
        left: 0,
        top: 0
      }
      const areaObj: any = {
        customType: CustomType.Area,
        points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
        customData: {
          drawId: 'area-1',
          points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
          distances: [20, 20, 28.3],
          lineColor: '#00f',
          fillColor: '#0ff'
        },
        on: vi.fn(),
        setCoords: vi.fn(),
        set: vi.fn()
      }

      const areaLine: any = {
        customType: CustomType.AreaLine,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const areaPoint: any = {
        customType: CustomType.AreaPoint,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const areaLabel: any = {
        customType: CustomType.AreaLabel,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const polylineCircle: any = {
        customType: CustomType.PolylineHelper,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn()
      }
      const polylineLabel: any = {
        customType: CustomType.PolylineHelperLabel,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn()
      }
      const curveCircle: any = {
        customType: CustomType.CurveHelper,
        customData: { drawPid: 'curve-1' },
        set: vi.fn()
      }
      const curveLabel: any = {
        customType: CustomType.CurveHelperLabel,
        customData: { drawPid: 'curve-1' },
        set: vi.fn()
      }

      await importFromJSON(
        canvas as unknown as Canvas,
        {
          objects: [
            areaObj,
            areaLine,
            areaPoint,
            areaLabel,
            polylineObj,
            polylineCircle,
            polylineLabel,
            curveObj,
            curveCircle,
            curveLabel
          ],
          background: ''
        },
        eventBus
      )

      expect(areaObj.customData.originalOptions).toEqual(
        expect.objectContaining({
          hasControls: true,
          hasBorders: true
        })
      )
      expect(areaObj.customData.lines).toEqual([areaLine])
      expect(areaObj.customData.circles).toEqual([areaPoint])
      expect(areaObj.customData.labels).toEqual([areaLabel])
      expect(polylineObj.customData.polyline).toBe(polylineObj)
      expect(polylineObj.customData.circles).toEqual([polylineCircle])
      expect(polylineObj.customData.labels).toEqual([polylineLabel])
      expect(curveObj.customData.circles).toEqual([curveCircle])
      expect(curveObj.customData.labels).toEqual([curveLabel])
    })

    it('导入时 helper 可见性应按 helpersVisible 生效', async () => {
      const areaObj: any = {
        customType: CustomType.Area,
        points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
        customData: {
          drawId: 'area-1',
          points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
          distances: [20, 20, 28.3],
          lineColor: '#00f',
          fillColor: '#0ff'
        },
        on: vi.fn(),
        setCoords: vi.fn(),
        set: vi.fn()
      }
      const polylineObj: any = {
        customType: CustomType.Polyline,
        customData: {
          drawId: 'polyline-1',
          points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
          distances: [14.1],
          lineColor: '#f00'
        },
        on: vi.fn(),
        set: vi.fn(),
        left: 0,
        top: 0
      }
      const curveObj: any = {
        customType: CustomType.Curve,
        customData: {
          drawId: 'curve-1',
          points: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
          isClosed: false,
          lineColor: '#0f0',
          fillColor: null
        },
        on: vi.fn(),
        set: vi.fn(),
        left: 0,
        top: 0
      }
      const rectObj: any = {
        customType: CustomType.Rect,
        customData: {
          drawId: 'rect-1',
          startPoint: { x: 10, y: 10 },
          endPoint: { x: 110, y: 60 },
          width: 100,
          height: 50,
          lineColor: '#f00',
          fillColor: '#0f0'
        },
        on: vi.fn(),
        set: vi.fn(),
        setControlsVisibility: vi.fn()
      }
      const areaLine: any = {
        customType: CustomType.AreaLine,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const areaPoint: any = {
        customType: CustomType.AreaPoint,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const areaLabel: any = {
        customType: CustomType.AreaLabel,
        customData: { drawPid: 'area-1' },
        set: vi.fn()
      }
      const polylineCircle: any = {
        customType: CustomType.PolylineHelper,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn()
      }
      const polylineLabel: any = {
        customType: CustomType.PolylineHelperLabel,
        customData: { drawPid: 'polyline-1', index: 0 },
        set: vi.fn()
      }
      const curveCircle: any = {
        customType: CustomType.CurveHelper,
        customData: { drawPid: 'curve-1' },
        set: vi.fn()
      }
      const curveLabel: any = {
        customType: CustomType.CurveHelperLabel,
        customData: { drawPid: 'curve-1' },
        set: vi.fn()
      }
      const widthLabel: any = {
        customType: CustomType.RectLabel,
        customData: { drawPid: 'rect-1', labelType: 'width' },
        set: vi.fn()
      }
      const heightLabel: any = {
        customType: CustomType.RectLabel,
        customData: { drawPid: 'rect-1', labelType: 'height' },
        set: vi.fn()
      }

      await importFromJSON(
        canvas as unknown as Canvas,
        {
          objects: [
            areaObj,
            areaLine,
            areaPoint,
            areaLabel,
            polylineObj,
            polylineCircle,
            polylineLabel,
            curveObj,
            curveCircle,
            curveLabel,
            rectObj,
            widthLabel,
            heightLabel
          ],
          background: ''
        },
        eventBus,
        true
      )

      expect(areaLine.set).toHaveBeenCalledWith(
        expect.objectContaining({ visible: true, evented: false })
      )
      expect(areaPoint.set).toHaveBeenCalledWith(
        expect.objectContaining({ visible: true, evented: true })
      )
      expect(polylineCircle.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
      expect(polylineLabel.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
      expect(curveCircle.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
      expect(curveLabel.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
      expect(widthLabel.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
      expect(heightLabel.set).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))

      const objectOrder = canvas._objects.map((obj: any) => obj.customType)
      expect(objectOrder.indexOf(CustomType.Area)).toBeGreaterThan(
        objectOrder.indexOf(CustomType.AreaLine)
      )
    })

    it('should rebind imported pen events', async () => {
      const handlers: Record<string, Function> = {}
      const penObj: any = {
        customType: CustomType.Pen,
        customData: {
          drawId: 'pen-1',
          layer: 0,
          lineColor: '#f00',
          strokeWidth: 2
        },
        set: vi.fn(),
        on: vi.fn((event: string, handler: Function) => {
          handlers[event] = handler
        })
      }
      const clicked = vi.fn()
      const selected = vi.fn()
      const modified = vi.fn()
      eventBus.on('pen:clicked', clicked)
      eventBus.on('pen:selected', selected)
      eventBus.on('pen:modified', modified)

      await importFromJSON(
        canvas as unknown as Canvas,
        {
          objects: [penObj],
          background: ''
        },
        eventBus
      )

      expect(penObj.set).toHaveBeenCalledWith({
        evented: true,
        selectable: true,
        perPixelTargetFind: true
      })
      expect(penObj.on).toHaveBeenCalledTimes(3)

      handlers.mousedown()
      handlers.selected()
      handlers.modified()

      expect(clicked).toHaveBeenCalledWith({ drawId: 'pen-1', object: penObj })
      expect(selected).toHaveBeenCalledWith({ drawId: 'pen-1', object: penObj })
      expect(modified).toHaveBeenCalledWith({ drawId: 'pen-1', object: penObj })
    })
  })
})
