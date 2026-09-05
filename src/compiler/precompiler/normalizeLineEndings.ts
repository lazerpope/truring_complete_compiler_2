import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => source.replace(/\r\n?/g, '\n'))
}
