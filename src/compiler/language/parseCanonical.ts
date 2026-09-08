import { CompilerError } from '../compilerError'
import type {
  ArrayCreationExpression,
  AssignmentTarget,
  BinaryExpression,
  BinaryOperator,
  Expression,
  Program,
  Statement,
} from './ast'
import { tokenize, type Token, type TokenKind } from './tokenize'

const BINARY_LEVELS: readonly (readonly BinaryOperator[])[] = [
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
]

const HARDWARE_READS = new Set(['input', 'keyboard', 'time_0', 'time_1', 'counter'])

export function parseCanonical(source: string): Program {
  return new CanonicalParser(tokenize(source)).parseProgram()
}

class CanonicalParser {
  private index = 0

  constructor(private readonly tokens: readonly Token[]) {}

  parseProgram(): Program {
    const statements = this.parseStatementList('eof')
    this.expectKind('eof', 'Expected end of source')
    return { statements }
  }

  private parseStatementList(until: 'eof' | '}'): Statement[] {
    const statements: Statement[] = []
    this.consumeNewlines()

    while (!this.isAtEnd(until)) {
      const statement = this.parseStatement()
      statements.push(statement)

      if (statement.type === 'if' || statement.type === 'while') {
        if (this.current().value === '}') continue
        if (this.current().kind === 'eof') continue
        this.requireNewline('A newline is required after a control-flow statement')
      } else if (statement.type === 'comment' && statement.text.startsWith('/*')) {
        if (this.current().kind === 'newline') this.consumeNewlines()
      } else {
        this.consumeTrailingComment(statement)
        if (this.current().kind === 'eof') continue
        if (this.current().value === '}') {
          throw this.error(this.current(), 'A newline is required after a simple statement')
        }
        this.requireNewline('A newline is required after a simple statement')
      }

      this.consumeNewlines()
    }

    return statements
  }

  private parseStatement(): Statement {
    const token = this.current()

    if (token.kind === 'comment') {
      this.advance()
      return { type: 'comment', text: token.value, location: token.location }
    }

    switch (token.value) {
      case 'let':
        return this.parseDeclaration()
      case 'if':
        return this.parseIf()
      case 'while':
        return this.parseWhile()
      case 'break':
        this.advance()
        return { type: 'break', location: token.location }
      case 'continue':
        this.advance()
        return { type: 'continue', location: token.location }
      case 'output':
      case 'screen':
        return this.parseHardwareWrite()
      case 'for':
      case 'const':
      case 'var':
        throw this.error(token, `${token.value} must be removed by a precompiler before canonical compilation`)
      default:
        if (token.value === '__ts_screen8_store') return this.parseScreen8Store()
        if (token.value === '__ts_screen8_present') return this.parseScreen8Present()
        return this.parseAssignment()
    }
  }

  private parseScreen8Store(): Statement {
    const start = this.advance()
    this.expectValue('(')
    const offset = this.parseExpression()
    this.expectValue(',')
    const value = this.parseExpression()
    this.expectValue(')')
    return { type: 'screen8Store', offset, value, location: start.location }
  }

  private parseScreen8Present(): Statement {
    const start = this.advance()
    this.expectValue('(')
    const color = this.parseExpression()
    this.expectValue(')')
    return { type: 'screen8Present', color, location: start.location }
  }

  private parseDeclaration(): Statement {
    const start = this.expectValue('let')
    const name = this.expectIdentifier()
    this.expectValue('=')

    let initializer: Expression | ArrayCreationExpression
    if (this.matchValue('Array')) {
      const arrayToken = this.previous()
      this.expectValue('(')
      const sizeToken = this.expectKind('number', 'Array size must be a resolved integer literal')
      const size = this.parseInteger(sizeToken)
      if (size === 0) throw this.error(sizeToken, 'Array size must be greater than zero')
      this.expectValue(')')
      initializer = { type: 'arrayCreation', size, location: arrayToken.location }
    } else {
      initializer = this.parseExpression()
    }

    return { type: 'declaration', name: name.value, initializer, location: start.location }
  }

  private parseAssignment(): Statement {
    const start = this.current()
    const target = this.parseAssignmentTarget()
    this.expectValue('=')
    const value = this.parseExpression()
    return { type: 'assignment', target, value, location: start.location }
  }

  private parseAssignmentTarget(): AssignmentTarget {
    const identifier = this.expectIdentifier()
    if (!this.matchValue('[')) {
      return { type: 'identifier', name: identifier.value, location: identifier.location }
    }

    const index = this.parseExpression()
    this.expectValue(']')
    return { type: 'arrayAccess', name: identifier.value, index, location: identifier.location }
  }

  private parseHardwareWrite(): Statement {
    const operation = this.advance()
    this.expectValue('(')
    const args = [this.parseExpression()]
    if (operation.value === 'screen') {
      this.expectValue(',')
      args.push(this.parseExpression())
    }
    this.expectValue(')')
    return {
      type: 'hardwareWrite',
      operation: operation.value as 'output' | 'screen',
      arguments: args,
      location: operation.location,
    }
  }

