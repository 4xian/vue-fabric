import type {
  FabricPaintOptions,
  CanvasManagerOptions,
  AreaToolOptions,
  BaseToolOptions,
  CurveToolOptions,
  ImageToolOptions,
  TextToolOptions,
  LineToolOptions,
  RectToolOptions,
  SelectToolOptions,
  TraceOptions,
  ToolName,
  ToolbarOptions
} from '../../types'

// 自定义类型枚举
export const CustomType = {
  // 主要类型
  Line: 'line',
  Area: 'area',
  Curve: 'curve',
  Text: 'text',
  Image: 'image',
  Rect: 'rect',
  // 直线辅助类型
  LineHelper: 'lineHelper',
  LineHelperLabel: 'lineHelperLabel',
  // 区域辅助类型
  AreaPoint: 'areaPoint',
  AreaLine: 'areaLine',
  AreaLabel: 'areaLabel',
  // 曲线辅助类型
  CurveHelper: 'curveHelper',
  CurveHelperLabel: 'curveHelperLabel',
  CurvePreview: 'curvePreview',
  // 矩形辅助类型
  RectLabel: 'rectLabel',
  // 人员轨迹类型
  PersonMarker: 'personMarker',
  TracePath: 'tracePath'
} as const

export const TOOL_TITLES: Record<string, string> = {
  select: '选择工具: 不对画布进行任何操作，默认工具',
  drag: '拖拽工具: 选中该工具后可以任意拖拽，缩放图形大小；按住Ctrl键可以拖拽整个画布',
  line: '直线工具: 画直线',
  area: '区域工具: 画任意直线图形区域',
  curve: '曲线工具: 画任意曲线图形区域',
  rect: '矩形工具: 画矩形/正方形区域',
  text: '文字工具: 添加文字',
  image: '图片工具: 上传图片',
  undo: '撤销工具: 撤销上一步操作，已绘制图形无法撤销',
  redo: '还原工具: 还原上一步被撤销的操作',
  zoomIn: '放大工具: 放大画布',
  zoomOut: '缩小工具: 缩小画布',
  fitZoom: '重置工具: 画布重置到初始大小',
  download: '下载工具: 将画布内容导出为图片下载',
  lineColor: '线段颜色工具: 设置绘制线段颜色',
  fillColor: '填充颜色工具: 设置图形填充颜色',
  helpers: '距离提示工具: 显示/隐藏图形区域的距离提示功能'
}

export const TOOL_MAPS: Record<string, string> = {
  SELECT: 'select',
  DRAG: 'drag',
  LINE: 'line',
  AREA: 'area',
  CURVE: 'curve',
  RECT: 'rect',
  TEXT: 'text',
  IMAGE: 'image'
}

export type CustomTypeValue = (typeof CustomType)[keyof typeof CustomType]

export type MainCustomType = 'line' | 'area' | 'curve' | 'text' | 'image' | 'rect'

export const CUSTOM_TYPE_HELPER_MAP: Record<MainCustomType, CustomTypeValue[]> = {
  line: [CustomType.LineHelper, CustomType.LineHelperLabel],
  area: [CustomType.AreaPoint, CustomType.AreaLine, CustomType.AreaLabel],
  curve: [CustomType.CurveHelper, CustomType.CurveHelperLabel, CustomType.CurvePreview],
  text: [],
  image: [],
  rect: [CustomType.RectLabel]
}

// 项目名称
export const PROJECT_NAME = 'vue-fabric'

// 默认画板配置
export const DEFAULT_VUEFABRIC_OPTIONS: FabricPaintOptions = {
  width: 800,
  height: 800,
  hoverCursor: 'default',
  moveCursor: 'pointer',
  backgroundColor: 'transparent',
  lineColor: 'rgba(2, 167, 240, 1)',
  fillColor: 'rgba(128, 255, 255, 1)',
  selection: false,
  preserveObjectStacking: true,
  perPixelTargetFind: false,
  targetFindTolerance: 0,
  defaultShowHelpers: true,
  autoResize: false,
  pixelRatio: 'auto'
}

// 默认canvas管理器配置
export const DEFAULT_CANVAS_MANAGER_OPTIONS: CanvasManagerOptions = {
  zoomStep: 1.1,
  minZoom: 0.2,
  maxZoom: 5,
  expandMargin: 50,
  expandSize: 200,
  zoomOrigin: 'center'
}

// 默认基础工具配置
export const DEFAULT_BASETOOL_OPTIONS: BaseToolOptions = {
  continueDraw: false,
  disabeldClick: false,
  activeCursor: 'crosshair',
  deactiveCursor: 'default'
}

