import type { PrecompilerPipeline } from '../compilerError'
import { tokenize } from '../language/tokenize'
import { identifierPattern, withErrors } from './shared'
import {
  parseStaticStructSchemas,
  parseStructInstance,
  type StaticStructInstance,
} from './staticStructs'
import { RESERVED_IDENTIFIERS } from './validateIdentifiers'

const addUnique = (reasons: string[], reason: string): void => {
  if (!reasons.includes(reason)) reasons.push(reason)
}

const hasValueIdentifier = (code: string, name: string): boolean => {
  const occurrences = code.matchAll(new RegExp(identifierPattern(name), 'g'))
  for (const occurrence of occurrences) {
    const prefix = code.slice(0, occurrence.index ?? 0).trimEnd()
    if (!prefix.endsWith('.')) return true
  }
  return false
}

const propertyAfter = (code: string, offset: number): { name: string; end: number } | undefined => {
  const match = code.slice(offset).match(/^\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/)
  return match ? { name: match[1]!, end: offset + match[0].length } : undefined
}

const validateFieldUse = (
  lineNumber: number,
  code: string,
  instance: StaticStructInstance,
  occurrenceEnd: number,
  reasons: string[],
): void => {
  const property = propertyAfter(code, occurrenceEnd)
  if (!property) {
    addUnique(
      reasons,
      `Line ${lineNumber}: struct ${instance.name} may only be used through a named field`,
    )
    return
  }

  const field = instance.schema.fields.find((candidate) => candidate.name === property.name)
  if (!field) {
    addUnique(
      reasons,
      `Line ${lineNumber}: class ${instance.schema.name} has no field named ${property.name}`,
    )
    return
  }

  const remainder = code.slice(property.end).trimStart()
  if (field.kind === 'scalar') {
    if (remainder.startsWith('[') || remainder.startsWith('.')) {
      addUnique(
        reasons,
        `Line ${lineNumber}: scalar field ${instance.name}.${field.name} cannot be indexed`,
      )
    }
    return
  }

  if (remainder.startsWith('[') || /^\.\s*length\b/.test(remainder)) return
  const escapedInstance = identifierPattern(instance.name)
  const escapedField = identifierPattern(field.name)
  const forIn = new RegExp(
    String.raw`^\s*for\s*\([^)]*\bin\s+${escapedInstance}\s*\.\s*${escapedField}\s*\)\s*\{\s*$`,
  )
  if (forIn.test(code)) return
  addUnique(
    reasons,
    `Line ${lineNumber}: array field ${instance.name}.${field.name} may only be indexed, use .length, or be a for...in iterable`,
  )
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  if (pipeline[1].isError) return pipeline
  const parsed = parseStaticStructSchemas(pipeline[0])
  const reasons = [...parsed.reasons]
  try {
    tokenize(pipeline[0])
  } catch (error: unknown) {
    addUnique(reasons, error instanceof Error ? error.message : String(error))
  }

  const variableDeclarations = new Map<string, number>()
  for (const [index, line] of parsed.lines.entries()) {
    if (parsed.classLineIndexes.has(index)) continue
    for (const declaration of line.code.matchAll(
      /(?:^|\bfor\s*\()\s*(?:let|const|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g,
    )) {
      if (!variableDeclarations.has(declaration[1]!)) {
        variableDeclarations.set(declaration[1]!, line.lineNumber)
      }
    }
  }

  for (const schema of parsed.schemas.values()) {
    if (schema.name.startsWith('__ts_')) {
      addUnique(reasons, `Line ${schema.lineNumber}: identifiers beginning with __ts_ are reserved`)
    }
    if (RESERVED_IDENTIFIERS.has(schema.name)) {
      addUnique(reasons, `Line ${schema.lineNumber}: ${schema.name} is reserved`)
    }
    const variableLine = variableDeclarations.get(schema.name)
    if (variableLine !== undefined) {
      addUnique(
        reasons,
        `Line ${variableLine}: ${schema.name} cannot be both a class and a variable`,
      )
    }
    for (const field of schema.fields) {
      if (field.name.startsWith('__ts_')) {
        addUnique(
          reasons,
          `Line ${field.lineNumber}: identifiers beginning with __ts_ are reserved`,
        )
      }
      if (RESERVED_IDENTIFIERS.has(field.name)) {
        addUnique(reasons, `Line ${field.lineNumber}: ${field.name} is reserved`)
      }
      for (const otherSchema of parsed.schemas.values()) {
        const nested = new RegExp(String.raw`^${identifierPattern(otherSchema.name)}\s*\(`)
        if (nested.test(field.initializer)) {
          addUnique(reasons, `Line ${field.lineNumber}: nested struct fields are prohibited`)
        }
      }

      let initializerTokens: ReturnType<typeof tokenize> = []
      try {
        initializerTokens = tokenize(field.initializer).filter(
          (token) => token.kind !== 'comment' && token.kind !== 'newline' && token.kind !== 'eof',
        )
      } catch {
        continue
      }
      for (const [tokenIndex, token] of initializerTokens.entries()) {
        if (token.value === 'this' || token.value === 'super') {
          addUnique(
            reasons,
            `Line ${field.lineNumber}: ${token.value} is prohibited in struct field defaults`,
          )
        }
        if (
          token.kind === 'identifier' &&
          schema.fields.some((candidate) => candidate.name === token.value) &&
          initializerTokens[tokenIndex - 1]?.value !== '.'
        ) {
          addUnique(
            reasons,
            `Line ${field.lineNumber}: struct field defaults cannot reference field ${token.value}`,
          )
        }
      }
    }
  }

  const instances = new Map<string, StaticStructInstance>()
  for (const [index, line] of parsed.lines.entries()) {
    if (parsed.classLineIndexes.has(index)) continue
    const instance = parseStructInstance(line, index, parsed.schemas)
    if (instance) {
      instances.set(instance.name, instance)
      if (instance.lineNumber <= instance.schema.lineNumber) {
        addUnique(
          reasons,
          `Line ${instance.lineNumber}: class ${instance.schema.name} must be declared before construction`,
        )
      }
      const scalarCount = instance.schema.fields.filter((field) => field.kind === 'scalar').length
      if (instance.arguments.some((argument) => argument === '')) {
        addUnique(
          reasons,
          `Line ${instance.lineNumber}: struct constructor arguments cannot be omitted`,
        )
      }
      if (instance.arguments.length > scalarCount) {
        addUnique(
          reasons,
          `Line ${instance.lineNumber}: ${instance.schema.name} accepts at most ${scalarCount} scalar arguments`,
        )
      }
    }

    for (const schema of parsed.schemas.values()) {
      const construction = new RegExp(String.raw`${identifierPattern(schema.name)}\s*\(`)
      if (construction.test(line.code) && (!instance || instance.schema.name !== schema.name)) {
        addUnique(
          reasons,
          `Line ${line.lineNumber}: ${schema.name}(...) is allowed only as a complete variable initializer`,
        )
      }

      let codeWithoutValidConstruction = line.code
      if (instance?.schema.name === schema.name) {
        const allowedConstruction = new RegExp(
          String.raw`(=\s*)${identifierPattern(schema.name)}(\s*\()`,
        )
        codeWithoutValidConstruction = codeWithoutValidConstruction.replace(
          allowedConstruction,
          '$1$2',
        )
      }
      if (hasValueIdentifier(codeWithoutValidConstruction, schema.name)) {
        addUnique(
          reasons,
          `Line ${line.lineNumber}: class ${schema.name} is a schema and cannot be used as a runtime value`,
        )
      }
    }
  }

  for (const [index, line] of parsed.lines.entries()) {
    if (parsed.classLineIndexes.has(index)) continue
    const declaredHere = parseStructInstance(line, index, parsed.schemas)
    for (const instance of instances.values()) {
      const use = new RegExp(identifierPattern(instance.name), 'g')
      for (const match of line.code.matchAll(use)) {
        const prefix = line.code.slice(0, match.index ?? 0).trimEnd()
        if (prefix.endsWith('.')) continue
        const assignmentIndex = line.code.indexOf('=')
        const isDeclarationName =
          declaredHere?.name === instance.name &&
          line.lineNumber === instance.lineNumber &&
          (match.index ?? 0) < assignmentIndex
        if (isDeclarationName) continue
        if (line.lineNumber <= instance.lineNumber) {
          addUnique(
            reasons,
            `Line ${line.lineNumber}: struct ${instance.name} is used before its declaration`,
          )
          continue
        }
        validateFieldUse(
          line.lineNumber,
          line.code,
          instance,
          (match.index ?? 0) + match[0].length,
          reasons,
        )
      }
    }
  }

  return withErrors(pipeline, reasons)
}
