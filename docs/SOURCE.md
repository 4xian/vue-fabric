# @4xian/vue-fabric 源码说明

本文档只说明当前仓库真实实现，不复述历史计划。

## 目录结构

```text
src/
  index.ts
  core/
    PaintBoard.ts
    CanvasManager.ts
    EventBus.ts
  tools/
    BaseTool.ts
    SelectTool.ts
    DragTool.ts
    LineTool.ts
    PolylineTool.ts
    AreaTool.ts
    CurveTool.ts
    RectTool.ts
    TextTool.ts
    ImageTool.ts
  ui/
    Toolbar.ts
    ColorPicker.ts
  utils/
    areaEvents.ts
    rectEvents.ts
    export.ts
    geometry.ts
    generateId.ts
    ObjectPool.ts
    PersonTracker.ts
    settings.ts
    throttle.ts
    UndoRedoManager.ts

types/
  index.d.ts

tests/
  unit/
  integration/

demo/
  index.html
```

## 入口与公开边界

`src/index.ts` 做三件事：

1. 默认导出 `FabricPaint`
2. 命名导出核心类、工具类、UI、`PersonTracker`、`SERIALIZATION_PROPERTIES`、`CustomType`
3. 只重新导出 `types/index.d.ts` 里列出来的公共类型

所以：

- 对外类名是 `FabricPaint`
- `PaintBoard` 只是业务层常见别名，不是命名导出
- 判断某个类型是否真的公开，优先看 `src/index.ts`

## PaintBoard.ts

`src/core/PaintBoard.ts` 是总入口，负责：

- 创建 Fabric canvas
- 管理工具注册与切换
- 转发缩放、resize、背景图、导入导出
- 接 Undo/Redo
- 接 helper 显隐
- 接 `PersonTracker`

### 初始化链

`init()` 当前流程：

1. `_createCanvas()`
2. `_initCanvasManager()`
3. `_initUndoRedo()`
4. `_bindEvents()`
5. 若 `autoResize=true`，绑定 `ResizeObserver`，并立即按容器尺寸调一次 `resize()`

注意：

- `_initialized` 阻止重复初始化
- 构造配置里的 `backgroundImage` 自动应用逻辑当前被注释掉了，所以不会在 `init()` 生效

### pixelRatio 真实语义

当前 `pixelRatio` 不再走“业务 zoom 乘上倍率”的旧路子。

现在做法：

- 初始化时根据 `pixelRatio` 或 `window.devicePixelRatio` 计算 `_pixelRatio`
- 通过 `enableRetinaScaling` 和重写 `getRetinaScaling()` 控制 backing store
- `getZoom()`、逻辑坐标、对象创建尺寸、导出逻辑值都不应该再被 `pixelRatio` 改写

所以 `pixelRatio` 现在是显示清晰度开关，不是业务缩放参数。

### zoomOrigin、viewport 与 resetZoom

`PaintBoard` 的缩放公开入口都转发给 `CanvasManager`：

- `zoomIn`
- `zoomOut`
- `setZoom`
- `resetZoom`

当 `autoResize` 打开或显示尺寸不等于当前内部基准尺寸时，`resetZoom(zoomScale = 1)` 走 `_applyViewportResize(...)`，按传入业务倍率重新归位；不传时默认回到业务 zoom `1`。
`_applyViewportResize(...)` 在 `canvasManager` 存在时，最终仍落到 `CanvasManager.setViewportTransform()`；`resize()`、`autoResize()` 和 viewport-fit 下的 `resetZoom()` 现在不再绕开这条链路。
`zoomAnimationDuration` 默认 `500ms`，由 `CanvasManager` 统一控制 viewport 动画；传 `0` 或负数时直接同步落地。

### autoResize 当前语义

当前 `autoResize` 有两种模式。

默认 `autoResizeMode='canvas'`：

- 监听容器尺寸变化
- 500ms 防抖
- 调 `resize(width, height, undefined, origin)`
- 保留当前 `getZoom()`
- 重算 viewport、背景图、补偿缩放、`PersonTracker`
- `_setCanvasDisplaySize()` 会同步更新 `_originalWidth/_originalHeight`、`_displayWidth/_displayHeight`、`options.width/options.height`
- resize 后内部“当前基准画布尺寸”会被更新为新的显示尺寸