// 默认选择工具配置
export const DEFAULT_SELECTTOOL_OPTIONS: SelectToolOptions = {
  activeCursor: 'default',
  deactiveCursor: 'default',
  allowSelection: false,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认直线工具配置
export const DEFAULT_LINETOOL_OPTIONS: LineToolOptions = {
  activeCursor: 'crosshair',
  deactiveCursor: 'default',
  pointRadius: 3,
  labelFontSize: 12,
  labelFillColor: '#333',
  pointFillColor: '#ff0000',
  pointHoverColor: '#ff0000',
  perPixelTargetFind: true,
  defaultShowHelpers: false,
  strokeWidth: 2,
  helperStrokeWidth: 2,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认矩形工具配置
export const DEFAULT_RECTTOOL_OPTIONS: RectToolOptions = {
  activeCursor: 'crosshair',
  deactiveCursor: 'default',
  enableFill: true,
  strokeWidth: 2,
  perPixelTargetFind: true,
  hasBorders: true,
  hasControls: true,
  lockMovementX: false,
  lockMovementY: false,
  labelFontSize: 12,
  labelFillColor: '#000',
  defaultShowHelpers: false,
  cornerStyle: 'rect',
  cornerSize: 8,
  cornerColor: '#6194f5',
  borderWidth: 1.5,
  controlsPadding: 3
}

// 默认区域工具配置
export const DEFAULT_AREATOOL_OPTIONS: AreaToolOptions = {
  activeCursor: 'crosshair',
  deactiveCursor: 'default',
  closeThreshold: 8,
  pointRadius: 3,
  labelFontSize: 12,
  labelFillColor: '#333',
  pointFillColor: '#ff0000',
  pointHoverColor: '#ff0000',
  defaultShowHelpers: false,
  allowOverlap: true,
  enableFill: true,
  perPixelTargetFind: true,
  strokeWidth: 2,
  helperStrokeWidth: 2,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认曲线工具配置
export const DEFAULT_CURVETOOL_OPTIONS: CurveToolOptions = {
  activeCursor: 'crosshair',
  deactiveCursor: 'default',
  tension: 0.5,
  closeThreshold: 8,
  pointRadius: 3,
  labelFontSize: 12,
  labelFillColor: '#333',
  pointFillColor: '#ff0000',
  pointHoverColor: '#ff0000',
  defaultShowHelpers: false,
  enableFill: true,
  perPixelTargetFind: true,
  strokeWidth: 2,
  helperStrokeWidth: 2,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认文本工具配置
export const DEFAULT_TEXTTOOL_OPTIONS: TextToolOptions = {
  activeCursor: 'default',
  deactiveCursor: 'default',
  fontSize: 12,
  fontFamily: 'Arial',
  fill: '#333',
  perPixelTargetFind: false,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认图片工具配置
export const DEFAULT_IMAGETOOL_OPTIONS: ImageToolOptions = {
  activeCursor: 'default',
  deactiveCursor: 'default',
  defaultSelectable: false,
  defaultHasControls: false,
  defaultHasBorders: false,
  defaultLockMovement: true,
  defaultLockScaling: true,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认拖拽工具配置
export const DEFAULT_DRAGTOOL_OPTIONS: BaseToolOptions = {
  defaultCursor: 'pointer',
  activeCursor: 'grabbing',
  deactiveCursor: 'pointer',
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
}

// 默认人员轨迹配置
export const DEFAULT_PERSON_TRACKER_OPTIONS: TraceOptions = {
  radius: 3,
  strokeWidth: 2,
  fontSize: 12,
  textColor: '#333',
  lineWidth: 2,
  pathType: 'curve' as 'line' | 'curve',
  animationSpeed: 0.05,
  moveAnimationSpeed: 0.02,
  blinkInterval: 1000,
  displayDuration: 3000,
  batchSize: 50,
  blinkReasons: [
    'smoking',
    'sleeping',
    'climbing',
    'falling down',
    'looking at phone',
    'reaching high'
  ],
  deleteOld: false,
  fillColor: '',
  minMoveAnimationDuration: 500,
  maxMoveAnimationDuration: 3000,
  markerBase64: ''
}

const DEFAULT_TOOLS: ToolName[] = [
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
]

export const DEFAULT_TOOLBAR_OPTIONS: ToolbarOptions = {
  tools: DEFAULT_TOOLS,
  visible: true,
  draggable: true
}

// 序列化时需要包含的额外属性
export const SERIALIZATION_PROPERTIES = [
  'customType',
  'customData',
  'hasControls',
  'hasBorders',
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
  'selectable',
  'evented',
  'hoverCursor',
  'moveCursor',
  'objectCaching',
  'cornerStyle',
  'cornerSize',
  'cornerColor',
  'borderColor',
  'borderScaleFactor',
  'padding',
  'perPixelTargetFind'
]
