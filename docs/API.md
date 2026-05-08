# @4xian/vue-fabric API 文档

本文档以当前 `src/` 与 `types/index.d.ts` 为准，描述包的真实导出、方法、事件和使用前置条件。

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

- 默认导出是 `FabricPaint`，你可以按习惯命名成 `PaintBoard`。
- UMD 全局对象是 `VueFabric`，命名导出里使用 `FabricPaint`。

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

board.on('area:created', data => {
  console.log(data)
})
```

## FabricPaint

### 构造函数

```ts
new FabricPaint(container: HTMLElement | string, options?: FabricPaintOptions)
```

### 配置项

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `width` | `number` | `800` | 逻辑宽度 |
| `height` | `number` | `800` | 逻辑高度 |
| `backgroundColor` | `string` | `'transparent'` | 画布背景色 |
| `hoverCursor` | `string` | `'default'` | hover 光标 |
| `moveCursor` | `string` | `'pointer'` | move 光标 |
| `backgroundImage` | `string \| BackgroundImageOptions` | 无 | 类型已定义，但当前 `init()` 不会自动应用，需手动调用 `setBackgroundImage()` |
| `lineColor` | `string` | `'rgba(2, 167, 240, 1)'` | 默认描边色 |
| `fillColor` | `string` | `'rgba(128, 255, 255, 1)'` | 默认填充色 |
| `selection` | `boolean` | `false` | Fabric 框选开关 |
| `preserveObjectStacking` | `boolean` | `true` | 保持对象层级 |
| `perPixelTargetFind` | `boolean` | `false` | 像素级命中检测 |
| `targetFindTolerance` | `number` | `0` | 命中容差 |
| `defaultShowHelpers` | `boolean` | `true` | 初始化辅助元素显示状态 |
| `autoResize` | `boolean` | `false` | 是否启用 `ResizeObserver` |
| `pixelRatio` | `number \| 'auto'` | `'auto'` | 设备像素比，`auto` 会读取 `window.devicePixelRatio` |

### 只读状态

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `currentToolName` | `string` | 当前工具名；未激活时为空字符串 |
| `lineColor` | `string` | 当前线条颜色 |
| `fillColor` | `string` | 当前填充颜色 |

### 生命周期与工具

```ts
init(): this
registerTool(name: string, tool: BaseTool): this
setTool(toolName: string): this
destroy(): void
```

- `init()` 只会初始化一次。
- `registerTool()` 会把 `canvas`、`eventBus`、`paintBoard` 注入到工具实例。

### 颜色与缩放

```ts
setLineColor(color: string): this
setFillColor(color: string): this
zoomIn(origin?: 'center' | 'topLeft'): this
zoomOut(origin?: 'center' | 'topLeft'): this
resetZoom(): this
setZoom(zoom: number | { x: number; y: number }, origin?: 'center' | 'topLeft'): this
getZoom(): number
getPixelRatio(): number
```

- `CanvasManager` 的公开缩放 API 是可用的。
- 当前 `_bindEvents()` 里滚轮缩放和中键平移默认没有挂上，所以不要把它当成开箱即用的默认交互。

### 尺寸与历史

```ts
resize(
  width?: number,
  height?: number,
  reference?: { width: number; height: number },
  origin?: 'center' | 'topLeft'
): this
enableAutoResize(): this
disableAutoResize(): this

undo(): boolean
redo(): boolean
canUndo(): boolean
canRedo(): boolean
pauseHistory(): void
resumeHistory(): void
isHistoryPaused(): boolean
```

### 背景图

```ts
setBackgroundImage(source: string | BackgroundImageOptions): Promise<this>
clearBackgroundImage(): this
getBackgroundImage(): FabricImage | null
```

`BackgroundImageOptions`：

```ts
{
  source: string
  scaleMode?: 'fill' | 'fit' | 'stretch' | 'center' | 'repeat'
  opacity?: number
  backgroundVpt?: boolean
}
```

### 清空、导入导出、事件

```ts
clear(): this
originClear(): this

exportToJSON(options?: ExportJSONOptions | string[]): string
importFromJSON(json: string | object): Promise<void>
exportToImage(options?: ExportImageOptions | 'png' | 'jpeg' | 'webp'): string
exportToSVG(): string

on(event: string, callback: (data?: unknown) => void): this
off(event: string, callback?: (data?: unknown) => void): this

