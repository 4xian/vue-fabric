# @4xian/vue-fabric API

本文档以当前 `src/index.ts`、`types/index.d.ts`、`src/core/PaintBoard.ts`、`src/core/CanvasManager.ts` 为准。

## 包导出

```ts
import PaintBoard, {
  FabricPaint,
  EventBus,
  CanvasManager,
  Toolbar,
  ColorPicker,
  BaseTool,
  SelectTool,
  DragTool,
  LineTool,
  PolylineTool,
  AreaTool,
  CurveTool,
  RectTool,
  TextTool,
  ImageTool,
  PersonTracker,
  SERIALIZATION_PROPERTIES,
  CustomType
} from '@4xian/vue-fabric'
```

- 默认导出是 `FabricPaint`
- 业务侧可把默认导出重命名为 `PaintBoard`
- UMD 下请从 `VueFabric.FabricPaint` 取画板类

## FabricPaint

### 构造函数

```ts
new FabricPaint(container: HTMLElement | string, options?: FabricPaintOptions)
```

### FabricPaintOptions

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `width` | `number` | `800` | 初始化宽度 |
| `height` | `number` | `800` | 初始化高度 |
| `backgroundColor` | `string` | `'transparent'` | 画布底色 |
| `hoverCursor` | `string` | `'default'` | hover 光标 |
| `moveCursor` | `string` | `'pointer'` | move 光标 |
| `zoomOrigin` | `'center' \| 'topLeft'` | `'center'` | 统一缩放原点 |
| `enableWheelZoom` | `boolean` | `false` | 是否绑定滚轮缩放 |
| `backgroundImage` | `string \| BackgroundImageOptions` | 无 | 当前仅定义类型，`init()` 不会自动应用 |
| `lineColor` | `string` | `'rgba(2, 167, 240, 1)'` | 默认线条颜色 |
| `fillColor` | `string` | `'rgba(128, 255, 255, 1)'` | 默认填充颜色 |
| `selection` | `boolean` | `false` | Fabric 框选开关 |
| `preserveObjectStacking` | `boolean` | `true` | 保持对象层级 |
| `perPixelTargetFind` | `boolean` | `false` | 像素级命中 |
| `targetFindTolerance` | `number` | `0` | 命中容差 |
| `defaultShowHelpers` | `boolean` | `true` | 初始 helper 显示状态 |
| `autoResize` | `boolean` | `false` | 监听容器尺寸变化并重算显示层 |
| `autoResizeMode` | `'canvas' \| 'viewport'` | `'canvas'` | `canvas` 保持旧语义；`viewport` 固定参考尺寸后用 viewport 自适应 |
| `autoResizeFit` | `'contain' \| 'cover' \| 'stretch'` | `'contain'` | `viewport` 模式下的自适应方式 |
| `referenceSize` | `{ width: number; height: number }` | 容器尺寸 | `viewport` 模式的逻辑参考尺寸 |
| `pixelRatio` | `number \| 'auto'` | `'auto'` | 仅影响清晰度和 backing store |
| `lockObjectVisualSizeOnZoom` | `boolean` | `false` | 是否开启视觉尺寸补偿缩放 |
| `zoomInvariantExcludeTypes` | `string[]` | `[]` | 开启补偿缩放时排除的类型 |

### BackgroundImageOptions

```ts
{
  source: string
  scaleMode?: 'fill' | 'fit' | 'stretch' | 'center' | 'repeat'
  opacity?: number
  backgroundVpt?: boolean
}
```

真实行为：

- `fill`：按最大缩放比铺满，可能裁切
- `fit`：按最小缩放比完整显示，可能留白
- `stretch`：强制铺满当前画布
- `center`：原始尺寸居中
- `repeat`：当前仅原始尺寸放在左上角，不会真正平铺

### 只读状态

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `currentToolName` | `string` | 当前工具名 |
| `lineColor` | `string` | 当前线色 |
| `fillColor` | `string` | 当前填充色 |

