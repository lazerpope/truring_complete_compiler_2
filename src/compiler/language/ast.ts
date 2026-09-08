export interface SourceLocation {
  line: number
  column: number
}

export interface Program {
  statements: Statement[]
}

export type Statement =
  | DeclarationStatement
  | AssignmentStatement
  | HardwareWriteStatement
  | Screen8StoreStatement
  | Screen8PresentStatement
  | IfStatement
  | WhileStatement
  | BreakStatement
  | ContinueStatement
  | CommentStatement

interface StatementBase {
  location: SourceLocation
  trailingComment?: string
}

export interface DeclarationStatement extends StatementBase {
  type: 'declaration'
  name: string
  initializer: Expression | ArrayCreationExpression
}

export interface AssignmentStatement extends StatementBase {
  type: 'assignment'
  target: AssignmentTarget
  value: Expression
}

export interface HardwareWriteStatement extends StatementBase {
  type: 'hardwareWrite'
  operation: 'output' | 'screen'
  arguments: Expression[]
}

export interface Screen8StoreStatement extends StatementBase {
  type: 'screen8Store'
  offset: Expression
  value: Expression
}

export interface Screen8PresentStatement extends StatementBase {
  type: 'screen8Present'
  color: Expression
}

export interface IfStatement extends StatementBase {
  type: 'if'
  condition: Expression
  thenBranch: Statement[]
  elseBranch?: Statement[]
}

export interface WhileStatement extends StatementBase {
  type: 'while'
  condition: Expression
  body: Statement[]
}

export interface BreakStatement extends StatementBase {
  type: 'break'
}

export interface ContinueStatement extends StatementBase {
  type: 'continue'
}

export interface CommentStatement extends StatementBase {
  type: 'comment'
  text: string
}

export type AssignmentTarget = IdentifierExpression | ArrayAccessExpression

export type Expression =
  | LiteralExpression
  | IdentifierExpression
  | ArrayAccessExpression
  | UnaryExpression
  | BinaryExpression
  | HardwareReadExpression
  | Screen8BufferExpression

export interface LiteralExpression {
  type: 'literal'
  value: number
  raw: string
  location: SourceLocation
}

export interface IdentifierExpression {
  type: 'identifier'
  name: string
  location: SourceLocation
}

export interface ArrayAccessExpression {
  type: 'arrayAccess'
  name: string
  index: Expression
  location: SourceLocation
}

export interface ArrayCreationExpression {
  type: 'arrayCreation'
  size: number
  location: SourceLocation
}

export interface UnaryExpression {
  type: 'unary'
  operator: '!' | '~' | '-'
  operand: Expression
  location: SourceLocation
}

export interface BinaryExpression {
  type: 'binary'
  operator: BinaryOperator
  left: Expression
  right: Expression
  location: SourceLocation
}

export type BinaryOperator =
  | '*'
  | '/'
  | '%'
  | '+'
  | '-'
  | '<<'
  | '>>'
  | 's>>'
  | '<'
  | '<='
  | '>'
  | '>='
  | 's<'
  | 's<='
  | 's>'
  | 's>='
  | '=='
  | '!='
  | '==='
  | '!=='
  | '&'
  | '^'
  | '|'
  | '&&'
  | '||'

export interface HardwareReadExpression {
  type: 'hardwareRead'
  operation: 'input' | 'keyboard' | 'time_0' | 'time_1' | 'counter'
  location: SourceLocation
}

export interface Screen8BufferExpression {
  type: 'screen8Buffer'
  byteCount: number
  location: SourceLocation
}
