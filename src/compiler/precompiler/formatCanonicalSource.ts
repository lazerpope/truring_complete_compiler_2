import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { maskComments, sourceLines, splitTrailingComment } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    let depth = 0
    return sourceLines(source)
      .map((line) => {
        if (!line.original.trim()) return ''
        if (!line.code.trim()) return line.original
        const [sourceCode, comment] = splitTrailingComment(line.original)
        const trimmed = sourceCode.trim()
        const code = maskComments(trimmed)
        if (code.startsWith('}')) depth = Math.max(0, depth - 1)
        const formatted = `${'  '.repeat(depth)}${trimmed}${comment ? ` ${comment}` : ''}`
        const opens = [...code].filter((char) => char === '{').length
        const closes = [...code].filter((char) => char === '}').length
        depth = Math.max(0, depth + opens - closes + (code.startsWith('}') ? 1 : 0))
        return formatted
      })
      .join('\n')
  })
}
