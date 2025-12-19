# PaintBoard 源码学习指南

本文档详细介绍 PaintBoard 画板工具库的源码结构、实现原理和核心逻辑，帮助开发者快速理解和学习该工具库。

---

## 目录结构

```
src/utils/paint-board/
├── index.js                 # 入口文件，导出所有模块
├── core/                    # 核心模块
│   ├── EventBus.js          # 事件总线（发布-订阅模式）
│   ├── PaintBoard.js        # 主画板类
│   └── CanvasManager.js     # 画布管理（缩放、平移、自动扩展）
├── tools/                   # 绘图工具
│   ├── BaseTool.js          # 工具基类
│   ├── LineTool.js          # 直线/区域工具
│   ├── CurveTool.js         # 曲线工具
│   ├── TextTool.js          # 文本工具
│   └── SelectTool.js        # 选择工具
├── ui/                      # UI 组件
│   ├── Toolbar.js           # 工具栏
│   └── ColorPicker.js       # 颜色选择器
├── utils/                   # 工具函数
│   ├── geometry.js          # 几何计算
│   ├── export.js            # 导入导出
│   ├── UndoRedoManager.js   # 撤销还原
│   ├── ObjectPool.js        # 对象池
│   └── throttle.js          # 节流防抖
├── styles/                  # 样式
│   └── paint-board.css      # 组件样式
└── docs/                    # 文档
    ├── API.md               # API 文档
    └── SOURCE.md            # 源码学习文档（本文件）
```

---

## 核心模块详解

### 1. EventBus.js - 事件总线

**作用**：实现发布-订阅模式，用于模块间解耦通信。

**核心数据结构**：
```javascript
this.events = new Map()  // 事件名 -> Set<回调函数>
```

**关键方法解析**：

```javascript
// 订阅事件
on(event, callback) {
  if (!this.events.has(event)) {
    this.events.set(event, new Set())  // 使用 Set 自动去重
  }
  this.events.get(event).add(callback)
  return this  // 链式调用
}

// 发布事件
emit(event, data) {
  if (!this.events.has(event)) return this
  this.events.get(event).forEach(callback => {
    try {
      callback(data)
    } catch (e) {
      console.error(`EventBus error in "${event}":`, e)  // 错误隔离
    }
  })
  return this
}

// 一次性订阅
once(event, callback) {
  const wrapper = (data) => {
    callback(data)
    this.off(event, wrapper)  // 执行后自动取消订阅
  }
  return this.on(event, wrapper)
}
```

**设计亮点**：
- 使用 `Map` + `Set` 组合，查找和去重效率高
- try-catch 包裹回调，单个回调错误不影响其他订阅者
- 支持链式调用

---

### 2. PaintBoard.js - 主画板类

**作用**：整合所有模块的入口类，管理画布、工具和事件。

**初始化流程**：

```javascript
constructor(container, options = {}) {
  // 1. 容器处理（支持选择器字符串或 DOM 元素）
  this.container = typeof container === 'string'
    ? document.querySelector(container)
    : container

  // 2. 合并默认配置
  this.options = { ...defaultOptions, ...options }

  // 3. 初始化状态
  this.canvas = null
  this.eventBus = new EventBus()
  this.tools = new Map()  // 工具注册表
  this.currentTool = null
}

init() {
  if (this._initialized) return this  // 防止重复初始化

  this._createCanvas()      // 创建 Fabric.js 画布
  this._initCanvasManager() // 初始化缩放平移管理
  this._initUndoRedo()      // 初始化撤销还原
  this._bindEvents()        // 绑定画布事件

  this._initialized = true
  return this
}
```

**工具管理机制**：

```javascript
// 注册工具
registerTool(name, tool) {
  this.tools.set(name, tool)
  tool.bindCanvas(this.canvas, this.eventBus, this)  // 注入依赖
  return this
}

// 切换工具
setTool(toolName) {
  if (this.currentTool) {
    this.currentTool.deactivate()  // 停用当前工具
  }
  const tool = this.tools.get(toolName)
  if (tool) {
    this.currentTool = tool
    tool.activate()  // 激活新工具
    this.eventBus.emit('tool:changed', toolName)
  }
  return this
}
```

