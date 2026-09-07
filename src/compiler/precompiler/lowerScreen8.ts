import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'

const lowerScreen8 = (source: string): string => {
  let output = source
  

  return output
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, lowerScreen8)
}
