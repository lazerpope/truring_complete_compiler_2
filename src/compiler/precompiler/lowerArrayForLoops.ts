import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { findBlockEnd, maskComments, parseArrayInfos, splitTrailingComment } from './shared'

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
    const arrays = parseArrayInfos(source)

    const lowerRange = (lines: readonly string[]): string[] => {
      const output: string[] = []
      for (let index = 0; index < lines.length; index += 1) {
        const [header, comment] = splitTrailingComment(lines[index] ?? '')
        const match = header.match(
          /^(\s*)for\s*\(\s*let\s+([A-Za-z_$][\w$]*)\s+in\s+([A-Za-z_$][\w$]*)\s*\)\s*\{\s*$/,
        )
        if (!match) {
          output.push(lines[index] ?? '')
          continue
        }
        const end = findBlockEnd(lines, index)
        if (end < 0) {
          output.push(lines[index] ?? '')
          continue
        }
        const array = arrays.get(match[3]!)
        if (!array) {
          output.push(lines[index] ?? '')
          continue
        }
        const indent = match[1] ?? ''
        const iterator = match[2]!
        const update = `${iterator} = ${iterator} + 1`
        const body = injectBeforeCurrentLoopContinues(
          lowerRange(lines.slice(index + 1, end)),
          update,
        )
        output.push(`${indent}let ${iterator} = 0${comment ? ` ${comment}` : ''}`)
        output.push(`${indent}while (${iterator} < ${array.size}) {`)
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
