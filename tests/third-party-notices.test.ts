import {describe,it,expect} from 'vitest'
import fs from 'node:fs'

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const notices=fs.readFileSync('THIRD_PARTY_NOTICES.md','utf8')
const runtime=fs.readFileSync('dist/motion-runtime.js','utf8')

describe('third-party notices',()=>{
 it('ship in the npm package',()=>{
  expect(pkg.files).toContain('THIRD_PARTY_NOTICES.md')
 })
 it('cover what the motion runtime bundles, with the ECharts NOTICE',()=>{
  for(const name of ['echarts','zrender','d3-shape','d3-hierarchy','tslib'])expect(notices).toMatch(new RegExp(`^- ${name} \\d`,'m'))
  expect(notices).toContain('This product includes software developed at')
  expect(notices).toMatch(/Apache License\s+Version 2\.0/)
 })
 it('are embedded at the top of the motion runtime',()=>{
  expect(runtime.startsWith('/*!\n# Third-party notices: vilsem-mcp')).toBe(true)
  expect(runtime.slice(0,runtime.indexOf('*/'))).toContain('Apache ECharts')
 })
 it('are written into the Claude Desktop bundle by its build',()=>{
  const script=fs.readFileSync('scripts/build-mcpb.mjs','utf8')
  expect(script).toContain("'THIRD_PARTY_NOTICES.md'")
  expect(script).toContain('buildNotices(')
 })
})
