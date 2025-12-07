# @4xian/vue-fabric

基于 fabric.js 的二次封装绘图工具库，提供开箱即用的画板组件。

## 特性

- 多种绘图工具：选择、直线、多边形区域、曲线、文本、图片
- 内置颜色选择器和工具栏
- 撤销/重做支持
- 画布缩放与平移
- 人员追踪与轨迹展示
- 导出 JSON/PNG/SVG
- 完整的 TypeScript 类型定义

## 安装

```bash
# npm
npm install @4xian/vue-fabric fabric

# pnpm
pnpm add @4xian/vue-fabric fabric

# yarn
yarn add @4xian/vue-fabric fabric
```

## 快速开始

### Vue 项目

```vue
<template>
  <div ref="container" class="canvas-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import PaintBoard, { LineTool, AreaTool, SelectTool, TextTool, CurveTool, ImageTool, Toolbar } from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

const container = ref(null)
let paintBoard = null
let toolbar = null

onMounted(() => {
  paintBoard = new PaintBoard(container.value, {
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff'
  }).init()

  paintBoard
    .registerTool('select', new SelectTool())
    .registerTool('line', new LineTool())
    .registerTool('area', new AreaTool({ enableFill: true }))
    .registerTool('curve', new CurveTool())
    .registerTool('text', new TextTool())
    .registerTool('image', new ImageTool())
    .setTool('select')

  toolbar = new Toolbar(paintBoard).init()

  paintBoard.on('line:created', (data) => {
    console.log('直线创建:', data.lineId, data.distance)
  })

  paintBoard.on('area:created', (data) => {
    console.log('区域创建:', data.areaId, data.points)
  })
})

onUnmounted(() => {
  toolbar?.destroy()
  paintBoard?.destroy()
})
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 600px;
  position: relative;
}
</style>
```

### 原生 JavaScript

```html
<link rel="stylesheet" href="node_modules/@4xian/vue-fabric/dist/style.css">
<div id="canvas-container"></div>

<script src="node_modules/fabric/dist/fabric.js"></script>
<script src="node_modules/@4xian/vue-fabric/dist/index.umd.js"></script>
<script>
  const { PaintBoard, LineTool, AreaTool, SelectTool } = VueFabric

  const board = new PaintBoard('#canvas-container', {
    width: 1200,
    height: 800
  }).init()

  board
    .registerTool('select', new SelectTool())
    .registerTool('line', new LineTool())
    .registerTool('area', new AreaTool())
    .setTool('line')
</script>
```

## 核心 API

### PaintBoard 配置项

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| width | number | 1200 | 画布宽度 |
| height | number | 800 | 画布高度 |
| backgroundColor | string | 'transparent' | 背景颜色 |
| backgroundImage | string \| BackgroundImageOptions | - | 背景图 |
| lineColor | string | 'rgba(2, 167, 240, 1)' | 线条颜色 |
| fillColor | string | 'rgba(128, 255, 255, 1)' | 填充颜色 |
| selection | boolean | true | 启用多选 |
| perPixelTargetFind | boolean | false | 像素级碰撞检测 |

### 主要方法

```javascript
// 工具管理
board.registerTool(name, tool)  // 注册工具
board.setTool(name)             // 切换工具

// 颜色设置
board.setLineColor(color)
board.setFillColor(color)

// 缩放控制
board.zoomIn() / board.zoomOut() / board.resetZoom()

// 撤销重做
board.undo() / board.redo()
board.canUndo() / board.canRedo()

// 背景图
board.setBackgroundImage(source, options)

// 导出
board.exportToJSON()            // 导出 JSON
board.importFromJSON(json)      // 导入 JSON
board.exportToImage({ format: 'png', download: true })
board.exportToSVG()

// 数据获取
board.getAreasData()            // 获取所有区域数据
board.getLinesData()            // 获取所有直线数据
board.getCurvesData()           // 获取所有曲线数据
board.getTextsData()            // 获取所有文本数据
board.getCustomObjects()        // 获取所有自定义对象

// 对象操作
board.addText(options)          // 添加文本
board.addImage(options)         // 添加图片
board.updateTextById(id, options)
board.removeById(id)

// 清理
board.clear()
board.destroy()
```

### 事件

