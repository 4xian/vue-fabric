import { describe, it, expect, beforeEach } from 'vitest'
import { exportToJSON, importFromJSON } from '../../../src/utils/export'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import type { Canvas } from 'fabric'

describe('export utils', () => {
  let canvas: any
  let eventBus: EventBus

  beforeEach(() => {
    canvas = createMockCanvas()
    eventBus = new EventBus()
  })

  describe('exportToJSON', () => {
    it('应该导出画布为 JSON 字符串', () => {
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
  })
})
