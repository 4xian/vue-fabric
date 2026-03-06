import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PersonTracker from '../../src/utils/PersonTracker'
import EventBus from '../../src/core/EventBus'
import { createMockCanvas } from '../fixtures/mockCanvas'
import type { Canvas } from 'fabric'
import type { PersonData } from '../../types'

function makePerson(overrides: Partial<PersonData> = {}): PersonData {
  return {
    id: 'person-1',
    name: '张三',
    x: 100,
    y: 200,
    lineColor: '#ff0000',
    ...overrides
  }
}

describe('PersonTracker', () => {
  let canvas: any
  let eventBus: EventBus
  let tracker: PersonTracker

  beforeEach(() => {
    vi.useFakeTimers()
    canvas = createMockCanvas()
    eventBus = new EventBus()
    tracker = new PersonTracker(canvas as unknown as Canvas, eventBus, {
      animationSpeed: 1,
      maxMoveAnimationDuration: 0, // 禁用移动动画以简化测试
      deleteOld: true,
      batchSize: 10
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始化', () => {
    it('应该正确创建 PersonTracker 实例', () => {
      expect(tracker).toBeDefined()
    })

    it('初始状态 getAllPersonIds() 应返回空数组', () => {
      expect(tracker.getAllPersonIds()).toEqual([])
    })
  })

  describe('createSinglePerson()', () => {
    it('应该创建单个人员标记', async () => {
      const person = makePerson()
      await tracker.createSinglePerson(person)

      expect(tracker.getAllPersonIds()).toContain('person-1')
      expect(canvas.add).toHaveBeenCalled()
    })

    it('应该触发 person:created 事件', async () => {
      const callback = vi.fn()
      eventBus.on('person:created', callback)

      await tracker.createSinglePerson(makePerson())

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'person-1' }))
    })

    it('更新已存在的人员应更新其标记', async () => {
      const person = makePerson()
      await tracker.createSinglePerson(person)

      const updatedPerson = makePerson({ x: 300, y: 400 })
      await tracker.createSinglePerson(updatedPerson)

      // id 相同，人数不变
      expect(tracker.getAllPersonIds().length).toBe(1)
    })
  })

  describe('removePerson()', () => {
    it('应该移除已存在的人员', async () => {
      await tracker.createSinglePerson(makePerson())
      const result = tracker.removePerson('person-1')

      expect(result).toBe(true)
      expect(tracker.getAllPersonIds()).not.toContain('person-1')
    })

    it('移除不存在的人员应返回 false', () => {
      const result = tracker.removePerson('nonexistent')
      expect(result).toBe(false)
    })

    it('应该触发 person:removed 事件', async () => {
      const callback = vi.fn()
      eventBus.on('person:removed', callback)

      await tracker.createSinglePerson(makePerson())
      tracker.removePerson('person-1')

      expect(callback).toHaveBeenCalledWith({ id: 'person-1' })
    })
  })

  describe('clearAllPersons()', () => {
    it('应该清除所有人员', async () => {
      await tracker.createSinglePerson(makePerson({ id: 'p1' }))
      await tracker.createSinglePerson(makePerson({ id: 'p2' }))

      tracker.clearAllPersons()

      expect(tracker.getAllPersonIds()).toHaveLength(0)
    })

    it('应该触发 persons:cleared 事件', async () => {
      const callback = vi.fn()
      eventBus.on('persons:cleared', callback)

      tracker.clearAllPersons()

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('clearAll()', () => {
    it('应该清除所有人员和轨迹', async () => {
      await tracker.createSinglePerson(makePerson({ id: 'p1' }))

      tracker.clearAll()

      expect(tracker.getAllPersonIds()).toHaveLength(0)
    })

    it('应该触发 persons:allCleared 事件', () => {
      const callback = vi.fn()
      eventBus.on('persons:allCleared', callback)

      tracker.clearAll()

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('clearAllTraces()', () => {
    it('应该触发 traces:cleared 事件', () => {
      const callback = vi.fn()
      eventBus.on('traces:cleared', callback)

      tracker.clearAllTraces()

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('createMultiplePersons()', () => {
    it('应该批量创建多个人员', async () => {
      const persons = [
        makePerson({ id: 'p1', name: '张三' }),
        makePerson({ id: 'p2', name: '李四', x: 200, y: 300 }),
        makePerson({ id: 'p3', name: '王五', x: 300, y: 400 })
      ]

      await tracker.createMultiplePersons(persons)

      const ids = tracker.getAllPersonIds()
      expect(ids).toContain('p1')
      expect(ids).toContain('p2')
      expect(ids).toContain('p3')
    })

    it('deleteOld=true 时应删除不在新列表中的人员', async () => {
      await tracker.createSinglePerson(makePerson({ id: 'old-person' }))

      const newPersons = [makePerson({ id: 'new-person' })]
      await tracker.createMultiplePersons(newPersons)

      const ids = tracker.getAllPersonIds()
      expect(ids).not.toContain('old-person')
      expect(ids).toContain('new-person')
    })

    it('坐标为 (0, 0) 的人员不应创建', async () => {
      const persons = [makePerson({ id: 'zero-pos', x: 0, y: 0 })]

      await tracker.createMultiplePersons(persons)

      expect(tracker.getAllPersonIds()).not.toContain('zero-pos')
    })
  })

  describe('getPersonById()', () => {
    it('应该返回存在的人员标记', async () => {
      await tracker.createSinglePerson(makePerson())
      const marker = tracker.getPersonById('person-1')
      expect(marker).toBeDefined()
    })

    it('不存在的 id 应返回 undefined', () => {
      expect(tracker.getPersonById('nonexistent')).toBeUndefined()
    })
  })

  describe('removePersonTraces()', () => {
    it('移除不存在的轨迹不应报错', () => {
      expect(() => tracker.removePersonTraces('nonexistent')).not.toThrow()
    })
  })
})
