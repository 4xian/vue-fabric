import FabricPaint from './core/PaintBoard'
import EventBus from './core/EventBus'
import CanvasManager from './core/CanvasManager'
import Toolbar from './ui/Toolbar'
import ColorPicker from './ui/ColorPicker'
import BaseTool from './tools/BaseTool'
import AreaTool from './tools/AreaTool'
import SelectTool from './tools/SelectTool'
import DragTool from './tools/DragTool'
import TextTool from './tools/TextTool'
import CurveTool from './tools/CurveTool'
import LineTool from './tools/LineTool'
import RectTool from './tools/RectTool'
import ImageTool from './tools/ImageTool'
import PersonTracker from './utils/PersonTracker'
import { SERIALIZATION_PROPERTIES, CustomType } from './utils/settings'
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
  DragTool,
  TextTool,
  CurveTool,
  LineTool,
  RectTool,
  ImageTool,
  PersonTracker,
  SERIALIZATION_PROPERTIES,
  CustomType
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
  RectCustomData,
  RectToolOptions,
  HistoryState,
  ColorPickerOptions,
  ColorState,
  ToolbarOptions,
  ToolName,
  EventCallback,
  PersonData,
  TraceOptions
} from '../types'
