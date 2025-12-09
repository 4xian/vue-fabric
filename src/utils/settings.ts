import type {
  FabricPaintOptions,
  CanvasManagerOptions,
  AreaToolOptions,
  BaseToolOptions,
  CurveToolOptions,
  ImageToolOptions,
  TextToolOptions,
  LineToolOptions,
  SelectToolOptions,
  TraceOptions
} from '../../types'

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
  defaultShowHelpers: true
}

// 默认canvas管理器配置
export const DEFAULT_CANVAS_MANAGER_OPTIONS: CanvasManagerOptions = {
  zoomStep: 1.1,
  minZoom: 0.2,
  maxZoom: 5,
  expandMargin: 50,
  expandSize: 200
}

// 默认基础工具配置
export const DEFAULT_BASETOOL_OPTIONS: BaseToolOptions = {
  activeCursor: 'crosshair',
  deactiveCursor: 'default'
}

// 默认选择工具配置
export const DEFAULT_SELECTTOOL_OPTIONS: Required<SelectToolOptions> = {
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
  defaultShowHelpers: true,
  strokeWidth: 2,
  helperStrokeWidth: 2,
  hasBorders: false,
  hasControls: false,
  lockMovementX: true,
  lockMovementY: true
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
  defaultShowHelpers: true,
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
  defaultShowHelpers: true,
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
  fontSize: 14,
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

// 默认人员轨迹配置
export const DEFAULT_PERSON_TRACKER_OPTIONS: TraceOptions = {
  radius: 5,
  strokeWidth: 2,
  fontSize: 12,
  textColor: '#333',
  lineWidth: 2,
  pathType: 'curve' as 'line' | 'curve',
  animationSpeed: 0.05,
  blinkInterval: 1000,
  displayDuration: 5000
}

// 需要闪烁的状态列表
export const SHOULD_BLINK_LIST = ['fainted']

// 序列化时需要包含的额外属性
export const SERIALIZATION_PROPERTIES = [
  'customType',
  'customData',
  'areaId',
  'lineId',
  'curveId',
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
  'perPixelTargetFind'
]
