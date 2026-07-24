import type { Circle, Line, Text, FabricImage, Polyline } from 'fabric'

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

export interface ZoomInvariantBase {
  strokeWidth?: number
  radius?: number
  fontSize?: number
  scaleX?: number
  scaleY?: number
}

export interface FabricPaintOptions {
  width?: number
  height?: number
  backgroundColor?: string
  hoverCursor?: string
  moveCursor?: string
  zoomStep?: number
  minZoom?: number
  maxZoom?: number
  expandMargin?: number
  expandSize?: number
  zoomOrigin?: ZoomOrigin
  zoomAnimationDuration?: number
  enableWheelZoom?: boolean
  backgroundImage?: string | BackgroundImageOptions
  lineColor?: string
  fillColor?: string
  selection?: boolean
  preserveObjectStacking?: boolean
  perPixelTargetFind?: boolean
  targetFindTolerance?: number
  defaultShowHelpers?: boolean
  autoResize?: boolean
  autoResizeMode?: AutoResizeMode
  autoResizeFit?: AutoResizeFit
  referenceSize?: ResizeReference
  pixelRatio?: number | 'auto'
  lockObjectVisualSizeOnZoom?: boolean
  zoomInvariantExcludeTypes?: string[]
}

export type ZoomOrigin = 'center' | 'topLeft'

export type ResizeOrigin = 'center' | 'topLeft'

export interface ZoomScale {
  x: number
  y: number
}

export interface ResizeReference {
  width: number
  height: number
}

export type AutoResizeMode = 'canvas' | 'viewport'

export type AutoResizeFit = 'contain' | 'cover' | 'stretch'

export type CanvasManagerOptions = Pick<
  FabricPaintOptions,
  | 'zoomStep'
  | 'minZoom'
  | 'maxZoom'
  | 'expandMargin'
  | 'expandSize'
  | 'zoomOrigin'
  | 'zoomAnimationDuration'
  | 'enableWheelZoom'
  | 'autoResize'
  | 'autoResizeMode'
  | 'autoResizeFit'
  | 'referenceSize'
>

export interface BaseToolOptions {
  defaultCursor?: string
  activeCursor?: string
  deactiveCursor?: string
  defaultLayer?: number
  hasBorders?: boolean
  hasControls?: boolean
  lockMovementX?: boolean
  lockMovementY?: boolean
  cornerStyle?: 'rect' | 'circle'
  cornerSize?: number
  cornerColor?: string
  cornerStrokeColor?: string
  padding?: number
  borderScaleFactor?: number
  continueDraw?: boolean
  disabeldClick?: boolean
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

export interface PenToolOptions extends BaseToolOptions {
  strokeWidth?: number
  decimate?: number
  perPixelTargetFind?: boolean
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

export interface PolylineToolOptions extends BaseToolOptions {
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

export type MainCustomType = 'line' | 'polyline' | 'area' | 'curve' | 'pen' | 'text' | 'image' | 'rect'

export interface ExportJSONOptions {
  additionalProperties?: string[]
  excludeTypes?: MainCustomType[]
}

export interface AreaCustomData {
  drawId: string
  layer?: number
  points: Point[]
  distances: number[]
  lineColor: string
  fillColor: string
  circles?: Circle[]
  labels?: Text[]
  lines?: Line[]
  originalOptions?: AreaToolOptions
}

export interface TextCustomData {
  drawId: string
  layer?: number
  createdAt?: number
}

export interface CurveCustomData {
  drawId: string
  layer?: number
  points: Point[]
  isClosed: boolean
  lineColor: string
  fillColor: string | null
  circles?: Circle[]
  labels?: Text[]
  distances?: number[]
}

export interface PenCustomData {
  drawId: string
  layer?: number
  lineColor: string
  strokeWidth: number
  createdAt?: number
}

export interface LineCustomData {
  drawId: string
  layer?: number
  startPoint: Point
  endPoint: Point
  distance: number
  lineColor: string
  startCircle?: Circle
  endCircle?: Circle
  label?: Text
}

export interface PolylineCustomData {
  drawId: string
  layer?: number
  points: Point[]
  distances: number[]
  lineColor: string
  circles?: Circle[]
  labels?: Text[]
  polyline?: Polyline
}

export interface RectCustomData {
  drawId: string
  layer?: number
  points: Point[]
  startPoint: Point
  endPoint: Point
  width: number
  height: number
  lineColor: string
  fillColor: string | null
  widthLabel?: Text
  heightLabel?: Text
  originalOptions?: RectToolOptions
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
  draggable?: boolean
}

export interface AddTextOptions {
  id?: string
  layer?: number
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

export interface AddImageOptions {
  id?: string
  layer?: number
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
  layer?: number
  createdAt?: number
  base64?: string
}

export interface PersonData {
  id: string
  yid?: string
  name: string
  x: number
  y: number
  lineColor: string
  status?: string
  base64?: string
}

export interface TraceOptions {
  layer?: number
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

export type ToolName =
  | 'select'
  | 'drag'
  | 'area'
  | 'curve'
  | 'pen'
  | 'line'
  | 'polyline'
  | 'rect'
  | 'text'
  | 'image'
  | 'undo'
  | 'redo'
  | 'zoomIn'
  | 'zoomOut'
  | 'fitZoom'
  | 'download'
  | 'lineColor'
  | 'fillColor'
  | 'helpers'
  | 'uploadImage'
export type EventCallback = (data?: unknown) => void

export type CustomData =
  | AreaCustomData
  | TextCustomData
  | CurveCustomData
  | PenCustomData
  | LineCustomData
  | PolylineCustomData
  | RectCustomData
  | ImageCustomData

export const SERIALIZATION_PROPERTIES: string[]

export const CustomType: {
  readonly Line: 'line'
  readonly Polyline: 'polyline'
  readonly Area: 'area'
  readonly Curve: 'curve'
  readonly Pen: 'pen'
  readonly Text: 'text'
  readonly Image: 'image'
  readonly Rect: 'rect'
  readonly LineHelper: 'lineHelper'
  readonly LineHelperLabel: 'lineHelperLabel'
  readonly PolylineHelper: 'polylineHelper'
  readonly PolylineHelperLabel: 'polylineHelperLabel'
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

export interface BatchTextInsertResult {
  success: Array<{ id: string; object: Text & { customType: string; customData: TextCustomData } }>
  failed: Array<{ id?: string; error: string }>
}

export interface BatchImageInsertResult {
  success: Array<{ id: string; object: FabricImage }>
  failed: Array<{ id?: string; error: string }>
}

export interface BatchRemoveResult {
  removed: string[]
  notFound: string[]
}

export interface TextData {
  drawId: string
  text: string
  left: number
  top: number
  fontSize: number
  fontFamily: string
  fill: string
}
