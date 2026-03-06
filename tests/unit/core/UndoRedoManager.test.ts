import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import UndoRedoManager from '../../../src/utils/UndoRedoManager'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { createMockFabricObject } from '../../fixtures/mockFabricObjects'
import type { Canvas } from 'fabric'

describe('UndoRedoManager', () => {
  let canvas: any
  let eventBus: EventBus
  let manager: UndoRedoManager

  beforeEach(() => {
    vi.useFakeTimers()
    canvas = createMockCanvas()
    eventBus = new EventBus()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('初始化', () => {
    it('应该自动保存初始状态', () => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBe(1)
    })

    it('应该正确处理构造函数参数', () => {
      const options = {
        excludeTypes: ['test'],
        getBackgroundImage: () => null
      }
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus, options)
      expect(manager).toBeDefined()
    })
  })

  describe('undo() - 撤销功能', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('应该执行单次撤销', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      const result = manager.undo()
      expect(result).toBe(true)
    })

    it('应该支持多次连续撤销', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      expect(manager.undo()).toBe(true)
      expect(manager.undo()).toBe(true)
    })

    it('撤销到初始状态后应返回 false', () => {
      const result = manager.undo()
      expect(result).toBe(false)
    })

    it('无法继续撤销时应返回 false', () => {
      expect(manager.canUndo()).toBe(false)
      expect(manager.undo()).toBe(false)
    })
  })

  describe('redo() - 重做功能', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('应该执行单次重做', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      const result = manager.redo()
      expect(result).toBe(true)
    })

    it('应该支持多次连续重做', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      manager.undo()

      expect(manager.redo()).toBe(true)
      expect(manager.redo()).toBe(true)
    })

    it('无法继续重做时应返回 false', () => {
      expect(manager.canRedo()).toBe(false)
      expect(manager.redo()).toBe(false)
    })
  })

  describe('canUndo() / canRedo() - 状态查询', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('初始状态不能撤销', () => {
      expect(manager.canUndo()).toBe(false)
    })

    it('添加对象后可以撤销', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.canUndo()).toBe(true)
    })

    it('撤销后可以重做', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      expect(manager.canRedo()).toBe(true)
    })

    it('重做后不能继续重做', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      manager.redo()
      expect(manager.canRedo()).toBe(false)
    })
  })

  describe('pause() / resume() - 暂停恢复', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('暂停期间不记录历史', () => {
      const initialCount = manager.getUndoCount()
      manager.pause()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBe(initialCount)
    })

    it('恢复后保存当前状态', () => {
      manager.pause()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      const countBeforeResume = manager.getUndoCount()
      manager.resume()
      expect(manager.getUndoCount()).toBe(countBeforeResume + 1)
    })

    it('isPaused() 应返回正确状态', () => {
      expect(manager.isPaused()).toBe(false)
      manager.pause()
      expect(manager.isPaused()).toBe(true)
      manager.resume()
      expect(manager.isPaused()).toBe(false)
    })
  })

  describe('历史栈管理', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('新操作应清空 redo 栈', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await vi.runAllTimersAsync()
      expect(manager.canRedo()).toBe(true)

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      expect(manager.canRedo()).toBe(false)
    })
  })

  describe('事件触发', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('Canvas 对象变化时应自动保存', () => {
      const initialCount = manager.getUndoCount()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBeGreaterThan(initialCount)
    })

    it('撤销时应触发 history:changed 事件', () => {
      const callback = vi.fn()
      eventBus.on('history:changed', callback)

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      expect(callback).toHaveBeenCalled()
    })

    it('重做时应触发 history:changed 事件', () => {
      const callback = vi.fn()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()

      eventBus.on('history:changed', callback)
      manager.redo()
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('clear() - 清空历史', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('应清空所有历史记录', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.clear()
      vi.runAllTimers()

      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('清空后应触发 history:changed 事件', () => {
      const callback = vi.fn()
      eventBus.on('history:changed', callback)

      manager.clear()
      vi.runAllTimers()

      expect(callback).toHaveBeenCalledWith({
        canUndo: false,
        canRedo: false
      })
    })
  })
})
