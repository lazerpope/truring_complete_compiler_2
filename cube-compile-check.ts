import { readFileSync } from 'node:fs'

console.groupCollapsed = () => undefined
console.groupEnd = () => undefined
console.log = () => undefined

const { compile } = await import('./src/compiler/main')
const source = readFileSync('./docs/examples/spinning_cube.txt', 'utf8')
const result = compile(source)
process.stdout.write(JSON.stringify({ errors: result[1].reasons, lines: result[0].split('\n').length }))
