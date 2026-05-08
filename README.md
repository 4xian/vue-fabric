# @4xian/vue-fabric

基于 [fabric.js](https://fabricjs.com/) v6 的绘图 SDK，提供一套面向业务标注场景的高层 API、绘图工具、工具栏和人员轨迹能力。

无框架依赖，可用于 Vue、React 或原生 JavaScript。

## 当前能力

- 画板核心类 `FabricPaint`
- 绘图工具：`select`、`drag`、`line`、`polyline`、`area`、`curve`、`rect`、`text`、`image`
- UI 组件：`Toolbar`、`ColorPicker`
- 编程式文本/图片插入、批量 upsert、按 `id` 删除
- JSON / PNG / JPEG / WebP / SVG 导出
- 背景图设置与辅助元素显隐
- `PersonTracker` 人员点位与轨迹展示
- TypeScript 类型声明

## 安装

```bash
pnpm add @4xian/vue-fabric fabric
```

`fabric` 是 `peerDependency`，当前要求 `^6.0.0`。

## 快速开始

```ts
import PaintBoard, {
  SelectTool,
  DragTool,
  LineTool,
  PolylineTool,
  AreaTool,
  CurveTool,
  RectTool,
  TextTool,
  ImageTool,
  Toolbar
} from '@4xian/vue-fabric'
import '@4xian/vue-fabric/style.css'

const board = new PaintBoard('#canvas-container', {
  width: 1000,
  height: 600,
  backgroundColor: '#fff'
}).init()

board
  .registerTool('select', new SelectTool())
  .registerTool('drag', new DragTool())
  .registerTool('line', new LineTool())
  .registerTool('polyline', new PolylineTool())
  .registerTool('area', new AreaTool({ enableFill: true }))
  .registerTool('curve', new CurveTool())
  .registerTool('rect', new RectTool())
  .registerTool('text', new TextTool())
  .registerTool('image', new ImageTool())
  .setTool('select')

const toolbar = new Toolbar(board).init()

board.on('line:created', data => {
  console.log(data)
})
```

## UMD 用法

```html
<link rel="stylesheet" href="node_modules/@4xian/vue-fabric/dist/style.css" />
<div id="canvas-container"></div>

<script src="node_modules/fabric/dist/fabric.js"></script>
<script src="node_modules/@4xian/vue-fabric/dist/vue-fabric.umd.js"></script>
<script>
  const { FabricPaint, SelectTool, AreaTool, Toolbar } = VueFabric

  const board = new FabricPaint('#canvas-container', {
    width: 1000,
    height: 600
  }).init()

  board
    .registerTool('select', new SelectTool())
    .registerTool('area', new AreaTool({ enableFill: true }))
    .setTool('select')

  new Toolbar(board).init()
</script>
```

## 常用 API

```ts
board.registerTool(name, tool)
board.setTool(name)

board.setLineColor(color)
board.setFillColor(color)

board.zoomIn()
board.zoomOut()
board.resetZoom()
board.setZoom(1.5)

board.exportToJSON()
board.importFromJSON(json)
board.exportToImage({ format: 'png', download: true })
board.exportToSVG()

board.addText(options)
board.insertText(options)
board.addImage(options)
board.insertImage(options)

board.batchInsertTexts(list)
board.batchInsertImages(list)
board.batchRemoveByIds(ids)

board.showAllAreaHelpers()
board.hideAllAreaHelpers()
board.toggleAreaHelpers()

const tracker = board.createPersonTracker()
await tracker.createMultiplePersons(persons)
await tracker.createPersonTraces(id, person, traces)
```

完整 API 见 [docs/API.md](./docs/API.md)，源码说明见 [docs/SOURCE.md](./docs/SOURCE.md)。

## 真实使用边界

- `backgroundImage` 虽然在配置类型里存在，但当前 `init()` 不会自动应用，需手动调用 `setBackgroundImage()`。
- `exportToJSON()` 默认排除 `text` 和 `image`，如果你要完整导出，记得传 `excludeTypes: []`。
- 编程式 `addText()` / `addImage()` / 批量接口依赖已注册的 `TextTool` / `ImageTool`。
- `CanvasManager` 的公开缩放 API 可用，但内部滚轮缩放和中键平移监听当前默认未挂载；视口拖动建议使用 `DragTool` 的 `Ctrl` / `Meta` 拖拽。
- `Toolbar` 里的 `fitZoom` 当前行为等价于 `resetZoom()`。

## 开发

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

## 许可证

[MPL-2.0](./LICENSE)
