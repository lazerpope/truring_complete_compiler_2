import { doStep as removeWhitespaces } from './precompiler/removeWhitespaces'
import { doStep as compileCanonical } from './pipelines/compileCanonical'
import {
  CompilerError,
  isCompilerError,
  type CompilerResult,
  type CompilerStep,
} from './compilerError'

export { CompilerError, isCompilerError, type CompilerResult, type CompilerStep }

export class Compiler {
  private readonly precompilers: CompilerStep[] = []
  private readonly pipelines: CompilerStep[] = []

  registerPrecompiler(step: CompilerStep): this {
    this.precompilers.push(step)
    return this
  }

  registerPipeline(step: CompilerStep): this {
    this.pipelines.push(step)
    return this
  }

  applyPrecompilers(source: string): CompilerResult {
    return this.applySteps(source, this.precompilers)
  }

  applyPipelines(source: string): CompilerResult {
    return this.applySteps(source, this.pipelines)
  }

  compile(source: string): CompilerResult {
    const precompiled = this.applyPrecompilers(source)
    if (isCompilerError(precompiled)) return precompiled

    return this.applyPipelines(precompiled)
  }

  private applySteps(source: string, steps: readonly CompilerStep[]): CompilerResult {
    let result = source

    for (const step of steps) {
      try {
        const stepResult = step(result)
        if (isCompilerError(stepResult)) return stepResult
        result = stepResult
      } catch (error: unknown) {
        if (error instanceof CompilerError) return error
        return new CompilerError(error instanceof Error ? error.message : String(error))
      }
    }

    return result
  }
}

export const compiler = new Compiler()

compiler.registerPrecompiler(removeWhitespaces)

compiler.registerPipeline(compileCanonical)

export const compile = (source: string): CompilerResult => compiler.compile(source)