### 生命周期

```ts
init(): this
destroy(): void
```

说明：

- `init()` 只会初始化一次
- `destroy()` 会销毁工具、`PersonTracker`、`ResizeObserver`、事件总线和 Fabric canvas

### 工具注册与切换

```ts
registerTool(name: string, tool: BaseTool): this
setTool(toolName: string): this
```

常用工具名：

- `select`
- `drag`
- `line`
- `polyline`
- `area`
- `curve`
- `rect`
- `text`
- `image`

### 颜色与缩放

```ts
setLineColor(color: string): this
setFillColor(color: string): this

zoomIn(origin?: ZoomOrigin): this
zoomOut(origin?: ZoomOrigin): this
setZoom(zoom: number | ZoomScale, origin?: ZoomOrigin): this
resetZoom(zoomScale?: number | ZoomScale): this
setZoomOrigin(origin: ZoomOrigin): this
getZoom(): number
getPixelRatio(): number
```

相关类型：

```ts
type ZoomOrigin = 'center' | 'topLeft'

type ZoomScale = {
  x: number
  y: number
}
```

真实行为：

- `zoomIn()`、`zoomOut()`、`setZoom()` 在 `center` 下围绕当前画布内容中心缩放，拖拽平移后不会跳回容器中心
- `topLeft` 下缩放会保留当前画布左上锚点
- `enableWheelZoom=true` 时滚轮缩放也走同一套逻辑
- `getZoom()` 返回业务 zoom，不受 `pixelRatio` 影响
- `resetZoom()` 在当前显示尺寸上回到业务 zoom `1`
- `resetZoom(0.5)` 这类调用会按指定业务倍率归位

### resize 与 autoResize

```ts
resize(
  width?: number,
  height?: number,
  reference?: { width: number; height: number },
  origin?: 'center' | 'topLeft'
): this

enableAutoResize(): this
disableAutoResize(): this
```

真实行为：

- `resize()` 不会遍历对象去改 `left/top/points/scaleX/scaleY`
- `resize()` 会重建当前显示尺寸、更新 viewport，并保留当前业务 zoom
- `reference` 只在 `autoResize=true` 且 `autoResizeMode='viewport'` 时生效，用作本次 resize 的逻辑参考尺寸
- `autoResize` 通过 `ResizeObserver` 监听容器变化，500ms 防抖后调用 `resize()`
- `autoResize` 会同步触发背景图重算、补偿缩放重算、`PersonTracker` 重算
- `autoResizeMode='canvas'` 是默认兼容模式，会把内部基准画布尺寸更新为新的显示尺寸
- `autoResizeMode='viewport'` 会固定 `referenceSize`，只改变显示尺寸与 viewport transform
- `autoResizeFit='contain'` 完整显示参考画布，`cover` 铺满显示区域并可能裁切，`stretch` 按 X/Y 独立缩放并可能变形
- `referenceSize` 不传时，首次自适应取当前容器尺寸

### 历史记录

```ts
undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
pauseHistory(): void
resumeHistory(): void
isHistoryPaused(): boolean
```

说明：

- `undo()` / `redo()` 先让当前正在绘制的工具处理自身临时状态
- 工具没有可撤销临时状态时，才回退到全局 `UndoRedoManager`

### 背景图

```ts
setBackgroundImage(source: string | BackgroundImageOptions): Promise<this>
clearBackgroundImage(): this
getBackgroundImage(): FabricImage | null
```

真实行为：

- 背景图会被锁定：不可选中、不可拖拽、不可缩放、始终在最底层
- `backgroundVpt` 未显式传入时，若开启补偿缩放，会默认跟随 viewport
- `autoResizeMode='viewport'` 且 `backgroundVpt=true` 时，背景图按 `referenceSize` 计算缩放，页面尺寸变化不会改写背景与对象点位的参考关系
- 构造参数里的 `backgroundImage` 当前不会在 `init()` 自动调用

