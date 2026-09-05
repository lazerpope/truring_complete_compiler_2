import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'

const removeWhitespaces = (input: string): string => {
  let output = ''
  let mode: 'code' | 'lineComment' | 'blockComment' = 'code'
  let pendingSpace = false
  let atLineStart = true

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (mode === 'lineComment') {
      output += char
      if (char === '\n') {
        mode = 'code'
        pendingSpace = false
        atLineStart = true
      }
      continue
    }

    if (mode === 'blockComment') {
      output += char
      if (char === '*' && next === '/') {
        output += next
        index += 1
        mode = 'code'
        atLineStart = false
      } else if (char === '\n') {
        atLineStart = true
      } else {
        atLineStart = false
      }
      continue
    }

    if (char === '\n') {
      output += '\n'
      pendingSpace = false
      atLineStart = true
      continue
    }

    if (char === ' ' || char === '\t') {
      if (!atLineStart) pendingSpace = true
      continue
    }

    const startsLineComment = char === '#' || (char === '/' && next === '/')
    const startsBlockComment = char === '/' && next === '*'
    if (startsLineComment || startsBlockComment) {
      if (pendingSpace && !atLineStart) output += ' '
      pendingSpace = false
      output += char
      if (char === '/') {
        output += next
        index += 1
      }
      mode = startsBlockComment ? 'blockComment' : 'lineComment'
      atLineStart = false
      continue
    }

    if (pendingSpace && !atLineStart) output += ' '
    output += char
    pendingSpace = false
    atLineStart = false
  }

  return output
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, removeWhitespaces)
}
