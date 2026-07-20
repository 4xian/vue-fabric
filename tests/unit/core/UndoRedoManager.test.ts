import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import UndoRedoManager from '../../../src/utils/UndoRedoManager'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'
import { createMockFabricObject } from '../../fixtures/mockFabricObjects'
import type { Canvas } from 'fabric'

async function flushRestore(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

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

  describe('initialization', () => {
    it('should save the initial state automatically', () => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBe(1)
    })

    it('should accept constructor options', () => {
      const options = {
        excludeTypes: ['test'],
        getBackgroundImage: () => null
      }
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus, options)
      expect(manager).toBeDefined()
    })
  })

  describe('undo()', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should perform a single undo', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      const result = manager.undo()
      expect(result).toBe(true)
    })

    it('should support multiple undo calls after each restore finishes', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      expect(manager.undo()).toBe(true)
      await flushRestore()
      expect(manager.undo()).toBe(true)
    })

    it('should return false when already at the initial state', () => {
      const result = manager.undo()
      expect(result).toBe(false)
    })

    it('should return false when undo is not available', () => {
      expect(manager.canUndo()).toBe(false)
      expect(manager.undo()).toBe(false)
    })
  })

  describe('redo()', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should perform a single redo after undo restore finishes', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await flushRestore()

      const result = manager.redo()
      expect(result).toBe(true)
    })

    it('should support multiple redo calls after each restore finishes', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await flushRestore()
      manager.undo()
      await flushRestore()

      expect(manager.redo()).toBe(true)
      await flushRestore()
      expect(manager.redo()).toBe(true)
    })

    it('should return false when redo is not available', () => {
      expect(manager.canRedo()).toBe(false)
      expect(manager.redo()).toBe(false)
    })
  })

  describe('canUndo() / canRedo()', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should not allow undo at the initial state', () => {
      expect(manager.canUndo()).toBe(false)
    })

    it('should allow undo after an object is added', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.canUndo()).toBe(true)
    })

    it('should allow redo after undo restore finishes', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await flushRestore()
      expect(manager.canRedo()).toBe(true)
    })

    it('should clear redo availability after redo completes', async () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await flushRestore()

      expect(manager.redo()).toBe(true)
      expect(manager.canRedo()).toBe(false)
    })
  })

  describe('pause() / resume()', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should not record history while paused', () => {
      const initialCount = manager.getUndoCount()
      manager.pause()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBe(initialCount)
    })

    it('should save the current state when resumed', () => {
      manager.pause()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      const countBeforeResume = manager.getUndoCount()
      manager.resume()
      expect(manager.getUndoCount()).toBe(countBeforeResume + 1)
    })

    it('should report paused state correctly', () => {
      expect(manager.isPaused()).toBe(false)
      manager.pause()
      expect(manager.isPaused()).toBe(true)
      manager.resume()
      expect(manager.isPaused()).toBe(false)
    })
  })

  describe('history stack', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should clear redo stack after a new operation', async () => {
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

  describe('events', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should save automatically when canvas objects change', () => {
      const initialCount = manager.getUndoCount()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()
      expect(manager.getUndoCount()).toBeGreaterThan(initialCount)
    })

    it('should emit history:changed on undo', () => {
      const callback = vi.fn()
      eventBus.on('history:changed', callback)

      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      expect(callback).toHaveBeenCalled()
    })

    it('should emit history:changed on redo', async () => {
      const callback = vi.fn()
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.undo()
      await flushRestore()

      eventBus.on('history:changed', callback)
      manager.redo()
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('clear()', () => {
    beforeEach(() => {
      manager = new UndoRedoManager(canvas as unknown as Canvas, eventBus)
      vi.runAllTimers()
    })

    it('should clear all history', () => {
      canvas.add(createMockFabricObject())
      canvas.fire('object:added')
      vi.runAllTimers()

      manager.clear()
      vi.runAllTimers()

      expect(manager.getUndoCount()).toBe(1)
      expect(manager.getRedoCount()).toBe(0)
    })

    it('should emit history:changed after clear', () => {
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
