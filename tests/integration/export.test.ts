import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as exportUtils from '../../src/utils/export'
import EventBus from '../../src/core/EventBus'
import { createMockCanvas } from '../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('export 工具函数', () => {
  let canvas: any
  let eventBus: EventBus

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()

    // 为导出功能补充 mock 方法
    canvas.toDataURL = vi.fn(() => 'data:image/png;base64,mockedExportData')
    canvas.toSVG = vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"></svg>')
  })

  describe('exportToJSON()', () => {
    it('应该返回合法的 JSON 字符串', () => {
      const json = exportUtils.exportToJSON(canvas as unknown as Canvas)
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('导出的数据应包含 objects 字段', () => {
      const json = exportUtils.exportToJSON(canvas as unknown as Canvas)
      const data = JSON.parse(json)
      expect(data).toHaveProperty('objects')
    })

    it('应该支持 additionalProperties 参数', () => {
      const json = exportUtils.exportToJSON(canvas as unknown as Canvas, {
        additionalProperties: ['customType', 'customData']
      })
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('应该支持数组格式参数（向后兼容）', () => {
      const json = exportUtils.exportToJSON(canvas as unknown as Canvas, ['customType'])
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('excludeTypes 应过滤指定类型的对象', () => {
      // 模拟画布中有 text 类型对象
      canvas._objects.push({
        customType: 'text',
        customData: { drawId: 'text-1' },
        type: 'i-text',
        toObject: vi.fn(() => ({ customType: 'text' }))
      } as any)

      // canvas.toObject 会返回包含该对象的数据
      canvas.toObject = vi.fn(() => ({
        version: '6.0.0',
        objects: [{ customType: 'text', type: 'i-text' }]
      }))

      const json = exportUtils.exportToJSON(canvas as unknown as Canvas, {
        excludeTypes: ['text']
      })
      const data = JSON.parse(json)

      const textObjects = data.objects.filter((o: any) => o.customType === 'text')
      expect(textObjects).toHaveLength(0)
    })
  })

  describe('importFromJSON()', () => {
    it('应该成功导入 JSON 字符串', async () => {
      const json = JSON.stringify({ version: '6.0.0', objects: [] })
      await expect(
        exportUtils.importFromJSON(canvas as unknown as Canvas, json, eventBus)
      ).resolves.toBeUndefined()
    })

    it('应该成功导入对象格式的 JSON', async () => {
      const data = { version: '6.0.0', objects: [] }
      await expect(
        exportUtils.importFromJSON(canvas as unknown as Canvas, data, eventBus)
      ).resolves.toBeUndefined()
    })

    it('导入后应调用 renderAll', async () => {
      const json = JSON.stringify({ version: '6.0.0', objects: [] })
      await exportUtils.importFromJSON(canvas as unknown as Canvas, json, eventBus)
      expect(canvas.renderAll).toHaveBeenCalled()
    })

    it('无效 JSON 应 reject', async () => {
      await expect(
        exportUtils.importFromJSON(canvas as unknown as Canvas, 'invalid-json', eventBus)
      ).rejects.toThrow()
    })
  })

  describe('exportToImage()', () => {
    it('应该返回 dataURL 字符串', () => {
      const result = exportUtils.exportToImage(canvas as unknown as Canvas, {
        download: false
      })
      expect(typeof result).toBe('string')
      expect(result).toBe('data:image/png;base64,mockedExportData')
    })

    it('应该支持字符串格式参数（格式名）', () => {
      const result = exportUtils.exportToImage(canvas as unknown as Canvas, 'jpeg')
      expect(typeof result).toBe('string')
    })

    it('download=false 时不应创建下载链接', () => {
      const createElementSpy = vi.spyOn(document, 'createElement')
      exportUtils.exportToImage(canvas as unknown as Canvas, { download: false })
      // 不应为 download 创建 <a> 标签
      const aCalls = createElementSpy.mock.calls.filter(call => call[0] === 'a')
      expect(aCalls.length).toBe(0)
      createElementSpy.mockRestore()
    })

    it('应该传递 quality 和 multiplier 参数', () => {
      exportUtils.exportToImage(canvas as unknown as Canvas, {
        download: false,
        quality: 0.8,
        multiplier: 1
      })
      expect(canvas.toDataURL).toHaveBeenCalledWith(
        expect.objectContaining({ quality: 0.8, multiplier: 1 })
      )
    })
  })

  describe('exportToSVG()', () => {
    it('应该返回 SVG 字符串', () => {
      const result = exportUtils.exportToSVG(canvas as unknown as Canvas)
      expect(typeof result).toBe('string')
      expect(result).toContain('<svg')
    })
  })

  describe('getAreasData()', () => {
    it('画布无区域对象时应返回空数组', () => {
      const result = exportUtils.getAreasData(canvas as unknown as Canvas)
      expect(result).toEqual([])
    })

    it('应该返回画布中所有区域对象的数据', () => {
      const mockArea = {
        customType: 'area',
        customData: {
          drawId: 'area-1',
          points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
          distances: [100, 100, 141],
          lineColor: '#ff0000',
          fillColor: '#00ff00'
        }
      }
      canvas._objects.push(mockArea as any)

      const result = exportUtils.getAreasData(canvas as unknown as Canvas)
      expect(result).toHaveLength(1)
      expect(result[0].drawId).toBe('area-1')
      expect(result[0].points).toHaveLength(3)
    })
  })

  describe('getTextsData()', () => {
    it('画布无文本对象时应返回空数组', () => {
      const result = exportUtils.getTextsData(canvas as unknown as Canvas)
      expect(result).toEqual([])
    })
  })
})
