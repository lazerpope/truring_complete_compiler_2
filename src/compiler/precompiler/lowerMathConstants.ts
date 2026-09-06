import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { replaceOutsideComments } from './shared'

const VALUES: Record<string, string> = {
  U16_MAX: '65535',
  S16_MAX: '32767',
  U32_MAX: '4294967295',
  S32_MIN: '2147483648',
  S32_MAX: '2147483647',
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) =>
    replaceOutsideComments(source, (code) =>
      code.replace(/\bMath\.(U16_MAX|S16_MAX|U32_MAX|S32_MIN|S32_MAX)\b/g, (_, name: string) =>
        VALUES[name] ?? name,
      ),
    ),
  )
}
