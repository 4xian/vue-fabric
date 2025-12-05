import type { FabricObject } from 'fabric'
import type { SelectToolOptions } from '../../types'
import BaseTool from './BaseTool'

export default class SelectTool extends BaseTool {
  protected override options: Required<SelectToolOptions>

  constructor(options: SelectToolOptions = {}) {
    super('select', options)
    this.options = {
      activeCursor: options.activeCursor ?? 'default',
      deactiveCursor: options.deactiveCursor ?? 'default',
      allowSelection: options.allowSelection ?? false
    }
  }

  onActivate(): void {
    if (!this.canvas) return
    this.canvas.defaultCursor = this.options.activeCursor
    this.canvas.selection = this.options.allowSelection
    this.canvas.forEachObject((obj: FabricObject & { customType?: string }) => {
      if (obj.customType === 'area') {
        obj.set({ selectable: true, evented: true })
      }
    })
  }

  onDeactivate(): void {
    if (!this.canvas) return
    this.canvas.discardActiveObject()
    this.canvas.renderAll()
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this._deleteSelected()
    }
  }

  private _deleteSelected(): void {
    if (!this.canvas || !this.eventBus) return
    const activeObjects = this.canvas.getActiveObjects()
    if (activeObjects.length === 0) return

    activeObjects.forEach(obj => {
      const customObj = obj as FabricObject & {
        customData?: { circles?: FabricObject[]; labels?: FabricObject[]; lines?: FabricObject[] }
      }
      if (customObj.customData) {
        const { circles, labels, lines } = customObj.customData
        if (circles) circles.forEach(c => this.canvas!.remove(c))
        if (labels) labels.forEach(l => this.canvas!.remove(l))
        if (lines) lines.forEach(l => this.canvas!.remove(l))
      }
      this.canvas!.remove(obj)
    })

    this.canvas.discardActiveObject()
    this.canvas.renderAll()

    this.eventBus.emit('objects:deleted', activeObjects.length)
  }
}
