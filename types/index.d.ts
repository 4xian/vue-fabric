import type { Circle, Line, Text } from 'fabric'

export interface Point {
  x: number
  y: number
}

export interface BackgroundImageOptions {
  source: string
  scaleMode?: 'fill' | 'fit' | 'stretch' | 'center' | 'repeat'
  opacity?: number
  backgroundVpt?: boolean
}

export interface FabricPaintOptions {
  width?: number
  height?: number
  backgroundColor?: string
  hoverCursor?: string
  moveCursor?: string
  backgroundImage?: string | BackgroundImageOptions
  lineColor?: string
  fillColor?: string
  selection?: boolean
  preserveObjectStacking?: boolean
  perPixelTargetFind?: boolean
  targetFindTolerance?: number
  defaultShowHelpers?: boolean
}

export type ZoomOrigin = 'center' | 'topLeft'

export interface CanvasManagerOptions extends FabricPaintOptions {
  zoomStep?: number
  minZoom?: number
  maxZoom?: number
  expandMargin?: number
  expandSize?: number
  zoomOrigin?: ZoomOrigin
}

export interface BaseToolOptions {
  activeCursor?: string
  deactiveCursor?: string
  hasBorders?: boolean
  hasControls?: boolean
  lockMovementX?: boolean
  lockMovementY?: boolean
  cornerStyle?: 'rect' | 'circle'
  cornerSize?: number
}

export interface AreaToolOptions extends BaseToolOptions {
  closeThreshold?: number
  pointRadius?: number
  labelFontSize?: number
  labelFillColor?: string
  pointFillColor?: string
  pointHoverColor?: string
  defaultShowHelpers?: boolean
  allowOverlap?: boolean
  enableFill?: boolean
  perPixelTargetFind?: boolean
  strokeWidth?: number
  helperStrokeWidth?: number
}

export interface SelectToolOptions extends BaseToolOptions {
  allowSelection?: boolean
}

export interface TextToolOptions extends BaseToolOptions {
  fontSize?: number
  fontFamily?: string
  fill?: string
  perPixelTargetFind?: boolean
}

export interface CurveToolOptions extends BaseToolOptions {
  tension?: number
  pointRadius?: number
  closeThreshold?: number
  labelFontSize?: number
  labelFillColor?: string
  pointFillColor?: string
  pointHoverColor?: string
  defaultShowHelpers?: boolean
  enableFill?: boolean
  perPixelTargetFind?: boolean
  strokeWidth?: number
  helperStrokeWidth?: number
}

export interface LineToolOptions extends BaseToolOptions {
  pointRadius?: number
  labelFontSize?: number
  labelFillColor?: string
  pointFillColor?: string
  pointHoverColor?: string
  defaultShowHelpers?: boolean
  perPixelTargetFind?: boolean
  strokeWidth?: number
  helperStrokeWidth?: number
}

export interface RectToolOptions extends BaseToolOptions {
  enableFill?: boolean
  strokeWidth?: number
  perPixelTargetFind?: boolean
  labelFontSize?: number
  labelFillColor?: string
  defaultShowHelpers?: boolean
}

export interface ImageToolOptions extends BaseToolOptions {
  defaultSelectable?: boolean
  defaultHasControls?: boolean
  defaultHasBorders?: boolean
  defaultLockMovement?: boolean
  defaultLockScaling?: boolean
}

export interface ExportImageOptions {
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  multiplier?: number
  download?: boolean
  filename?: string
}

export type MainCustomType = 'line' | 'area' | 'curve' | 'text' | 'image' | 'rect'

export interface ExportJSONOptions {
  additionalProperties?: string[]
  excludeTypes?: MainCustomType[]
}

export interface AreaCustomData {
  drawId: string
  points: Point[]
  distances: number[]
  lineColor: string
  fillColor: string
  circles?: Circle[]
  labels?: Text[]
  lines?: Line[]
}

export interface TextCustomData {
  drawId: string
  createdAt: number
}

export interface CurveCustomData {
  drawId: string
  points: Point[]
  isClosed: boolean
  lineColor: string
  fillColor: string | null
  circles?: Circle[]
  labels?: Text[]
  distances?: number[]
}

export interface LineCustomData {
  drawId: string
  startPoint: Point
  endPoint: Point
  distance: number
  lineColor: string
  startCircle?: Circle
  endCircle?: Circle
  label?: Text
}

export interface RectCustomData {
  drawId: string
  startPoint: Point
  endPoint: Point
  width: number
  height: number
  lineColor: string
  fillColor: string | null
  widthLabel?: Text
  heightLabel?: Text
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
}

export interface ColorPickerOptions {
  defaultColor?: string
  onChange?: (color: string) => void
}

export interface ColorState {
  r: number
  g: number
  b: number
  a: number
  h: number
  s: number
  v: number
}

export interface ToolbarOptions {
  tools?: string[]
  visible?: boolean
}

export interface AddTextOptions {
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
}

export interface AddImageOptions {
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

export interface ImageCustomData {
  drawId: string
  createdAt: number
  base64?: string
}

export interface PersonData {
  id: string
  name: string
  x: number
  y: number
  lineColor: string
  status?: 'normal' | 'fainted' | string
  trajectory?: Point[]
}

export interface TraceOptions {
  radius?: number
  strokeWidth?: number
  fontSize?: number
  animationSpeed?: number
  textColor?: string
  lineWidth?: number
  pathType?: 'line' | 'curve'
  blinkInterval?: number
  displayDuration?: number
}

export type ToolName = 'select' | 'drag' | 'area' | 'curve' | 'line' | 'rect' | 'text' | 'image' | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'fitZoom' | 'download' | 'lineColor' | 'fillColor' | 'helpers' | 'uploadImage'
export type EventCallback = (data?: unknown) => void

export type CustomData = AreaCustomData | TextCustomData | CurveCustomData | LineCustomData | RectCustomData | ImageCustomData

export const SERIALIZATION_PROPERTIES: string[]

export const CustomType: {
  readonly Line: 'line'
  readonly Area: 'area'
  readonly Curve: 'curve'
  readonly Text: 'text'
  readonly Image: 'image'
  readonly Rect: 'rect'
  readonly LineHelper: 'lineHelper'
  readonly LineHelperLabel: 'lineHelperLabel'
  readonly AreaPoint: 'areaPoint'
  readonly AreaLine: 'areaLine'
  readonly AreaLabel: 'areaLabel'
  readonly CurveHelper: 'curveHelper'
  readonly CurveHelperLabel: 'curveHelperLabel'
  readonly CurvePreview: 'curvePreview'
  readonly RectLabel: 'rectLabel'
  readonly PersonMarker: 'personMarker'
  readonly TracePath: 'tracePath'
}

export type CustomTypeValue = (typeof CustomType)[keyof typeof CustomType]
