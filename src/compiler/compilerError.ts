export class CompilerError extends Error {
  readonly reason: string
  readonly errorOccured: boolean = true

  constructor(reason: string) {
    super(reason)
    this.name = 'CompilerError'
    this.reason = reason
  }
}

export type CompilerResult = string | CompilerError

export type CompilerStep = (source: string) => CompilerResult

export const isCompilerError = (result: CompilerResult): result is CompilerError =>
  result instanceof CompilerError
