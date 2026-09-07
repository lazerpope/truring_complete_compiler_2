import { tokenize } from '../language/tokenize'
import { braceDelta, sourceLines, splitTopLevel, type SourceLine } from './shared'

export type StructFieldKind = 'scalar' | 'array'

export interface StaticStructField {
  name: string
  kind: StructFieldKind
  initializer: string
  lineNumber: number
}

export interface StaticStructSchema {
  name: string
  fields: StaticStructField[]
  startIndex: number
  endIndex: number
  lineNumber: number
}

export interface StaticStructInstance {
  declarationKind: 'let' | 'const' | 'var'
  name: string
  schema: StaticStructSchema
  arguments: string[]
  lineIndex: number
  lineNumber: number
}

export interface StaticStructParseResult {
  lines: SourceLine[]
  schemas: Map<string, StaticStructSchema>
  classLineIndexes: Set<number>
  reasons: string[]
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

const classifyField = (initializer: string): StructFieldKind =>
  /^Array\s*\([\s\S]*\)$/.test(initializer) || /^\[[\s\S]*\]$/.test(initializer)
    ? 'array'
    : 'scalar'

export const parseStaticStructSchemas = (source: string): StaticStructParseResult => {
  const lines = sourceLines(source)
  const schemas = new Map<string, StaticStructSchema>()
  const classLineIndexes = new Set<number>()
  const reasons: string[] = []
  let sourceDepth = 0

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const code = line.code.trim()
    const classHeader = code.match(/^class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{$/)

    if (!classHeader) {
      if (/^class\b/.test(code)) {
        reasons.push(`Line ${line.lineNumber}: invalid class declaration; expected class Name {`)
      }
      sourceDepth += braceDelta(line.code)
      continue
    }

    const name = classHeader[1]!
    if (sourceDepth !== 0) {
      reasons.push(`Line ${line.lineNumber}: class ${name} must be declared at top level`)
    }

    let classDepth = braceDelta(line.code)
    let endIndex = index
    while (classDepth > 0 && endIndex + 1 < lines.length) {
      endIndex += 1
      classDepth += braceDelta(lines[endIndex]!.code)
    }

    if (classDepth !== 0) {
      reasons.push(`Line ${line.lineNumber}: class ${name} is missing its closing brace`)
      endIndex = lines.length - 1
    } else if (lines[endIndex]!.code.trim() !== '}') {
      reasons.push(
        `Line ${lines[endIndex]!.lineNumber}: a class closing brace must be on its own line`,
      )
    }

    for (let classIndex = index; classIndex <= endIndex; classIndex += 1) {
      classLineIndexes.add(classIndex)
    }

    const fields: StaticStructField[] = []
    const fieldNames = new Map<string, number>()
    for (let fieldIndex = index + 1; fieldIndex < endIndex; fieldIndex += 1) {
      const fieldLine = lines[fieldIndex]!
      const fieldCode = fieldLine.code.trim()
      if (!fieldCode) continue

      const field = fieldCode.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+)$/)
      if (!field || fieldCode.includes('{') || fieldCode.includes('}')) {
        reasons.push(
          `Line ${fieldLine.lineNumber}: class ${name} fields must use one name = initializer per line`,
        )
        continue
      }

      const fieldName = field[1]!
      const initializer = field[2]!.trim()
      if (!IDENTIFIER.test(fieldName)) {
        reasons.push(
          `Line ${fieldLine.lineNumber}: invalid struct field name ${JSON.stringify(fieldName)}`,
        )
        continue
      }
      const previous = fieldNames.get(fieldName)
      if (previous !== undefined) {
        reasons.push(
          `Line ${fieldLine.lineNumber}: duplicate field ${fieldName} in class ${name}; first declared on line ${previous}`,
        )
        continue
      }
      fieldNames.set(fieldName, fieldLine.lineNumber)

      try {
        tokenize(initializer)
      } catch (error: unknown) {
        reasons.push(
          error instanceof Error
            ? `Line ${fieldLine.lineNumber}: ${error.message.replace(/^Line \d+, column \d+: /, '')}`
            : String(error),
        )
      }

      if (/^\[\s*\]$/.test(initializer)) {
        reasons.push(`Line ${fieldLine.lineNumber}: empty struct array fields are prohibited`)
      }
      const arrayLiteral = initializer.match(/^\[([\s\S]*)\]$/)
      if (arrayLiteral) {
        const slots = splitTopLevel(arrayLiteral[1] ?? '', ',')
        if (slots.some((slot) => /^\[([\s\S]*)\]$/.test(slot) || /^Array\s*\(/.test(slot))) {
          reasons.push(`Line ${fieldLine.lineNumber}: nested struct arrays are prohibited`)
        }
      }
      if (/^Array\s*\(\s*Array\s*\(/.test(initializer)) {
        reasons.push(`Line ${fieldLine.lineNumber}: nested struct arrays are prohibited`)
      }

      fields.push({
        name: fieldName,
        kind: classifyField(initializer),
        initializer,
        lineNumber: fieldLine.lineNumber,
      })
    }

    if (fields.length === 0) reasons.push(`Line ${line.lineNumber}: class ${name} cannot be empty`)
    const previous = schemas.get(name)
    if (previous) {
      reasons.push(
        `Line ${line.lineNumber}: duplicate class ${name}; first declared on line ${previous.lineNumber}`,
      )
    } else {
      schemas.set(name, { name, fields, startIndex: index, endIndex, lineNumber: line.lineNumber })
    }

    index = endIndex
  }

  return { lines, schemas, classLineIndexes, reasons }
}

export const parseStructInstance = (
  line: SourceLine,
  lineIndex: number,
  schemas: ReadonlyMap<string, StaticStructSchema>,
): StaticStructInstance | undefined => {
  const declaration = line.code.match(
    /^\s*(let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\((.*)\)\s*$/,
  )
  if (!declaration) return undefined
  const schema = schemas.get(declaration[3]!)
  if (!schema) return undefined
  const argumentSource = declaration[4]!.trim()
  return {
    declarationKind: declaration[1] as StaticStructInstance['declarationKind'],
    name: declaration[2]!,
    schema,
    arguments: argumentSource ? splitTopLevel(argumentSource, ',') : [],
    lineIndex,
    lineNumber: line.lineNumber,
  }
}