### 清空、导入、导出

```ts
clear(): this
originClear(): this

exportToJSON(options?: ExportJSONOptions | string[]): string
importFromJSON(json: string | object): Promise<void>
exportToImage(options?: ExportImageOptions | 'png' | 'jpeg' | 'webp'): string
exportToSVG(): string
```

`ExportJSONOptions`：

```ts
{
  additionalProperties?: string[]
  excludeTypes?: Array<'line' | 'polyline' | 'area' | 'curve' | 'text' | 'image' | 'rect'>
}
```

`ExportImageOptions`：

```ts
{
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  multiplier?: number
  download?: boolean
  filename?: string
}
```

说明：

- `clear()` 会保留当前背景图对象
- `originClear()` 会走 `canvas.clear()`，然后把 SDK 内部缓存的背景图重新挂回去
- `exportToJSON()` 默认排除 `text` 和 `image`
- 若开启补偿缩放，导出的 JSON 会写逻辑真值和 `zoomInvariantBase`，不是当前运行时补偿值
- `importFromJSON()` 会自动重绑 helper、对象事件、helper 显隐状态，并重新应用当前 viewport 展示
- `exportToImage()` 导出当前视觉画面，不做逻辑归一化

### 数据查询与 helper

```ts
getCanvas(): Canvas | null
getObjects(): FabricObject[] | undefined
getObjectById(id: string): FabricObject | null
getCustomObjects(): Array<{ id: string; type: string; object: FabricObject }>

getAreasData(): AreaCustomData[]
getTextsData(): TextData[]

showAllAreaHelpers(): this
hideAllAreaHelpers(): this
toggleAreaHelpers(): this
isHelpersVisible(): boolean
```

说明：

- `showAllAreaHelpers()` / `hideAllAreaHelpers()` 名称沿用历史，但当前会处理 `area`、`curve`、`line`、`polyline`、`rect`

### 文本与图片编程式接口

这些能力依赖已注册的 `TextTool` / `ImageTool`。

```ts
addText(options: AddTextOptions): Text | null
insertText(options: AddTextOptions): Text | null
updateTextById(id: string, options: Partial<AddTextOptions>): boolean

addImage(options: AddImageOptions): Promise<FabricImage | null>
insertImage(options: AddImageOptions): Promise<FabricImage | null>
updateImageById(id: string, options: Partial<AddImageOptions>): boolean

removeById(id: string): boolean

batchInsertTexts(optionsList: AddTextOptions[]): Promise<BatchTextInsertResult | boolean>
batchInsertImages(optionsList: AddImageOptions[]): Promise<BatchImageInsertResult | boolean>
batchRemoveByIds(ids: string[]): Promise<BatchRemoveResult | boolean>
```

`AddTextOptions`：

```ts
{
  id?: string
  x: number
  y: number
  text: string
  editable?: boolean
  fontSize?: number
  fontFamily?: string
  fill?: string
  fontWeight?: string | number
  fontStyle?: string
  textAlign?: string
  selectable?: boolean
  hasControls?: boolean
  hasBorders?: boolean
  perPixelTargetFind?: boolean
  textOrigin?: 'left' | 'center' | 'right'
}
```

`AddImageOptions`：

```ts
{
  id?: string
  x: number
  y: number
  src?: string
  base64?: string
  width?: number
  height?: number
  selectable?: boolean
  hasControls?: boolean
  hasBorders?: boolean
  angle?: number
  scaleX?: number
  scaleY?: number
  opacity?: number
  lockMovementX?: boolean
  lockMovementY?: boolean
  lockScalingX?: boolean
  lockScalingY?: boolean
}
```

说明：

- `insertText()` / `insertImage()` 是 upsert 语义
- `batchInsertTexts()` / `batchInsertImages()` 也是按 id 走“存在则更新，不存在则新增”
- 文字和图片更新后会同步刷新补偿缩放基线

### PersonTracker

