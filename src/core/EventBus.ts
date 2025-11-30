import type { EventCallback } from '../../types'

export default class EventBus {
  private events: Map<string, Set<EventCallback>>

  constructor() {
    this.events = new Map()
  }

  on(event: string, callback: EventCallback): this {
    if (!this.events.has(event)) {
      this.events.set(event, new Set())
    }
    this.events.get(event)!.add(callback)
    return this
  }

  off(event: string, callback?: EventCallback): this {
    if (!this.events.has(event)) return this
    if (callback) {
      this.events.get(event)!.delete(callback)
    } else {
      this.events.delete(event)
    }
    return this
  }

  emit(event: string, data?: unknown): this {
    if (!this.events.has(event)) return this
    this.events.get(event)!.forEach(callback => {
      try {
        callback(data)
      } catch (e) {
        console.error(`EventBus error in "${event}":`, e)
      }
    })
    return this
  }

  once(event: string, callback: EventCallback): this {
    const wrapper: EventCallback = (data) => {
      callback(data)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }

  clear(): this {
    this.events.clear()
    return this
  }
}
