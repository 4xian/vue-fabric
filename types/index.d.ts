import type { Circle, Line, Text } from 'fabric'

export interface Point {
  x: number
  y: number
}

export interface BackgroundImageOptions {
  source: string
  scaleMode?: 'fill' | 'fit' | 'stretch' | 'center' | 'repeat'
  opacity?: number
}

export interface PaintBoardOptions {
  width?: number
  height?: number
  backgroundColor?: string
  backgroundImage?: string | BackgroundImageOptions
  lineColor?: string
  fillColor?: string
  selection?: boolean
  preserveObjectStacking?: boolean
  perPixelTargetFind?: boolean
  targetFindTolerance?: number
}

export interface CanvasManagerOptions extends PaintBoardOptions {
  zoomStep?: number
  minZoom?: number
  maxZoom?: number
  expandMargin?: number
  expandSize?: number
}

export interface BaseToolOptions {
  activeCursor?: string
  deactiveCursor?: string
}

export interface AreaToolOptions extends BaseToolOptions {
  closeThreshold?: number
  pointRadius?: number
  labelFontSize?: number
  pointFillColor?: string
  pointHoverColor?: string
  defaultShowHelpers?: boolean
  allowOverlap?: boolean
  enableFill?: boolean
  perPixelTargetFind?: boolean
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
  pointFillColor?: string
  pointHoverColor?: string
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

export interface AreaCustomData {
  areaId: string
  points: Point[]
  distances: number[]
  lineColor: string
  fillColor: string
  circles?: Circle[]
  labels?: Text[]
  lines?: Line[]
}

export interface TextCustomData {
  textId: string
  createdAt: number
}

export interface CurveCustomData {
  curveId: string
  points: Point[]
  isClosed: boolean
  lineColor: string
  fillColor: string | null
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
  src: string
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

export interface CustomTextData {
  customTextId: string
  editable: boolean
  createdAt: number
}

export interface CustomImageData {
  customImageId: string
  createdAt: number
}

export type ToolName = 'select' | 'area' | 'curve' | 'text' | 'image' | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'fitZoom' | 'download' | 'lineColor' | 'fillColor' | 'toggleHelpers' | 'uploadImage'
export type EventCallback = (data?: unknown) => void
