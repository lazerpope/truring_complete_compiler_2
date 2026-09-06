import { tokenize, type Token } from '../language/tokenize'
import type { PrecompilerPipeline } from '../compilerError'

export interface SourceLine {
  original: string
  code: string
  lineNumber: number
}

export interface ArrayInfo {
  name: string
  size: number
  declarationLine: number
  kind: 'let' | 'const' | 'var'
}

const MATH_CONSTANTS = new Map<string, bigint>([
  ['U16_MAX', 0xffffn],
  ['S16_MAX', 0x7fffn],
  ['U32_MAX', 0xffffffffn],
  ['S32_MIN', 0x80000000n],
  ['S32_MAX', 0x7fffffffn],
])

export const withErrors = (
  pipeline: PrecompilerPipeline,
  reasons: readonly string[],
): PrecompilerPipeline => {
  if (reasons.length === 0) return pipeline
  return [
    pipeline[0],
    {
      isError: true,
      reasons: [...pipeline[1].reasons, ...reasons],
    },
    pipeline[2],
  ]
}

export const maskComments = (source: string): string => {
  let output = ''
  let mode: 'code' | 'line' | 'block' = 'code'

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ''
    const next = source[index + 1] ?? ''

    if (mode === 'line') {
      if (char === '\n') {
        output += '\n'
        mode = 'code'
      } else output += ' '
      continue
    }

    if (mode === 'block') {
      if (char === '*' && next === '/') {
        output += '  '
        index += 1
        mode = 'code'
      } else output += char === '\n' ? '\n' : ' '
      continue
    }

    if (char === '#' || (char === '/' && next === '/')) {
      output += char === '#' ? ' ' : '  '
      if (char === '/') index += 1
      mode = 'line'
      continue
    }

    if (char === '/' && next === '*') {
      output += '  '
      index += 1
      mode = 'block'
      continue
    }

    output += char
  }

  return output
}

export const sourceLines = (source: string): SourceLine[] => {
  const originals = source.split('\n')
  const masked = maskComments(source).split('\n')
  return originals.map((original, index) => ({
    original,
    code: masked[index] ?? '',
    lineNumber: index + 1,
  }))
}

export const replaceOutsideComments = (
  source: string,
  transform: (code: string) => string,
): string => {
  let output = ''
  let code = ''
  let mode: 'code' | 'line' | 'block' = 'code'

  const flushCode = () => {
    output += transform(code)
    code = ''
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ''
    const next = source[index + 1] ?? ''

    if (mode === 'line') {
      output += char
      if (char === '\n') mode = 'code'
      continue
    }

    if (mode === 'block') {
      output += char
      if (char === '*' && next === '/') {
        output += next
        index += 1
        mode = 'code'
      }
      continue
    }

    if (char === '#' || (char === '/' && next === '/') || (char === '/' && next === '*')) {
      flushCode()
      output += char
      if (char === '/') {
        output += next
        index += 1
      }
      mode = char === '/' && next === '*' ? 'block' : 'line'
      continue
    }

    code += char
  }

  flushCode()
  return output
}

export const splitTrailingComment = (line: string): [code: string, comment: string] => {
  const masked = maskComments(line)
  for (let index = 0; index < line.length; index += 1) {
    if (masked[index] !== ' ' || line[index] === ' ' || line[index] === '\t') continue
    if (line[index] === '#' || line.slice(index, index + 2) === '//') {
      return [line.slice(0, index).trimEnd(), line.slice(index)]
    }
  }
  return [line.trimEnd(), '']
}

export const splitTopLevel = (source: string, delimiter: string): string[] => {
  const parts: string[] = []
  let start = 0
  let round = 0
  let square = 0

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '(') round += 1
    else if (char === ')') round -= 1
    else if (char === '[') square += 1
    else if (char === ']') square -= 1
    else if (char === delimiter && round === 0 && square === 0) {
      parts.push(source.slice(start, index).trim())
      start = index + 1
    }
  }

  parts.push(source.slice(start).trim())
  return parts
}

