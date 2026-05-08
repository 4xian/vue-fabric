# @4xian/vue-fabric 源码说明

本文档说明当前仓库的真实源码结构、模块职责和几个容易被误读的实现边界。

## 目录结构

```text
src/
├── index.ts
├── core/
│   ├── PaintBoard.ts
│   ├── CanvasManager.ts
│   └── EventBus.ts
├── tools/
│   ├── BaseTool.ts
│   ├── SelectTool.ts
│   ├── DragTool.ts
│   ├── LineTool.ts
│   ├── PolylineTool.ts
│   ├── AreaTool.ts
│   ├── CurveTool.ts
│   ├── RectTool.ts
│   ├── TextTool.ts
│   └── ImageTool.ts
├── ui/
│   ├── Toolbar.ts
│   └── ColorPicker.ts
├── utils/
│   ├── areaEvents.ts
│   ├── rectEvents.ts
│   ├── export.ts
│   ├── geometry.ts
│   ├── generateId.ts
│   ├── ObjectPool.ts
│   ├── PersonTracker.ts
│   ├── settings.ts
│   ├── throttle.ts
│   └── UndoRedoManager.ts
├── assets/svg/
└── styles/

types/
└── index.d.ts

tests/
├── unit/
├── integration/
└── fixtures/

demo/
├── index.html
└── esm/
```

## 入口与导出

`src/index.ts` 做了三件事：

1. 默认导出 `FabricPaint`
2. 命名导出核心类、工具类、UI 组件、`PersonTracker`
3. 命名导出公共类型以及 `SERIALIZATION_PROPERTIES`、`CustomType`

这里有两个结论：

- 对外类名是 `FabricPaint`，不是源码文件名里的 `PaintBoard`。
- 默认导出可以被业务侧自由起名成 `PaintBoard`，但命名导出要写 `FabricPaint`。

## PaintBoard.ts

`src/core/PaintBoard.ts` 是总入口，负责把画布、工具系统、事件总线、历史管理、背景图、导出导入、辅助元素显隐和人员轨迹串起来。

### 初始化流程

`init()` 当前流程是：

1. `_createCanvas()`
2. `_initCanvasManager()`
3. `_initUndoRedo()`
4. `_bindEvents()`
5. 如果 `autoResize` 为真，则启用 `ResizeObserver`

两个要点：

- `_initialized` 阻止重复初始化。
- `options.backgroundImage` 的自动应用逻辑现在被注释掉了，所以构造配置里的 `backgroundImage` 不会在 `init()` 时自动生效。

### 画布尺寸和像素比

`_createCanvas()` 用逻辑尺寸乘 `pixelRatio` 创建底层 Fabric canvas，再把 wrapper 和上下层 canvas 的 CSS 尺寸设回逻辑尺寸。

这意味着：

- `width` / `height` 是逻辑尺寸。
- Retina 支持不是靠 Fabric 默认的 `enableRetinaScaling`，而是靠库自己乘了 `_pixelRatio`。
- 如果 `ratio !== 1`，会在初始化时调用 `canvas.setZoom(ratio)`。

### 工具系统

`registerTool()` 会把工具实例放进 `Map<string, BaseTool>`，并调用 `tool.bindCanvas(...)` 注入依赖。

`setTool()` 会：

1. 先 `deactivate()` 当前工具
2. 再 `activate()` 目标工具
3. 最后发出 `tool:changed`

工具切换不是 Fabric 原生能力，是这层策略模式包装。

### 缩放、平移、resize

`PaintBoard` 暴露的缩放入口最终都走 `CanvasManager`：

- `zoomIn`
- `zoomOut`
- `resetZoom`
- `setZoom`
- `getZoom`

`resize()` 不是简单改 canvas 尺寸，而是：

1. 计算新旧逻辑尺寸比例
2. 遍历对象并缩放 `scaleX` / `scaleY` / `left` / `top`
3. 更新底层像素尺寸和 DOM 样式尺寸
4. 发出 `canvas:resized`

这也是为什么文档里不能把它写成“纯视口缩放”。

### 辅助元素体系

辅助元素不是临时态 UI，而是实际 Fabric 对象：

- `line` 有端点和距离标签
- `polyline` 有点和标签
- `area` 有点、边、标签
- `curve` 有点和标签
- `rect` 有宽高标签

`showAllAreaHelpers()` / `hideAllAreaHelpers()` 实际处理的不是只有 `area`，而是所有上述自定义图元。

命名是旧的，作用面已经扩大了。

### 文本、图片、批量接口

`addText()` / `addImage()` / `insertText()` / `insertImage()` 不是自己创建对象，而是转发给已注册的 `TextTool` / `ImageTool`。

因此这些 API 的前置条件是：

- 先 `registerTool('text', new TextTool())`
- 或先 `registerTool('image', new ImageTool())`

`insertText()` / `insertImage()` 是 upsert 语义：

- 传入 `id`
- 如果对象已存在且类型匹配，则更新
- 否则新建