getCanvas(): Canvas | null
getObjects(): FabricObject[] | undefined
getObjectById(id: string): FabricObject | null
getCustomObjects(): Array<{ id: string; type: string; object: FabricObject }>
```

说明：

- `clear()` 会保留当前背景图对象。
- `originClear()` 会走 `canvas.clear()`，然后把背景图重新挂回去。
- `exportToJSON()` 默认会排除 `text` 和 `image` 两类对象；如需完整导出，传 `excludeTypes: []`。

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

- `quality` 走 Fabric `toDataURL()` 语义，范围应按 `0 ~ 1` 使用。

### 数据查询与辅助元素

```ts
getAreasData(): AreaCustomData[]
getTextsData(): TextData[]

showAllAreaHelpers(): this
hideAllAreaHelpers(): this
toggleAreaHelpers(): this
isHelpersVisible(): boolean
```

`showAllAreaHelpers()` / `hideAllAreaHelpers()` 实际会处理：

- `area`
- `curve`
- `line`
- `polyline`
- `rect`

对应事件：

- `areaHelpers:shown`
- `areaHelpers:hidden`

### 文本与图片编程式操作

这些能力依赖已注册的 `TextTool` / `ImageTool`。

```ts
addText(options: AddTextOptions): Text | null
insertText(options: AddTextOptions): Text | null
addImage(options: AddImageOptions): Promise<FabricImage | null>
insertImage(options: AddImageOptions): Promise<FabricImage | null>

updateTextById(id: string, options: Partial<AddTextOptions>): boolean
updateImageById(id: string, options: Partial<AddImageOptions>): boolean

removeById(id: string): boolean

batchInsertTexts(optionsList: AddTextOptions[]): Promise<BatchTextInsertResult | boolean>
batchInsertImages(optionsList: AddImageOptions[]): Promise<BatchImageInsertResult | boolean>
batchRemoveByIds(ids: string[]): Promise<BatchRemoveResult | boolean>
```

说明：

- `insertText()` / `insertImage()` 是 upsert 语义：传入已存在的 `id` 时会更新原对象。
- `batchInsertTexts()` / `batchInsertImages()` 也是按 `id` 执行“存在则更新，不存在则新增”。

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

### 人员轨迹

```ts
createPersonTracker(options?: TraceOptions): PersonTracker
getPersonTracker(): PersonTracker | null
```

## 工具类

### BaseTool

公共生命周期：

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

- 当前 `allowSelection` 默认是 `false`。
- 删除选中对象的键盘逻辑在源码里已注释，不应按默认快捷键理解。

### DragTool

```ts
new DragTool(options?: BaseToolOptions)
```

- 激活后按住 `Ctrl` / `Meta` 拖动画布视口。
- 平移完成时触发 `canvas:panned`。

### LineTool

```ts
new LineTool(options?: LineToolOptions)
```

- 左键第一次点击确定起点，第二次点击确定终点。
- `Esc` 取消当前绘制。

### PolylineTool

```ts
new PolylineTool(options?: PolylineToolOptions)
```

- 左键逐点绘制。
- 右键结束绘制。
- `Esc` 取消。

### AreaTool

```ts
new AreaTool(options: AreaToolOptions)
```

- 建议显式传对象，例如 `new AreaTool({ enableFill: true })`。
- 左键逐点绘制，靠近首点时闭合。
- `Esc` 取消。

### CurveTool

```ts
new CurveTool(options?: CurveToolOptions)
setTension(value: number): void
```

- 左键逐点绘制平滑曲线。
- `Enter` 结束开放曲线。
- 靠近首点时闭合。
- `Esc` 取消。

### RectTool

```ts
new RectTool(options?: RectToolOptions)
```

- 第一次点击确定起点，移动预览，第二次点击完成。
- `Esc` 取消。

### TextTool

```ts
new TextTool(options?: TextToolOptions)
setFontSize(size: number): void
setFontFamily(family: string): void
setTextColor(color: string): void
createTextAt(options: AddTextOptions): CreateTextResult | null
createTextWithoutRender(options: AddTextOptions): CreateTextResult | null
```

- 点击画布时创建默认文本“文本”并进入编辑。
- 文本编辑结束后，如果内容为空，会自动删除。

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

默认按钮顺序：

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

注意：

- `fitZoom` 当前实际调用的是 `resetZoom()`。
- `image` 按钮只负责打开文件选择框，要求先注册 `ImageTool`。

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

支持输入：

- `rgba(...)`
- `rgb(...)`
- `#rrggbb`

