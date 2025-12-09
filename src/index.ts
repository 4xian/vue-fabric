import FabricPaint from './core/PaintBoard'
import EventBus from './core/EventBus'
import CanvasManager from './core/CanvasManager'
import Toolbar from './ui/Toolbar'
import ColorPicker from './ui/ColorPicker'
import BaseTool from './tools/BaseTool'
import AreaTool from './tools/AreaTool'
import SelectTool from './tools/SelectTool'
import TextTool from './tools/TextTool'
import CurveTool from './tools/CurveTool'
import LineTool from './tools/LineTool'
import ImageTool from './tools/ImageTool'
import PersonTracker from './utils/PersonTracker'
import { SERIALIZATION_PROPERTIES } from './utils/settings'
import './styles/ui.css'

export {
  FabricPaint,
  EventBus,
  CanvasManager,
  Toolbar,
  ColorPicker,
  BaseTool,
  AreaTool,
  SelectTool,
  TextTool,
  CurveTool,
  LineTool,
  ImageTool,
  PersonTracker,
  SERIALIZATION_PROPERTIES
}

export default FabricPaint

export type {
  Point,
  FabricPaintOptions,
  CanvasManagerOptions,
  ExportImageOptions,
  AreaCustomData,
  TextCustomData,
  CurveCustomData,
  LineCustomData,
  HistoryState,
  ColorPickerOptions,
  ColorState,
  ToolbarOptions,
  ToolName,
  EventCallback,
  PersonData,
  TraceOptions
} from '../types'
