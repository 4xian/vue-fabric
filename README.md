# @4xian/vue-fabric

基于 [fabric.js](https://fabricjs.com/) v6 的绘图 SDK，面向标注、测量、区域绘制、文本图片叠加和人员轨迹展示场景。

文档以当前 `src/`、`types/index.d.ts` 和测试为准；如果旧文档与源码不一致，以源码为准。

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
  backgroundColor: '#fff',
  zoomOrigin: 'center',
  zoomAnimationDuration: 1000,
  enableWheelZoom: false,
  autoResize: true,
  pixelRatio: 'auto'
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

new Toolbar(board).init()

await board.setBackgroundImage({
  source: '/demo/static/draw-bg.png',
  scaleMode: 'stretch',
  backgroundVpt: true
})

board.on('line:created', data => {
  console.log(data)
})
```

## 当前能力

- 画板核心类：`FabricPaint`，默认导出可自由命名为 `PaintBoard`
- 工具：`select`、`drag`、`line`、`polyline`、`area`、`curve`、`rect`、`text`、`image`
- UI：`Toolbar`、`ColorPicker`
- 编程式文本/图片插入、批量 upsert、按 id 删除
- JSON / PNG / JPEG / WebP / SVG 导出
- 背景图、辅助元素显隐、撤销重做
- `PersonTracker` 人员点位、轨迹、闪烁水波纹
- 缩放视觉尺寸锁定模式和类型排除配置

## 缩放与自适应

`FabricPaintOptions` 当前与缩放相关的重点配置：

- `zoomStep?: number`
- `minZoom?: number`
- `maxZoom?: number`
- `expandMargin?: number`
- `expandSize?: number`
- `zoomOrigin?: 'center' | 'topLeft'`
- `zoomAnimationDuration?: number`
- `enableWheelZoom?: boolean`
- `autoResize?: boolean`
- `autoResizeMode?: 'canvas' | 'viewport'`
- `autoResizeFit?: 'contain' | 'cover' | 'stretch'`
- `referenceSize?: { width: number; height: number }`
- `pixelRatio?: number | 'auto'`
- `lockObjectVisualSizeOnZoom?: boolean`
- `zoomInvariantExcludeTypes?: string[]`

真实语义：

- `zoomIn()`、`zoomOut()`、`setZoom()` 在 `center` 下围绕当前画布内容中心缩放；拖拽平移后不会跳回容器中心。
- `zoomStep` 默认 `0.2`，当前按“额外比例”计算；默认 `zoomIn()` 是乘 `1.2`，`zoomOut()` 是除 `1.2`。
- `minZoom` 默认 `0.2`，`maxZoom` 默认 `3`。
- `expandMargin` 默认 `50`，`expandSize` 默认 `200`；仅在对应自动扩布链路启用时生效。
- `topLeft` 下缩放会保留当前画布左上锚点。
- `resetZoom(zoomScale = 1)` 会按当前显示尺寸归位，可传入还原倍率，默认回到业务 zoom `1`。
- `zoomAnimationDuration` 默认 `500` ms；传 `0` 或负数会关闭动画，回退成同步缩放。
- `zoomIn()`、`zoomOut()`、`setZoom()`、`resetZoom()`、启用后的滚轮缩放，以及 `resize()` / `autoResize()` 触发的 viewport 归位，最终都复用同一套 viewport transform 落地逻辑。
- `CanvasManager` 初始化现在直接吃 `FabricPaintOptions` 里的这组缩放配置，不再单独维护第二套缩放配置来源。
- 动画过程中逐帧触发 `canvas:zooming`，结束时触发 `canvas:zoomed`。
- `enableWheelZoom` 默认 `false`，显式开启后才会监听 `mouse:wheel`。
- `autoResize` 默认 `true`。开启后会监听容器尺寸变化，500ms 防抖后重建当前显示尺寸，并保留当前业务 zoom。
- `autoResizeMode` 默认 `canvas`，保持旧语义：容器变化时同步更新内部基准画布尺寸。
- `autoResizeMode: 'viewport'` 会固定逻辑参考尺寸，只用 viewport 把参考画布适配到新显示尺寸，适合背景图和对象点位需要保持相对一致的场景。
- `autoResizeFit` 默认 `stretch`，仅在 `autoResize=true` 且 `autoResizeMode='viewport'` 时生效；`contain` 会完整显示参考画布，`cover` 会铺满并可能裁切，`stretch` 会按 X/Y 独立缩放并可能变形。
- `referenceSize` 可选；不传时，`autoResizeMode='viewport'` 首次自适应会取当前容器尺寸作为参考尺寸。
- `pixelRatio` 现在只负责清晰度和 backing store，不再参与业务 zoom，也不会改变 `getZoom()`、逻辑坐标或导出值。

## 补偿缩放模式

当 `lockObjectVisualSizeOnZoom: true` 时：

- 几何坐标继续跟随 viewport 缩放和平移
- 线宽、辅助点半径、文字字号、图片显示尺寸按 `1 / zoom` 做补偿
- 导出 JSON 时写出逻辑真值和 `zoomInvariantBase`，不会把当前运行时补偿值当成真实值导出

可通过 `zoomInvariantExcludeTypes` 排除某些类型，让它们继续走 Fabric 正常缩放。常见可选值见 `CustomType`，例如：

```ts
zoomInvariantExcludeTypes: ['text', 'image']
```

## 背景图

设置背景图需要手动调用 `setBackgroundImage()`：

```ts
await board.setBackgroundImage({
  source: '/demo/static/draw-bg.png',
  scaleMode: 'stretch',
  backgroundVpt: true
})
```

注意：

- `FabricPaintOptions.backgroundImage` 类型虽然存在，但当前 `init()` 不会自动应用，仍需手动调用 `setBackgroundImage()`。
- `setBackgroundImage()` 设置的背景图会被锁定为不可选中、不可拖拽、不可缩放，并始终压到最底层。
- `scaleMode: 'fill'` 会裁切，`fit` 会留白，`stretch` 会严格铺满画布，`center` 保持原始尺寸居中。
- `autoResizeMode: 'viewport'` 且 `backgroundVpt: true` 时，`stretch` 会铺满 `referenceSize`，页面尺寸变化只改变 viewport，背景与对象逻辑点位保持同一参考坐标。
- `repeat` 当前只是按原始尺寸放在左上角，不会真正平铺。
- `backgroundVpt` 未显式传值时，若开启了补偿缩放，会默认按 `true` 处理。

## 导入导出

```ts
const json = board.exportToJSON()
await board.importFromJSON(json)

board.exportToImage({
  format: 'png',
  multiplier: 2,
  download: true
})

const svg = board.exportToSVG()
```

注意：

- `exportToJSON()` 默认排除 `text` 和 `image`；如果要完整导出，传 `excludeTypes: []`。
- 导入会自动重绑 helper、对象事件、当前 helper 显隐状态，并重新应用当前缩放补偿和背景图展示。
- `exportToImage()` 导出的是当前视觉画面，`quality` 语义沿用 Fabric，范围按 `0 ~ 1` 使用。

## 辅助元素

当前 helper API 名称沿用历史命名，但作用范围不只 area：

```ts
board.showAllAreaHelpers()
board.hideAllAreaHelpers()
board.toggleAreaHelpers()
board.isHelpersVisible()
```

它们当前会处理：

- `area`
- `curve`
- `line`
- `polyline`
- `rect`

## PersonTracker

```ts
const tracker = board.createPersonTracker({
  pathType: 'curve',
  showMovingMarker: true
})

await tracker.createMultiplePersons(persons)
await tracker.createPersonTraces(id, person, traces)
```

`PersonTracker` 当前会跟随：

- `canvas:zooming`
- `canvas:zoomed`
- `canvas:panned`
- `canvas:resized`

如果开启补偿缩放：

- 轨迹线宽、marker、文字、图片、水波纹都会按当前 zoom 重新计算显示尺寸
- 逻辑点位不改，仍按原始业务坐标工作

## UMD

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
board.setZoom(1.5)
board.resetZoom()
board.resetZoom(0.5)
board.setZoomOrigin('center')

board.resize()
board.enableAutoResize()
board.disableAutoResize()

board.exportToJSON()
board.importFromJSON(json)
board.exportToImage({ format: 'png' })
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

const tracker = board.createPersonTracker()
```

完整 API 见 [docs/API.md](./docs/API.md)，源码职责说明见 [docs/SOURCE.md](./docs/SOURCE.md)。

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
