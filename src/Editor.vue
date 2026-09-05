<script setup lang="ts">
import { useAppState } from './stores/appState'

defineOptions({ name: 'CodeEditor' })

const store = useAppState()
</script>

<template>
  <textarea
    v-model="store.text"
    class="code-editor"
    aria-label="Source editor"
    placeholder="Write or open a source file..."
    spellcheck="false"
  />
</template>

<style scoped>
.code-editor {
  width: 100%;
  height: 100%;
  min-height: 0;
  resize: none;
  border: 0;
  outline: none;
  padding: 14px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  line-height: 1.5;
  tab-size: 2;
}

.code-editor::placeholder {
  color: var(--muted);
  opacity: 0.72;
}

.code-editor::selection {
  background: rgba(123, 223, 246, 0.28);
}
</style>
