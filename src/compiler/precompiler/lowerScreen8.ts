import type { PrecompilerPipeline } from '../compilerError'
import { nextGeneratedName, splitTrailingComment, tryEvaluateConstant } from './shared'
import { parseScreen8Declaration, parseScreen8PixelWrite } from './screen8'

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline

  let width = 0n
  const nextX = nextGeneratedName(pipeline[0], 'screen8_x')
  const nextY = nextGeneratedName(pipeline[0], 'screen8_y')
  const nextColor = nextGeneratedName(pipeline[0], 'screen8_color')
  const nextOffset = nextGeneratedName(pipeline[0], 'screen8_offset')

  const output = pipeline[0].split('\n').flatMap((original) => {
    const [rawCode, comment] = splitTrailingComment(original)
    const declaration = parseScreen8Declaration(rawCode)

    if (declaration !== undefined) {
      const setting = tryEvaluateConstant(declaration)
      if (setting === undefined) return [original]

      width = 4n * (setting + 1n)
      const height = 3n * (setting + 1n)
      const byteCount = width * height
      return [
        `screen(0, 2)${comment ? ` ${comment}` : ''}`,
        `screen(2, ${setting})`,
        `screen(1, __ts_screen8_buffer_${byteCount})`,
      ]
    }

    const write = parseScreen8PixelWrite(rawCode)
    if (!write) return [original]

    const x = nextX()
    const y = nextY()
    const color = nextColor()
    const offset = nextOffset()
    return [
      `let ${x} = ${write.x}${comment ? ` ${comment}` : ''}`,
      `let ${y} = ${write.y}`,
      `let ${color} = ${write.value}`,
      `let ${offset} = ${y} * ${width} + ${x}`,
      `__ts_screen8_store(${offset}, ${color})`,
    ]
  })

  return [output.join('\n'), pipeline[1], pipeline[2]]
}
