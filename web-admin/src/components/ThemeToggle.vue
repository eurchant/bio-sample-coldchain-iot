<script setup lang="ts">
import { THEME_OPTIONS, type ThemePreference } from '../lib/theme'

defineProps<{
  modelValue: ThemePreference
}>()

const emit = defineEmits<{
  'update:modelValue': [preference: ThemePreference]
}>()

function selectTheme(preference: ThemePreference) {
  emit('update:modelValue', preference)
}
</script>

<template>
  <div class="theme-toggle" role="group" aria-label="界面主题">
    <span class="theme-toggle-label">主题</span>
    <button
      v-for="option in THEME_OPTIONS"
      :key="option.value"
      type="button"
      :aria-pressed="modelValue === option.value"
      :title="'切换为' + option.label + '主题'"
      @click="selectTheme(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
