import { CompilerError, runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import type {
  ArrayAccessExpression,
  AssignmentTarget,
  BinaryExpression,
  BinaryOperator,
  Expression,
  Program,
  SourceLocation,
  Statement,
} from '../language/ast'
import { parseCanonical } from '../language/parseCanonical'

interface SymbolInfo {
  name: string
  kind: 'scalar' | 'array'
  address: number
  size: number
  location: SourceLocation
}

interface LoopLabels {
  breakLabel: string
  continueLabel: string
}

const BINARY_INSTRUCTIONS: Partial<Record<BinaryOperator, string>> = {
  '*': 'mul',
  '/': 'div',
  '%': 'mod',
  '+': 'add',
  '-': 'sub',
  '<<': 'lsl',
  '>>': 'lsr',
  's>>': 'asr',
  '&': 'and',
  '^': 'xor',
  '|': 'or',
  '&&': 'and',
  '||': 'or',
}

const COMPARISON_JUMPS: Partial<Record<BinaryOperator, string>> = {
  '==': 'je',
  '===': 'je',
  '!=': 'jne',
  '!==': 'jne',
  '<': 'jb',
  '>=': 'jae',
  '<=': 'jbe',
  '>': 'ja',
  's<': 'jl',
  's>=': 'jge',
  's<=': 'jle',
  's>': 'jg',
}

const isComparison = (operator: BinaryOperator): boolean => operator in COMPARISON_JUMPS

const SCREEN8_DRAW_REGISTER = 'r13'
const FRAMEBUFFER_0_HIGH = '__ts_framebuffer_0_high'
const FRAMEBUFFER_0_LOW = '__ts_framebuffer_0_low'
const FRAMEBUFFER_1_HIGH = '__ts_framebuffer_1_high'
const FRAMEBUFFER_1_LOW = '__ts_framebuffer_1_low'
const FRAMEBUFFER_TOGGLE_HIGH = '__ts_framebuffer_toggle_high'
const FRAMEBUFFER_TOGGLE_LOW = '__ts_framebuffer_toggle_low'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const program = parseCanonical(source)
    return new AssemblyCompiler(program).compile()
  })
}

class AssemblyCompiler {
  private readonly lines: string[] = []
  private readonly symbols = new Map<string, SymbolInfo>()
  private readonly declared = new Set<string>()
  private readonly registers = new RegisterPool()
  private readonly loops: LoopLabels[] = []
  private labelCounter = 0
  private nextAddress = 0
  private framebufferByteCount: number | undefined

  constructor(private readonly program: Program) {
    this.allocateStatements(program.statements)
  }

  compile(): string {
    this.compileStatements(this.program.statements)
    if (this.framebufferByteCount !== undefined) {
      const programByteCount = this.lines.filter((line) => {
        const trimmed = line.trim()
        return trimmed !== '' && !trimmed.startsWith('#') && !trimmed.endsWith(':')
      }).length * 4
      const guardByteCount = 4
      const framebuffer0Address = programByteCount + guardByteCount
      const framebuffer1Address = framebuffer0Address + this.framebufferByteCount
      const framebufferEndAddress = framebuffer1Address + this.framebufferByteCount
      this.resolveFramebufferAddresses(framebuffer0Address, framebuffer1Address)
      this.lines.push(
        '',
        '_pre_framebuffer_label:',
        'jmp _pre_framebuffer_label',
        'framebuffer_0:',
        `@0x${framebuffer1Address.toString(16)}`,
        'framebuffer_1:',
        `@0x${framebufferEndAddress.toString(16)}`,
      )
    }
    return this.lines.join('\n')
  }

  private allocateStatements(statements: readonly Statement[]): void {
    for (const statement of statements) {
      if (statement.type === 'declaration') {
        if (this.symbols.has(statement.name)) {
          throw this.error(statement.location, `Duplicate declaration of ${statement.name}`)
        }
        const isArray = statement.initializer.type === 'arrayCreation'
        const size = statement.initializer.type === 'arrayCreation' ? statement.initializer.size : 1
        this.symbols.set(statement.name, {
          name: statement.name,
          kind: isArray ? 'array' : 'scalar',
          address: this.nextAddress,
          size,
          location: statement.location,
        })
        this.nextAddress += size * 4
      } else if (statement.type === 'if') {
        this.allocateStatements(statement.thenBranch)
        if (statement.elseBranch) this.allocateStatements(statement.elseBranch)
      } else if (statement.type === 'while') {
        this.allocateStatements(statement.body)
      }
    }
  }