**设计模式**：
- **策略模式**：工具可动态注册和切换
- **依赖注入**：工具通过 `bindCanvas` 获取所需依赖
- **单例管理**：同一时间只有一个工具处于激活状态

---

### 3. CanvasManager.js - 画布管理器

**作用**：处理画布缩放、平移和自动扩展。

**缩放实现**：

```javascript
// 滚轮缩放（以鼠标位置为中心）
_onMouseWheel(opt) {
  const delta = opt.e.deltaY
  let zoom = this.canvas.getZoom()
  zoom *= Math.pow(0.999, delta)  // 平滑缩放
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))  // 限制范围

  // 关键：以鼠标位置为中心缩放
  this.canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom)

  opt.e.preventDefault()
  opt.e.stopPropagation()
}

// 按钮缩放（以画布中心为基准）
zoomIn() {
  const center = this._getCanvasCenter()
  let zoom = this.canvas.getZoom() * ZOOM_STEP
  zoom = Math.min(zoom, MAX_ZOOM)
  this.canvas.zoomToPoint(center, zoom)
}
```

**平移实现**（Alt + 拖拽 或 鼠标中键）：

```javascript
_onMouseDown(opt) {
  const evt = opt.e
  if (evt.altKey === true || evt.button === 1) {  // Alt键或中键
    this.isDragging = true
    this.canvas.selection = false  // 禁用框选
    this.lastPosX = evt.clientX
    this.lastPosY = evt.clientY
    this.canvas.setCursor('grabbing')
  }
}

_onMouseMove(opt) {
  if (this.isDragging) {
    const e = opt.e
    const vpt = this.canvas.viewportTransform  // 视口变换矩阵
    vpt[4] += e.clientX - this.lastPosX  // X 平移
    vpt[5] += e.clientY - this.lastPosY  // Y 平移
    this.canvas.requestRenderAll()
    this.lastPosX = e.clientX
    this.lastPosY = e.clientY
  }
}
```

**自动扩展画布**：

```javascript
_onObjectMoving(opt) {
  this._throttledObjectMoving(opt)  // 节流处理
}

_checkCanvasExpand(opt) {
  const obj = opt.target
  const bounds = obj.getBoundingRect()

  // 检测对象是否接近边缘
  if (
    bounds.left < EXPAND_MARGIN ||
    bounds.top < EXPAND_MARGIN ||
    bounds.left + bounds.width > canvasWidth - EXPAND_MARGIN ||
    bounds.top + bounds.height > canvasHeight - EXPAND_MARGIN
  ) {
    this._expandCanvas(bounds)
  }
}
```

---

## 工具类详解

### 4. BaseTool.js - 工具基类

**作用**：定义所有绘图工具的通用接口和生命周期。

**模板方法模式**：

```javascript
export default class BaseTool {
  constructor(name) {
    this.name = name
    this.canvas = null
    this.eventBus = null
    this.paintBoard = null
    this.isActive = false
    this._bindHandlers()  // 预绑定 this
  }

  // 预绑定事件处理器（避免每次绑定时创建新函数）
  _bindHandlers() {
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)
  }

  // 激活工具
  activate() {
    if (!this.canvas) return
    this.isActive = true
    this.canvas.on('mouse:down', this._onMouseDown)
    this.canvas.on('mouse:move', this._onMouseMove)
    this.canvas.on('mouse:up', this._onMouseUp)
    document.addEventListener('keydown', this._onKeyDown)
    this.onActivate()  // 子类钩子
  }

  // 停用工具
  deactivate() {
    if (!this.canvas) return
    this.isActive = false
    this.canvas.off('mouse:down', this._onMouseDown)
    this.canvas.off('mouse:move', this._onMouseMove)
    this.canvas.off('mouse:up', this._onMouseUp)
    document.removeEventListener('keydown', this._onKeyDown)
    this.onDeactivate()  // 子类钩子
  }

  // 子类需要实现的钩子方法
  onActivate() {}
  onDeactivate() {}
  onMouseDown(opt) {}
  onMouseMove(opt) {}
  onMouseUp(opt) {}
  onKeyDown(e) {}
}
```

