import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { nextGeneratedName, splitTrailingComment } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const makeName = nextGeneratedName(source, 'update_index')
    const output: string[] = []
    for (const original of source.split('\n')) {
      const [line, comment] = splitTrailingComment(original)
      const match = line.match(/^(\s*)([A-Za-z_$][\w$]*(?:\[(.+)\])?)\s*(\+\+|--)\s*$/)
      if (!match) {
        output.push(original)
        continue
      }
      const indent = match[1] ?? ''
      const amount = match[4] === '++' ? '+' : '-'
      const array = match[2]!.match(/^([A-Za-z_$][\w$]*)\[(.+)\]$/)
      if (!array) {
        output.push(`${indent}${match[2]} = ${match[2]} ${amount} 1${comment ? ` ${comment}` : ''}`)
        continue
      }
      const temporary = makeName()
      output.push(`${indent}let ${temporary} = ${array[2]}${comment ? ` ${comment}` : ''}`)
      output.push(`${indent}${array[1]}[${temporary}] = ${array[1]}[${temporary}] ${amount} 1`)
    }
    return output.join('\n')
  })
}
