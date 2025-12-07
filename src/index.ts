import PaintBoard from './core/PaintBoard'
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
import './styles/paint-board.css'

export {
  PaintBoard,
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
  PersonTracker
}

export default PaintBoard

export type {
  Point,
  PaintBoardOptions,
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
  TrajectoryOptions
} from '../types'
