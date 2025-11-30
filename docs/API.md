# PaintBoard 画板工具库 API 文档

## 快速开始

### 安装依赖

```bash
npm install fabric
```

### 在 Vue 项目中使用

```vue
<template>
  <div ref="canvasContainer" class="canvas-container"></div>
</template>

<script>
import PaintBoard, { LineTool, SelectTool, TextTool, CurveTool, Toolbar } from '@/utils/paint-board'

export default {
  data() {
    return {
      paintBoard: null,
      toolbar: null
    }
  },
  mounted() {
    // 初始化画板
    this.paintBoard = new PaintBoard(this.$refs.canvasContainer, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
      lineColor: 'rgba(2, 167, 240, 1)',
      fillColor: 'rgba(128, 255, 255, 0.5)'
    })
    this.paintBoard.init()

    // 注册工具
    this.paintBoard.registerTool('select', new SelectTool())
    this.paintBoard.registerTool('line', new LineTool())
    this.paintBoard.registerTool('text', new TextTool())
    this.paintBoard.registerTool('curve', new CurveTool())

    // 初始化工具栏
    this.toolbar = new Toolbar(this.paintBoard)
    this.toolbar.init()

    // 设置默认工具
    this.paintBoard.setTool('select')

    // 监听事件
    this.paintBoard.on('area:created', (data) => {
      console.log('区域创建:', data)
    })
  },
  beforeDestroy() {
    if (this.toolbar) this.toolbar.destroy()
    if (this.paintBoard) this.paintBoard.destroy()
  }
}
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
```

### 在纯 JavaScript 项目中使用

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="paint-board.css">
</head>
<body>
  <div id="canvas-container"></div>

  <script type="module">
    import PaintBoard, { LineTool, SelectTool } from './paint-board/index.js'

    const container = document.getElementById('canvas-container')
    const paintBoard = new PaintBoard(container)
    paintBoard.init()

    paintBoard.registerTool('select', new SelectTool())
    paintBoard.registerTool('line', new LineTool())
    paintBoard.setTool('line')
  </script>
</body>
</html>
```

---

## PaintBoard 类

主画板类，管理画布、工具和事件。

### 构造函数

```javascript
new PaintBoard(container, options)
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| container | HTMLElement \| string | 是 | DOM 元素或选择器 |
| options | Object | 否 | 配置选项 |

**options 配置项：**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| width | number | 1200 | 画布宽度 |
| height | number | 800 | 画布高度 |
| backgroundColor | string | 'transparent' | 背景颜色 |
| lineColor | string | 'rgba(2, 167, 240, 1)' | 默认线条颜色 |
| fillColor | string | 'rgba(128, 255, 255, 1)' | 默认填充颜色 |
| selection | boolean | true | 是否允许框选 |
| preserveObjectStacking | boolean | true | 保持对象层级 |

### 方法

#### init()

初始化画板，必须在使用前调用。

```javascript
paintBoard.init()
```

返回值：`this`（支持链式调用）

---

#### registerTool(name, tool)

注册绘图工具。

```javascript
paintBoard.registerTool('line', new LineTool())
```

| 参数 | 类型 | 说明 |
|------|------|------|
| name | string | 工具名称 |
| tool | BaseTool | 工具实例 |

返回值：`this`

---

#### setTool(toolName)

切换当前工具。

```javascript
paintBoard.setTool('line')
```

| 参数 | 类型 | 说明 |
|------|------|------|
| toolName | string | 已注册的工具名称 |

返回值：`this`

---

#### setLineColor(color)

设置线条颜色。

```javascript
paintBoard.setLineColor('rgba(255, 0, 0, 1)')
```

| 参数 | 类型 | 说明 |
|------|------|------|
| color | string | CSS 颜色值 |

返回值：`this`

---

#### setFillColor(color)

设置填充颜色。

```javascript
paintBoard.setFillColor('rgba(0, 255, 0, 0.5)')
```