export const findMatching = (
  source: string,
  openIndex: number,
  open = '(',
  close = ')',
): number => {
  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === open) depth += 1
    else if (source[index] === close) {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

export const nextGeneratedName = (source: string, purpose: string): (() => string) => {
  const pattern = new RegExp(`\\b__ts_${purpose}_(\\d+)\\b`, 'g')
  let next = 0
  for (const match of source.matchAll(pattern)) next = Math.max(next, Number(match[1]) + 1)
  return () => `__ts_${purpose}_${next++}`
}

export const identifierPattern = (name: string): string => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `(?<![A-Za-z0-9_$])${escaped}(?![A-Za-z0-9_$])`
}

export const parseArrayInfos = (source: string): Map<string, ArrayInfo> => {
  const arrays = new Map<string, ArrayInfo>()
  for (const line of sourceLines(source)) {
    const creation = line.code.match(
      /^\s*(let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Array\s*\(\s*(0[xX][\dA-Fa-f]+|0[bB][01]+|\d+)\s*\)/,
    )
    if (creation) {
      arrays.set(creation[2]!, {
        name: creation[2]!,
        size: Number.parseInt(
          creation[3]!.replace(/^0[bB]/, ''),
          /^0[xX]/.test(creation[3]!) ? 16 : /^0[bB]/.test(creation[3]!) ? 2 : 10,
        ),
        declarationLine: line.lineNumber,
        kind: creation[1] as ArrayInfo['kind'],
      })
      continue
    }

    const literal = line.code.match(
      /^\s*(let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[(.*)\]\s*$/,
    )
    if (!literal) continue
    const contents = literal[3] ?? ''
    const slots = splitTopLevel(contents, ',')
    if (slots.at(-1) === '') slots.pop()
    arrays.set(literal[2]!, {
      name: literal[2]!,
      size: slots.length,
      declarationLine: line.lineNumber,
      kind: literal[1] as ArrayInfo['kind'],
    })
  }
  return arrays
}

const significantTokens = (expression: string): Token[] =>
  tokenize(expression).filter((token) => token.kind !== 'newline' && token.kind !== 'comment')

class ConstantEvaluator {
  private index = 0

  constructor(
    private readonly tokens: readonly Token[],
    private readonly constants: ReadonlyMap<string, bigint>,
  ) {}

  evaluate(): bigint | undefined {
    const value = this.parseBinary(0)
    return value === undefined || this.current().kind !== 'eof' ? undefined : value
  }

  private readonly levels = [
    ['|'],
    ['^'],
    ['&'],
    ['<<', '>>', 's>>'],
    ['+', '-'],
    ['*', '/', '%'],
    ['**'],
  ]

  private parseBinary(level: number): bigint | undefined {
    if (level === this.levels.length) return this.parseUnary()
    let left = this.parseBinary(level + 1)
    const operators = this.levels[level] ?? []
    while (operators.includes(this.current().value)) {
      const operator = this.advance().value
      const right = this.parseBinary(level + 1)
      if (left === undefined || right === undefined) return undefined
      left = this.applyBinary(left, operator, right)
      if (left === undefined) return undefined
    }
    return left
  }

  private parseUnary(): bigint | undefined {
    const operator = this.current().value
    if (operator === '-' || operator === '~') {
      this.advance()
      const value = this.parseUnary()
      if (value === undefined) return undefined
      return operator === '-' ? -value : ~value
    }
    return this.parsePrimary()
  }

  private parsePrimary(): bigint | undefined {
    const token = this.current()
    if (token.kind === 'number') {
      this.advance()
      return BigInt(token.value)
    }

    if (token.kind === 'identifier') {
      this.advance()
      return this.constants.get(token.value)
    }

    if (token.value === 'Math') {
      this.advance()
      if (!this.consume('.')) return undefined
      const member = this.advance().value
      if (!this.consume('(')) return MATH_CONSTANTS.get(member)
      const first = this.parseBinary(0)
      if (first === undefined) return undefined
      if (member === 'abs') {
        if (!this.consume(')')) return undefined
        const signed = BigInt.asIntN(32, first)
        return signed < 0 ? -signed : signed
      }
      if (!this.consume(',')) return undefined
      const second = this.parseBinary(0)
      if (second === undefined || !this.consume(')')) return undefined
      if (member === 'min') return BigInt.asUintN(32, first) <= BigInt.asUintN(32, second) ? first : second
      if (member === 'max') return BigInt.asUintN(32, first) >= BigInt.asUintN(32, second) ? first : second
      if (member === 'smin') return BigInt.asIntN(32, first) <= BigInt.asIntN(32, second) ? first : second
      if (member === 'smax') return BigInt.asIntN(32, first) >= BigInt.asIntN(32, second) ? first : second
      return undefined
    }

    if (this.consume('(')) {
      const value = this.parseBinary(0)
      return value !== undefined && this.consume(')') ? value : undefined
    }
    return undefined
  }

  private applyBinary(left: bigint, operator: string, right: bigint): bigint | undefined {
    if (operator === '+') return left + right
    if (operator === '-') return left - right
    if (operator === '*') return left * right
    if (operator === '/') return right === 0n ? 0n : left / right
    if (operator === '%') return right === 0n ? left : left % right
    if (operator === '&') return left & right
    if (operator === '^') return left ^ right
    if (operator === '|') return left | right
    if (operator === '**') {
      if (right < 0n || right > 100000n) return undefined
      return left ** right
    }
    const amount = Number(BigInt.asUintN(32, right) & 31n)
    if (operator === '<<') return left << BigInt(amount)
    if (operator === '>>') return BigInt.asUintN(32, left) >> BigInt(amount)
    if (operator === 's>>') return BigInt.asIntN(32, left) >> BigInt(amount)
    return undefined
  }

  private consume(value: string): boolean {
    if (this.current().value !== value) return false
    this.advance()
    return true
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!
  }

  private advance(): Token {
    const token = this.current()
    if (token.kind !== 'eof') this.index += 1
    return token
  }
}

export const tryEvaluateConstant = (
  expression: string,
  constants: ReadonlyMap<string, bigint> = new Map(),
): bigint | undefined => {
  try {
    return new ConstantEvaluator(significantTokens(expression), constants).evaluate()
  } catch {
    return undefined
  }
}

export const formatConstant = (value: bigint): string => value.toString(10)

interface FoldedNode {
  text: string
  constant?: bigint
}

class ArithmeticFolder {
  private index = 0
  private readonly levels = [
    ['||'],
    ['&&'],
    ['|'],
    ['^'],
    ['&'],
    ['==', '!=', '===', '!=='],
    ['<', '<=', '>', '>=', 's<', 's<=', 's>', 's>='],
    ['<<', '>>', 's>>'],
    ['+', '-'],
    ['*', '/', '%'],
    ['**'],
  ]

  constructor(
    private readonly tokens: readonly Token[],
    private readonly constants: ReadonlyMap<string, bigint>,
  ) {}

  fold(): string | undefined {
    const node = this.parseBinary(0)
    if (!node || this.current().kind !== 'eof') return undefined
    return this.unwrap(node.text)
  }

  private parseBinary(level: number): FoldedNode | undefined {
    if (level === this.levels.length) return this.parseUnary()
    let left = this.parseBinary(level + 1)
    if (!left) return undefined
    const operators = this.levels[level] ?? []
    while (operators.includes(this.current().value)) {
      const operator = this.advance().value
      const right = this.parseBinary(level + 1)
      if (!right) return undefined
      const folded = this.foldOperation(left, operator, right)
      left = folded ?? { text: `(${left.text} ${operator} ${right.text})` }
    }
    return left
  }

  private parseUnary(): FoldedNode | undefined {
    const operator = this.current().value
    if (operator === '-' || operator === '!' || operator === '~') {
      this.advance()
      const operand = this.parseUnary()
      if (!operand) return undefined
      if (operator === '-' && operand.constant !== undefined) {
        return this.constant(-operand.constant)
      }
      return { text: `${operator}${operand.text}` }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): FoldedNode | undefined {
    const token = this.current()
    let node: FoldedNode

    if (token.kind === 'number') {
      this.advance()
      node = this.constant(BigInt(token.value))
    } else if (token.kind === 'identifier' || token.kind === 'keyword') {
      this.advance()
      const value = this.constants.get(token.value)
      node = value === undefined ? { text: token.value } : this.constant(value)
    } else if (this.consume('(')) {
      const nested = this.parseBinary(0)
      if (!nested || !this.consume(')')) return undefined
      node = nested.constant === undefined ? { text: `(${nested.text})` } : nested
    } else return undefined

    while (true) {
      if (this.consume('.')) {
        const property = this.advance()
        if (property.kind !== 'identifier' && property.kind !== 'keyword') return undefined
        node = { text: `${node.text}.${property.value}` }
        continue
      }
      if (this.consume('[')) {
        const index = this.parseBinary(0)
        if (!index || !this.consume(']')) return undefined
        node = { text: `${node.text}[${index.text}]` }
        continue
      }
      if (this.consume('(')) {
        const args: string[] = []
        if (!this.consume(')')) {
          while (true) {
            const argument = this.parseBinary(0)
            if (!argument) return undefined
            args.push(argument.text)
            if (this.consume(')')) break
            if (!this.consume(',')) return undefined
          }
        }
        node = { text: `${node.text}(${args.join(', ')})` }
        continue
      }
      break
    }
    return node
  }

  private foldOperation(
    left: FoldedNode,
    operator: string,
    right: FoldedNode,
  ): FoldedNode | undefined {
    if (left.constant === undefined || right.constant === undefined) return undefined
    if (operator === '+') return this.constant(left.constant + right.constant)
    if (operator === '-') return this.constant(left.constant - right.constant)
    if (operator === '*') return this.constant(left.constant * right.constant)
    if (operator === '/') {
      return this.constant(right.constant === 0n ? 0n : left.constant / right.constant)
    }
    return undefined
  }

  private constant(value: bigint): FoldedNode {
    return { text: formatConstant(value), constant: value }
  }

  private unwrap(text: string): string {
    let result = text
    while (result.startsWith('(') && findMatching(result, 0) === result.length - 1) {
      result = result.slice(1, -1)
    }
    return result
  }

  private consume(value: string): boolean {
    if (this.current().value !== value) return false
    this.advance()
    return true
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!
  }

  private advance(): Token {
    const token = this.current()
    if (token.kind !== 'eof') this.index += 1
    return token
  }
}

export const foldArithmeticExpression = (
  expression: string,
  constants: ReadonlyMap<string, bigint>,
): string => {
  try {
    return new ArithmeticFolder(significantTokens(expression), constants).fold() ?? expression
  } catch {
    return expression
  }
}

export const braceDelta = (line: string): number => {
  const code = maskComments(line)
  return [...code].reduce((depth, char) => depth + (char === '{' ? 1 : char === '}' ? -1 : 0), 0)
}

export const findBlockEnd = (lines: readonly string[], headerIndex: number): number => {
  let depth = 0
  let opened = false
  for (let index = headerIndex; index < lines.length; index += 1) {
    const code = maskComments(lines[index] ?? '')
    for (const char of code) {
      if (char === '{') {
        depth += 1
        opened = true
      } else if (char === '}') depth -= 1
    }
    if (opened && depth === 0) return index
  }
  return -1
}