  private compileStatements(statements: readonly Statement[]): void {
    for (const statement of statements) this.compileStatementWithComment(statement)
  }

  private compileStatementWithComment(statement: Statement): void {
    const firstLine = this.lines.length
    this.compileStatement(statement)
    if (!statement.trailingComment) return

    const comment = this.toAssemblyComment(statement.trailingComment)
    if (this.lines.length > firstLine) {
      this.lines[firstLine] = `${this.lines[firstLine]} ${comment}`
    } else {
      this.lines.push(comment)
    }
  }

  private compileStatement(statement: Statement): void {
    switch (statement.type) {
      case 'comment':
        this.emitComment(statement.text)
        return
      case 'declaration':
        this.compileDeclaration(statement)
        return
      case 'assignment':
        this.compileAssignment(statement.target, statement.value)
        return
      case 'hardwareWrite':
        this.compileHardwareWrite(statement.operation, statement.arguments, statement.location)
        return
      case 'screen8Store':
        this.compileScreen8Store(statement.offset, statement.value, statement.location)
        return
      case 'screen8Present':
        this.compileScreen8Present(statement.color, statement.location)
        return
      case 'if':
        this.compileIf(statement)
        return
      case 'while':
        this.compileWhile(statement)
        return
      case 'break': {
        const loop = this.loops[this.loops.length - 1]
        if (!loop) throw this.error(statement.location, 'break is only valid inside a loop')
        this.emit(`jmp ${loop.breakLabel}`)
        return
      }
      case 'continue': {
        const loop = this.loops[this.loops.length - 1]
        if (!loop) throw this.error(statement.location, 'continue is only valid inside a loop')
        this.emit(`jmp ${loop.continueLabel}`)
      }
    }
  }

  private compileDeclaration(statement: Extract<Statement, { type: 'declaration' }>): void {
    const symbol = this.symbols.get(statement.name)!
    this.declared.add(statement.name)
    if (symbol.kind === 'array') return

    const value = this.compileExpression(statement.initializer as Expression)
    this.storeSymbol(symbol, value)
    this.registers.release(value)
  }

  private compileAssignment(target: AssignmentTarget, expression: Expression): void {
    if (target.type === 'identifier') {
      const symbol = this.requireDeclared(target.name, target.location)
      if (symbol.kind === 'array') throw this.error(target.location, `Array ${target.name} cannot be reassigned`)
      const value = this.compileExpression(expression)
      this.storeSymbol(symbol, value)
      this.registers.release(value)
      return
    }

    const address = this.compileArrayAddress(target)
    const value = this.compileExpression(expression)
    this.emit(`pstore [${address}], ${value}`)
    this.registers.release(value)
    this.registers.release(address)
  }

  private compileHardwareWrite(
    operation: 'output' | 'screen',
    args: readonly Expression[],
    location: SourceLocation,
  ): void {
    if (operation === 'output') {
      if (args.length !== 1) throw this.error(location, 'output requires exactly one argument')
      const value = args[0]
      if (value?.type === 'literal' && value.value <= 0xffff) {
        this.emit(`out ${value.value}`)
        return
      }
      const register = this.compileExpression(this.requiredExpression(value, location))
      this.emit(`out ${register}`)
      this.registers.release(register)
      return
    }

    if (args.length !== 2) throw this.error(location, 'screen requires exactly two arguments')
    const setting = this.compileExpression(this.requiredExpression(args[0], location))
    const valueExpression = this.requiredExpression(args[1], location)
    if (valueExpression.type === 'screen8Buffer') {
      if (
        this.framebufferByteCount !== undefined &&
        this.framebufferByteCount !== valueExpression.byteCount
      ) {
        throw this.error(location, 'Conflicting generated Screen8 framebuffer sizes')
      }
      this.framebufferByteCount = valueExpression.byteCount
      this.registers.reserve(SCREEN8_DRAW_REGISTER, valueExpression.location)
      const value = this.registers.acquire(valueExpression.location)
      this.emitFramebufferAddress(value, 0)
      this.emit(`screen ${setting}, ${value}`)
      this.registers.release(value)
      this.registers.release(setting)
      this.emitFramebufferAddress(SCREEN8_DRAW_REGISTER, 1)
      return
    }
    if (valueExpression.type === 'literal' && valueExpression.value <= 0xffff) {
      this.emit(`screen ${setting}, ${valueExpression.value}`)
      this.registers.release(setting)
      return
    }
    const value = this.compileExpression(valueExpression)
    this.emit(`screen ${setting}, ${value}`)
    this.registers.release(value)
    this.registers.release(setting)
  }