`batchInsertTexts()` / `batchInsertImages()` 也是同一套语义，只是改成批量。

### 人员轨迹入口

`createPersonTracker()` 会：

1. 校验 canvas 已初始化
2. 如果旧 tracker 存在，先 `destroy()`
3. 创建新的 `PersonTracker`
4. 挂到 `_personTracker`

这意味着一个 `FabricPaint` 同时只维护一个活动 `PersonTracker`。

## CanvasManager.ts

`CanvasManager` 主要负责：

- 缩放计算
- 视口平移
- 对象靠边时扩展画布

但当前实现有一个非常关键的事实：

- `_bindEvents()` 里的 `mouse:wheel`、`mouse:down`、`mouse:move`、`mouse:up`、`object:moving` 监听全部被注释了

所以当前真实状态是：

- 公共方法 `zoomIn()` / `zoomOut()` / `setZoom()` / `resetZoom()` 可用
- 内部写好的滚轮缩放、中键平移、自动扩展逻辑默认不生效

这点必须和“源码存在”区分开。

## EventBus.ts

`EventBus` 是一个轻量 `Map<string, Set<callback>>` 发布订阅实现。

职责很纯：

- `on`
- `off`
- `emit`
- `clear`

它让：

- 工具层
- `PaintBoard`
- `Toolbar`
- `PersonTracker`
- 导入导出重绑逻辑

之间通过事件协作，而不是直接互相引用业务细节。

## BaseTool 与工具体系

### BaseTool.ts

所有工具都继承 `BaseTool`。

基类提供：

- `bindCanvas()`
- `activate()` / `deactivate()`
- `onActivate()` / `onDeactivate()`
- `onMouseDown()` / `onMouseMove()` / `onMouseUp()` / `onKeyDown()`
- `undo()` / `redo()` 能力占位

工具激活时会挂：

- Fabric `mouse:*` 事件
- `document` 的 `keydown`

注意：基类没有统一挂 `keyup`，所以像 `DragTool` 里写的 `onKeyUp()` 当前不会自动生效。

### SelectTool.ts

当前选择工具非常克制：

- 激活时设置 `canvas.selection`
- 主要保证对象可被选中
- 删除快捷键逻辑 `_deleteSelected()` 已存在，但键盘入口被注释

所以“Delete 删除选中对象”不能写成当前默认行为。

### DragTool.ts

拖拽工具不负责拖动画布上对象本身，它处理的是视口平移。

触发方式：

- 激活工具
- 按住 `Ctrl` 或 `Meta`
- 鼠标拖动

实现上直接改 `viewportTransform[4]` / `viewportTransform[5]`。

### LineTool.ts

线段工具是两段式状态机：

1. 第一次点击记录起点并创建起点辅助圆
2. 第二次点击落终点，生成正式 `Line`、终点辅助圆、距离标签

线段对象的业务标识保存在：

- `customType = CustomType.Line`
- `customData: LineCustomData`

### PolylineTool.ts

折线工具用右键结束绘制，这是它和 `AreaTool` 最大的交互差异。

辅助元素：

- 每个节点一个 helper circle
- 每一段一个距离标签

完成后主对象是 `fabric.Polyline`，辅助元素继续作为独立对象保留在 canvas 上。

### AreaTool.ts

区域工具和旧文档里“line tool 画区域”已经不是一回事了。

真实行为：

- 左键逐点
- 靠近首点闭合
- 闭合后生成 `fabric.Polygon`
- 辅助点、辅助边、标签与主对象通过 `drawPid` 关联

源码里 `allowOverlap`、`enableFill`、`continueDraw` 都是当前有效选项。

### CurveTool.ts

曲线工具使用平滑路径数据拼装 `fabric.Path`。

特点：

- 靠近首点可闭合
- `Enter` 可结束开放曲线
- `setTension()` 可以动态调整张力
- 路径长度与中点位置会通过临时 SVG path 计算

### RectTool.ts

矩形工具是点两次完成，不是按下拖拽后松开完成。

它会：

- 预览矩形
- 预览宽高标签
- 完成后调用 `setupRectEvents()` 绑定事件和控制点逻辑

### TextTool.ts

文本工具支持两种入口：

1. 交互点击画布创建默认 `IText`
2. 编程式 `createTextAt()` / `createTextWithoutRender()`

退出编辑时如果文本为空，会自动删除。

### ImageTool.ts

图片工具也分两类入口：

1. `openFileDialog()` 走本地文件选择
2. `addImageAt()` / `addImageWithoutRender()` 走编程式插入

图片对象的 `customData` 会尽量保存 `base64`，如果传的是 URL，会加载后自行转成 base64 存进去。

这就是为什么导入导出时图片能靠 JSON 自保，而不是只保留远端 URL。

## 导入导出链路

`src/utils/export.ts` 是序列化、反序列化和事件重绑的中心。

### exportToJSON

关键点：

- 使用 `SERIALIZATION_PROPERTIES`
- 默认 `excludeTypes = ['text', 'image']`
- 排除主类型时，会连带排除对应 helper 类型

