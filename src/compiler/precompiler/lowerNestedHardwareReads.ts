import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { findBlockEnd, nextGeneratedName, splitTrailingComment } from './shared'

const READ_PATTERN = /\b(input|keyboard|time_0|time_1|counter)\s*\(\s*\)/

const extractReads = (
  expression: string,
  indent: string,
  makeName: () => string,
): { expression: string; prelude: string[] } => {
  let result = expression
  const prelude: string[] = []
  while (true) {
    const match = READ_PATTERN.exec(result)
    if (!match || match.index === undefined) break
    const name = makeName()
    prelude.push(`${indent}let ${name} = ${match[0]}`)
    result = `${result.slice(0, match.index)}${name}${result.slice(match.index + match[0].length)}`
  }
  return { expression: result, prelude }
}

const isDirectReadAssignment = (line: string): boolean =>
  /^\s*(?:(?:let|const|var)\s+)?[A-Za-z_$][\w$]*\s*=\s*(?:input|keyboard|time_0|time_1|counter)\s*\(\s*\)\s*$/.test(
    line,
  )

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const makeName = nextGeneratedName(source, 'hardware')

    const lowerRange = (lines: readonly string[]): string[] => {
      const output: string[] = []
      for (let index = 0; index < lines.length; index += 1) {
        const original = lines[index] ?? ''
        const [line, comment] = splitTrailingComment(original)
        const indent = line.match(/^\s*/)?.[0] ?? ''
        if (isDirectReadAssignment(line) || !READ_PATTERN.test(line)) {
          output.push(original)
          continue
        }

        // The canonical compiler already preserves conditional short-circuiting.
        // Leaving reads in logical conditions is safer than hoisting a skipped read.
        if (line.includes('&&') || line.includes('||')) {
          output.push(original)
          continue
        }

        const whileMatch = line.match(/^\s*while\s*\((.*)\)\s*\{\s*$/)
        if (whileMatch) {
          const end = findBlockEnd(lines, index)
          if (end >= 0) {
            const lowered = extractReads(whileMatch[1] ?? '', `${indent}  `, makeName)
            output.push(`${indent}while (1) {${comment ? ` ${comment}` : ''}`)
            output.push(...lowered.prelude)
            output.push(`${indent}  if (!(${lowered.expression})) {`)
            output.push(`${indent}    break`)
            output.push(`${indent}  }`)
            output.push(...lowerRange(lines.slice(index + 1, end)))
            output.push(`${indent}}`)
            index = end
            continue
          }
        }

        const lowered = extractReads(line, indent, makeName)
        if (lowered.prelude.length > 0 && comment) lowered.prelude[0] += ` ${comment}`
        output.push(...lowered.prelude, lowered.expression)
      }
      return output
    }

    return lowerRange(source.split('\n')).join('\n')
  })
}