  private compileScreen8Store(
    offsetExpression: Expression,
    valueExpression: Expression,
    location: SourceLocation,
  ): void {
    if (this.framebufferByteCount === undefined) {
      throw this.error(location, 'Generated Screen8 pixel write appeared before initialization')
    }
    const offset = this.compileExpression(offsetExpression)
    const value = this.compileExpression(valueExpression)
    this.emit(`add ${offset}, ${offset}, ${SCREEN8_DRAW_REGISTER}`)
    this.emit(`store_8 [${offset}], ${value}`)
    this.registers.release(value)
    this.registers.release(offset)
  }

  private compileScreen8Present(colorExpression: Expression, location: SourceLocation): void {
    if (this.framebufferByteCount === undefined) {
      throw this.error(location, 'Generated Screen8 present appeared before initialization')
    }
    if (this.framebufferByteCount % 4 !== 0) {
      throw this.error(location, 'Screen8 framebuffer size must be divisible by four')
    }

    const color = this.compileExpression(colorExpression)
    const setting = this.registers.acquire(location)
    this.emit(`mov ${setting}, 1`)
    this.emit(`screen ${setting}, ${SCREEN8_DRAW_REGISTER}`)
    this.registers.release(setting)

    const toggleMask = this.registers.acquire(location)
    this.emitFramebufferToggleMask(toggleMask)
    this.emit(`xor ${SCREEN8_DRAW_REGISTER}, ${SCREEN8_DRAW_REGISTER}, ${toggleMask}`)
    this.registers.release(toggleMask)
    this.emit(`and ${color}, ${color}, 255`)

    const shifted = this.registers.acquire(location)
    this.emit(`mov ${shifted}, ${color}`)
    this.emit(`lsl ${shifted}, ${shifted}, 8`)
    this.emit(`or ${color}, ${color}, ${shifted}`)
    this.emit(`mov ${shifted}, ${color}`)
    this.emit(`lsl ${shifted}, ${shifted}, 16`)
    this.emit(`or ${color}, ${color}, ${shifted}`)
    this.registers.release(shifted)

    const address = this.registers.acquire(location)
    const endAddress = this.registers.acquire(location)
    this.emit(`mov ${address}, ${SCREEN8_DRAW_REGISTER}`)
    this.emitImmediate(endAddress, this.framebufferByteCount)
    this.emit(`add ${endAddress}, ${SCREEN8_DRAW_REGISTER}, ${endAddress}`)
    const clearLabel = this.label('screen8_clear')
    this.emitLabel(clearLabel)
    this.emit(`store_32 [${address}], ${color}`)
    this.emit(`add ${address}, ${address}, 4`)
    this.emit(`cmp ${address}, ${endAddress}`)
    this.emit(`jb ${clearLabel}`)
    this.registers.release(endAddress)
    this.registers.release(address)
    this.registers.release(color)
  }

  private compileIf(statement: Extract<Statement, { type: 'if' }>): void {
    const elseLabel = this.label('if_else')
    const endLabel = this.label('if_end')
    this.compileCondition(statement.condition, undefined, elseLabel)
    this.compileStatements(statement.thenBranch)
    if (statement.elseBranch) {
      this.emit(`jmp ${endLabel}`)
      this.emitLabel(elseLabel)
      this.compileStatements(statement.elseBranch)
      this.emitLabel(endLabel)
    } else {
      this.emitLabel(elseLabel)
    }
  }

