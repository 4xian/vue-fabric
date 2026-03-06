import { describe, it, expect, vi, beforeEach } from 'vitest'
import EventBus from '../../../src/core/EventBus'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  describe('on() - 事件订阅', () => {
    it('应该成功订阅单个监听器', () => {
      const callback = vi.fn()
      eventBus.on('test', callback)
      eventBus.emit('test', 'data')
      expect(callback).toHaveBeenCalledWith('data')
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('应该支持多个监听器订阅同一事件', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      eventBus.on('test', callback1)
      eventBus.on('test', callback2)
      eventBus.emit('test', 'data')
      expect(callback1).toHaveBeenCalledWith('data')
      expect(callback2).toHaveBeenCalledWith('data')
    })

    it('应该支持链式调用', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const result = eventBus.on('event1', callback1).on('event2', callback2)
      expect(result).toBe(eventBus)
    })
  })

  describe('off() - 取消订阅', () => {
    it('应该取消单个监听器', () => {
      const callback = vi.fn()
      eventBus.on('test', callback)
      eventBus.off('test', callback)
      eventBus.emit('test', 'data')
      expect(callback).not.toHaveBeenCalled()
    })

    it('应该取消所有监听器', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      eventBus.on('test', callback1)
      eventBus.on('test', callback2)
      eventBus.off('test')
      eventBus.emit('test', 'data')
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })

    it('取消不存在的事件不应报错', () => {
      expect(() => eventBus.off('nonexistent')).not.toThrow()
    })

    it('应该支持链式调用', () => {
      const callback = vi.fn()
      eventBus.on('test', callback)
      const result = eventBus.off('test', callback)
      expect(result).toBe(eventBus)
    })
  })

  describe('emit() - 事件触发', () => {
    it('应该触发事件并传递数据', () => {
      const callback = vi.fn()
      eventBus.on('test', callback)
      eventBus.emit('test', { value: 123 })
      expect(callback).toHaveBeenCalledWith({ value: 123 })
    })

    it('触发不存在的事件不应报错', () => {
      expect(() => eventBus.emit('nonexistent')).not.toThrow()
    })

    it('应该按顺序执行多个监听器', () => {
      const order: number[] = []
      eventBus.on('test', () => order.push(1))
      eventBus.on('test', () => order.push(2))
      eventBus.on('test', () => order.push(3))
      eventBus.emit('test')
      expect(order).toEqual([1, 2, 3])
    })

    it('应该支持链式调用', () => {
      const result = eventBus.emit('test')
      expect(result).toBe(eventBus)
    })
  })

  describe('once() - 一次性订阅', () => {
    it('应该只执行一次', () => {
      const callback = vi.fn()
      eventBus.once('test', callback)
      eventBus.emit('test', 'data1')
      eventBus.emit('test', 'data2')
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith('data1')
    })

    it('执行后应自动移除', () => {
      const callback = vi.fn()
      eventBus.once('test', callback)
      eventBus.emit('test')
      eventBus.emit('test')
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('应该支持链式调用', () => {
      const callback = vi.fn()
      const result = eventBus.once('test', callback)
      expect(result).toBe(eventBus)
    })
  })

  describe('clear() - 清空所有事件', () => {
    it('清空后无法触发任何事件', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      eventBus.on('event1', callback1)
      eventBus.on('event2', callback2)
      eventBus.clear()
      eventBus.emit('event1')
      eventBus.emit('event2')
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
    })

    it('应该支持链式调用', () => {
      const result = eventBus.clear()
      expect(result).toBe(eventBus)
    })
  })

  describe('错误处理', () => {
    it('监听器抛出异常不应影响其他监听器', () => {
      const callback1 = vi.fn(() => {
        throw new Error('callback1 error')
      })
      const callback2 = vi.fn()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      eventBus.on('test', callback1)
      eventBus.on('test', callback2)
      eventBus.emit('test')

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('错误应被正确捕获和记录', () => {
      const error = new Error('test error')
      const callback = vi.fn(() => {
        throw error
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      eventBus.on('test', callback)
      eventBus.emit('test')

      expect(consoleErrorSpy).toHaveBeenCalledWith('EventBus error in "test":', error)

      consoleErrorSpy.mockRestore()
    })
  })
})