| 参数 | 类型 | 说明 |
|------|------|------|
| color | string | CSS 颜色值 |

返回值：`this`

---

#### zoomIn() / zoomOut() / resetZoom()

缩放控制。

```javascript
paintBoard.zoomIn()   // 放大 1.1 倍
paintBoard.zoomOut()  // 缩小 1.1 倍
paintBoard.resetZoom() // 重置为 100%
```

返回值：`this`

---

#### undo() / redo()

撤销/重做操作。

```javascript
paintBoard.undo()
paintBoard.redo()
```

返回值：`boolean`（是否成功）

---

#### canUndo() / canRedo()

检查是否可撤销/重做。

```javascript
if (paintBoard.canUndo()) {
  paintBoard.undo()
}
```

返回值：`boolean`

---

#### clear()

清空画布。

```javascript
paintBoard.clear()
```

返回值：`this`

---

#### exportToJSON(additionalProperties)

导出画布为 JSON。

```javascript
const json = paintBoard.exportToJSON()
localStorage.setItem('canvas', json)

// 包含额外属性
const json2 = paintBoard.exportToJSON(['myCustomProp'])
```

| 参数 | 类型 | 说明 |
|------|------|------|
| additionalProperties | string[] | 额外序列化的属性 |

返回值：`string`（JSON 字符串）

---

#### importFromJSON(json)

从 JSON 导入画布。

```javascript
const json = localStorage.getItem('canvas')
await paintBoard.importFromJSON(json)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| json | string \| Object | JSON 字符串或对象 |

返回值：`Promise<void>`

---

#### exportToImage(options)

导出为图片并下载。

```javascript
// 简单用法
paintBoard.exportToImage()

// 完整配置
paintBoard.exportToImage({
  format: 'png',      // 'png' | 'jpeg'
  quality: 1.0,       // 0-1
  multiplier: 2,      // 分辨率倍数
  download: true,     // 是否触发下载
  filename: 'my-canvas'
})
```

返回值：`string`（Data URL）

---

#### exportToSVG()

导出为 SVG。

```javascript
const svg = paintBoard.exportToSVG()
```

返回值：`string`（SVG 字符串）

---

#### getAreasData()

获取所有区域数据。

```javascript
const areas = paintBoard.getAreasData()
// [{ areaId, points, distances, lineColor, fillColor }, ...]
```

返回值：`Array<Object>`

---

#### getTextsData()

获取所有文本数据。

```javascript
const texts = paintBoard.getTextsData()
// [{ textId, text, left, top, fontSize, fontFamily, fill }, ...]
```

返回值：`Array<Object>`

---

#### on(event, callback) / off(event, callback)

事件监听。

```javascript
paintBoard.on('area:created', (data) => {
  console.log('区域ID:', data.areaId)
  console.log('顶点:', data.points)
  console.log('边长:', data.distances)
})
```

**可用事件：**

| 事件名 | 数据 | 说明 |
|--------|------|------|
| tool:changed | toolName | 工具切换 |
| lineColor:changed | color | 线条颜色变化 |
| fillColor:changed | color | 填充颜色变化 |
| area:created | { areaId, points, distances } | 区域创建 |
| area:selected | { areaId, points, distances } | 区域选中 |
| curve:created | { curveId, points, isClosed } | 曲线创建 |
| text:created | { textId, text } | 文本创建 |
| text:changed | { textId, text } | 文本修改 |
| objects:deleted | count | 对象删除 |
| canvas:cleared | - | 画布清空 |
| canvas:loaded | - | JSON 导入完成 |
| canvas:zoomed | zoom | 缩放变化 |
| canvas:expanded | { width, height } | 画布扩展 |
| mouse:move | { x, y } | 鼠标移动 |
| history:changed | { canUndo, canRedo } | 历史变化 |

---

#### getCanvas()

获取原始 Fabric.js Canvas 实例。

```javascript
const fabricCanvas = paintBoard.getCanvas()
```

返回值：`fabric.Canvas`

---

#### destroy()

销毁画板，释放资源。

```javascript
paintBoard.destroy()
```

---

## 工具类

### LineTool 直线/区域工具

绘制多边形区域。

**操作方式：**
- 点击添加顶点
- 点击首点附近（15px）闭合区域
- Ctrl+Z 撤销上一个点
- ESC 取消绘制

```javascript
const lineTool = new LineTool()
paintBoard.registerTool('line', lineTool)
```

---

### CurveTool 曲线工具

绘制平滑曲线。

**操作方式：**
- 点击添加控制点
- Enter 完成开放曲线
- 点击首点附近闭合曲线
- Ctrl+Z 撤销上一个点
- ESC 取消绘制

```javascript
const curveTool = new CurveTool()
paintBoard.registerTool('curve', curveTool)

