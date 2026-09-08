import { findMatching } from './shared'

export interface Screen8PixelWrite {
  x: string
  y: string
  value: string
}

export const parseScreen8Declaration = (code: string): string | undefined =>
  code.match(/^\s*let\s+screen\s*=\s*Screen8\s*\((.*)\)\s*$/)?.[1]?.trim()

export const parseScreen8Present = (code: string): string | undefined =>
  code.match(/^\s*screen\s*\.\s*present\s*\((.*)\)\s*$/)?.[1]?.trim()

export const parseScreen8PixelWrite = (code: string): Screen8PixelWrite | undefined => {
  const trimmed = code.trim()
  if (!/^screen\s*\[/.test(trimmed)) return undefined

  const firstOpen = trimmed.indexOf('[')
  const firstClose = findMatching(trimmed, firstOpen, '[', ']')
  if (firstClose < 0 || trimmed[firstClose + 1] !== '[') return undefined
  const secondOpen = firstClose + 1
  const secondClose = findMatching(trimmed, secondOpen, '[', ']')
  if (secondClose < 0) return undefined

  const remainder = trimmed.slice(secondClose + 1).trim()
  if (!remainder.startsWith('=') || remainder.startsWith('==')) return undefined
  const value = remainder.slice(1).trim()
  if (!value) return undefined

  return {
    x: trimmed.slice(firstOpen + 1, firstClose).trim(),
    y: trimmed.slice(secondOpen + 1, secondClose).trim(),
    value,
  }
}