```javascript
// 直线事件
board.on('line:created', (data) => {})    // 直线创建
board.on('line:selected', (data) => {})   // 直线选中

// 区域事件
board.on('area:created', (data) => {})    // 区域创建
board.on('area:selected', (data) => {})   // 区域选中

// 曲线事件
board.on('curve:created', (data) => {})   // 曲线创建
board.on('curve:selected', (data) => {})  // 曲线选中

// 文本事件
board.on('text:created', (data) => {})    // 文本创建
board.on('text:changed', (data) => {})    // 文本修改

// 工具与历史
board.on('tool:changed', (name) => {})    // 工具切换
board.on('history:changed', (state) => {}) // 历史变化

// 选择事件
board.on('object:selected', (objects) => {})
board.on('selection:cleared', () => {})

// 画布事件
board.on('canvas:zoomed', (zoom) => {})
board.on('canvas:panned', () => {})
board.on('canvas:cleared', () => {})
board.on('backgroundImage:set', (data) => {})

// 人员追踪
board.on('persons:updated', (data) => {})
board.on('trajectory:shown', (data) => {})
```

## 工具说明

### LineTool（直线工具）

点击两次绘制直线，自动计算距离。

```javascript
const lineTool = new LineTool({
  pointRadius: 3,         // 端点半径
  labelFontSize: 12       // 标签字号
})
```

**输出数据**:

```typescript
{
  lineId: string
  startPoint: Point
  endPoint: Point
  distance: number
  lineColor: string
}
```

### AreaTool（区域工具）

点击添加顶点，靠近起点自动闭合。

```javascript
const areaTool = new AreaTool({
  closeThreshold: 8,      // 闭合距离
  pointRadius: 3,         // 点半径
  labelFontSize: 12,      // 标签字号
  enableFill: true,       // 启用填充
  defaultShowHelpers: true // 显示辅助元素
})
```

**输出数据**:

```typescript
{
  areaId: string
  points: Point[]
  distances: number[]
  lineColor: string
  fillColor: string
}
```

### CurveTool（曲线工具）

点击添加控制点，Enter 完成，使用 Catmull-Rom 样条插值。

```javascript
const curveTool = new CurveTool({
  tension: 0.5,           // 张力系数
  pointRadius: 3,
  closeThreshold: 8,
  enableFill: true
})
```

### SelectTool（选择工具）

点击选择对象，框选多个，Delete/Backspace 删除。

### TextTool（文本工具）

点击添加可编辑文本，双击编辑。

```javascript
const textTool = new TextTool()

// 通过 PaintBoard 添加文本
board.addText({
  x: 100,
  y: 100,
  text: '示例文本',
  fontSize: 16,
  fill: '#ff0000'
})
```

### ImageTool（图片工具）

```javascript
const imageTool = new ImageTool()

// 通过 PaintBoard 添加图片
board.addImage({
  x: 200,
  y: 200,
  src: '/path/to/image.png',
  width: 100,
  height: 100
})
```

## 工具操作快捷键

| 工具 | 操作 |
|------|------|
| SelectTool | 点击选择，框选多个，Delete 删除 |
| LineTool | 第一次点击设置起点，第二次点击设置终点 |
| AreaTool | 点击添加顶点，靠近起点闭合，Ctrl+Z 撤销点，ESC 取消 |
| CurveTool | 点击添加控制点，Enter 完成，靠近起点闭合，ESC 取消 |
| TextTool | 点击添加文本，双击编辑 |

## 人员追踪

```javascript
// 创建追踪器
const tracker = board.createPersonTracker()

// 设置人员
tracker.setPersons([
  { id: 'p1', name: '张三', x: 100, y: 100, lineColor: '#ff0000' },
  { id: 'p2', name: '李四', x: 200, y: 150, lineColor: '#00ff00' }
])

// 更新人员位置
tracker.updatePerson('p1', { x: 150, y: 120 })

// 显示轨迹
tracker.showTrajectory('p1', person, [
  { x: 100, y: 100 },
  { x: 150, y: 120 },
  { x: 200, y: 100 }
])

// 隐藏轨迹
tracker.hideTrajectory('p1')

// 移除人员
tracker.removePerson('p1')

// 清空所有
tracker.clearAll()
```

## 导出选项

```javascript
board.exportToImage({
  format: 'png',         // 'png' | 'jpeg' | 'webp'
  quality: 100,          // 0-100
  multiplier: 2,         // 清晰度倍数
  download: true,        // 自动下载
  filename: 'canvas'     // 文件名
})
```

## 类型定义

```typescript
import type {
  Point,
  PaintBoardOptions,
  CanvasManagerOptions,
  AreaCustomData,
  LineCustomData,
  CurveCustomData,
  TextCustomData,
  CustomImageData,
  PersonData,
  TrajectoryOptions,
  ExportImageOptions
} from '@4xian/vue-fabric'
```

## 开发

```bash
pnpm install     # 安装依赖
pnpm dev         # 开发模式
pnpm build       # 构建
pnpm demo:dev    # 运行演示
```

## License

MPL-2.0
