import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { splitTopLevel, splitTrailingComment } from './shared'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const output: string[] = []
    for (const original of source.split('\n')) {
      const [line, comment] = splitTrailingComment(original)
      const match = line.match(
        /^(\s*)(let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[(.*)\]\s*$/,
      )
      if (!match) {
        output.push(original)
        continue
      }
      const slots = splitTopLevel(match[4] ?? '', ',')
      if (slots.at(-1) === '') slots.pop()
      const values = slots.map((slot) => slot || '0')
      output.push(`${match[1]}${match[2]} ${match[3]} = Array(${values.length})${comment ? ` ${comment}` : ''}`)
      values.forEach((value, index) => {
        output.push(`${match[1]}${match[3]}[${index}] = ${value}`)
      })
    }
    return output.join('\n')
  })
}
