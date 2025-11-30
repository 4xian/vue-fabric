import PaintBoard from './core/PaintBoard'
import EventBus from './core/EventBus'
import CanvasManager from './core/CanvasManager'
import Toolbar from './ui/Toolbar'
import ColorPicker from './ui/ColorPicker'
import BaseTool from './tools/BaseTool'
import LineTool from './tools/LineTool'
import SelectTool from './tools/SelectTool'
import TextTool from './tools/TextTool'
import CurveTool from './tools/CurveTool'
import './styles/paint-board.css'

export {
  PaintBoard,
  EventBus,
  CanvasManager,
  Toolbar,
  ColorPicker,
  BaseTool,
  LineTool,
  SelectTool,
  TextTool,
  CurveTool
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
  HistoryState,
  ColorPickerOptions,
  ColorState,
  ToolbarOptions,
  ToolName,
  EventCallback
} from '../types'
