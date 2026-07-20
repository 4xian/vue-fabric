import { afterEach, describe, expect, it, vi } from 'vitest'
import EventBus from '../../../src/core/EventBus'
import UndoRedoManager from '../../../src/utils/UndoRedoManager'
import { createMockCanvas } from '../../fixtures/mockCanvas'

async function flushRestore(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('UndoRedoManager restore timing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the initial state synchronously before drawing states', () => {
    vi.useFakeTimers()

    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    expect(manager.getUndoCount()).toBe(1)

    canvas.add({ id: 'shape-1' } as any)
    manager.saveState()
    vi.runAllTimers()

    expect(manager.getUndoCount()).toBe(2)
    const undoStack = (manager as any).undoStack as string[]
    expect(JSON.parse(undoStack[0]).objects).toHaveLength(0)
    expect(JSON.parse(undoStack[1]).objects).toHaveLength(1)
  })

  it('hides undo and redo availability while restoring', async () => {
    let resolveLoad: ((value: unknown) => void) | null = null
    const canvas = createMockCanvas()
    const eventBus = new EventBus()

    canvas.loadFromJSON = vi.fn(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve
        })
    )

    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    canvas.add({ id: 'shape-1' } as any)
    manager.saveState()
    canvas.add({ id: 'shape-2' } as any)
    manager.saveState()

    expect(manager.undo()).toBe(true)
    expect(manager.canUndo()).toBe(false)
    expect(manager.canRedo()).toBe(false)

    resolveLoad?.(canvas as any)
    await flushRestore()

    expect(manager.canUndo()).toBe(true)
    expect(manager.canRedo()).toBe(true)
  })

  it('keeps each resumed drawing as one undo step', async () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    manager.pause()
    canvas.add({ id: 'shape-1' } as any)
    manager.resume()

    manager.pause()
    canvas.add({ id: 'shape-2' } as any)
    manager.resume()

    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(1)
    expect(canvas.getObjects()[0]).toEqual(expect.objectContaining({ id: 'shape-1' }))

    expect(manager.redo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(2)
  })

  it('clears redo history when a new drawing starts', async () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    canvas.add({ id: 'shape-1' } as any)
    manager.saveState()
    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(manager.canRedo()).toBe(true)

    manager.pause()
    expect(manager.canRedo()).toBe(false)
  })
})