  private compileWhile(statement: Extract<Statement, { type: 'while' }>): void {
    const conditionLabel = this.label('while_condition')
    const bodyLabel = this.label('while_body')
    const endLabel = this.label('while_end')
    this.emitLabel(conditionLabel)
    this.compileCondition(statement.condition, bodyLabel, endLabel)
    this.emitLabel(bodyLabel)
    this.loops.push({ breakLabel: endLabel, continueLabel: conditionLabel })
    this.compileStatements(statement.body)
    this.loops.pop()
    this.emit(`jmp ${conditionLabel}`)
    this.emitLabel(endLabel)
  }

  private compileCondition(expression: Expression, trueLabel: string | undefined, falseLabel: string): void {
    if (expression.type === 'binary' && expression.operator === '&&') {
      const rightLabel = this.label('and_right')
      this.compileCondition(expression.left, rightLabel, falseLabel)
      this.emitLabel(rightLabel)
      this.compileCondition(expression.right, trueLabel, falseLabel)
      return
    }

    if (expression.type === 'binary' && expression.operator === '||') {
      const rightLabel = this.label('or_right')
      const resolvedTrue = trueLabel ?? this.label('or_true')
      this.compileCondition(expression.left, resolvedTrue, rightLabel)
      this.emitLabel(rightLabel)
      this.compileCondition(expression.right, resolvedTrue, falseLabel)
      if (!trueLabel) this.emitLabel(resolvedTrue)
      return
    }

    if (expression.type === 'binary' && isComparison(expression.operator)) {
      const left = this.compileExpression(expression.left)
      const right = this.compileExpression(expression.right)
      this.emit(`cmp ${left}, ${right}`)
      this.registers.release(right)
      this.registers.release(left)
      if (trueLabel) this.emit(`${COMPARISON_JUMPS[expression.operator]} ${trueLabel}`)
      else this.emit(`${this.inverseJump(expression.operator)} ${falseLabel}`)
      if (trueLabel) this.emit(`jmp ${falseLabel}`)
      return
    }

    const value = this.compileExpression(expression)
    this.emit(`cmp ${value}, 0`)
    this.registers.release(value)
    if (trueLabel) {
      this.emit(`jne ${trueLabel}`)
      this.emit(`jmp ${falseLabel}`)
    } else {
      this.emit(`je ${falseLabel}`)
    }
  }

  private compileExpression(expression: Expression): string {
    switch (expression.type) {
      case 'literal': {
        const register = this.registers.acquire(expression.location)
        this.emitImmediate(register, expression.value)
        return register
      }
      case 'identifier': {
        const symbol = this.requireDeclared(expression.name, expression.location)
        if (symbol.kind === 'array') {
          throw this.error(expression.location, `Array ${expression.name} may only be indexed`)
        }
        const register = this.registers.acquire(expression.location)
        this.loadSymbol(register, symbol)
        return register
      }
      case 'arrayAccess': {
        const address = this.compileArrayAddress(expression)
        this.emit(`pload ${address}, [${address}]`)
        return address
      }
      case 'hardwareRead': {
        const register = this.registers.acquire(expression.location)
        const instruction = expression.operation === 'input' ? 'in' : expression.operation
        this.emit(`${instruction} ${register}`)
        return register
      }
      case 'screen8Buffer':
        throw this.error(expression.location, 'Generated Screen8 buffer may only configure screen data offset')
      case 'unary': {
        const register = this.compileExpression(expression.operand)
        if (expression.operator === '-') this.emit(`neg ${register}, ${register}`)
        else if (expression.operator === '~') this.emit(`not ${register}, ${register}`)
        else {
          this.emit(`cmp ${register}, 0`)
          this.emit(`and ${register}, flags, 1`)
        }
        return register
      }
      case 'binary':
        return this.compileBinary(expression)
    }
  }

  private compileBinary(expression: BinaryExpression): string {
    if (isComparison(expression.operator)) return this.compileComparisonValue(expression)

    const instruction = BINARY_INSTRUCTIONS[expression.operator]
    if (!instruction) throw this.error(expression.location, `Unsupported operator ${expression.operator}`)
    const left = this.compileExpression(expression.left)
    const right = this.compileExpression(expression.right)
    this.emit(`${instruction} ${left}, ${left}, ${right}`)
    this.registers.release(right)
    return left
  }

