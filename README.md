# @4xian/vue-fabric

基于 fabric.js 的二次封装绘图工具库，提供开箱即用的画板组件。

## 特性

- 多种绘图工具：选择、多边形区域、曲线、文本
- 内置颜色选择器和工具栏
- 撤销/重做支持
- 画布缩放与平移
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
import PaintBoard, { LineTool, SelectTool, TextTool, CurveTool, Toolbar } from '@4xian/vue-fabric'
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
    .registerTool('text', new TextTool())
    .registerTool('curve', new CurveTool())
    .setTool('select')

  toolbar = new Toolbar(paintBoard).init()

  paintBoard.on('area:created', (data) => {
    console.log('区域创建:', data)
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
  const { PaintBoard, LineTool, SelectTool } = VueFabric

  const board = new PaintBoard('#canvas-container', {
    width: 1200,
    height: 800
  }).init()

  board
    .registerTool('select', new SelectTool())
    .registerTool('line', new LineTool())
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
| lineColor | string | 'rgba(2, 167, 240, 1)' | 线条颜色 |
| fillColor | string | 'rgba(128, 255, 255, 1)' | 填充颜色 |

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

// 导出
board.exportToJSON()            // 导出 JSON
board.importFromJSON(json)      // 导入 JSON
board.exportToImage({ format: 'png', download: true })
board.exportToSVG()

// 数据获取
board.getAreasData()            // 获取所有区域数据
board.getTextsData()            // 获取所有文本数据

// 清理
board.clear()
board.destroy()
```

### 事件

```javascript
board.on('area:created', (data) => {})    // 区域创建
board.on('area:selected', (data) => {})   // 区域选中
board.on('curve:created', (data) => {})   // 曲线创建
board.on('text:created', (data) => {})    // 文本创建
board.on('tool:changed', (name) => {})    // 工具切换
board.on('history:changed', (state) => {}) // 历史变化
```

## 工具操作说明

| 工具 | 操作 |
|------|------|
| SelectTool | 点击选择，框选多个，Delete 删除 |
| LineTool | 点击添加顶点，靠近起点闭合，Ctrl+Z 撤销点，ESC 取消 |
| CurveTool | 点击添加控制点，Enter 完成，靠近起点闭合，ESC 取消 |
| TextTool | 点击添加文本，双击编辑 |

## 开发

```bash
pnpm install     # 安装依赖
pnpm dev         # 开发模式
pnpm build       # 构建
pnpm demo:dev    # 运行演示
```

## License

MPL-2.0
