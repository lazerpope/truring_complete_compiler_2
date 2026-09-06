import type { PrecompilerPipeline } from '../compilerError'
import {
  identifierPattern,
  parseArrayInfos,
  sourceLines,
  tryEvaluateConstant,
  withErrors,
} from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const arrays = parseArrayInfos(pipeline[0])
  const constants = new Map<string, bigint>()
  const reasons: string[] = []

  for (const line of sourceLines(pipeline[0])) {
    const declaration = line.code.match(
      /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(0[xX][0-9A-Fa-f]+|0[bB][01]+|\d+)\s*$/,
    )
    if (declaration) constants.set(declaration[1]!, BigInt(declaration[2]!))
    for (const array of arrays.values()) {
      const pattern = new RegExp(`${identifierPattern(array.name)}\\s*\\[([^\\]]+)\\]`, 'g')
      for (const access of line.code.matchAll(pattern)) {
        const value = tryEvaluateConstant(access[1] ?? '', constants)
        if (value === undefined) continue
        if (value < 0n || value >= BigInt(array.size)) {
          reasons.push(
            `Line ${line.lineNumber}: index ${value} is outside array ${array.name} of size ${array.size}`,
          )
        }
      }
    }
  }

  return withErrors(pipeline, reasons)
}
