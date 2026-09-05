import { CompilerError } from '../compilerError'
import type { SourceLocation } from './ast'

export type TokenKind =
  | 'identifier'
  | 'number'
  | 'keyword'
  | 'operator'
  | 'punctuation'
  | 'newline'
  | 'comment'
  | 'eof'

export interface Token {
  kind: TokenKind
  value: string
  location: SourceLocation
}

const KEYWORDS = new Set([
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

const OPERATORS = [
  '>>>=',
  '===',
  '!==',
  's>>',
  's<=',
  's>=',
  '&&=',
  '||=',
  '??=',
  '**=',
  '>>>',
  '<<=',
  '>>=',
  '==',
  '!=',
  '<=',
  '>=',
  's<',
  's>',
  '&&',
  '||',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '<<',
  '>>',
  '**',
  '=>',
  '?.',
  '??',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '!',
  '~',
] as const

const isIdentifierStart = (value: string): boolean => /[A-Za-z_$]/.test(value)
const isIdentifierPart = (value: string): boolean => /[A-Za-z0-9_$]/.test(value)
const isDecimalDigit = (value: string): boolean => /[0-9]/.test(value)
const isHexDigit = (value: string): boolean => /[0-9A-Fa-f]/.test(value)

const compilerError = (reason: string, line: number, column: number): CompilerError =>
  new CompilerError(`Line ${line}, column ${column}: ${reason}`)

export function tokenize(source: string): Token[] {
  const text = source.replace(/\r\n?/g, '\n')
  const tokens: Token[] = []
  let index = 0
  let line = 1
  let column = 1

  const location = (): SourceLocation => ({ line, column })
  const advance = (): string => {
    const value = text[index++] ?? ''
    if (value === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
    return value
  }

  while (index < text.length) {
    const char = text[index] ?? ''

    if (char === ' ' || char === '\t') {
      advance()
      continue
    }

    if (char === '\n') {
      tokens.push({ kind: 'newline', value: '\n', location: location() })
      advance()
      continue
    }

    if (char === '/' && text[index + 1] === '/') {
      const start = location()
      let value = ''
      while (index < text.length && text[index] !== '\n') value += advance()
      tokens.push({ kind: 'comment', value, location: start })
      continue
    }

    if (char === '#') {
      const start = location()
      let value = ''
      while (index < text.length && text[index] !== '\n') value += advance()
      tokens.push({ kind: 'comment', value, location: start })
      continue
    }

    if (char === '/' && text[index + 1] === '*') {
      const start = location()
      let value = advance() + advance()
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        value += advance()
      }
      if (index >= text.length) throw compilerError('Unterminated block comment', start.line, start.column)
      value += advance() + advance()
      tokens.push({ kind: 'comment', value, location: start })
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      throw compilerError('String and template literals are prohibited', line, column)
    }

    if (isDecimalDigit(char)) {
      const start = location()
      let value = ''
      if (char === '0' && (text[index + 1] === 'x' || text[index + 1] === 'X')) {
        value += advance() + advance()
        if (!isHexDigit(text[index] ?? '')) throw compilerError('Invalid hexadecimal literal', start.line, start.column)
        while (isHexDigit(text[index] ?? '')) value += advance()
      } else if (char === '0' && (text[index + 1] === 'b' || text[index + 1] === 'B')) {
        value += advance() + advance()
        if (text[index] !== '0' && text[index] !== '1') {
          throw compilerError('Invalid binary literal', start.line, start.column)
        }
        while (text[index] === '0' || text[index] === '1') value += advance()
      } else {
        while (isDecimalDigit(text[index] ?? '')) value += advance()
        if (value.length > 1 && value.startsWith('0')) {
          throw compilerError('Octal and leading-zero decimal literals are prohibited', start.line, start.column)
        }
      }
      const suffix = text[index] ?? ''
      if (suffix === '_' || suffix === '.' || suffix === 'e' || suffix === 'E' || suffix === 'n') {
        throw compilerError('Unsupported numeric literal format', line, column)
      }
      tokens.push({ kind: 'number', value, location: start })
      continue
    }

    const operator = OPERATORS.find((candidate) => text.startsWith(candidate, index))
    if (operator) {
      const start = location()
      for (let offset = 0; offset < operator.length; offset += 1) advance()
      tokens.push({ kind: 'operator', value: operator, location: start })
      continue
    }

    if (isIdentifierStart(char)) {
      const start = location()
      let value = advance()
      while (isIdentifierPart(text[index] ?? '')) value += advance()
      tokens.push({ kind: KEYWORDS.has(value) ? 'keyword' : 'identifier', value, location: start })
      continue
    }

    if ('(){}[],.;'.includes(char)) {
      const start = location()
      tokens.push({ kind: 'punctuation', value: advance(), location: start })
      continue
    }

    throw compilerError(`Unexpected character ${JSON.stringify(char)}`, line, column)
  }

  tokens.push({ kind: 'eof', value: '', location: location() })
  return tokens
}
