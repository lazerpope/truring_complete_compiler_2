import { sourceLines } from '../compiler/precompiler/shared'

const countCharacter = (source: string, character: string): number =>
  [...source].filter((value) => value === character).length

export const formatSourceIndentation = (source: string): string => {
  let depth = 0

  return sourceLines(source)
    .map(({ original, code }) => {
      if (!original.trim()) return ''

      const content = original.trimStart()
      const visibleCode = code.trimStart()
      const leadingClosures = visibleCode.match(/^}+/)?.[0].length ?? 0
      const indentation = '\t'.repeat(Math.max(0, depth - leadingClosures))

      depth = Math.max(
        0,
        depth + countCharacter(visibleCode, '{') - countCharacter(visibleCode, '}'),
      )

      return `${indentation}${content}`
    })
    .join('\n')
}
