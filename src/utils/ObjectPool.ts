import * as fabric from 'fabric'

type FabricObjectType = 'circle' | 'line' | 'text' | 'polygon' | 'path'

export default class ObjectPool {
  private pools: Map<string, fabric.FabricObject[]>

  constructor() {
    this.pools = new Map()
  }

  private _getPool(type: string): fabric.FabricObject[] {
    if (!this.pools.has(type)) {
      this.pools.set(type, [])
    }
    return this.pools.get(type)!
  }

  acquire<T extends fabric.FabricObject>(type: FabricObjectType, options: object = {}): T | null {
    const pool = this._getPool(type)

    if (pool.length > 0) {
      const obj = pool.pop() as T
      obj.set(options)
      obj.set({ visible: true })
      return obj
    }

    return this._createObject(type, options) as T | null
  }

  release(obj: fabric.FabricObject & { type?: string }): void {
    if (!obj || !obj.type) return

    obj.set({ visible: false })

    const pool = this._getPool(obj.type)
    if (pool.length < 50) {
      pool.push(obj)
    }
  }

  private _createObject(type: FabricObjectType, options: object): fabric.FabricObject | null {
    switch (type) {
      case 'circle':
        return new fabric.Circle(options as fabric.CircleProps)
      case 'line':
        return new fabric.Line([0, 0, 0, 0], options as fabric.FabricObjectProps)
      case 'text':
        return new fabric.Text('', options as fabric.TextProps)
      case 'polygon':
        return new fabric.Polygon([], options as fabric.FabricObjectProps)
      case 'path':
        return new fabric.Path('', options as fabric.PathProps)
      default:
        return null
    }
  }

  clear(): void {
    this.pools.clear()
  }

  getPoolSize(type: string): number {
    const pool = this.pools.get(type)
    return pool ? pool.length : 0
  }

  getTotalSize(): number {
    let total = 0
    this.pools.forEach(pool => {
      total += pool.length
    })
    return total
  }
}