也就是说，默认 JSON 导出不是“完整画布快照”，而是偏业务标注图元快照。

### importFromJSON

导入后不是直接结束，而是会继续做两件事：

1. `relinkHelperElements(canvas)`
2. `rebindObjectEvents(...)`

`relinkHelperElements()` 会重新把主对象和 helper 对象按 `drawId` / `drawPid` 关联起来。

`rebindObjectEvents()` 会按 `customType` 重挂：

- area 事件
- line 事件
- polyline 事件
- curve 事件
- rect 事件
- text 事件
- image 事件

这是整个仓库最关键的“导入后恢复行为”逻辑。

## UndoRedoManager.ts

历史系统和交互式绘制中的临时点状态是分开的。

- `UndoRedoManager` 负责 canvas 级历史
- `AreaTool` / `CurveTool` / `LineTool` / `PolylineTool` / `RectTool` 各自还维护绘制过程里的临时 undo/redo

所以 `board.undo()` 的真实顺序是：

1. 如果当前工具能处理临时绘制 undo，优先交给当前工具
2. 否则遍历其他工具，看是否有工具处在可撤销的绘制态
3. 都没有，再走 `UndoRedoManager`

这也是为什么撤销语义会随当前绘制状态变化。

## Toolbar.ts

`Toolbar` 是纯 DOM 组件，不依赖 Vue。

职责：

- 生成按钮
- 管理高亮状态
- 监听 `tool:changed` / `history:changed`
- 管理两个 `ColorPicker`
- 支持面板拖动

几个实现细节：

- `fitZoom` 按钮当前调用的是 `paintBoard.resetZoom()`
- `helpers` 按钮实际控制的是所有图元 helper 显隐
- `image` 按钮本身不切换工具，而是直接触发 `ImageTool.openFileDialog()`

## ColorPicker.ts

颜色选择器是纯原生 DOM + HSV 状态模型。

内部维护：

- RGB
- Alpha
- HSV

并在这些表示之间双向转换。

支持入口：

- 饱和度面板拖拽
- 色相条拖拽
- 透明度条拖拽
- RGBA 数值输入
- HEX 文本输入

## PersonTracker.ts

`PersonTracker` 是一个独立于绘图工具体系的运行时模块。

### 核心能力

- 人员标记批量创建与更新
- 通过 `yid` 把旧标记迁移成新 `id`
- 平滑移动动画
- 告警状态涟漪效果
- 轨迹绘制与可选移动 marker
- 分批渲染与中断渲染

### 设计要点

1. `renderVersion` 用来中断旧批次渲染
2. `deleteOld` 控制新一帧数据是否清理旧人员
3. `displayDuration` 控制标记自动消失
4. `blinkReasons` 决定哪些状态触发涟漪

### 真实公开方法

- `createMultiplePersons`
- `createSinglePerson`
- `removePerson`
- `createPersonTraces`
- `removePersonTraces`
- `clearAll`
- `clearAllPersons`
- `clearAllTraces`
- `getPersonById`
- `getAllPersonIds`
- `abortRendering`

旧文档里的 `setPersons`、`updatePerson`、`showTrace`、`hideTrace` 不是当前公开方法。

## settings.ts

`src/utils/settings.ts` 是全仓库的常量中心，文档和测试对齐时要重点看这里。

包括：

- `CustomType`
- 默认工具提示文案
- 默认画板配置
- 默认各工具配置
- 默认 `PersonTracker` 配置
- 默认 `Toolbar` 工具列表
- `SERIALIZATION_PROPERTIES`

如果文档里的默认值和这里不一致，以这里为准。

## 测试与示例

### tests/

测试覆盖：

- `core`
- `tools`
- `ui`
- `utils`
- `integration`

文档对 API 是否存在拿不准时，先看：

- `tests/unit/core/PaintBoard.test.ts`
- `tests/integration/PaintBoard.test.ts`
- `tests/integration/PersonTracker.test.ts`

### demo/

`demo/index.html` 是当前最完整的集成示例。

它能直接反映：

- UMD 下应使用 `FabricPaint`
- `polyline`、`area`、`rect`、`curve`、`text`、`image` 的真实注册方式
- `insertText()` / `insertImage()` / `batchInsert*()` / `createMultiplePersons()` 的真实调用方式

## 当前需要特别注意的边界

1. `backgroundImage` 配置项目前不会在 `init()` 自动生效。
2. `CanvasManager` 的滚轮缩放 / 中键平移 / 自动扩展默认未绑定事件。
3. `SelectTool` 删除快捷键代码存在，但默认未启用。
4. 多个工具里的 `Ctrl+Z` 键盘入口被注释，撤销主要依赖外部调用 `board.undo()`。
5. `Toolbar` 的 `fitZoom` 现在等价于 `resetZoom()`，不是适配容器。
6. `exportToJSON()` 默认排除 `text` 和 `image`，这会直接影响“导出再导入”的预期。
