import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { compile as compileSource } from '../compiler/main'

const AUTOCOMPILE_STORAGE_KEY = 'autocompile'
const TEXT_STORAGE_KEY = 'text'
const TEXT_SAVE_DELAY = 50

const getStorage = (): Storage | null =>
  typeof window === 'undefined' ? null : window.localStorage

const loadText = (storage: Storage | null): string => {
  if (!storage) return ''

  const savedText = storage.getItem(TEXT_STORAGE_KEY)
  if (savedText !== null) return savedText

  storage.setItem(TEXT_STORAGE_KEY, '')
  return ''
}

const loadAutocompile = (storage: Storage | null): boolean => {
  if (!storage) return true

  const savedAutocompile = storage.getItem(AUTOCOMPILE_STORAGE_KEY)
  if (savedAutocompile === null) {
    storage.setItem(AUTOCOMPILE_STORAGE_KEY, 'true')
    return true
  }

  return savedAutocompile === 'true' || savedAutocompile === '1'
}

export const useAppState = defineStore('app-state', () => {
  const storage = getStorage()
  const autocompile = ref(loadAutocompile(storage))
  const text = ref(loadText(storage))
  const compiled = ref('')

  const compile = () => {
    const result = compileSource(text.value)
    compiled.value = result[1].isError
      ? `Compiler error: ${result[1].reasons.join('\n')}`
      : result[0]
  }

  if (autocompile.value && text.value) compile()

  let saveTextTimer: ReturnType<typeof setTimeout> | undefined

  watch(text, () => {
    if (autocompile.value) compile()

    clearTimeout(saveTextTimer)
    saveTextTimer = setTimeout(() => {
      storage?.setItem(TEXT_STORAGE_KEY, text.value)
    }, TEXT_SAVE_DELAY)
  })

  watch(autocompile, (enabled) => {
    storage?.setItem(AUTOCOMPILE_STORAGE_KEY, String(enabled))
    if (enabled) compile()
  })

  return { autocompile, text, compiled, compile }
})