`autoResizeMode='viewport'`：

- `referenceSize` 作为逻辑参考尺寸
- `referenceSize` 不传时，首次自适应取当前容器尺寸
- Fabric canvas 的实际显示尺寸仍会改成容器尺寸
- `_originalWidth/_originalHeight` 保持为 `referenceSize`
- `autoResizeFit='contain' | 'cover' | 'stretch'` 决定 reference 到 display 的 viewport transform
- `contain` 完整显示参考画布，`cover` 铺满显示区域并可能裁切，`stretch` 按 X/Y 独立缩放并可能变形

两种模式都不会遍历对象去改：

- `left/top`
- `points`
- `x1/y1/x2/y2`
- `fontSize`
- `scaleX/scaleY`

### 背景图链路

`setBackgroundImage()` 当前做法：

- 归一化 `BackgroundImageOptions`
- `scaleMode` 默认 `fill`
- `backgroundVpt` 未显式传入时，默认取“是否开启补偿缩放”
- 创建 `FabricImage`
- 强制锁定为不可交互对象
- 加到 canvas，送到底层
- 触发 `_updateBackgroundImageTransform()`

`_updateBackgroundImageTransform()` 当前分两支：

- `backgroundVpt=true`：背景图直接跟 viewport
- `backgroundVpt=false`：用 `/ zoom` 和 `- pan` 反算，让背景不跟 viewport
- `autoResizeMode='viewport'` 且 `backgroundVpt=true` 时，背景缩放使用固定的 `referenceSize`，而不是变化后的显示尺寸

各模式真实效果：

- `fill`：铺满，可能裁切
- `fit`：完整显示，可能留白
- `stretch`：强制铺满
- `center`：不缩放，居中
- `repeat`：当前只是原始尺寸停在左上角，没有真正平铺逻辑

背景图每次同步后都会再走 `_ensureBackgroundImageLocked()`，保证：

- 不可选中
- 不可拖动
- 不可缩放
- 始终在最底层

### 补偿缩放

当前补偿缩放核心在 `PaintBoard`，不是分散在各工具里。

关键点：

- 每个对象可挂 `zoomInvariantBase`
- `object:added` 时补采基准
- `object:modified` 时刷新基准
- `canvas:zooming` / `canvas:zoomed` / `canvas:panned` 时统一重算运行时显示值
- `importFromJSON()` 后重跑一遍基准采集和 viewport 展示同步

补偿规则：

- `strokeWidth = base.strokeWidth / zoom`
- `radius = base.radius / zoom`
- `fontSize = base.fontSize / zoom`
- `scaleX = base.scaleX / zoom`
- `scaleY = base.scaleY / zoom`

排除规则：

- `zoomInvariantExcludeTypes` 命中时，不做补偿
- 背景图和 `PersonTracker` 走单独分支，不由 `_walkZoomInvariantObjects()` 直接处理

## CanvasManager.ts

`CanvasManager` 当前职责：

- 统一计算 viewportTransform
- 统一执行 viewportTransform 动画
- 维护业务 zoom
- 可选绑定滚轮缩放
- 保留自动扩布逻辑

初始化来源：

- `PaintBoard` 构造时先合并 `DEFAULT_VUEFABRIC_OPTIONS`
- `CanvasManager` 初始化直接读取 `FabricPaintOptions`
- 这组共享字段包括 `zoomStep`、`minZoom`、`maxZoom`、`expandMargin`、`expandSize`、`zoomOrigin`、`zoomAnimationDuration`、`enableWheelZoom`

### 当前已启用的部分

- `zoomIn()`
- `zoomOut()`
- `setZoom()`
- `resetZoom()`
- `getZoom()`
- `enableWheelZoom=true` 时绑定 `mouse:wheel`

`setViewportTransform()` 现在是统一落地点：