```ts
createPersonTracker(options?: TraceOptions): PersonTracker
getPersonTracker(): PersonTracker | null
```

`TraceOptions`：

```ts
{
  radius?: number
  strokeWidth?: number
  fontSize?: number
  animationSpeed?: number
  textColor?: string
  lineWidth?: number
  pathType?: 'line' | 'curve'
  blinkInterval?: number
  displayDuration?: number
  batchSize?: number
  blinkReasons?: string[]
  deleteOld?: boolean
  fillColor?: string
  moveAnimationSpeed?: number
  minMoveAnimationDuration?: number
  maxMoveAnimationDuration?: number
  markerBase64?: string
  showMovingMarker: boolean
}
```

说明：

- 一个 `FabricPaint` 同时只维护一个活动 `PersonTracker`
- 若开启补偿缩放，`PersonTracker` 的轨迹线、marker、文字、图片、水波纹也会一起重算显示尺寸

## 工具类

### BaseTool

```ts
bindCanvas(canvas, eventBus, paintBoard): void
activate(): void
deactivate(): void
isDrawing(): boolean
canUndoTool(): boolean
canRedoTool(): boolean
undo(): boolean
redo(): boolean
getPointer(opt): Point
destroy(): void
```

### SelectTool

```ts
new SelectTool(options?: SelectToolOptions)
```

额外选项：

- `allowSelection?: boolean`

### DragTool

```ts
new DragTool(options?: BaseToolOptions)
```

真实行为：

- 视口拖拽靠 `DragTool`
- 激活后按住 `Ctrl` / `Meta` 拖动画布
- `CanvasManager` 里的中键/Alt 平移监听当前默认未启用

### LineTool

```ts
new LineTool(options?: LineToolOptions)
```

行为：

- 两次左键完成一条线
- `Escape` 取消当前绘制

### PolylineTool

```ts
new PolylineTool(options?: PolylineToolOptions)
```

行为：

- 左键逐点绘制
- `Enter` 或右键结束绘制
- `Escape` 取消

### AreaTool

```ts
new AreaTool(options?: AreaToolOptions)
```

行为：

- 左键逐点绘制
- 靠近首点闭合
- `Escape` 取消

### CurveTool

```ts
new CurveTool(options?: CurveToolOptions)
setTension(value: number): void
```

行为：

- 左键逐点绘制平滑曲线
- 靠近首点可闭合
- `Enter` 结束开放曲线
- `Escape` 取消

### RectTool

```ts
new RectTool(options?: RectToolOptions)
```

行为：

- 第一次点击确定起点
- 第二次点击确定终点
- `Escape` 取消

### TextTool

```ts
new TextTool(options?: TextToolOptions)
setFontSize(size: number): void
setFontFamily(family: string): void
setTextColor(color: string): void
createTextAt(options: AddTextOptions): CreateTextResult | null
createTextWithoutRender(options: AddTextOptions): CreateTextResult | null
```

### ImageTool

```ts
new ImageTool(options?: ImageToolOptions)
openFileDialog(): void
addImageAt(options: AddImageOptions): Promise<CreateImageResult | null>
addImageWithoutRender(options: AddImageOptions): Promise<CreateImageResult | null>
setAngle(id: string, angle: number): boolean
setOpacity(id: string, opacity: number): boolean
setPosition(id: string, x: number, y: number): boolean
setScale(id: string, scaleX: number, scaleY?: number): boolean
setSize(id: string, width: number, height?: number): boolean
setSelectable(id: string, selectable: boolean): boolean
setLockMovement(id: string, locked: boolean): boolean
setLockScaling(id: string, locked: boolean): boolean
setControls(id: string, hasControls: boolean, hasBorders?: boolean): boolean
getImageById(id: string): FabricImage | null
```

## Toolbar

