import type { PrecompilerPipeline } from '../compilerError'
import {
  foldArithmeticExpression,
  formatConstant,
  splitTopLevel,
  splitTrailingComment,
  tryEvaluateConstant,
  withErrors,
} from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const constants = new Map<string, bigint>()
  const reasons: string[] = []
  const output = pipeline[0].split('\n').map((original, index) => {
    const [line, comment] = splitTrailingComment(original)
    let code = line

    const powerOperand = String.raw`(?:0[xX][0-9A-Fa-f]+|0[bB][01]+|\d+|[A-Za-z_$][\w$]*|\([^()]+\))`
    const powerPattern = new RegExp(`(${powerOperand})\\s*\\*\\*\\s*(${powerOperand})`)
    while (powerPattern.test(code)) {
      const before = code
      code = code.replace(powerPattern, (expression) => {
        const value = tryEvaluateConstant(expression, constants)
        return value === undefined ? expression : formatConstant(value)
      })
      if (code === before) break
    }

    const declaration = code.match(/^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.+)$/)
    if (declaration) {
      let initializer = declaration[4]!
      const arrayLiteral = initializer.match(/^\[(.*)\]$/)
      if (arrayLiteral) {
        const slots = splitTopLevel(arrayLiteral[1] ?? '', ',')
        initializer = `[${slots.map((slot) => foldArithmeticExpression(slot, constants)).join(', ')}]`
      } else {
        initializer = foldArithmeticExpression(initializer, constants)
      }
      code = `${declaration[1]}${declaration[2]} ${declaration[3]} = ${initializer}`
      if (declaration[2] === 'const') {
        const value = tryEvaluateConstant(initializer, constants)
        if (value !== undefined) {
          constants.set(declaration[3]!, value)
          code = `${declaration[1]}const ${declaration[3]} = ${formatConstant(value)}`
        }
      }
    } else {
      const assignment = code.match(
        /^(\s*[A-Za-z_$][\w$]*(?:\[[^\]]+\])?\s*=\s*)(.+)$/,
      )
      if (assignment) code = `${assignment[1]}${foldArithmeticExpression(assignment[2]!, constants)}`
    }

    let searchFrom = 0
    while (true) {
      const match = /\bArray\s*\(/g
      match.lastIndex = searchFrom
      const found = match.exec(code)
      if (!found) break
      const open = code.indexOf('(', found.index)
      let depth = 1
      let close = open + 1
      while (close < code.length && depth > 0) {
        if (code[close] === '(') depth += 1
        else if (code[close] === ')') depth -= 1
        close += 1
      }
      if (depth !== 0) break
      const expression = code.slice(open + 1, close - 1)
      const value = tryEvaluateConstant(expression, constants)
      if (value === undefined) {
        reasons.push(`Line ${index + 1}: Array size must be a compile-time constant`)
        break
      }
      code = `${code.slice(0, open + 1)}${formatConstant(value)}${code.slice(close - 1)}`
      searchFrom = open + 1
    }

    if (code.includes('**')) {
      reasons.push(`Line ${index + 1}: runtime exponentiation is prohibited`)
    }
    return `${code}${comment ? ` ${comment}` : ''}`
  })

  if (reasons.length > 0) return withErrors(pipeline, reasons)
  return [output.join('\n'), pipeline[1], pipeline[2]]
}
