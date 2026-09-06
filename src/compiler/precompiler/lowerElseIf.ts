import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { maskComments, splitTrailingComment } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const lines = source.split('\n')
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const [originalCode, comment] = splitTrailingComment(lines[index] ?? '')
      const code = maskComments(originalCode)
      const match = code.match(/^(\s*)}\s*else\s+if\s*(\([^\n]+\))\s*\{\s*$/)
      if (!match) continue
      const indent = match[1] ?? ''
      let depth = 1
      let end = index
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const nested = maskComments(lines[cursor] ?? '')
        depth += [...nested].filter((char) => char === '{').length
        depth -= [...nested].filter((char) => char === '}').length
        if (depth === 0) {
          end = cursor
          break
        }
      }
      lines[index] = `${indent}} else {${comment ? ` ${comment}` : ''}\n${indent}  if ${match[2]} {`
      lines.splice(end + 1, 0, `${indent}}`)
    }
    return lines.join('\n')
  })
}