**设计亮点**：
- **模板方法模式**：基类定义流程，子类实现具体行为
- **预绑定 this**：在构造函数中绑定，避免重复创建函数
- **生命周期钩子**：`onActivate`/`onDeactivate` 供子类扩展

---

### 5. LineTool.js - 直线/区域工具

**作用**：通过点击创建多边形区域，显示边长。

**状态管理**：

```javascript
constructor() {
  super('line')
  this.isDrawing = false     // 是否正在绘制
  this.points = []           // 顶点坐标
  this.circles = []          // 顶点圆圈（辅助显示）
  this.lines = []            // 边线
  this.labels = []           // 边长标签
  this.distances = []        // 边长数值
  this.previewLine = null    // 预览线
  this.previewLabel = null   // 预览标签
}
```

**绘制流程**：

```javascript
onMouseDown(opt) {
  // 1. 过滤非左键点击
  if (opt.e.button !== 0) return
  if (opt.target && opt.target.customType === 'area') return

  // 2. 获取坐标并验证
  const pointer = this.getPointer(opt)
  if (!pointer || isNaN(pointer.x) || isNaN(pointer.y)) return
  const point = { x: pointer.x, y: pointer.y }

  // 3. 检测是否闭合（点击首点附近）
  if (this.points.length > 2 && this._isNearFirstPoint(point)) {
    this._closePolygon()
    return
  }

  // 4. 添加顶点
  this._addPoint(point)
}
```

**闭合检测**：

```javascript
_isNearFirstPoint(point) {
  if (this.points.length < 3) return false
  const firstPoint = this.points[0]
  const distance = calculateDistance(point, firstPoint)
  return distance < CLOSE_THRESHOLD  // 15px 阈值
}
```

**创建多边形**：

```javascript
_closePolygon() {
  // 1. 添加闭合线段
  this._addLine(lastPoint, firstPoint)

  // 2. 创建 Fabric.js Polygon
  const polygon = new fabric.Polygon(
    this.points.map(p => ({ x: p.x, y: p.y })),
    {
      fill: this.paintBoard.fillColor,
      stroke: this.paintBoard.lineColor,
      strokeWidth: 2,
      selectable: true,
      customType: 'area',  // 自定义类型标记
      customData: {        // 存储业务数据
        areaId: `area-${Date.now()}`,
        points: [...this.points],
        distances: [...this.distances],
        circles: [...this.circles],  // 关联辅助元素
        labels: [...this.labels],
        lines: [...this.lines]
      }
    }
  )

  // 3. 隐藏辅助元素
  this._hideHelpers()

  // 4. 添加到画布并绑定事件
  this.canvas.add(polygon)
  this._setupAreaEvents(polygon)

  // 5. 发布事件
  this.eventBus.emit('area:created', { ... })

  // 6. 重置状态
  this._reset()
}
```

**选中时显示辅助元素**：

```javascript
_setupAreaEvents(polygon) {
  polygon.on('selected', () => {
    this._showAreaHelpers(polygon)
    this.eventBus.emit('area:selected', { ... })
  })

  polygon.on('deselected', () => {
    this._hideAreaHelpers(polygon)
  })
}

_showAreaHelpers(polygon) {
  const data = polygon.customData
  data.circles.forEach(circle => circle.set({ visible: true }))
  data.labels.forEach(label => label.set({ visible: true }))
  data.lines.forEach(line => line.set({ visible: true }))
  this.canvas.renderAll()
}
```

---

### 6. CurveTool.js - 曲线工具

**作用**：通过控制点绘制平滑贝塞尔曲线。

**核心算法 - 平滑曲线生成**：

