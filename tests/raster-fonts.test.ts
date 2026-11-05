import {describe,it,expect} from 'vitest'
import {createRequire} from 'node:module'
import {Resvg} from '@resvg/resvg-js'
const {expandFontShorthand}=createRequire(import.meta.url)('../src/rasterize.cjs')
describe('PNG typography matches ECharts SVG',()=>{
 it.each(['normal bold','italic 700','normal normal'])('preserves %s font size and style in actual raster pixels',prefix=>{
  const make=(style:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><text x="10" y="70" fill="white" style="${style}">155</text></svg>`
  const source=make(`font: ${prefix} 50px sans-serif`)
  const weight=prefix.includes('bold')?'bold':prefix.includes('700')?'700':'normal'
  const expected=make(`font-family:sans-serif;font-size:50px;font-weight:${weight};font-style:${prefix.includes('italic')?'italic':'normal'};font-variant:normal`)
  const actual=new Resvg(expandFontShorthand(source))
  expect(actual.innerBBox()!.height).toBeGreaterThan(30)
  expect(actual.render().pixels.equals(new Resvg(expected).render().pixels)).toBe(true)
 })
 it('preserves family lists, surrounding CSS and later longhand overrides',()=>{
  expect(expandFontShorthand(`<text style="fill:red;font: bold 24px 'Segoe UI', sans-serif;opacity:.5;font-size:30px">x</text>`)).toBe(`<text style="fill:red;font-family:'Segoe UI', sans-serif;font-size:24px;font-weight:bold;font-style:normal;font-variant:normal;opacity:.5;font-size:30px">x</text>`)
  const unknown='<text style="font:caption;fill:red">font: example</text>'
  expect(expandFontShorthand(unknown)).toBe(unknown)
  const label='<text>literal font: bold 50px sans-serif"</text>'
  expect(expandFontShorthand(label)).toBe(label)
 })
})
