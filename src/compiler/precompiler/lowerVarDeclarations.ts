import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { replaceOutsideComments } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) =>
    replaceOutsideComments(source, (code) => code.replace(/\bvar\b/g, 'let')),
  )
}