```javascript
_generateSmoothPath(points) {
  if (points.length < 2) return ''

  let path = `M ${points[0].x} ${points[0].y}`  // 移动到起点

  if (points.length === 2) {
    path += ` L ${points[1].x} ${points[1].y}`  // 两点直接连线
    return path
  }

  // 对每对相邻点生成贝塞尔曲线
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]           // 前一点
    const p1 = points[i]                            // 当前点
    const p2 = points[i + 1]                        // 下一点
    const p3 = points[Math.min(points.length - 1, i + 2)]  // 后一点

    // 计算控制点（基于张力 tension）
    const cp1 = {
      x: p1.x + (p2.x - p0.x) * this.tension / 3,
      y: p1.y + (p2.y - p0.y) * this.tension / 3
    }
    const cp2 = {
      x: p2.x - (p3.x - p1.x) * this.tension / 3,
      y: p2.y - (p3.y - p1.y) * this.tension / 3
    }

    // 三次贝塞尔曲线命令
    path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`
  }

  return path
}
```

**原理说明**：
- 使用 Catmull-Rom 样条算法的变体
- `tension` 参数控制曲线的平滑程度（0-1）
- 控制点基于相邻点的位置计算，确保曲线平滑过渡

---

### 7. TextTool.js - 文本工具

**作用**：添加可编辑的文本对象。

**创建文本**：

```javascript
_createText(pointer) {
  const text = new fabric.IText('文本', {
    left: pointer.x,
    top: pointer.y,
    fontSize: this.defaultFontSize,
    fontFamily: this.defaultFontFamily,
    fill: this.paintBoard.lineColor,
    editable: true,
    customType: 'text',
    customData: {
      textId: `text-${Date.now()}`,
      createdAt: Date.now()
    }
  })

  this.canvas.add(text)
  this.canvas.setActiveObject(text)
  text.enterEditing()  // 自动进入编辑模式
  text.selectAll()     // 全选文本
  this.canvas.renderAll()

  this._bindTextEvents(text)
}
```

**空文本自动删除**：

```javascript
_bindTextEvents(textObj) {
  textObj.on('editing:exited', () => {
    if (textObj.text.trim() === '') {
      this.canvas.remove(textObj)
      this.canvas.renderAll()
    }
  })
}
```

---

## 工具函数详解

### 8. UndoRedoManager.js - 撤销还原管理

**作用**：基于画布快照实现撤销还原。

**数据结构**：

```javascript
constructor(canvas, eventBus) {
  this.undoStack = []    // 撤销栈
  this.redoStack = []    // 还原栈
  this._isRestoring = false  // 防止恢复时触发保存
}
```

**自动保存状态**：

```javascript
_bindEvents() {
  this.canvas.on('object:added', () => this._onCanvasChanged())
  this.canvas.on('object:removed', () => this._onCanvasChanged())
  this.canvas.on('object:modified', () => this._onCanvasChanged())
}

_onCanvasChanged() {
  if (this._isRestoring) return  // 恢复过程中不保存
  this.saveState()
}

saveState() {
  const state = this._serializeCanvas()
  this.undoStack.push(state)

  // 限制历史记录数量
  if (this.undoStack.length > MAX_HISTORY) {
    this.undoStack.shift()
  }

  this.redoStack = []  // 新操作清空还原栈
}
```

**撤销/还原实现**：

```javascript
undo() {
  if (!this.canUndo()) return false

  // 当前状态存入还原栈
  const currentState = this._serializeCanvas()
  this.redoStack.push(currentState)

  // 恢复上一状态
  const previousState = this.undoStack.pop()
  this._restoreState(previousState)

  return true
}

_restoreState(state) {
  this._isRestoring = true  // 标记恢复中

  const data = typeof state === 'string' ? JSON.parse(state) : state
  this.canvas.loadFromJSON(data, () => {
    this.canvas.renderAll()
    this._isRestoring = false
  })
}
```

---

### 9. export.js - 导入导出

**JSON 导出**：

```javascript
export function exportToJSON(canvas, additionalProperties = []) {
  const defaultProps = ['selectable', 'hasControls', 'customType', 'customData']
  const allProps = [...new Set([...defaultProps, ...additionalProperties])]
  return JSON.stringify(canvas.toJSON(allProps))
}
```

**JSON 导入并重新绑定事件**：

```javascript
export function importFromJSON(canvas, json, eventBus) {
  return new Promise((resolve, reject) => {
    const data = typeof json === 'string' ? JSON.parse(json) : json
    canvas.loadFromJSON(data, () => {
      rebindObjectEvents(canvas, eventBus)  // 重新绑定事件
      canvas.renderAll()
      resolve()
    })
  })
}

