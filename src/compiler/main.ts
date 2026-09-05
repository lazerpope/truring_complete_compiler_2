import { doStep as removeWhitespaces } from './precompiler/removeWhitespaces'
import { doStep as testPipeline } from './pipelines/test'

export type CompilerStep = (source: string) => string

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

  applyPrecompilers(source: string): string {
    return this.applySteps(source, this.precompilers)
  }

  applyPipelines(source: string): string {
    return this.applySteps(source, this.pipelines)
  }

  compile(source: string): string {
    const precompiled = this.applyPrecompilers(source)
    return this.applyPipelines(precompiled)
  }

  private applySteps(source: string, steps: readonly CompilerStep[]): string {
    return steps.reduce((result, step) => step(result), source)
  }
}

export const compiler = new Compiler()

compiler.registerPrecompiler(removeWhitespaces)

compiler.registerPipeline(testPipeline)

export const compile = (source: string): string => compiler.compile(source)
