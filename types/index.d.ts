import type { Circle, Line, Text } from 'fabric'

export interface Point {
  x: number
  y: number
}

export interface PaintBoardOptions {
  width?: number
  height?: number
  backgroundColor?: string
  lineColor?: string
  fillColor?: string
  selection?: boolean
  preserveObjectStacking?: boolean
}

export interface CanvasManagerOptions extends PaintBoardOptions {}

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

export type ToolName = 'select' | 'line' | 'curve' | 'text'
export type EventCallback = (data?: unknown) => void
