import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { maskComments, nextGeneratedName, splitTrailingComment } from './shared'

const parseLiteral = (literal: string): bigint => BigInt(literal)

const insideArraySize = (code: string, position: number): boolean => {
  const before = code.slice(0, position)
  const arrays = [...before.matchAll(/\bArray\s*\(/g)]
  const array = arrays.at(-1)
  if (!array || array.index === undefined) return false
  return before.lastIndexOf(')') < array.index
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const makeName = nextGeneratedName(source, 'large')
    const output: string[] = []

    for (const original of source.split('\n')) {
      const [line, comment] = splitTrailingComment(original)
      const indent = line.match(/^\s*/)?.[0] ?? ''
      const masked = maskComments(line)
      const matches = [...masked.matchAll(/\b(?:0[xX][0-9A-Fa-f]+|0[bB][01]+|\d+)\b/g)].reverse()
      let rewritten = line
      const generated: string[][] = []

      for (const match of matches) {
        if (match.index === undefined || insideArraySize(masked, match.index)) continue
        const value = parseLiteral(match[0])
        if (value <= 0xffffn || value > 0xffffffffn) continue
        const name = makeName()
        const high = Number((value >> 16n) & 0xffffn)
        const low = Number(value & 0xffffn)
        const lines = [
          `${indent}let ${name} = ${high}`,
          `${indent}${name} = ${name} << 16`,
        ]
        if (low !== 0) lines.push(`${indent}${name} = ${name} | ${low}`)
        generated.unshift(lines)
        rewritten = `${rewritten.slice(0, match.index)}${name}${rewritten.slice(match.index + match[0].length)}`
      }

      const prelude = generated.flat()
      if (prelude.length > 0 && comment) prelude[0] += ` ${comment}`
      output.push(...prelude, `${rewritten}${prelude.length ? '' : comment ? ` ${comment}` : ''}`)
    }

    return output.join('\n')
  })
}
