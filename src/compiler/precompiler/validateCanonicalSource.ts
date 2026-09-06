import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { parseCanonical } from '../language/parseCanonical'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    parseCanonical(source)
    return source
  })
}
