import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import dts from 'rollup-plugin-dts'
import postcss from 'rollup-plugin-postcss'
import svgImport from 'rollup-plugin-svg-import'

const external = ['fabric']

const commonPlugins = [
  peerDepsExternal(),
  resolve(),
  commonjs(),
  svgImport({ stringify: true }),
  postcss({
    extract: 'style.css',
    minimize: true
  }),
  typescript({
    tsconfig: './tsconfig.build.json',
    declaration: false
  }),
  terser()
]

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/vue-fabric.js',
        format: 'esm',
        sourcemap: false,
        exports: 'named'
      },
      {
        file: 'dist/vue-fabric.umd.js',
        format: 'umd',
        name: 'VueFabric',
        sourcemap: false,
        exports: 'named',
        globals: { fabric: 'fabric' }
      }
    ],
    external,
    plugins: commonPlugins
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/vue-fabric.umd.min.js',
      format: 'umd',
      name: 'VueFabric',
      sourcemap: false,
      exports: 'named',
      globals: { fabric: 'fabric' }
    },
    external,
    plugins: [
      peerDepsExternal(),
      resolve(),
      commonjs(),
      svgImport({ stringify: true }),
      postcss({
        extract: false,
        inject: false
      }),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false
      }),
      terser()
    ]
  },
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'es' },
    external: [/\.css$/],
    plugins: [
      dts({
        tsconfig: './tsconfig.build.json'
      })
    ]
  }
]
