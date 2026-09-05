import { doStep as collapseEquality } from './precompiler/collapseEquality'
import { doStep as normalizeLineEndings } from './precompiler/normalizeLineEndings'
import { doStep as removeWhitespaces } from './precompiler/removeWhitespaces'
import { doStep as compileCanonical } from './pipelines/compileCanonical'
import {
  addPipelineError,
  CompilerError,
  createPrecompilerPipeline,
  isCompilerError,
  type CompilerResult,
  type CompilerStep,
  type PipelineDebugResult,
  type PipelineDebugState,
  type PipelineErrorState,
  type PrecompilerPipeline,
} from './compilerError'

export {
  CompilerError,
  createPrecompilerPipeline,
  isCompilerError,
  type CompilerResult,
  type CompilerStep,
  type PipelineDebugResult,
  type PipelineDebugState,
  type PipelineErrorState,
  type PrecompilerPipeline,
}

export const DEBUG_COLLECT = true

interface RegisteredStep {
  name: string
  phase: 'precompiler' | 'pipeline'
  step: CompilerStep
}

export class Compiler {
  private readonly precompilers: RegisteredStep[] = []
  private readonly pipelines: RegisteredStep[] = []

  registerPrecompiler(name: string, step: CompilerStep): this {
    this.precompilers.push({ name, phase: 'precompiler', step })
    return this
  }

  registerPipeline(name: string, step: CompilerStep): this {
    this.pipelines.push({ name, phase: 'pipeline', step })
    return this
  }

  applyPrecompilers(pipeline: PrecompilerPipeline): CompilerResult {
    return this.applySteps(pipeline, this.precompilers)
  }

  applyPipelines(pipeline: PrecompilerPipeline): CompilerResult {
    return this.applySteps(pipeline, this.pipelines)
  }

  compile(source: string): CompilerResult {
    let result = createPrecompilerPipeline(source, DEBUG_COLLECT)
    result = this.applyPrecompilers(result)
    if (!isCompilerError(result)) result = this.applyPipelines(result)
    this.printDebug(result)
    return result
  }

  private applySteps(
    pipeline: PrecompilerPipeline,
    steps: readonly RegisteredStep[],
  ): CompilerResult {
    let result = pipeline

    for (const registeredStep of steps) {
      try {
        result = registeredStep.step(result)
      } catch (error: unknown) {
        const reason =
          error instanceof CompilerError
            ? error.reason
            : error instanceof Error
              ? error.message
              : String(error)
        result = addPipelineError(result, reason)
      }

      result = this.collectDebugResult(result, registeredStep)
      if (isCompilerError(result)) break
    }

    return result
  }

  private collectDebugResult(
    pipeline: PrecompilerPipeline,
    step: RegisteredStep,
  ): PrecompilerPipeline {
    if (!pipeline[2].isEnabled) return pipeline

    const debugResult: PipelineDebugResult = {
      phase: step.phase,
      stepName: step.name,
      resultingCode: pipeline[0],
    }

    return [
      pipeline[0],
      pipeline[1],
      {
        ...pipeline[2],
        results: [...pipeline[2].results, debugResult],
      },
    ]
  }

  private printDebug(pipeline: PrecompilerPipeline): void {
    const debug = pipeline[2]
    if (!debug.isEnabled) return

    console.groupCollapsed(
      `%cTuringScript debug - ${debug.results.length} collected step results`,
      'color:#00e8c6;font-weight:700',
    )

    debug.results.forEach((result, index) => {
      const phaseColor = result.phase === 'precompiler' ? '#c74ded' : '#f39c12'
      console.groupCollapsed(
        `%c${index + 1}. ${result.phase} - ${result.stepName}`,
        `color:${phaseColor};font-weight:700`,
      )
      console.log(
        '%c%s',
        'color:#d7d7dc;background:#17171d;padding:6px;font-family:monospace;white-space:pre-wrap',
        result.resultingCode || '<empty>',
      )
      console.groupEnd()
    })

    if (pipeline[1].isError) {
      console.error(
        '%cCompiler errors:%c\n%s',
        'color:#ff6680;font-weight:700',
        'color:inherit',
        pipeline[1].reasons.join('\n'),
      )
    }

    console.groupEnd()
  }
}

export const compiler = new Compiler()

compiler.registerPrecompiler('normalizeLineEndings', normalizeLineEndings)
compiler.registerPrecompiler('removeWhitespaces', removeWhitespaces)
compiler.registerPrecompiler('collapseEquality', collapseEquality)

compiler.registerPipeline('compileCanonical', compileCanonical)

export const compile = (source: string): CompilerResult => compiler.compile(source)
