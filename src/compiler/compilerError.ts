export class CompilerError extends Error {
  readonly reason: string
  readonly errorOccured: boolean = true

  constructor(reason: string) {
    super(reason)
    this.name = 'CompilerError'
    this.reason = reason
  }
}

export interface PipelineErrorState {
  isError: boolean
  reasons: string[]
}

export interface PipelineDebugResult {
  phase: 'precompiler' | 'pipeline'
  stepName: string
  resultingCode: string
}

export interface PipelineDebugState {
  isEnabled: boolean
  results: PipelineDebugResult[]
}

export type PrecompilerPipeline = [
  code: string,
  error: PipelineErrorState,
  debug: PipelineDebugState,
]

export type CompilerResult = PrecompilerPipeline

export type CompilerStep = (pipeline: PrecompilerPipeline) => CompilerResult

export const createPrecompilerPipeline = (
  code: string,
  isDebugEnabled: boolean,
): PrecompilerPipeline => [
  code,
  { isError: false, reasons: [] },
  { isEnabled: isDebugEnabled, results: [] },
]

export const replacePipelineCode = (
  pipeline: PrecompilerPipeline,
  code: string,
): PrecompilerPipeline => [code, pipeline[1], pipeline[2]]

export const addPipelineError = (
  pipeline: PrecompilerPipeline,
  reason: string,
): PrecompilerPipeline => [
  pipeline[0],
  {
    isError: true,
    reasons: [...pipeline[1].reasons, reason],
  },
  pipeline[2],
]

export const runCompilerTransform = (
  pipeline: PrecompilerPipeline,
  transform: (code: string) => string,
): PrecompilerPipeline => {
  if (pipeline[1].isError) return pipeline

  try {
    return replacePipelineCode(pipeline, transform(pipeline[0]))
  } catch (error: unknown) {
    const reason =
      error instanceof CompilerError
        ? error.reason
        : error instanceof Error
          ? error.message
          : String(error)
    return addPipelineError(pipeline, reason)
  }
}

export const isCompilerError = (result: CompilerResult): boolean => result[1].isError
