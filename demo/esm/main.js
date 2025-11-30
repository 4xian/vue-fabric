import { PaintBoard, LineTool, SelectTool, TextTool, CurveTool, Toolbar } from '../../dist/index.esm.js'

const board = new PaintBoard('#canvas-container', {
  width: 1000,
  height: 600,
  backgroundColor: '#ffffff'
}).init()

board
  .registerTool('select', new SelectTool())
  .registerTool('line', new LineTool())
  .registerTool('curve', new CurveTool())
  .registerTool('text', new TextTool())
  .setTool('select')

const toolbar = new Toolbar(board).init()

board.on('area:created', (data) => {
  console.log('区域已创建:', data)
})

board.on('text:created', (data) => {
  console.log('文本已创建:', data)
})

board.on('curve:created', (data) => {
  console.log('曲线已创建:', data)
})

console.log('ESM 方式初始化成功:', board)
