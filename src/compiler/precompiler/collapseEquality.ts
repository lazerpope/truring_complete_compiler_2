import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'

const collapseEquality = (source: string): string => {
  let output = ''
  let mode: 'code' | 'lineComment' | 'blockComment' = 'code'

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ''
    const next = source[index + 1] ?? ''

    if (mode === 'lineComment') {
      output += char
      if (char === '\n') mode = 'code'
      continue
    }

    if (mode === 'blockComment') {
      output += char
      if (char === '*' && next === '/') {
        output += next
        index += 1
        mode = 'code'
      }
      continue
    }

    if (char === '#' || (char === '/' && next === '/')) {
      output += char
      if (char === '/') {
        output += next
        index += 1
      }
      mode = 'lineComment'
      continue
    }

    if (char === '/' && next === '*') {
      output += char + next
      index += 1
      mode = 'blockComment'
      continue
    }

    if (source.startsWith('!==', index)) {
      output += '!='
      index += 2
      continue
    }

    if (source.startsWith('===', index)) {
      output += '=='
      index += 2
      continue
    }

    output += char
  }

  return output
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, collapseEquality)
}