- `zoomIn()` / `zoomOut()` / `setZoom()` / `resetZoom()`
- `enableWheelZoom=true` 时的滚轮缩放
- `PaintBoard.resize()`、`autoResize()` 和 viewport-fit 下的 `resetZoom()`

动画语义：

- 默认时长来自 `zoomAnimationDuration=500`
- `zoomAnimationDuration <= 0` 时跳过动画
- 动画中逐帧发 `canvas:zooming`
- 最终落地时发 `canvas:zoomed`

### 当前未启用的部分

这些内部能力还在文件里，但默认没有挂监听：

- `mouse:down`
- `mouse:move`
- `mouse:up`
- `object:moving`

所以：

- 视口拖拽主要靠 `DragTool`
- 中键 / Alt 平移不是当前默认行为
- 自动扩布逻辑存在，但默认也不靠 `CanvasManager` 监听去触发

### center / topLeft 的真实计算

`_buildViewportTransform()` 当前算法是：

- 先算 fit scale：`min(displayWidth / logicalWidth, displayHeight / logicalHeight)`
- 再乘业务 zoom
- `zoomIn()`、`zoomOut()`、`setZoom()` 默认保留当前内容锚点：
  - `center` 锚点是当前 viewport 下的画布内容中心
  - `topLeft` 锚点是当前 viewport 下的画布左上点
- `resetZoom()` 使用显示区锚点重新归位：
  - `center` 锚点是当前显示区中心
  - `topLeft` 锚点是 `{ x: 0, y: 0 }`
- 最后用锚点反算 `tx` / `ty`

也就是普通缩放保留拖拽后的画布内容位置，`resetZoom()` 才回到显示区锚点。

## EventBus.ts

`EventBus` 很薄，只做：

- `on`
- `off`
- `emit`
- `clear`

它把 `PaintBoard`、工具、`Toolbar`、`PersonTracker`、导入导出重绑逻辑串起来。

## 工具体系

### BaseTool.ts

所有工具继承 `BaseTool`。

基类负责：

- 注入 `canvas` / `eventBus` / `paintBoard`
- 统一 `activate()` / `deactivate()`
- 挂 `mouse:*` 和 `keydown`
- 提供 `isDrawing()`、`undo()`、`redo()`、`getPointer()`

注意：

- 基类默认只挂 `keydown`
- 没有统一挂 `keyup`

### SelectTool.ts

当前是一个较克制的选择工具：

- 负责让对象可选中
- `allowSelection` 默认 `false`
- 删除快捷键逻辑不是当前默认行为

### DragTool.ts

当前视口拖拽主实现。

触发条件：

- 当前工具是 `drag`
- 按住 `Ctrl` 或 `Meta`
- 拖动鼠标

它直接改 `viewportTransform[4]` / `viewportTransform[5]`，完成后发 `canvas:panned`。

### LineTool.ts

两次点击完成一条线：

1. 记录起点并创建起点 helper
2. 第二次点击确定终点，创建正式 `Line`、终点 helper、距离 label

### PolylineTool.ts

当前不是“第二个点自动结束”的语义。

真实行为：

- 左键逐点
- `Enter` 结束
- 右键结束
- `Escape` 取消

### AreaTool.ts

真实行为：

- 左键逐点
- 靠近首点闭合
- 生成 `fabric.Polygon`
- helper 通过 `drawPid` 关联

### CurveTool.ts

真实行为：

- 左键逐点
- `Enter` 结束开放曲线
- 靠近首点闭合
- 主对象是 `fabric.Path`

### RectTool.ts

不是按住拖拽结束，而是两次点击：

1. 第一次确定起点
2. 第二次确定终点

### TextTool.ts

两类入口：

- 交互点击画布创建
- `createTextAt()` / `createTextWithoutRender()` 编程式创建

编辑退出后若文本为空，会自动删掉。

### ImageTool.ts

两类入口：

- `openFileDialog()` 本地上传
- `addImageAt()` / `addImageWithoutRender()` 编程式插入

更新图片尺寸或缩放后，会和 `PaintBoard` 的补偿缩放基线同步。

## 导入导出：export.ts

`src/utils/export.ts` 是当前序列化核心。

