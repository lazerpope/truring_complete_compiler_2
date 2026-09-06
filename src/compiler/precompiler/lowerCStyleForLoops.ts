import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { findBlockEnd, maskComments, splitTopLevel, splitTrailingComment } from './shared'

const injectBeforeCurrentLoopContinues = (lines: readonly string[], update: string): string[] => {
  const output: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const code = maskComments(lines[index] ?? '').trim()
    if (/^(?:while|for)\s*\(/.test(code)) {
      const end = findBlockEnd(lines, index)
      if (end >= index) {
        output.push(...lines.slice(index, end + 1))
        index = end
        continue
      }
    }
    if (/^continue\s*$/.test(code)) {
      const indent = lines[index]?.match(/^\s*/)?.[0] ?? ''
      output.push(`${indent}${update}`)
    }
    output.push(lines[index] ?? '')
  }
  return output
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const lowerRange = (lines: readonly string[]): string[] => {
      const output: string[] = []
      for (let index = 0; index < lines.length; index += 1) {
        const [header, comment] = splitTrailingComment(lines[index] ?? '')
        const match = header.match(/^(\s*)for\s*\((.*)\)\s*\{\s*$/)
        if (!match) {
          output.push(lines[index] ?? '')
          continue
        }
        const clauses = splitTopLevel(match[2] ?? '', ';')
        const end = findBlockEnd(lines, index)
        if (clauses.length !== 3 || end < 0) {
          output.push(lines[index] ?? '')
          continue
        }
        const indent = match[1] ?? ''
        const [initializer, condition, update] = clauses as [string, string, string]
        const body = injectBeforeCurrentLoopContinues(
          lowerRange(lines.slice(index + 1, end)),
          update,
        )
        output.push(`${indent}${initializer}${comment ? ` ${comment}` : ''}`)
        output.push(`${indent}while (${condition}) {`)
        output.push(...body)
        output.push(`${indent}  ${update}`)
        output.push(`${indent}}`)
        index = end
      }
      return output
    }

    return lowerRange(source.split('\n')).join('\n')
  })
}
