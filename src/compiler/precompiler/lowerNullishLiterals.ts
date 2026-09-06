import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { replaceOutsideComments } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) =>
    replaceOutsideComments(source, (code) =>
      code.replace(/\bnull\b/g, '0').replace(/\bundefined\b/g, '0'),
    ),
  )
}