  private compileComparisonValue(expression: BinaryExpression): string {
    const left = this.compileExpression(expression.left)
    const right = this.compileExpression(expression.right)
    this.emit(`cmp ${left}, ${right}`)

    const operator = expression.operator
    if (operator === '==' || operator === '===') {
      this.emit(`and ${left}, flags, 1`)
      this.registers.release(right)
      return left
    }
    if (operator === '!=' || operator === '!==') {
      this.emit(`and ${left}, flags, 1`)
      this.emit(`xor ${left}, ${left}, 1`)
      this.registers.release(right)
      return left
    }

    const signed = operator.startsWith('s')
    const normalized = signed ? operator.slice(1) : operator
    const bit = signed ? 2 : 1
    this.emit(`lsr ${right}, flags, ${bit}`)
    this.emit(`and ${right}, ${right}, 1`)

    if (normalized === '<') {
      this.registers.release(left)
      return right
    }
    if (normalized === '>=') {
      this.emit(`xor ${right}, ${right}, 1`)
      this.registers.release(left)
      return right
    }

    this.emit(`and ${left}, flags, 1`)
    this.emit(`or ${left}, ${left}, ${right}`)
    this.registers.release(right)
    if (normalized === '>') this.emit(`xor ${left}, ${left}, 1`)
    return left
  }

  private compileArrayAddress(expression: ArrayAccessExpression): string {
    const symbol = this.requireDeclared(expression.name, expression.location)
    if (symbol.kind !== 'array') throw this.error(expression.location, `${expression.name} is not an array`)

    if (expression.index.type === 'literal') {
      if (expression.index.value >= symbol.size) {
        throw this.error(expression.index.location, `Array index ${expression.index.value} is outside ${expression.name}`)
      }
      const address = this.registers.acquire(expression.location)
      this.emitImmediate(address, symbol.address + expression.index.value * 4)
      return address
    }

    const index = this.compileExpression(expression.index)
    this.emit(`lsl ${index}, ${index}, 2`)
    if (symbol.address !== 0) {
      if (symbol.address <= 0xffff) this.emit(`add ${index}, ${index}, ${symbol.address}`)
      else {
        const base = this.registers.acquire(expression.location)
        this.emitImmediate(base, symbol.address)
        this.emit(`add ${index}, ${index}, ${base}`)
        this.registers.release(base)
      }
    }
    return index
  }

  private requireDeclared(name: string, location: SourceLocation): SymbolInfo {
    const symbol = this.symbols.get(name)
    if (!symbol || !this.declared.has(name)) throw this.error(location, `Read of ${name} before declaration`)
    return symbol
  }

  private loadSymbol(target: string, symbol: SymbolInfo): void {
    if (symbol.address <= 0xffff) {
      this.emit(`pload ${target}, [${symbol.address}]`)
      return
    }
    this.emitImmediate(target, symbol.address)
    this.emit(`pload ${target}, [${target}]`)
  }

  private storeSymbol(symbol: SymbolInfo, value: string): void {
    if (symbol.address <= 0xffff) {
      this.emit(`pstore [${symbol.address}], ${value}`)
      return
    }
    const address = this.registers.acquire(symbol.location)
    this.emitImmediate(address, symbol.address)
    this.emit(`pstore [${address}], ${value}`)
    this.registers.release(address)
  }

  private emitImmediate(register: string, value: number): void {
    if (value <= 0xffff) {
      this.emit(`mov ${register}, ${value}`)
      return
    }
    const high = Math.floor(value / 0x10000) & 0xffff
    const low = value & 0xffff
    this.emit(`mov ${register}, ${high}`)
    this.emit(`lsl ${register}, ${register}, 16`)
    if (low !== 0) this.emit(`or ${register}, ${register}, ${low}`)
  }

  private emitFramebufferAddress(register: string, index: 0 | 1): void {
    const high = index === 0 ? FRAMEBUFFER_0_HIGH : FRAMEBUFFER_1_HIGH
    const low = index === 0 ? FRAMEBUFFER_0_LOW : FRAMEBUFFER_1_LOW
    this.emit(`mov ${register}, ${high}`)
    this.emit(`lsl ${register}, ${register}, 16`)
    this.emit(`or ${register}, ${register}, ${low}`)
  }

