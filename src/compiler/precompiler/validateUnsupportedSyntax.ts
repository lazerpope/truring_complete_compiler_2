import type { PrecompilerPipeline } from '../compilerError'
import { tokenize } from '../language/tokenize'
import { maskComments, withErrors } from './shared'

const FORBIDDEN_WORDS = new Set([
  'arguments', 'async', 'await', 'case', 'catch', 'class', 'debugger', 'default', 'delete', 'do',
  'enum', 'export', 'extends', 'finally', 'from', 'function', 'get', 'implements', 'import',
  'Infinity', 'instanceof', 'interface', 'NaN', 'new', 'of', 'package', 'private', 'protected',
  'public', 'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'void',
  'with', 'yield',
])

const FORBIDDEN_OPERATORS = new Set([
  '>>>=', '&&=', '||=', '??=', '**=', '>>>', '<<=', '>>=', '&=', '|=', '^=', '=>', '?.', '??',
])

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const reasons: string[] = []
  try {
    for (const token of tokenize(pipeline[0])) {
      if (FORBIDDEN_WORDS.has(token.value)) {
        reasons.push(`Line ${token.location.line}, column ${token.location.column}: ${token.value} is prohibited`)
      }
      if (FORBIDDEN_OPERATORS.has(token.value)) {
        reasons.push(`Line ${token.location.line}, column ${token.location.column}: operator ${token.value} is prohibited`)
      }
    }
  } catch (error: unknown) {
    reasons.push(error instanceof Error ? error.message : String(error))
  }

  const code = maskComments(pipeline[0])
  for (const [pattern, description] of [
    [/\b(?:goto|asm|pload|pstore|load_(?:8|16|32)|store_(?:8|16|32))\b/g, 'low-level source syntax'],
    [/^\s*[A-Za-z_$][\w$]*\s*:/gm, 'labels'],
  ] as const) {
    for (const match of code.matchAll(pattern)) {
      const line = code.slice(0, match.index).split('\n').length
      reasons.push(`Line ${line}: ${description} is prohibited`)
    }
  }

  return withErrors(pipeline, [...new Set(reasons)])
}
