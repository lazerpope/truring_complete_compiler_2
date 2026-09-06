import { runCompilerTransform, type PrecompilerPipeline } from '../compilerError'
import {
  findBlockEnd,
  findMatching,
  nextGeneratedName,
  splitTopLevel,
  splitTrailingComment,
} from './shared'

interface LoweredExpression {
  expression: string
  prelude: string[]
}

const lowerExpression = (
  input: string,
  indent: string,
  makeName: () => string,
): LoweredExpression => {
  let expression = input
  const prelude: string[] = []

  while (true) {
    const match = /\bMath\.(min|max|smin|smax|abs)\s*\(/.exec(expression)
    if (!match || match.index === undefined) break
    const member = match[1]!
    const open = expression.indexOf('(', match.index)
    const close = findMatching(expression, open)
    if (close < 0) break
    const argumentsList = splitTopLevel(expression.slice(open + 1, close), ',')
    const expected = member === 'abs' ? 1 : 2
    if (argumentsList.length !== expected) break

    const loweredArguments = argumentsList.map((argument) =>
      lowerExpression(argument, indent, makeName),
    )
    const argumentNames: string[] = []
    loweredArguments.forEach((lowered) => {
      prelude.push(...lowered.prelude)
      const argumentName = makeName()
      argumentNames.push(argumentName)
      prelude.push(`${indent}let ${argumentName} = ${lowered.expression}`)
    })
    const result = makeName()
    prelude.push(`${indent}let ${result} = ${argumentNames[0]}`)

    if (member === 'abs') {
      prelude.push(`${indent}if (${result} s< 0) {`)
      prelude.push(`${indent}  ${result} = -${result}`)
      prelude.push(`${indent}}`)
    } else {
      const signed = member.startsWith('s')
      const minimum = member === 'min' || member === 'smin'
      const operator = `${signed ? 's' : ''}${minimum ? '<' : '>'}`
      prelude.push(`${indent}if (${argumentNames[1]} ${operator} ${argumentNames[0]}) {`)
      prelude.push(`${indent}  ${result} = ${argumentNames[1]}`)
      prelude.push(`${indent}}`)
    }

    expression = `${expression.slice(0, match.index)}${result}${expression.slice(close + 1)}`
  }

  return { expression, prelude }
}

const stripOuterParentheses = (expression: string): string => {
  let result = expression.trim()
  while (result.startsWith('(') && findMatching(result, 0) === result.length - 1) {
    result = result.slice(1, -1).trim()
  }
  return result
}

const splitLogical = (expression: string, operator: '||' | '&&'): [string, string] | undefined => {
  let depth = 0
  for (let index = 0; index < expression.length - 1; index += 1) {
    const char = expression[index]
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (depth === 0 && expression.slice(index, index + 2) === operator) {
      return [expression.slice(0, index).trim(), expression.slice(index + 2).trim()]
    }
  }
  return undefined
}

const lowerCondition = (
  input: string,
  target: string,
  indent: string,
  makeName: () => string,
): string[] => {
  const expression = stripOuterParentheses(input)
  const logicalOr = splitLogical(expression, '||')
  if (logicalOr) {
    return [
      ...lowerCondition(logicalOr[0], target, indent, makeName),
      `${indent}if (!${target}) {`,
      ...lowerCondition(logicalOr[1], target, `${indent}  `, makeName),
      `${indent}}`,
    ]
  }
  const logicalAnd = splitLogical(expression, '&&')
  if (logicalAnd) {
    return [
      ...lowerCondition(logicalAnd[0], target, indent, makeName),
      `${indent}if (${target}) {`,
      ...lowerCondition(logicalAnd[1], target, `${indent}  `, makeName),
      `${indent}}`,
    ]
  }

  const lowered = lowerExpression(expression, indent, makeName)
  return [
    ...lowered.prelude,
    `${indent}${target} = 0`,
    `${indent}if (${lowered.expression}) {`,
    `${indent}  ${target} = 1`,
    `${indent}}`,
  ]
}

export function doStep(pipeline: PrecompilerPipeline): PrecompilerPipeline {
  return runCompilerTransform(pipeline, (source) => {
    const makeName = nextGeneratedName(source, 'math')

    const lowerRange = (lines: readonly string[]): string[] => {
      const output: string[] = []
      for (let index = 0; index < lines.length; index += 1) {
        const original = lines[index] ?? ''
        const [line, comment] = splitTrailingComment(original)
        const indent = line.match(/^\s*/)?.[0] ?? ''
        const whileMatch = line.match(/^\s*while\s*\((.*)\)\s*\{\s*$/)
        if (whileMatch?.[1]?.includes('Math.')) {
          const end = findBlockEnd(lines, index)
          if (end >= 0) {
            const condition = makeName()
            output.push(`${indent}while (1) {${comment ? ` ${comment}` : ''}`)
            output.push(`${indent}  let ${condition} = 0`)
            output.push(...lowerCondition(whileMatch[1], condition, `${indent}  `, makeName))
            output.push(`${indent}  if (!${condition}) {`)
            output.push(`${indent}    break`)
            output.push(`${indent}  }`)
            output.push(...lowerRange(lines.slice(index + 1, end)))
            output.push(`${indent}}`)
            index = end
            continue
          }
        }

        const ifMatch = line.match(/^\s*if\s*\((.*)\)\s*\{\s*$/)
        if (ifMatch?.[1]?.includes('Math.')) {
          const condition = makeName()
          const generated = [
            `${indent}let ${condition} = 0`,
            ...lowerCondition(ifMatch[1], condition, indent, makeName),
            `${indent}if (${condition}) {`,
          ]
          if (comment) generated[0] += ` ${comment}`
          output.push(...generated)
          continue
        }

        const lowered = lowerExpression(line, indent, makeName)
        if (lowered.prelude.length > 0 && comment) lowered.prelude[0] += ` ${comment}`
        output.push(
          ...lowered.prelude,
          `${lowered.expression}${lowered.prelude.length ? '' : comment ? ` ${comment}` : ''}`,
        )
      }
      return output
    }

    return lowerRange(source.split('\n')).join('\n')
  })
}