### exportToJSON

当前链路：

1. 用 `SERIALIZATION_PROPERTIES` 调 `canvas.toObject(...)`
2. 临时把对象 `customData` 规整成可序列化结构
3. 用 `normalizeZoomInvariantNode()` 把 `zoomInvariantBase` 写回逻辑视觉值
4. 默认排除 `text` 和 `image`
5. 排除主类型时，也连带排掉对应 helper 类型

所以默认 JSON 不是“全画布原样快照”，而是偏业务标注快照。

### importFromJSON

导入后还会继续做：

1. `relinkHelperElements(canvas)`
2. `rebindObjectEvents(...)`
3. 在 `PaintBoard.importFromJSON()` 里重新初始化补偿缩放基线
4. 重新同步背景图、helper、当前 viewport 展示

这是导入后还能继续编辑和点击的关键。

## UndoRedoManager.ts

当前历史系统和工具临时绘制状态是分层的。

`board.undo()` / `board.redo()` 的优先级：

1. 先给当前工具机会处理临时绘制撤销/重做
2. 再看其他工具是否还处于可撤销的绘制中
3. 最后才回退到全局 `UndoRedoManager`

## Toolbar.ts

`Toolbar` 是纯 DOM 组件，不依赖 Vue。

它负责：

- 生成按钮
- 管理 active 状态
- 监听 `tool:changed` / `history:changed`
- 管理两个 `ColorPicker`
- 支持面板拖动

要点：

- `fitZoom` 实际调的是 `resetZoom()`
- `image` 按钮不会切换当前工具，只是直接触发 `ImageTool.openFileDialog()`
- `helpers` 按钮控制的是所有业务 helper，不只 area

## ColorPicker.ts

`ColorPicker` 是独立的 DOM 颜色选择器。

内部维护：

- RGBA
- HSV
- HEX 输入同步

如果只是要 SDK 自带工具栏色板，通常不需要单独操作它。

## PersonTracker.ts

`PersonTracker` 是独立运行时模块，不属于绘图工具继承链。

当前能力：

- `createMultiplePersons()` 批量 upsert
- `createSinglePerson()` 单点 upsert
- `createPersonTraces()` 绘制 line / curve 轨迹
- 可选 moving marker
- `yid` 迁移
- 状态触发的水波纹闪烁
- `renderVersion` 中断旧批次渲染

当前还会监听：

- `canvas:zooming`
- `canvas:zoomed`
- `canvas:panned`
- `canvas:resized`

所以一旦 viewport 或容器尺寸变化，轨迹、marker、文字、水波纹都会重算。

## settings.ts

`src/utils/settings.ts` 是常量真值源。

重点看这里：

- `CustomType`
- 默认 `FabricPaintOptions`
- 默认各工具配置
- 默认 `TraceOptions`
- 默认 `ToolbarOptions`
- `SERIALIZATION_PROPERTIES`

如果 README、API 文档、skills 参考文档和这里冲突，以这里和公开类型为准。

## demo 与 tests

看真实集成方式优先读：

- `demo/index.html`
- `tests/unit/core/PaintBoard.test.ts`
- `tests/unit/core/CanvasManager.test.ts`
- `tests/integration/PaintBoard.test.ts`
- `tests/integration/PaintBoardZoomInvariant.test.ts`
- `tests/integration/PersonTracker.test.ts`
- `tests/integration/export.test.ts`

这些文件比旧 prose 文档更能反映当前实际行为。

## 当前最容易误判的边界

1. `backgroundImage` 构造参数当前不会在 `init()` 自动生效。
2. `pixelRatio` 现在只负责清晰度，不再等价于业务 zoom。
3. `enableWheelZoom` 默认关闭，滚轮缩放不是开箱即用默认行为。
4. `autoResize` 当前是展示层 resize，不会遍历对象改逻辑坐标。
5. `showAllAreaHelpers()` 名称旧，但现在不只管 area。
6. `repeat` 背景模式当前不会真正平铺。
7. `CanvasManager` 里中键平移和 `object:moving` 自动扩布监听默认未挂载。