  private emitFramebufferToggleMask(register: string): void {
    this.emit(`mov ${register}, ${FRAMEBUFFER_TOGGLE_HIGH}`)
    this.emit(`lsl ${register}, ${register}, 16`)
    this.emit(`or ${register}, ${register}, ${FRAMEBUFFER_TOGGLE_LOW}`)
  }

  private resolveFramebufferAddresses(framebuffer0Address: number, framebuffer1Address: number): void {
    const toggleMask = framebuffer0Address ^ framebuffer1Address
    const replacements = new Map<string, number>([
      [FRAMEBUFFER_0_HIGH, Math.floor(framebuffer0Address / 0x10000)],
      [FRAMEBUFFER_0_LOW, framebuffer0Address & 0xffff],
      [FRAMEBUFFER_1_HIGH, Math.floor(framebuffer1Address / 0x10000)],
      [FRAMEBUFFER_1_LOW, framebuffer1Address & 0xffff],
      [FRAMEBUFFER_TOGGLE_HIGH, Math.floor(toggleMask / 0x10000)],
      [FRAMEBUFFER_TOGGLE_LOW, toggleMask & 0xffff],
    ])

    for (let index = 0; index < this.lines.length; index += 1) {
      let line = this.lines[index]!
      for (const [placeholder, value] of replacements) line = line.replaceAll(placeholder, String(value))
      this.lines[index] = line
    }
  }

  private inverseJump(operator: BinaryOperator): string {
    const inverse: Partial<Record<BinaryOperator, string>> = {
      '==': 'jne',
      '===': 'jne',
      '!=': 'je',
      '!==': 'je',
      '<': 'jae',
      '>=': 'jb',
      '<=': 'ja',
      '>': 'jbe',
      's<': 'jge',
      's>=': 'jl',
      's<=': 'jg',
      's>': 'jle',
    }
    const jump = inverse[operator]
    if (!jump) throw new CompilerError(`Cannot invert comparison ${operator}`)
    return jump
  }

  private requiredExpression(expression: Expression | undefined, location: SourceLocation): Expression {
    if (!expression) throw this.error(location, 'Missing expression')
    return expression
  }

  private label(purpose: string): string {
    const label = `__ts_${purpose}_${this.labelCounter}`
    this.labelCounter += 1
    return label
  }

  private emitLabel(label: string): void {
    this.lines.push(`${label}:`)
  }

  private emit(line: string): void {
    this.lines.push(line)
  }

  private emitComment(comment: string): void {
    for (const line of comment.split('\n')) this.lines.push(this.toAssemblyComment(line))
  }

  private toAssemblyComment(comment: string): string {
    if (comment.startsWith('//')) return `#${comment.slice(2)}`
    if (comment.startsWith('#')) return comment
    return `# ${comment}`
  }

  private error(location: SourceLocation, reason: string): CompilerError {
    return new CompilerError(`Line ${location.line}, column ${location.column}: ${reason}`)
  }
}

class RegisterPool {
  private readonly available = [
    'r13',
    'r12',
    'r11',
    'r10',
    'r9',
    'r8',
    'r7',
    'r6',
    'r5',
    'r4',
    'r3',
    'r2',
    'r1',
  ]
  private readonly allocated = new Set<string>()

  acquire(location: SourceLocation): string {
    const register = this.available.pop()
    if (!register) {
      throw new CompilerError(
        `Line ${location.line}, column ${location.column}: Expression requires more available registers`,
      )
    }
    this.allocated.add(register)
    return register
  }

  reserve(register: string, location: SourceLocation): void {
    if (this.allocated.has(register)) {
      throw new CompilerError(
        `Line ${location.line}, column ${location.column}: Cannot reserve active register ${register}`,
      )
    }
    const index = this.available.indexOf(register)
    if (index >= 0) this.available.splice(index, 1)
  }

  release(register: string): void {
    if (!this.allocated.delete(register)) return
    this.available.push(register)
  }
}
