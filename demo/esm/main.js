import { PaintBoard, AreaTool, SelectTool, TextTool, CurveTool, ImageTool, Toolbar } from '../../dist/index.esm.js'

const board = new PaintBoard('#canvas-container', {
  width: 1000,
  height: 600,
  backgroundColor: '#ffffff'
}).init()

board
  .registerTool('select', new SelectTool())
  .registerTool('area', new AreaTool())
  .registerTool('curve', new CurveTool())
  .registerTool('text', new TextTool())
  .registerTool('image', new ImageTool())
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

board.on('image:created', (data) => {
  console.log('图片已创建:', data)
})

console.log('ESM 方式初始化成功:', board)
