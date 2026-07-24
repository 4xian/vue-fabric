import { beforeEach, describe, expect, it, vi } from 'vitest'
import UndoRedoManager from '../../../src/utils/UndoRedoManager'
import EventBus from '../../../src/core/EventBus'
import { createMockCanvas } from '../../fixtures/mockCanvas'

async function flushRestore(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('UndoRedoManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('历史快照应该过滤背景图', () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const backgroundImage = { id: 'bg-image' } as any
    const lineObject = { id: 'line-1', customType: 'line' } as any

    canvas.toObject = vi.fn(() => ({
      version: '6.0.0',
      objects: canvas
        .getObjects()
        .filter(obj => !(obj as any).excludeFromExport)
        .map(obj => ({ type: 'rect', ...obj }))
    }))
    canvas.add(backgroundImage, lineObject)

    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: [],
      getBackgroundImage: () => backgroundImage
    })

    vi.runAllTimers()
    manager.saveState()

    const undoStack = (manager as any).undoStack as string[]
    const snapshot = JSON.parse(undoStack[undoStack.length - 1])

    expect(snapshot.objects).toHaveLength(1)
    expect(snapshot.objects[0]).toEqual(expect.objectContaining({ id: 'line-1' }))
  })

  it('背景图不参与 Fabric 序列化时仍应逐步撤销和还原绘制内容', async () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const backgroundImage = { id: 'bg-image', excludeFromExport: true } as any
    const firstShape = { id: 'shape-1' } as any
    const secondShape = { id: 'shape-2' } as any

    canvas.toObject = vi.fn(() => ({
      version: '6.0.0',
      objects: canvas
        .getObjects()
        .filter(obj => !(obj as any).excludeFromExport)
        .map(obj => ({ type: 'rect', ...obj }))
    }))
    canvas.add(backgroundImage)

    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: [],
      getBackgroundImage: () => backgroundImage
    })

    canvas.add(firstShape)
    manager.saveState()
    canvas.add(secondShape)
    manager.saveState()

    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toEqual([
      backgroundImage,
      expect.objectContaining({ id: 'shape-1' })
    ])

    expect(manager.redo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toEqual([
      backgroundImage,
      expect.objectContaining({ id: 'shape-1' }),
      expect.objectContaining({ id: 'shape-2' })
    ])
  })

  it('没有实际变化时不应重复写入相同历史快照', () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    vi.runAllTimers()
    expect(manager.getUndoCount()).toBe(1)

    manager.saveState()
    expect(manager.getUndoCount()).toBe(1)
  })

  it('连续 undo 和 redo 后应保持单步历史边界', async () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    vi.runAllTimers()

    canvas.add({ id: 'shape-1' } as any)
    manager.saveState()

    canvas.add({ id: 'shape-2' } as any)
    manager.saveState()

    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(1)

    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(0)

    expect(manager.redo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(1)

    expect(manager.redo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(2)

    expect(manager.undo()).toBe(true)
    await flushRestore()
    expect(canvas.getObjects()).toHaveLength(1)
    expect(canvas.getObjects()[0]).toEqual(expect.objectContaining({ id: 'shape-1' }))
  })

  it('恢复过程中重复点击 undo 不应继续修改历史栈', async () => {
    const canvas = createMockCanvas()
    const eventBus = new EventBus()
    let resolveLoad: ((value: unknown) => void) | null = null

    canvas.loadFromJSON = vi.fn(
      () =>
        new Promise(resolve => {
          resolveLoad = resolve
        })
    )

    const manager = new UndoRedoManager(canvas as any, eventBus, {
      excludeTypes: []
    })

    vi.runAllTimers()

    canvas.add({ id: 'shape-1' } as any)
    manager.saveState()

    canvas.add({ id: 'shape-2' } as any)
    manager.saveState()

    expect(manager.undo()).toBe(true)
    expect(manager.undo()).toBe(false)

    resolveLoad?.(canvas as any)
    await flushRestore()
  })
})
