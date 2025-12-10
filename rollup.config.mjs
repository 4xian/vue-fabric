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
  })
]

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
        exports: 'named'
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'VueFabric',
        sourcemap: true,
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
      file: 'dist/index.umd.min.js',
      format: 'umd',
      name: 'VueFabric',
      sourcemap: true,
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
