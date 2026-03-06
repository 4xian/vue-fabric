# @4xian/vue-fabric

基于 [fabric.js](https://fabricjs.com/) v6 的高层绘图工具库，提供开箱即用的 Canvas 绘图 SDK。

无框架依赖，支持 Vue、React、原生 JavaScript 等任意环境。

## 特性

- **多种绘图工具**：选择、拖拽、直线、多边形区域、曲线、矩形、文本、图片
- **内置 UI 组件**：可拖拽工具栏 + HSV 颜色选择器（纯原生 DOM，无框架依赖）
- **完整撤销/重做**：基于 JSON 快照，支持暂停/恢复历史记录
- **画布缩放与平移**：鼠标滚轮缩放、Alt/中键拖拽，支持缩放原点配置
- **背景图支持**：fill / fit / stretch / center / repeat 五种模式，跟随缩放自动更新
- **人员追踪**：实时位置显示、平滑移动动画、状态涟漪效果、轨迹路径展示
- **导出能力**：JSON / PNG / JPEG / WebP / SVG，支持自动下载
- **Retina 屏支持**：自动检测 `devicePixelRatio`
- **自动响应式尺寸**：`ResizeObserver` 自动缩放适配
- **完整 TypeScript 类型定义**

## 安装

```bash
# npm
npm install @4xian/vue-fabric fabric

# pnpm
pnpm add @4xian/vue-fabric fabric

# yarn
yarn add @4xian/vue-fabric fabric
```

> `fabric` 是对等依赖（peerDependency），需要单独安装，要求版本 `^6.0.0`。

## 快速开始

### Vue 3

```vue
<template>
  <div ref="container" class="canvas-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import PaintBoard, {
  SelectTool,
  DragTool,
  LineTool,
  AreaTool,
  CurveTool,
  RectTool,
  TextTool,
  ImageTool,
  Toolbar
} from '@4xian/vue-fabric'
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
    .registerTool('drag', new DragTool())
    .registerTool('line', new LineTool())
    .registerTool('area', new AreaTool({ enableFill: true }))
    .registerTool('curve', new CurveTool())
    .registerTool('rect', new RectTool())
    .registerTool('text', new TextTool())
    .registerTool('image', new ImageTool())
    .setTool('select')

  toolbar = new Toolbar(paintBoard).init()

  paintBoard.on('line:created', data => {
    console.log('直线创建:', data.drawId, data.distance)
  })

  paintBoard.on('area:created', data => {
    console.log('区域创建:', data.drawId, data.points)
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

### 原生 JavaScript（UMD）

```html
<link rel="stylesheet" href="node_modules/@4xian/vue-fabric/dist/style.css" />
<div id="canvas-container"></div>

<script src="node_modules/fabric/dist/fabric.js"></script>
<script src="node_modules/@4xian/vue-fabric/dist/vue-fabric.umd.js"></script>
<script>
  const { PaintBoard, SelectTool, LineTool, AreaTool, Toolbar } = VueFabric

  const board = new PaintBoard(document.getElementById('canvas-container'), {
    width: 1200,
    height: 800
  }).init()

  board
    .registerTool('select', new SelectTool())
    .registerTool('line', new LineTool())
    .registerTool('area', new AreaTool())
    .setTool('select')

  new Toolbar(board).init()
</script>
```

### ESM 模块

```javascript
import PaintBoard, { SelectTool, LineTool, AreaTool } from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

const board = new PaintBoard('#canvas-container', {
  width: 1200,
  height: 800
}).init()

board
  .registerTool('select', new SelectTool())
  .registerTool('line', new LineTool())
  .registerTool('area', new AreaTool())
  .setTool('select')
```

---

## API 参考

### PaintBoard

主画板类，所有功能的入口。

#### 构造函数

```typescript
new PaintBoard(container: HTMLElement | string, options?: FabricPaintOptions)
```

**配置项（FabricPaintOptions）：**

| 属性                     | 类型                               | 默认值                     | 说明                            |
| ------------------------ | ---------------------------------- | -------------------------- | ------------------------------- |
| `width`                  | `number`                           | `1200`                     | 画布宽度                        |
| `height`                 | `number`                           | `800`                      | 画布高度                        |
| `backgroundColor`        | `string`                           | `'transparent'`            | 背景颜色                        |
| `backgroundImage`        | `string \| BackgroundImageOptions` | -                          | 背景图配置                      |
| `lineColor`              | `string`                           | `'rgba(2, 167, 240, 1)'`   | 默认线条颜色                    |
| `fillColor`              | `string`                           | `'rgba(128, 255, 255, 1)'` | 默认填充颜色                    |
| `pixelRatio`             | `number \| 'auto'`                 | `'auto'`                   | 像素比（`'auto'` 自动检测 DPR） |
| `autoResize`             | `boolean`                          | `false`                    | 是否启用自动响应式尺寸          |
| `selection`              | `boolean`                          | `true`                     | 启用框选                        |
| `preserveObjectStacking` | `boolean`                          | `true`                     | 保持对象层级                    |
| `perPixelTargetFind`     | `boolean`                          | `false`                    | 像素级碰撞检测                  |

#### 工具管理

```javascript
board.registerTool(name, toolInstance) // 注册工具，返回 this
board.setTool(name) // 切换工具，返回 this
board.getCurrentTool() // 获取当前工具名称
```

#### 颜色设置

```javascript
board.setLineColor(color) // 设置线条颜色，返回 this
board.setFillColor(color) // 设置填充颜色，返回 this
```

#### 缩放控制

```javascript
board.zoomIn() // 放大（默认步长 1.1x）
board.zoomOut() // 缩小
board.resetZoom() // 重置为 100%
board.setZoom(value) // 设置指定缩放值（0.2 ~ 5）
board.getZoom() // 获取当前缩放值
board.fitZoom() // 适配画布到容器大小
```

#### 撤销/重做

```javascript
board.undo() // 撤销，返回 boolean
board.redo() // 重做，返回 boolean
board.canUndo() // 是否可撤销，返回 boolean
board.canRedo() // 是否可重做，返回 boolean
board.pauseHistory() // 暂停历史记录
board.resumeHistory() // 恢复历史记录
```

#### 背景图

```javascript
// 支持 URL 或 base64
board.setBackgroundImage(source, options)
board.clearBackgroundImage()

// options 配置项：
// { mode: 'fill' | 'fit' | 'stretch' | 'center' | 'repeat' }
```

#### 导出与导入

```javascript
// JSON 序列化
const json = board.exportToJSON()
await board.importFromJSON(json)

// 图片导出
board.exportToImage({
  format: 'png', // 'png' | 'jpeg' | 'webp'
  quality: 100, // 0-100
  multiplier: 2, // 分辨率倍数
  download: true, // 是否触发下载
  filename: 'canvas' // 文件名（不含扩展名）
})

// SVG 导出
const svgStr = board.exportToSVG()
```

#### 数据查询

```javascript
board.getAreasData() // 获取所有区域数据
board.getTextsData() // 获取所有文本数据
board.getCustomObjects() // 获取所有自定义对象（含直线/曲线/矩形等）
board.getObjectById(id) // 按 ID 获取 fabric 对象
```

#### 对象操作

```javascript
// 添加文本（编程方式，不依赖工具）
board.addText({ x, y, text, fontSize, fill, id })
board.insertText({ x, y, text, fontSize, fill, id })     // 不触发历史记录

// 添加图片
board.addImage({ x, y, src, width, height, angle, opacity, id })
board.insertImage({ x, y, src, ... })

// 批量操作
board.batchInsertTexts(textsArray)
board.batchInsertImages(imagesArray)
board.batchRemoveByIds(idsArray)

// 删除
board.removeById(id)

// 更新文本内容
board.updateTextById(id, options)
```

#### 辅助元素控制

```javascript
board.showAllAreaHelpers() // 显示所有区域的距离标签和辅助点
board.hideAllAreaHelpers() // 隐藏所有辅助元素
board.toggleAreaHelpers() // 切换显示/隐藏
```

#### 调整大小

```javascript
board.resize(width, height) // 手动调整画布大小
board.enableAutoResize() // 启用 ResizeObserver 自动响应
board.disableAutoResize() // 禁用自动响应
```

#### 其他

```javascript
board.clear() // 清空画布
board.destroy() // 销毁，释放资源
board.getCanvas() // 获取原始 fabric.Canvas 实例
board.on(event, callback) // 监听事件
board.off(event, callback) // 取消监听
```

---

### 绘图工具

所有工具继承自 `BaseTool`，通过 `registerTool()` 注册后由 `setTool()` 激活。

#### SelectTool（选择工具）

点击选择对象，框选多个，`Delete` / `Backspace` 删除选中对象。

```javascript
const selectTool = new SelectTool()
board.registerTool('select', selectTool)
```

#### DragTool（拖拽工具）

按住 `Ctrl` / `Meta` 键拖拽移动整个画布视口。

```javascript
const dragTool = new DragTool()
board.registerTool('drag', dragTool)
```

#### LineTool（直线工具）

两次点击绘制直线，自动计算并显示距离标签。

```javascript
const lineTool = new LineTool({
  pointRadius: 3, // 端点圆圈半径
  labelFontSize: 12 // 距离标签字号
})
board.registerTool('line', lineTool)
```

**快捷键：** `ESC` 取消当前绘制

**事件数据（drawId 代替旧版 lineId）：**

```typescript
{
  drawId: string
  startPoint: {
    x: number
    y: number
  }
  endPoint: {
    x: number
    y: number
  }
  distance: number
  lineColor: string
}
```

#### AreaTool（区域工具）

点击添加顶点，靠近起点自动闭合，生成多边形。

```javascript
const areaTool = new AreaTool({
  closeThreshold: 8, // 闭合距离（px）
  pointRadius: 3, // 顶点半径
  labelFontSize: 12, // 距离标签字号
  enableFill: true, // 启用填充
  allowOverlap: true, // 允许在已有区域内绘制
  defaultShowHelpers: true // 初始显示辅助元素
})
board.registerTool('area', areaTool)
```

**快捷键：** `ESC` 取消，`Ctrl+Z` 撤销上一个点

**事件数据（drawId 代替旧版 areaId）：**

```typescript
{
  drawId: string
  points: Array<{ x: number; y: number }>
  distances: number[]
  lineColor: string
  fillColor: string
}
```

#### CurveTool（曲线工具）

点击添加控制点，使用 Catmull-Rom 样条生成平滑曲线。

```javascript
const curveTool = new CurveTool({
  tension: 0.5, // 样条张力（0-1）
  pointRadius: 3,
  closeThreshold: 8,
  enableFill: true
})
board.registerTool('curve', curveTool)
```

**快捷键：** `Enter` 完成开放曲线，`ESC` 取消，靠近起点自动闭合

**事件数据（drawId 代替旧版 curveId）：**

```typescript
{
  drawId: string
  points: Array<{ x: number; y: number }>
  isClosed: boolean
  lineColor: string
  fillColor: string
}
```

#### RectTool（矩形工具）

点击起点后移动鼠标实时预览，再次点击完成矩形。

```javascript
const rectTool = new RectTool({
  enableFill: true,
  cornerStyle: 'circle', // 控制点样式
  cornerSize: 8,
  cornerColor: '#ffffff'
})
board.registerTool('rect', rectTool)
```

**事件数据：**

```typescript
{
  drawId: string
  startPoint: {
    x: number
    y: number
  }
  endPoint: {
    x: number
    y: number
  }
  width: number
  height: number
  lineColor: string
  fillColor: string
}
```

#### TextTool（文本工具）

点击画布创建可编辑文本，自动进入编辑模式，空文本退出时自动删除。

```javascript
const textTool = new TextTool()
board.registerTool('text', textTool)

// 编程方式添加文本（不需要激活工具）
board.addText({
  x: 100,
  y: 100,
  text: '示例文本',
  fontSize: 16,
  fill: '#ff0000',
  fontFamily: 'Arial',
  id: 'my-text-1' // 可选，指定自定义 ID
})
```

#### ImageTool（图片工具）

支持 URL 和 base64 两种图片来源，可通过文件对话框选取。

```javascript
const imageTool = new ImageTool()
board.registerTool('image', imageTool)

// 打开文件选择对话框
imageTool.openFileDialog()

// 编程方式添加图片
board.addImage({
  x: 200,
  y: 200,
  src: '/path/to/image.png', // URL 或 base64
  width: 100,
  height: 100,
  angle: 0,
  opacity: 1,
  id: 'my-image-1'
})
```

---

### 快捷键总览

| 工具       | 快捷键                 | 说明             |
| ---------- | ---------------------- | ---------------- |
| SelectTool | `Delete` / `Backspace` | 删除选中对象     |
| LineTool   | `ESC`                  | 取消当前绘制     |
| AreaTool   | `ESC`                  | 取消绘制         |
| AreaTool   | `Ctrl+Z`               | 撤销上一个顶点   |
| CurveTool  | `Enter`                | 完成开放曲线     |
| CurveTool  | `ESC`                  | 取消绘制         |
| CurveTool  | `Ctrl+Z`               | 撤销上一个控制点 |

---

### 事件系统

通过 `board.on(event, callback)` 监听，`board.off(event, callback)` 取消监听。

#### 绘图对象事件

| 事件名           | 数据                                                                    | 说明           |
| ---------------- | ----------------------------------------------------------------------- | -------------- |
| `line:created`   | `{ drawId, startPoint, endPoint, distance, lineColor }`                 | 直线绘制完成   |
| `line:selected`  | 同上                                                                    | 直线被选中     |
| `line:clicked`   | 同上                                                                    | 直线被点击     |
| `area:created`   | `{ drawId, points, distances, lineColor, fillColor }`                   | 区域完成       |
| `area:clicked`   | 同上                                                                    | 区域被点击     |
| `area:selected`  | 同上                                                                    | 区域被选中     |
| `curve:created`  | `{ drawId, points, isClosed, lineColor, fillColor }`                    | 曲线完成       |
| `curve:clicked`  | 同上                                                                    | 曲线被点击     |
| `curve:selected` | 同上                                                                    | 曲线被选中     |
| `rect:created`   | `{ drawId, startPoint, endPoint, width, height, lineColor, fillColor }` | 矩形完成       |
| `rect:clicked`   | 同上                                                                    | 矩形被点击     |
| `text:created`   | `{ drawId, text }`                                                      | 文本创建       |
| `text:changed`   | `{ drawId, text }`                                                      | 文本内容变化   |
| `text:clicked`   | `{ drawId, text, object }`                                              | 文本被点击     |
| `text:selected`  | 同上                                                                    | 文本被选中     |
| `text:updated`   | `{ id, textObj }`                                                       | 文本被编程更新 |
| `image:created`  | `ImageCustomData`                                                       | 图片创建       |
| `image:clicked`  | `{ id, object }`                                                        | 图片被点击     |
| `image:selected` | `{ type, id, object }`                                                  | 图片被选中     |
| `image:modified` | `{ id, object }`                                                        | 图片被修改     |
| `image:updated`  | `{ id, obj }`                                                           | 图片被编程更新 |

#### 画布与系统事件

| 事件名                    | 数据                                | 说明             |
| ------------------------- | ----------------------------------- | ---------------- |
| `tool:changed`            | 工具名称字符串                      | 工具切换         |
| `history:changed`         | `{ canUndo, canRedo }`              | 历史状态变化     |
| `object:selected`         | 选中对象数组                        | 任意对象选中     |
| `object:created`          | fabric 对象                         | 对象添加到画布   |
| `object:modified`         | fabric 对象                         | 对象被修改       |
| `object:removed`          | `{ id, type }`                      | 对象被删除       |
| `objects:deleted`         | 删除数量                            | 选择工具批量删除 |
| `canvas:zoomed`           | 缩放比例                            | 画布缩放         |
| `canvas:panned`           | -                                   | 画布平移完成     |
| `canvas:cleared`          | -                                   | 画布清空         |
| `canvas:loaded`           | -                                   | JSON 导入完成    |
| `canvas:expanded`         | `{ width, height }`                 | 画布尺寸扩展     |
| `canvas:resized`          | `{ width, height, scaleX, scaleY }` | 画布调整大小     |
| `backgroundImage:set`     | `{ source }`                        | 背景图设置成功   |
| `backgroundImage:cleared` | -                                   | 背景图清除       |
| `backgroundImage:error`   | `{ source }`                        | 背景图加载失败   |
| `areaHelpers:shown`       | -                                   | 辅助元素显示     |
| `areaHelpers:hidden`      | -                                   | 辅助元素隐藏     |
| `mouse:move`              | `{ x, y }`                          | 鼠标在画布移动   |
| `batch:textsInserted`     | `{ successCount, failedCount }`     | 批量文字插入完成 |
| `batch:imagesInserted`    | `{ successCount, failedCount }`     | 批量图片插入完成 |
| `batch:removed`           | `{ removedCount, notFoundCount }`   | 批量删除完成     |

---

### Toolbar（工具栏）

内置可拖拽工具栏，纯原生 DOM 实现。

```javascript
import { Toolbar } from '@4xian/vue-fabric'

const toolbar = new Toolbar(paintBoard, {
  tools: [
    'lineColor',
    'fillColor',
    'select',
    'drag',
    'line',
    'area',
    'curve',
    'rect',
    'text',
    'image',
    'undo',
    'redo',
    'zoomIn',
    'zoomOut',
    'fitZoom',
    'download',
    'helpers'
  ],
  visible: true,
  draggable: true // 允许拖拽移动工具栏
})
toolbar.init()

// 销毁
toolbar.destroy()
```

**支持的工具按钮：**

| 按钮名      | 功能             |
| ----------- | ---------------- |
| `lineColor` | 线条颜色选择器   |
| `fillColor` | 填充颜色选择器   |
| `select`    | 选择工具         |
| `drag`      | 拖拽工具         |
| `line`      | 直线工具         |
| `area`      | 区域工具         |
| `curve`     | 曲线工具         |
| `rect`      | 矩形工具         |
| `text`      | 文本工具         |
| `image`     | 图片工具         |
| `undo`      | 撤销             |
| `redo`      | 重做             |
| `zoomIn`    | 放大             |
| `zoomOut`   | 缩小             |
| `fitZoom`   | 适配缩放         |
| `download`  | 下载为 PNG       |
| `helpers`   | 切换距离标签显示 |

---

### ColorPicker（颜色选择器）

纯原生 DOM 实现的 HSV 颜色选择器，支持 RGBA / RGB / HEX 格式输入。

```javascript
import { ColorPicker } from '@4xian/vue-fabric'

const picker = new ColorPicker({
  defaultColor: 'rgba(255, 0, 0, 1)',
  onChange: color => console.log(color)
})

picker.show() // 显示
picker.hide() // 隐藏
picker.toggle() // 切换显示/隐藏
picker.setColor('#00ff00') // 设置颜色
picker.getColor() // 获取当前颜色字符串
picker.getElement() // 获取 DOM 元素
picker.destroy() // 销毁
```

---

### PersonTracker（人员追踪器）

实时人员位置展示与追踪，支持平滑动画、状态涟漪、路径轨迹。

```javascript
// 通过 PaintBoard 创建
const tracker = board.createPersonTracker()

// 批量设置人员（自动平滑动画）
tracker.setPersons(
  [
    { id: 'p1', name: '张三', x: 100, y: 100, lineColor: '#ff4444' },
    { id: 'p2', name: '李四', x: 200, y: 150, lineColor: '#44ff44', base64: '...' }
  ],
  {
    deleteOld: true // 自动清除不在新列表中的旧人员
  }
)

// 更新单个人员位置（带平滑移动动画）
tracker.updatePerson('p1', { x: 150, y: 120, status: 'active' })

// 使用 base64 图片作为标记
tracker.createPerson({
  id: 'p3',
  name: '王五',
  x: 300,
  y: 200,
  base64: 'data:image/png;base64,...' // 自定义头像
})

// 批量渲染（分批处理，防止阻塞）
tracker.createMultiplePersons(personsArray, {
  batchSize: 50, // 每批数量
  batchDelay: 16 // 批次间延迟（ms）
})

// 轨迹展示
tracker.createPersonTraces('p1', person, tracePoints, {
  radius: 4,
  pathType: 'curve', // 'line' | 'curve'
  animationSpeed: 2, // 轨迹动画速度
  color: '#ff4444'
})

// 显示/隐藏轨迹
tracker.showTrace('p1')
tracker.hideTrace('p1')

// 移除
tracker.removePerson('p1')
tracker.clearPersons() // 清除所有人员（保留轨迹）
tracker.clearTraces() // 清除所有轨迹（保留人员）
tracker.clearAll() // 清除所有人员和轨迹
```

**人员追踪事件：**

| 事件名                | 数据         | 说明         |
| --------------------- | ------------ | ------------ |
| `person:created`      | `PersonData` | 人员标记创建 |
| `person:updated`      | `PersonData` | 人员位置更新 |
| `person:removed`      | `{ id }`     | 人员标记移除 |
| `person:clicked`      | `PersonData` | 人员被点击   |
| `person:statusChange` | `PersonData` | 人员状态变化 |
| `persons:cleared`     | -            | 所有人员清除 |
| `trace:shown`         | `{ id }`     | 轨迹显示     |
| `trace:hidden`        | `{ id }`     | 轨迹隐藏     |
| `traces:cleared`      | -            | 所有轨迹清除 |

---

## TypeScript 类型

```typescript
import type {
  Point,
  FabricPaintOptions,
  CanvasManagerOptions,
  BaseToolOptions,
  AreaToolOptions,
  CurveToolOptions,
  LineToolOptions,
  RectToolOptions,
  TextToolOptions,
  ImageToolOptions,
  AreaCustomData,
  LineCustomData,
  CurveCustomData,
  RectCustomData,
  TextCustomData,
  ImageCustomData,
  PersonData,
  TraceOptions,
  ExportImageOptions,
  ExportJSONOptions,
  AddTextOptions,
  AddImageOptions,
  ToolbarOptions,
  ColorPickerOptions,
  ToolName,
  BatchTextInsertResult,
  BatchImageInsertResult,
  BatchRemoveResult
} from '@4xian/vue-fabric'
```

---

## 构建产物

| 文件                         | 格式       | 说明                                    |
| ---------------------------- | ---------- | --------------------------------------- |
| `dist/vue-fabric.js`         | ESM        | 支持 Tree-shaking，推荐在打包项目中使用 |
| `dist/vue-fabric.umd.js`     | UMD        | 全局变量 `VueFabric`，适合 CDN 引入     |
| `dist/vue-fabric.umd.min.js` | UMD 压缩   | 体积更小，需单独引入 CSS                |
| `dist/style.css`             | CSS        | 工具栏和颜色选择器样式                  |
| `dist/index.d.ts`            | TypeScript | 完整类型声明                            |

---

## 开发

```bash
pnpm install      # 安装依赖
pnpm dev          # 监听模式构建
pnpm build        # 构建生产产物
pnpm demo         # 启动演示服务（端口 3000）
pnpm demo:dev     # 并发运行 dev + demo
pnpm test         # 运行测试（watch 模式）
pnpm test:run     # 单次运行测试
pnpm lint         # ESLint 检查
pnpm lint:fix     # ESLint 自动修复
pnpm format       # Prettier 格式化
pnpm typecheck    # TypeScript 类型检查
```

### 提交规范

项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，通过 commitlint 强制执行。

```bash
git commit -m "feat: 添加新功能"
git commit -m "fix: 修复某个 bug"
git commit -m "docs: 更新文档"
```

---

## 许可证

[MPL-2.0](./LICENSE)
