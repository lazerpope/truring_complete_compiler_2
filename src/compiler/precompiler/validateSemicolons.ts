import type { PrecompilerPipeline } from '../compilerError'
import { sourceLines, withErrors } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const reasons: string[] = []

  for (const line of sourceLines(pipeline[0])) {
    const semicolons = [...line.code.matchAll(/;/g)]
    if (semicolons.length === 0) continue
    const forHeader = line.code.match(/^\s*for\s*\((.*)\)\s*\{\s*$/)
    if (!forHeader || semicolons.length !== 2 || (forHeader[1]?.match(/;/g)?.length ?? 0) !== 2) {
      reasons.push(`Line ${line.lineNumber}: semicolons are allowed only as the two C-style for separators`)
    }
  }

  return withErrors(pipeline, reasons)
}
