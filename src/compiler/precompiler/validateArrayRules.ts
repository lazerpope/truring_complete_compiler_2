import type { PrecompilerPipeline } from '../compilerError'
import {
  identifierPattern,
  maskComments,
  parseArrayInfos,
  sourceLines,
  tryEvaluateConstant,
  withErrors,
} from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const arrays = parseArrayInfos(pipeline[0])
  const reasons: string[] = []

  for (const array of arrays.values()) {
    if (!Number.isSafeInteger(array.size) || array.size <= 0 || array.size > 0xffffffff) {
      reasons.push(`Line ${array.declarationLine}: array ${array.name} must have a positive U32 size`)
    }
  }

  for (const line of sourceLines(pipeline[0])) {
    for (const creation of line.code.matchAll(/\bArray\s*\(([^)]*)\)/g)) {
      const size = tryEvaluateConstant(creation[1] ?? '')
      if (size !== undefined && (size <= 0n || size > 0xffffffffn)) {
        reasons.push(`Line ${line.lineNumber}: array size must be in 1..4294967295`)
      }
    }
    if (/=\s*\[\s*\]\s*$/.test(line.code)) {
      reasons.push(`Line ${line.lineNumber}: empty array literals are prohibited`)
    }
    if (/=\s*\[[^\n]*\[/.test(line.code)) {
      reasons.push(`Line ${line.lineNumber}: nested arrays are prohibited`)
    }

    for (const array of arrays.values()) {
      if (line.lineNumber === array.declarationLine) continue
      const name = identifierPattern(array.name)
      const directAssignment = new RegExp(`^\\s*${name}\\s*(?:=|\\+=|-=|\\*=|\\/=|%=|\\+\\+|--)`)
      if (directAssignment.test(line.code)) {
        reasons.push(`Line ${line.lineNumber}: array ${array.name} cannot be reassigned`)
      }
      const alias = new RegExp(`^\\s*(?:let|const|var)\\s+[A-Za-z_$][\\w$]*\\s*=\\s*${name}\\s*$`)
      if (alias.test(line.code)) reasons.push(`Line ${line.lineNumber}: arrays cannot be aliased`)
      const comparison = new RegExp(`${name}\\s*(?:===|!==|==|!=|s?[<>]=?)`)
      if (comparison.test(line.code)) reasons.push(`Line ${line.lineNumber}: arrays cannot be compared`)
    }
  }

  const code = maskComments(pipeline[0])
  for (const array of arrays.values()) {
    const invalidProperty = new RegExp(
      `${identifierPattern(array.name)}\\.(?!length(?![A-Za-z0-9_$]))[A-Za-z_$][\\w$]*`,
      'g',
    )
    if (invalidProperty.test(code)) reasons.push(`Array ${array.name} only supports the length property`)
  }

  return withErrors(pipeline, reasons)
}
