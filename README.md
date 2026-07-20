# @4xian/vue-fabric

基于 Fabric.js v6 的 TypeScript 绘图 SDK。它提供可注册、可切换的绘图工具体系，内置工具栏、颜色选择器、撤销重做、JSON 导入导出、图片导出、背景图、辅助测量元素和人员轨迹能力，适合标注、测量、区域绘制、画板编辑等业务场景。

`@4xian/vue-fabric` 不绑定 Vue 运行时，Vue、原生 ESM 和 UMD 页面都可以集成。包名保留 `vue-fabric` 是为了延续项目定位和生态命名。

## 特性

- 基于 Fabric.js v6，`fabric` 作为 `peerDependency` 由业务项目自行安装
- 支持 `select`、`drag`、`line`、`polyline`、`area`、`curve`、`pen`、`rect`、`text`、`image` 等工具
- 工具可通过 `registerTool()` 注册，通过 `setTool()` 在运行时互相切换
- 内置 `Toolbar` 和 `ColorPicker`，可直接启用或自行实现 UI
- 支持全局撤销、重做，绘制中的工具可优先处理自身临时状态
- 支持 JSON 导入导出、PNG/JPEG/WebP 导出、SVG 导出
- 支持背景图、响应式画布、缩放视觉补偿、辅助元素显隐和图层重排
- 提供 `PersonTracker` 用于人员点位、轨迹、状态和动画展示

## 安装

```bash
pnpm add @4xian/vue-fabric fabric
```

要求：

- Node.js >= 18
- fabric >= 6

## 快速开始

```ts
import PaintBoard, {
  SelectTool,
  DragTool,
  LineTool,
  PolylineTool,
  AreaTool,
  CurveTool,
  PenTool,
  RectTool,
  TextTool,
  ImageTool,
  Toolbar
} from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

const board = new PaintBoard('#canvas-container', {
  width: 1000,
  height: 600,
  backgroundColor: '#fff',
  autoResize: true,
  enableWheelZoom: true
}).init()

board
  .registerTool('select', new SelectTool())
  .registerTool('drag', new DragTool())
  .registerTool('line', new LineTool())
  .registerTool('polyline', new PolylineTool())
  .registerTool('area', new AreaTool({ enableFill: true }))
  .registerTool('curve', new CurveTool())
  .registerTool('pen', new PenTool())
  .registerTool('rect', new RectTool())
  .registerTool('text', new TextTool())
  .registerTool('image', new ImageTool())
  .setTool('select')

new Toolbar(board).init()

```

## 集成方式

Vue 3 中通常在 `onMounted` 里初始化，在 `onUnmounted` 中销毁：

```vue
<template>
  <div ref="container" class="canvas-container"></div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import PaintBoard, { SelectTool, PenTool, Toolbar } from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

const container = ref<HTMLElement | null>(null)
let board: PaintBoard | null = null
let toolbar: Toolbar | null = null

onMounted(() => {
  board = new PaintBoard(container.value!, { width: 1000, height: 600 }).init()
  board.registerTool('select', new SelectTool()).registerTool('pen', new PenTool()).setTool('select')
  toolbar = new Toolbar(board).init()
})

onUnmounted(() => {
  toolbar?.destroy()
  board?.destroy()
})
</script>
```

React 中可在 `useEffect` 中初始化和销毁：

```tsx
import { useEffect, useRef } from 'react'
import PaintBoard, { SelectTool, PenTool, Toolbar } from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

export function FabricCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const board = new PaintBoard(containerRef.current, {
      width: 1000,
      height: 600,
      autoResize: true
    }).init()

    board
      .registerTool('select', new SelectTool())
      .registerTool('pen', new PenTool({ strokeWidth: 4 }))
      .setTool('select')

    const toolbar = new Toolbar(board).init()

    return () => {
      toolbar.destroy()
      board.destroy()
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: 600 }} />
}
```

UMD 页面使用全局变量 `VueFabric`：

```html
<link rel="stylesheet" href="node_modules/@4xian/vue-fabric/dist/style.css" />
<div id="canvas-container"></div>

<script src="node_modules/fabric/dist/fabric.js"></script>
<script src="node_modules/@4xian/vue-fabric/dist/vue-fabric.umd.js"></script>
<script>
  const { FabricPaint, SelectTool, PenTool, Toolbar } = VueFabric

  const board = new FabricPaint('#canvas-container', { width: 1000, height: 600 }).init()
  board.registerTool('select', new SelectTool()).registerTool('pen', new PenTool()).setTool('select')
  new Toolbar(board).init()
</script>
```

更完整的 Vue、ESM、UMD 集成示例见 [docs/API.md](docs/API.md) 和 [demo](demo/)。

## 常用 API

```ts
board.registerTool(name, tool)
board.setTool(name)
board.undo()
board.redo()
board.canUndo()
board.canRedo()

const json = board.exportToJSON()
await board.importFromJSON(json)
board.exportToImage({ format: 'png', download: true })
const svg = board.exportToSVG()
```

具体参数、事件和数据结构请以 [docs/API.md](docs/API.md) 为准；源码实现说明见 [docs/SOURCE.md](docs/SOURCE.md)。

## 项目结构

```text
src/
  core/      PaintBoard、CanvasManager、EventBus
  tools/     BaseTool 和各类绘图工具
  ui/        Toolbar、ColorPicker
  utils/     导入导出、撤销重做、图层、辅助元素、人员轨迹
  assets/    工具图标
  styles/    内置 UI 样式
types/       对外类型声明
docs/        API 和源码说明
demo/        本地示例
tests/       Vitest 单元测试和集成测试
```

## 运行

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:run
pnpm lint
pnpm lint:fix
pnpm format
pnpm typecheck
pnpm demo
pnpm demo:dev
```

## AI Skills

面向 agent 的集成和诊断说明维护在 `vue-fabric-skills` 仓库：

```text
https://github.com/4xian/vue-fabric-skills
```

当前源码、docs 和 skills 应保持同步。使用 agent 排查 SDK 集成问题时，优先让 agent 读取真实源码和 `docs/`，再参考 skills 中的速查文档。

## License

MPL-2.0