  private parseIf(): Statement {
    const start = this.expectValue('if')
    this.expectValue('(')
    const condition = this.parseExpression()
    this.expectValue(')')
    const thenBranch = this.parseBlock()

    const beforeNewlines = this.index
    this.consumeNewlines()
    let elseBranch: Statement[] | undefined
    if (this.matchValue('else')) {
      if (this.current().value === 'if') {
        elseBranch = [this.parseIf()]
      } else {
        elseBranch = this.parseBlock()
      }
    } else {
      this.index = beforeNewlines
    }

    return { type: 'if', condition, thenBranch, elseBranch, location: start.location }
  }

  private parseWhile(): Statement {
    const start = this.expectValue('while')
    this.expectValue('(')
    const condition = this.parseExpression()
    this.expectValue(')')
    const body = this.parseBlock()
    return { type: 'while', condition, body, location: start.location }
  }

  private parseBlock(): Statement[] {
    this.expectValue('{')
    if (this.current().value === '}') {
      this.advance()
      return []
    }
    this.requireNewline('A newline is required after {')
    const statements = this.parseStatementList('}')
    this.expectValue('}')
    return statements
  }

  private parseExpression(level = 0): Expression {
    if (level === BINARY_LEVELS.length) return this.parseUnary()

    let expression = this.parseExpression(level + 1)
    const operators = BINARY_LEVELS[level] ?? []
    while (operators.includes(this.current().value as BinaryOperator)) {
      const operatorToken = this.advance()
      const right = this.parseExpression(level + 1)
      expression = {
        type: 'binary',
        operator: operatorToken.value as BinaryOperator,
        left: expression,
        right,
        location: operatorToken.location,
      } satisfies BinaryExpression
    }
    return expression
  }

  private parseUnary(): Expression {
    const token = this.current()
    if (token.value === '!' || token.value === '~' || token.value === '-') {
      this.advance()
      return {
        type: 'unary',
        operator: token.value,
        operand: this.parseUnary(),
        location: token.location,
      }
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const token = this.current()

    if (token.kind === 'number') {
      this.advance()
      return { type: 'literal', value: this.parseInteger(token), raw: token.value, location: token.location }
    }

    if (HARDWARE_READS.has(token.value)) {
      this.advance()
      this.expectValue('(')
      this.expectValue(')')
      return {
        type: 'hardwareRead',
        operation: token.value as 'input' | 'keyboard' | 'time_0' | 'time_1' | 'counter',
        location: token.location,
      }
    }

    if (token.kind === 'identifier') {
      this.advance()
      const screen8Buffer = token.value.match(/^__ts_screen8_buffer_(\d+)$/)
      if (screen8Buffer) {
        const byteCount = Number(screen8Buffer[1])
        if (!Number.isSafeInteger(byteCount) || byteCount <= 0) {
          throw this.error(token, 'Invalid generated Screen8 framebuffer size')
        }
        return { type: 'screen8Buffer', byteCount, location: token.location }
      }
      if (this.matchValue('[')) {
        const index = this.parseExpression()
        this.expectValue(']')
        return { type: 'arrayAccess', name: token.value, index, location: token.location }
      }
      return { type: 'identifier', name: token.value, location: token.location }
    }

    if (this.matchValue('(')) {
      const expression = this.parseExpression()
      this.expectValue(')')
      return expression
    }

    throw this.error(token, `Expected expression but found ${JSON.stringify(token.value)}`)
  }

  private parseInteger(token: Token): number {
    const value = Number.parseInt(token.value.slice(0, 2).toLowerCase() === '0b' ? token.value.slice(2) : token.value, token.value.toLowerCase().startsWith('0x') ? 16 : token.value.toLowerCase().startsWith('0b') ? 2 : 10)
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw this.error(token, 'Integer literal must fit in one unsigned 32-bit word')
    }
    return value
  }

  private consumeTrailingComment(statement: Statement): void {
    if (this.current().kind !== 'comment') return
    statement.trailingComment = this.advance().value
  }

  private requireNewline(reason: string): void {
    if (this.current().kind !== 'newline') throw this.error(this.current(), reason)
    this.consumeNewlines()
  }

  private consumeNewlines(): void {
    while (this.current().kind === 'newline') this.advance()
  }

  private isAtEnd(until: 'eof' | '}'): boolean {
    return until === 'eof' ? this.current().kind === 'eof' : this.current().value === '}'
  }

  private matchValue(value: string): boolean {
    if (this.current().value !== value) return false
    this.advance()
    return true
  }

  private expectValue(value: string): Token {
    const token = this.current()
    if (token.value !== value) throw this.error(token, `Expected ${JSON.stringify(value)}`)
    return this.advance()
  }

  private expectIdentifier(): Token {
    return this.expectKind('identifier', 'Expected an identifier')
  }

  private expectKind(kind: TokenKind, reason: string): Token {
    const token = this.current()
    if (token.kind !== kind) throw this.error(token, reason)
    return this.advance()
  }

  private previous(): Token {
    return this.tokens[this.index - 1] ?? this.tokens[0]!
  }

  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!
  }

  private advance(): Token {
    const token = this.current()
    if (token.kind !== 'eof') this.index += 1
    return token
  }

  private error(token: Token, reason: string): CompilerError {
    return new CompilerError(`Line ${token.location.line}, column ${token.location.column}: ${reason}`)
  }
}
