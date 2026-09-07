import type { PrecompilerPipeline } from '../compilerError'
import { sourceLines, withErrors } from './shared'
import { parseScreen8Declaration } from './screen8'

export const RESERVED_IDENTIFIERS = new Set([
  'Array',
  'Math',
  'arguments',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'counter',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'Infinity',
  'input',
  'instanceof',
  'interface',
  'keyboard',
  'let',
  'NaN',
  'new',
  'null',
  'of',
  'output',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'screen',
  'Screen8',
  'set',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'time_0',
  'time_1',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const reasons: string[] = []
  const declared = new Map<string, number>()

  for (const line of sourceLines(pipeline[0])) {
    const isScreen8Declaration = parseScreen8Declaration(line.code) !== undefined
    const declarations = [
      ...line.code.matchAll(/(?:^|\bfor\s*\()\s*(?:let|const|var)\s+([^\s=;,)]+)/g),
    ]
    for (const declaration of declarations) {
      const name = declaration[1] ?? ''
      // `screen` is reserved everywhere except the language's one dedicated
      // Screen8 declaration. validateScreen8 owns validation of that form.
      if (name === 'screen' && isScreen8Declaration) continue
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
        reasons.push(`Line ${line.lineNumber}: invalid identifier ${JSON.stringify(name)}`)
        continue
      }
      if (name.startsWith('__ts_')) {
        reasons.push(`Line ${line.lineNumber}: identifiers beginning with __ts_ are reserved`)
      }
      if (RESERVED_IDENTIFIERS.has(name))
        reasons.push(`Line ${line.lineNumber}: ${name} is reserved`)
      const previous = declared.get(name)
      if (previous !== undefined) {
        reasons.push(
          `Line ${line.lineNumber}: duplicate declaration of ${name}; first declared on line ${previous}`,
        )
      } else declared.set(name, line.lineNumber)
    }
  }

  return withErrors(pipeline, reasons)
}