// 设置曲线张力 (0-1)
curveTool.setTension(0.5)
```

---

### TextTool 文本工具

添加可编辑文本。

**操作方式：**
- 点击添加文本框
- 双击编辑文本
- 空文本自动删除

```javascript
const textTool = new TextTool()
paintBoard.registerTool('text', textTool)

// 设置默认字体大小
textTool.setFontSize(20)

// 设置字体
textTool.setFontFamily('Arial')

// 设置选中文本颜色
textTool.setTextColor('#ff0000')
```

---

### SelectTool 选择工具

选择和删除对象。

**操作方式：**
- 点击选择对象
- 框选多个对象
- Delete/Backspace 删除选中

```javascript
const selectTool = new SelectTool()
paintBoard.registerTool('select', selectTool)
```

---

## Toolbar 工具栏类

### 构造函数

```javascript
new Toolbar(paintBoard, options)
```

### 方法

#### init()

初始化工具栏。

```javascript
const toolbar = new Toolbar(paintBoard)
toolbar.init()
```

#### setActiveTool(name)

设置当前激活的工具按钮。

```javascript
toolbar.setActiveTool('line')
```

#### destroy()

销毁工具栏。

```javascript
toolbar.destroy()
```

---

## ColorPicker 颜色选择器类

### 构造函数

```javascript
new ColorPicker(options)
```

| 选项 | 类型 | 说明 |
|------|------|------|
| defaultColor | string | 默认颜色 |
| onChange | Function | 颜色变化回调 |

### 方法

```javascript
const picker = new ColorPicker({
  defaultColor: '#ff0000',
  onChange: (color) => console.log(color)
})

picker.show()           // 显示
picker.hide()           // 隐藏
picker.toggle()         // 切换
picker.setColor('#00ff00') // 设置颜色
picker.getColor()       // 获取颜色
picker.getElement()     // 获取 DOM 元素
picker.destroy()        // 销毁
```

---

## 工具函数

### geometry.js

```javascript
import {
  calculateDistance,    // 计算两点距离
  getMidPoint,          // 获取中点
  getAngle,             // 获取角度
  isPointNear,          // 判断点是否接近
  getPolygonArea,       // 计算多边形面积
  getPolygonCentroid,   // 获取多边形中心
  isPointInPolygon,     // 判断点是否在多边形内
  getBezierPoint,       // 获取贝塞尔曲线点
  smoothCurve           // 平滑曲线
} from '@/utils/paint-board/utils/geometry'

// 示例
const dist = calculateDistance({x: 0, y: 0}, {x: 3, y: 4}) // 5
const mid = getMidPoint({x: 0, y: 0}, {x: 10, y: 10}) // {x: 5, y: 5}
```

### throttle.js

```javascript
import { throttle, debounce, rafThrottle } from '@/utils/paint-board/utils/throttle'

// 节流
const throttled = throttle(fn, 100)

// 防抖
const debounced = debounce(fn, 100)

// RAF 节流
const rafThrottled = rafThrottle(fn)
```