function rebindObjectEvents(canvas, eventBus) {
  canvas.getObjects().forEach((obj) => {
    if (obj.customType === 'area' && obj.customData) {
      obj.on('selected', () => {
        showHelpers(obj, canvas)
        eventBus.emit('area:selected', { ... })
      })
      obj.on('deselected', () => {
        hideHelpers(obj)
      })
    }
  })
}
```

---

### 10. throttle.js - 节流防抖

**节流实现**（固定间隔执行）：

```javascript
export function throttle(fn, delay = 16) {
  let lastCall = 0
  let timeoutId = null

  return function throttled(...args) {
    const now = Date.now()
    const remaining = delay - (now - lastCall)

    if (remaining <= 0) {
      // 已超过间隔，立即执行
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      fn.apply(this, args)
    } else if (!timeoutId) {
      // 设置定时器，确保最后一次调用被执行
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn.apply(this, args)
      }, remaining)
    }
  }
}
```

**RAF 节流**（每帧最多执行一次）：

```javascript
export function rafThrottle(fn) {
  let rafId = null

  return function rafThrottled(...args) {
    if (rafId) return

    rafId = requestAnimationFrame(() => {
      fn.apply(this, args)
      rafId = null
    })
  }
}
```

---

## UI 组件详解

### 11. ColorPicker.js - 颜色选择器

**颜色模型转换**：

```javascript
// RGB 转 HSV
_rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return { h: h * 360, s, v }
}

// HSV 转 RGB
_hsvToRgb(h, s, v) {
  h /= 360
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  let r, g, b
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}
```

**拖拽交互**：

```javascript
_bindEvents() {
  let isDraggingSaturation = false

  const onSaturationMove = (e) => {
    if (!isDraggingSaturation) return
    this._handleSaturationChange(e)
  }

  this.saturationEl.addEventListener('mousedown', (e) => {
    isDraggingSaturation = true
    this._handleSaturationChange(e)
  })

  document.addEventListener('mousemove', onSaturationMove)
  document.addEventListener('mouseup', () => {
    isDraggingSaturation = false
  })

  // 保存清理函数
  this._cleanupFns = [
    () => document.removeEventListener('mousemove', onSaturationMove),
    // ...
  ]
}

destroy() {
  this._cleanupFns.forEach(fn => fn())  // 清理全局事件
}
```

---

## 设计模式总结

| 模式 | 应用位置 | 说明 |
|------|----------|------|
| 发布-订阅 | EventBus | 模块间解耦通信 |
| 策略模式 | 工具系统 | 工具可动态切换 |
| 模板方法 | BaseTool | 基类定义流程，子类实现细节 |
| 命令模式 | UndoRedoManager | 操作可撤销还原 |
| 对象池 | ObjectPool | 复用对象减少 GC |
| 单例管理 | currentTool | 同时只有一个工具激活 |

---

## 性能优化点

1. **事件节流**：`CanvasManager` 中对 `object:moving` 事件节流处理
2. **对象池**：`ObjectPool` 复用 Fabric.js 对象
3. **预绑定 this**：`BaseTool` 构造函数中预绑定事件处理器
4. **Set 去重**：`EventBus` 使用 Set 存储回调，自动去重
5. **防重复初始化**：`PaintBoard` 的 `_initialized` 标志
6. **恢复标记**：`UndoRedoManager` 的 `_isRestoring` 避免循环触发

---

## 扩展指南

### 创建自定义工具

```javascript
import BaseTool from './BaseTool'

export default class MyCustomTool extends BaseTool {
  constructor() {
    super('myTool')
    // 初始化状态
  }

  onActivate() {
    this.canvas.defaultCursor = 'crosshair'
  }

  onDeactivate() {
    this.canvas.defaultCursor = 'default'
  }

  onMouseDown(opt) {
    const pointer = this.getPointer(opt)
    // 处理点击
  }

  onMouseMove(opt) {
    // 处理移动
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      // 处理取消
    }
  }
}
```

### 注册自定义工具

```javascript
import MyCustomTool from './tools/MyCustomTool'

paintBoard.registerTool('myTool', new MyCustomTool())
paintBoard.setTool('myTool')
```
