import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { identifierPattern, parseArrayInfos, replaceOutsideComments } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const arrays = parseArrayInfos(source)
    return replaceOutsideComments(source, (code) => {
      let result = code
      for (const array of arrays.values()) {
        result = result.replace(
          new RegExp(`${identifierPattern(array.name)}\\.length(?![A-Za-z0-9_$])`, 'g'),
          String(array.size),
        )
      }
      return result
    })
  })
}
