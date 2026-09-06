import type { PrecompilerPipeline } from '../compilerError'
import { sourceLines, withErrors } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const constants = new Map<string, number>()
  const reasons: string[] = []

  for (const line of sourceLines(pipeline[0])) {
    const declaration = line.code.match(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=/)
    if (declaration) {
      constants.set(declaration[1]!, line.lineNumber)
      continue
    }
    const assignment = line.code.match(
      /^\s*([A-Za-z_$][\w$]*)\s*(?:=|\+=|-=|\*=|\/=|%=|\+\+|--)/,
    )
    if (!assignment || !constants.has(assignment[1]!)) continue
    reasons.push(`Line ${line.lineNumber}: const ${assignment[1]} cannot be reassigned`)
  }

  return withErrors(pipeline, reasons)
}
