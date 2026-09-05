export function doStep(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .join('\n')
}
