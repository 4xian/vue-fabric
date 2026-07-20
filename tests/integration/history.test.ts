import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VueFabric from '../../src/core/PaintBoard'
import LineTool from '../../src/tools/LineTool'
import SelectTool from '../../src/tools/SelectTool'

function createContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.width = '800px'
  container.style.height = '600px'
  document.body.appendChild(container)
  return container
}

async function flushRestore(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('history integration', () => {
  let container: HTMLDivElement
  let board: VueFabric

  beforeEach(() => {
    container = createContainer()
    board = new VueFabric(container, {
      width: 800,
      height: 600,
      autoResize: false,
      zoomAnimationDuration: 0
    })
    board.init()
    board.registerTool('select', new SelectTool())
    board.registerTool('line', new LineTool())
    board.canvas!.renderOnAddRemove = false
    vi.spyOn(board.canvas!, 'renderAll').mockReturnValue(board.canvas!)
    vi.spyOn(board.canvas!, 'requestRenderAll').mockReturnValue(board.canvas!)
  })

  afterEach(() => {
    board.destroy()
    document.body.removeChild(container)
  })

  it('undoes and redoes completed drawings one shape at a time', async () => {
    const points = [
      { x: 10, y: 10 },
      { x: 100, y: 100 },
      { x: 120, y: 120 },
      { x: 220, y: 220 }
    ]
    const getPointer = vi.spyOn(board.canvas!, 'getPointer')
    const click = () => board.currentTool!.onMouseDown({ e: new MouseEvent('mousedown') } as any)

    board.setTool('line')
    getPointer.mockReturnValue(points[0])
    click()
    getPointer.mockReturnValue(points[1])
    click()
    expect(board.canvas!.getObjects()).toHaveLength(4)

    board.setTool('line')
    getPointer.mockReturnValue(points[2])
    click()
    getPointer.mockReturnValue(points[3])
    click()
    expect(board.canvas!.getObjects()).toHaveLength(8)

    expect(board.undo()).toBe(true)
    await flushRestore()
    expect(board.canvas!.getObjects()).toHaveLength(4)

    expect(board.redo()).toBe(true)
    await flushRestore()
    expect(board.canvas!.getObjects()).toHaveLength(8)
  })
})
