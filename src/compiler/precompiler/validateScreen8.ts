import type { PrecompilerPipeline } from '../compilerError'
import {
  braceDelta,
  sourceLines,
  splitTopLevel,
  splitTrailingComment,
  tryEvaluateConstant,
  withErrors,
} from './shared'
import { parseScreen8Declaration, parseScreen8PixelWrite, parseScreen8Present } from './screen8'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline

  const reasons: string[] = []
  const constants = new Map<string, bigint>()
  let depth = 0
  let declarationLine: number | undefined
  let width = 0n
  let height = 0n

  for (const line of sourceLines(pipeline[0])) {
    const [rawCode] = splitTrailingComment(line.original)
    const code = rawCode.trim()
    const declaration = parseScreen8Declaration(code)

    const constant = code.match(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/)
    if (constant) {
      const value = tryEvaluateConstant(constant[2]!, constants)
      if (value !== undefined) constants.set(constant[1]!, value)
    }

    if (declaration !== undefined) {
      if (depth !== 0) reasons.push(`Line ${line.lineNumber}: Screen8 must be declared at top level`)
      if (declarationLine !== undefined) {
        reasons.push(`Line ${line.lineNumber}: only one Screen8 declaration is allowed`)
      } else {
        declarationLine = line.lineNumber
        const setting = tryEvaluateConstant(declaration, constants)
        if (setting === undefined || setting < 0n || setting > 255n) {
          reasons.push(`Line ${line.lineNumber}: Screen8 resolution must be a constant integer from 0 to 255`)
        } else {
          width = 4n * (setting + 1n)
          height = 3n * (setting + 1n)
        }
      }
    } else if (/\bScreen8\b/.test(code)) {
      reasons.push(`Line ${line.lineNumber}: Screen8 is only valid as let screen = Screen8(constant)`)
    }

    if (/\bscreen\s*\.\s*present\b/.test(code)) {
      const color = parseScreen8Present(code)
      if (!color || splitTopLevel(color, ',').length !== 1) {
        reasons.push(`Line ${line.lineNumber}: screen.present requires exactly one color argument`)
      } else if (declarationLine === undefined) {
        reasons.push(`Line ${line.lineNumber}: screen.present cannot be called before Screen8 is declared`)
      } else {
        if (/\bscreen\s*\[/.test(color)) {
          reasons.push(`Line ${line.lineNumber}: Screen8 pixel reads are prohibited`)
        }
        const value = tryEvaluateConstant(color, constants)
        if (value !== undefined && (value < 0n || value > 255n)) {
          reasons.push(`Line ${line.lineNumber}: screen.present color must fit in 8 bits`)
        }
      }
    }

    if (/\bscreen\s*\[/.test(code)) {
      const write = parseScreen8PixelWrite(code)
      if (!write) {
        reasons.push(`Line ${line.lineNumber}: Screen8 only supports screen[x][y] = value`)
      } else if (declarationLine === undefined) {
        reasons.push(`Line ${line.lineNumber}: screen pixels cannot be written before Screen8 is declared`)
      } else {
        if (/\bscreen\s*\[/.test(write.value)) {
          reasons.push(`Line ${line.lineNumber}: Screen8 pixel reads are prohibited`)
        }
        const x = tryEvaluateConstant(write.x, constants)
        const y = tryEvaluateConstant(write.y, constants)
        const value = tryEvaluateConstant(write.value, constants)
        if (x !== undefined && (x < 0n || x >= width)) {
          reasons.push(`Line ${line.lineNumber}: Screen8 x coordinate ${x} is outside 0..${width - 1n}`)
        }
        if (y !== undefined && (y < 0n || y >= height)) {
          reasons.push(`Line ${line.lineNumber}: Screen8 y coordinate ${y} is outside 0..${height - 1n}`)
        }
        if (value !== undefined && (value < 0n || value > 255n)) {
          reasons.push(`Line ${line.lineNumber}: Screen8 pixel value must fit in 8 bits`)
        }
      }
    }

    depth += braceDelta(rawCode)
  }

  return withErrors(pipeline, reasons)
}