## PersonTracker

```ts
new PersonTracker(canvas, eventBus, options?)

createMultiplePersons(persons: PersonData[]): Promise<void>
createSinglePerson(person: PersonData): Promise<void>
removePerson(id: string): boolean

createPersonTraces(id: string, person: PersonData, traces: Point[]): Promise<void>
removePersonTraces(id: string): void

clearAll(): void
clearAllPersons(): void
clearAllTraces(): void

getPersonById(id: string): unknown
getAllPersonIds(): string[]
abortRendering(): void
destroy(): void
```

说明：

- 复用同一个 `id` 调 `createSinglePerson()`，会走更新逻辑。
- `createMultiplePersons()` 支持 `yid` 迁移场景。
- `showMovingMarker`、`markerBase64`、`deleteOld` 等配置都走 `TraceOptions`。

## 事件

### 绘图对象

| 事件 | 数据 |
| --- | --- |
| `line:created` | `{ drawId, startPoint, endPoint, distance }` |
| `line:selected` | `{ drawId, startPoint, endPoint, distance }` |
| `line:clicked` | `{ drawId, startPoint, endPoint, distance }` |
| `polyline:created` | `{ drawId, points, distances }` |
| `polyline:selected` | `{ drawId, points, distances }` |
| `polyline:clicked` | `{ drawId, points, distances }` |
| `area:created` | `{ drawId, points, distances }` |
| `area:selected` | 由 `setupAreaEvents` 发出，包含区域数据 |
| `area:clicked` | 由 `setupAreaEvents` 发出，包含区域数据 |
| `curve:created` | `{ drawId, points, isClosed }` |
| `curve:selected` | `{ drawId, points, isClosed }` |
| `curve:clicked` | `{ drawId, points, isClosed }` |
| `rect:created` | `RectCustomData` |
| `rect:selected` | 由 `setupRectEvents` 发出，包含矩形数据 |
| `rect:clicked` | 由 `setupRectEvents` 发出，包含矩形数据 |
| `text:created` | `{ drawId, text }` 或 `AddTextOptions & { drawId }` |
| `text:changed` | `{ drawId, text }` |
| `text:selected` | `{ drawId, text, object }` |
| `text:clicked` | `{ drawId, text, object }` |
| `text:updated` | `{ id, textObj }` |
| `image:created` | `ImageCustomData` |
| `image:selected` | `{ type: 'image', id, object }` |
| `image:clicked` | `{ id, object }` |
| `image:modified` | `{ id, object }` |
| `image:updated` | `{ id, obj }` 或 `{ id, property, value }` |

### 画布与系统

| 事件 | 数据 |
| --- | --- |
| `tool:changed` | `string` |
| `history:changed` | `{ canUndo, canRedo }` |
| `object:selected` | `FabricObject[]` |
| `selection:cleared` | 无 |
| `object:created` | `FabricObject` |
| `object:modified` | `FabricObject` |
| `object:removed` | `{ id, type }` |
| `objects:deleted` | `number` |
| `canvas:zoomed` | `number` 或 `{ x, y }` |
| `canvas:panned` | 无 |
| `canvas:cleared` | 无 |
| `canvas:loaded` | 无 |
| `canvas:expanded` | `{ width, height }` |
| `canvas:resized` | `{ width, height, scaleX, scaleY, origin }` |
| `backgroundImage:set` | `{ source }` |
| `backgroundImage:cleared` | 无 |
| `backgroundImage:error` | `{ source }` |
| `areaHelpers:shown` | 无 |
| `areaHelpers:hidden` | 无 |
| `mouse:move` | `{ x, y }` |
| `batch:textsInserted` | `{ successCount, failedCount }` |
| `batch:imagesInserted` | `{ successCount, failedCount }` |
| `batch:removed` | `{ removedCount, notFoundCount }` |

### PersonTracker

| 事件 | 数据 |
| --- | --- |
| `person:created` | `PersonData` |
| `person:updated` | `PersonData` |
| `person:removed` | `{ id }` |
| `person:clicked` | `PersonData` |
| `person:statusChange` | `PersonData` |
| `persons:cleared` | 无 |
| `persons:allCleared` | 无 |
| `trace:shown` | `{ id }` |
| `trace:hidden` | `{ id }` |
| `traces:cleared` | 无 |