```ts
new Toolbar(board: FabricPaint, options?: ToolbarOptions)
init(): this
setActiveTool(name: string): void
setHelpersVisible(visible: boolean): void
getHelpersVisible(): boolean
show(): void
hide(): void
isVisible(): boolean
setDraggable(draggable: boolean): void
isDraggable(): boolean
destroy(): void
```

`ToolbarOptions`：

```ts
{
  tools?: string[]
  visible?: boolean
  draggable?: boolean
}
```

默认工具顺序：

```ts
[
  'lineColor',
  'fillColor',
  'select',
  'drag',
  'line',
  'polyline',
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
]
```

说明：

- `fitZoom` 当前调用的是 `resetZoom()`
- `image` 按钮只负责触发 `ImageTool.openFileDialog()`

## ColorPicker

```ts
new ColorPicker(options?: ColorPickerOptions)
getElement(): HTMLDivElement | null
show(): void
hide(): void
toggle(): void
setColor(color: string): void
getColor(): string
destroy(): void
```

## 事件

### 绘图与对象

| 事件 | 说明 |
| --- | --- |
| `line:created` | 线段创建 |
| `line:selected` | 线段选中 |
| `line:clicked` | 线段点击 |
| `polyline:created` | 折线创建 |
| `polyline:selected` | 折线选中 |
| `polyline:clicked` | 折线点击 |
| `area:created` | 区域创建 |
| `area:selected` | 区域选中 |
| `area:clicked` | 区域点击 |
| `curve:created` | 曲线创建 |
| `curve:selected` | 曲线选中 |
| `curve:clicked` | 曲线点击 |
| `rect:created` | 矩形创建 |
| `rect:selected` | 矩形选中 |
| `rect:clicked` | 矩形点击 |
| `text:created` | 文本创建 |
| `text:changed` | 文本内容变化 |
| `text:selected` | 文本选中 |
| `text:clicked` | 文本点击 |
| `text:updated` | 编程式更新文本 |
| `image:created` | 图片创建 |
| `image:selected` | 图片选中 |
| `image:clicked` | 图片点击 |
| `image:modified` | 图片修改完成 |
| `image:updated` | 编程式更新图片 |

### 画布与系统

| 事件 | 说明 |
| --- | --- |
| `tool:changed` | 工具切换 |
| `history:changed` | 历史状态变化 |
| `object:selected` | Fabric selection 创建或更新 |
| `selection:cleared` | 清除选中 |
| `object:created` | 任意对象加入画布 |
| `object:modified` | 任意对象修改 |
| `object:removed` | 通过 id 删除对象 |
| `objects:deleted` | 批量删除 |
| `canvas:zoomed` | 缩放变化 |
| `canvas:panned` | 平移完成 |
| `canvas:cleared` | 画布清空 |
| `canvas:loaded` | JSON 导入完成 |
| `canvas:expanded` | `CanvasManager` 自动扩布 |
| `canvas:resized` | resize / autoResize 完成 |
| `backgroundImage:set` | 背景图设置成功 |
| `backgroundImage:cleared` | 背景图清空 |
| `backgroundImage:error` | 背景图加载失败 |
| `areaHelpers:shown` | helper 显示 |
| `areaHelpers:hidden` | helper 隐藏 |
| `mouse:move` | 鼠标逻辑坐标移动 |
| `batch:textsInserted` | 批量文本插入完成 |
| `batch:imagesInserted` | 批量图片插入完成 |
| `batch:removed` | 批量删除完成 |

### PersonTracker

| 事件 | 说明 |
| --- | --- |
| `person:created` | 人员 marker 创建 |
| `person:updated` | 人员 marker 更新 |
| `person:removed` | 人员 marker 删除 |
| `person:clicked` | 人员 marker 点击 |
| `person:statusChange` | 人员状态变化 |
| `persons:cleared` | 清空所有人员 |
| `persons:allCleared` | 人员和轨迹全部清空 |
| `trace:shown` | 轨迹显示 |
| `trace:hidden` | 轨迹移除 |
| `traces:cleared` | 轨迹全部清空 |
