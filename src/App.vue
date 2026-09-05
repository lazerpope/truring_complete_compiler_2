<script setup lang="ts">
import { computed, ref } from 'vue'
import Editor from './Editor.vue'
import { useAppState } from './stores/appState'

const store = useAppState()
const fileInput = ref<HTMLInputElement | null>(null)
const editorStatus = ref(store.text ? 'Restored' : 'Idle')
const resultStatus = ref(store.compiled ? 'Compiled' : 'Waiting')

const resultLineNumbers = computed(() => {
  const lineCount = store.compiled === '' ? 1 : store.compiled.split('\n').length
  return Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')
})

const openFilePicker = () => fileInput.value?.click()

const openTextFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    store.text = await file.text()
    editorStatus.value = `Opened ${file.name}`
    if (store.autocompile) resultStatus.value = 'Compiled'
  } catch {
    editorStatus.value = 'Could not open file'
  } finally {
    input.value = ''
  }
}

const downloadText = (text: string, filename: string) => {
  const objectUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}

const fallbackCopy = (text: string): boolean => {
  const field = document.createElement('textarea')
  field.value = text
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  const copied = document.execCommand('copy')
  field.remove()
  return copied
}

const copyText = async (text: string, side: 'editor' | 'result') => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else if (!fallbackCopy(text)) {
      throw new Error('Clipboard API unavailable')
    }

    if (side === 'editor') editorStatus.value = 'Copied'
    else resultStatus.value = 'Copied'
  } catch {
    if (side === 'editor') editorStatus.value = 'Copy failed'
    else resultStatus.value = 'Copy failed'
  }
}

const compile = () => {
  store.compile()
  resultStatus.value = 'Compiled'
}
</script>

<template>
  <main class="app-shell">
    <header class="toolbar">
      <div class="group" aria-label="Source actions">
        <button type="button" @click="openFilePicker">Open TXT</button>
        <button type="button" @click="downloadText(store.text, 'source.txt')">Download</button>
        <button type="button" @click="copyText(store.text, 'editor')">Copy</button>
      </div>

      <div class="spacer" />

      <div class="group compile-actions">
        <button type="button" class="primary" @click="compile">Compile</button>
        <label class="checkbox">
          <input v-model="store.autocompile" type="checkbox" />
          Auto
        </label>
      </div>

      <div class="spacer" />

      <div class="group" aria-label="Result actions">
        <button type="button" @click="downloadText(store.compiled, 'assembly.txt')">
          Download
        </button>
        <button type="button" @click="copyText(store.compiled, 'result')">Copy</button>
      </div>
    </header>

    <div class="panes">
      <section class="pane">
        <header class="pane-header">
          Editor
          <span>{{ editorStatus }}</span>
        </header>
        <div class="code-wrap code-wrap--single">
          <Editor />
        </div>
      </section>

      <section class="pane">
        <header class="pane-header">
          Result
          <span>{{ resultStatus }}</span>
        </header>
        <div class="code-wrap">
          <div class="text-gutter" aria-hidden="true">
            <div class="text-gutter__inner">{{ resultLineNumbers }}</div>
          </div>
          <textarea
            :value="store.compiled"
            class="result-editor"
            aria-label="Compiled assembly"
            readonly
            spellcheck="false"
          />
        </div>
      </section>
    </div>

    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept=".txt,text/plain"
      @change="openTextFile"
    />
  </main>
</template>

<style>
:root {
  --bg-0: #23262e;
  --bg-1: #1a1c22;
  --panel: #23262e;
  --panel-2: #2b303b;
  --text: #d5ced9;
  --muted: #746f77;
  --accent: #00e8c6;
  --border: #363c49;
  --glow: rgba(0, 232, 198, 0.2);
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-family: 'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace;
  background:
    radial-gradient(900px 500px at 20% -20%, #2d313b 0%, transparent 60%),
    radial-gradient(900px 500px at 100% 0%, #20232a 0%, transparent 55%),
    linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%);
}

button,
textarea,
input {
  font: inherit;
}

button {
  height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  letter-spacing: 0.2px;
  cursor: pointer;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    background 120ms ease;
}

button:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--glow);
  transform: translateY(-1px);
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

button:active {
  transform: translateY(0);
}

button.primary {
  border-color: rgba(0, 232, 197, 0.8);
  background: linear-gradient(135deg, rgba(0, 232, 197, 0.8), rgba(7, 212, 182, 0.8));
  color: #20232b;
  font-weight: 700;
}

.app-shell {
  height: 100%;
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, #23262e, #20232a);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  z-index: 1;
}

.group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spacer {
  flex: 1;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.checkbox input {
  margin: 0;
  accent-color: var(--accent);
}

.panes {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  padding: 16px;
  animation: fade-in 420ms ease-out;
}

.pane {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--panel), #1a1c22);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, #23262e, #20232a);
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.pane-header span {
  overflow: hidden;
  color: var(--accent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-wrap {
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  overflow: hidden;
}

.code-wrap--single {
  grid-template-columns: minmax(0, 1fr);
}

.text-gutter {
  overflow: hidden;
  padding: 14px 10px;
  border-right: 1px solid var(--border);
  background: #23262e;
  color: var(--muted);
  text-align: right;
  user-select: none;
}

.text-gutter__inner {
  white-space: pre;
  font-size: 12px;
  line-height: 1.5;
}

.result-editor {
  width: 100%;
  height: 100%;
  min-height: 0;
  resize: none;
  border: 0;
  outline: none;
  padding: 14px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
}

.result-editor::selection {
  background: rgba(123, 223, 246, 0.28);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  body {
    overflow: auto;
  }

  .app-shell {
    min-height: 100%;
    height: auto;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .spacer {
    display: none;
  }

  .compile-actions {
    margin-left: auto;
    order: 1;
  }

  .panes {
    min-height: calc(100vh - 90px);
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, minmax(340px, 1fr));
  }
}

@media (max-width: 560px) {
  .toolbar {
    justify-content: space-between;
    padding: 8px;
  }

  .toolbar .group:last-of-type {
    margin-left: auto;
  }

  .compile-actions {
    width: 100%;
    justify-content: center;
    order: 2;
  }

  .panes {
    padding: 8px;
  }
}
</style>
