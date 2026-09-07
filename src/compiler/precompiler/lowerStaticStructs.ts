import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import { tokenize } from '../language/tokenize'
import {
  identifierPattern,
  nextGeneratedName,
  replaceOutsideComments,
  splitTrailingComment,
} from './shared'
import {
  parseStaticStructSchemas,
  parseStructInstance,
  type StaticStructInstance,
} from './staticStructs'

interface LoweredInstance {
  instance: StaticStructInstance
  scalarBacking?: string
  arrayBackings: Map<string, string>
}

const commentsFromClass = (source: string): string[] =>
  tokenize(source)
    .filter((token) => token.kind === 'comment')
    .map((token) => token.value)

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const parsed = parseStaticStructSchemas(source)
    if (parsed.schemas.size === 0) return source

    const generatedName = nextGeneratedName(source, 'struct')
    const loweredInstances = new Map<string, LoweredInstance>()

    for (const [index, line] of parsed.lines.entries()) {
      if (parsed.classLineIndexes.has(index)) continue
      const instance = parseStructInstance(line, index, parsed.schemas)
      if (!instance) continue
      const scalarFields = instance.schema.fields.filter((field) => field.kind === 'scalar')
      const arrayFields = instance.schema.fields.filter((field) => field.kind === 'array')
      loweredInstances.set(instance.name, {
        instance,
        scalarBacking: scalarFields.length > 0 ? generatedName() : undefined,
        arrayBackings: new Map(arrayFields.map((field) => [field.name, generatedName()])),
      })
    }

    const output: string[] = []
    for (let index = 0; index < parsed.lines.length; index += 1) {
      const line = parsed.lines[index]!
      const schema = [...parsed.schemas.values()].find(
        (candidate) => candidate.startIndex === index,
      )
      if (schema) {
        const classSource = parsed.lines
          .slice(schema.startIndex, schema.endIndex + 1)
          .map((candidate) => candidate.original)
          .join('\n')
        output.push(...commentsFromClass(classSource))
        index = schema.endIndex
        continue
      }
      if (parsed.classLineIndexes.has(index)) continue

      const instance = parseStructInstance(line, index, parsed.schemas)
      if (!instance) {
        output.push(line.original)
        continue
      }

      const lowered = loweredInstances.get(instance.name)!
      const scalarFields = instance.schema.fields.filter((field) => field.kind === 'scalar')
      const generatedLines: string[] = []
      if (lowered.scalarBacking) {
        generatedLines.push(`let ${lowered.scalarBacking} = Array(${scalarFields.length})`)
      }

      let scalarIndex = 0
      for (const field of instance.schema.fields) {
        if (field.kind === 'array') {
          generatedLines.push(
            `let ${lowered.arrayBackings.get(field.name)!} = ${field.initializer}`,
          )
          continue
        }
        const initializer = instance.arguments[scalarIndex] ?? field.initializer
        generatedLines.push(`${lowered.scalarBacking!}[${scalarIndex}] = ${initializer}`)
        scalarIndex += 1
      }

      const [, trailingComment] = splitTrailingComment(line.original)
      const inlineComments = tokenize(line.original)
        .filter((token) => token.kind === 'comment')
        .map((token) => token.value)
      const comments = trailingComment ? [trailingComment] : inlineComments
      if (comments.length > 0 && generatedLines.length > 0) {
        generatedLines[0] = `${generatedLines[0]} ${comments.join(' ')}`
      }
      output.push(...generatedLines)
    }

    let loweredSource = output.join('\n')
    loweredSource = replaceOutsideComments(loweredSource, (code) => {
      let result = code
      for (const lowered of loweredInstances.values()) {
        let scalarIndex = 0
        for (const field of lowered.instance.schema.fields) {
          const replacement =
            field.kind === 'array'
              ? lowered.arrayBackings.get(field.name)!
              : `${lowered.scalarBacking!}[${scalarIndex++}]`
          const access = new RegExp(
            String.raw`${identifierPattern(lowered.instance.name)}\s*\.\s*${identifierPattern(field.name)}`,
            'g',
          )
          result = result.replace(access, replacement)
        }
      }
      return result
    })
    return loweredSource
  })
}
