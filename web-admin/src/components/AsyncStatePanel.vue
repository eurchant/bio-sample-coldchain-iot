<script setup lang="ts">
import { computed, useId, type PropType } from 'vue'

type AsyncState = 'loading' | 'empty' | 'offline' | 'error'

interface StateCopy {
  title: string
  description: string
}

const props = defineProps({
  state: {
    type: String as PropType<AsyncState>,
    required: true,
  },
  title: String,
  description: String,
  retryable: {
    type: Boolean,
    default: undefined,
  },
  retryLabel: String,
})

const emit = defineEmits<{
  retry: []
}>()

const defaultCopy: Record<AsyncState, StateCopy> = {
  loading: {
    title: '正在加载数据',
    description: '正在请求最新数据，请稍候。',
  },
  empty: {
    title: '暂无可显示的数据',
    description: '当前条件下没有可展示的记录。',
  },
  offline: {
    title: '网络连接暂时中断',
    description: '请检查网络或服务状态，恢复后可重新加载。',
  },
  error: {
    title: '数据加载失败',
    description: '请求未能完成，请检查服务状态后重试。',
  },
}

const stateIcon: Record<AsyncState, string> = {
  loading: '…',
  empty: '—',
  offline: '!',
  error: '×',
}

const instanceId = useId()
const titleId = `async-state-title-${instanceId}`
const descriptionId = `async-state-description-${instanceId}`
const copy = computed(() => defaultCopy[props.state])
const resolvedTitle = computed(() => props.title || copy.value.title)
const resolvedDescription = computed(() => props.description || copy.value.description)
const isError = computed(() => props.state === 'error')
const role = computed(() => (isError.value ? 'alert' : 'status'))
const ariaLive = computed(() => (isError.value ? 'assertive' : 'polite'))
const canRetryByDefault = computed(() => props.state === 'offline' || props.state === 'error')
const showRetry = computed(() => props.retryable ?? canRetryByDefault.value)
const resolvedRetryLabel = computed(() => props.retryLabel || '重新加载')
</script>

<template>
  <section
    :class="['async-state-panel', 'is-' + state]"
    :data-state="state"
    :role="role"
    :aria-live="ariaLive"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
  >
    <span class="async-state-icon" :class="{ 'is-loading': state === 'loading' }" aria-hidden="true">
      {{ stateIcon[state] }}
    </span>

    <div class="async-state-copy">
      <h2 :id="titleId">{{ resolvedTitle }}</h2>
      <p :id="descriptionId">{{ resolvedDescription }}</p>
    </div>

    <button
      v-if="showRetry"
      class="async-state-retry"
      type="button"
      :aria-label="resolvedRetryLabel"
      @click="emit('retry')"
    >
      {{ resolvedRetryLabel }}
    </button>
  </section>
</template>

<style scoped>
.async-state-panel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 104px;
  padding: 18px;
  color: var(--text-primary, #edf7f2);
  background: var(--panel-surface, rgba(11, 37, 38, 0.78));
  border: 1px solid var(--border-subtle, rgba(172, 225, 207, 0.16));
  border-radius: 14px;
  box-shadow: var(--panel-shadow, 0 14px 35px rgba(0, 0, 0, 0.13));
}

.async-state-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--state-info, #8fe2cb);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  background: var(--state-info-surface, rgba(99, 215, 184, 0.12));
  border: 1px solid var(--state-info-border, rgba(99, 215, 184, 0.3));
  border-radius: 50%;
}

.async-state-icon.is-loading {
  color: transparent;
  border-color: var(--state-info, #63d7b8);
  border-right-color: transparent;
  background: transparent;
  animation: async-state-spin 0.9s linear infinite;
}

.async-state-copy {
  min-width: 0;
}

.async-state-copy h2 {
  margin: 0;
  color: inherit;
  font-size: 15px;
  line-height: 1.45;
}

.async-state-copy p {
  margin: 4px 0 0;
  color: var(--text-secondary, rgba(237, 247, 242, 0.7));
  font-size: 13px;
  line-height: 1.6;
}

.async-state-panel.is-offline .async-state-icon {
  color: var(--state-warning, #ffc77d);
  background: var(--state-warning-surface, rgba(255, 174, 76, 0.12));
  border-color: var(--state-warning-border, rgba(255, 174, 76, 0.35));
}

.async-state-panel.is-error .async-state-icon {
  color: var(--state-danger, #ff9b91);
  background: var(--state-danger-surface, rgba(255, 111, 97, 0.12));
  border-color: var(--state-danger-border, rgba(255, 111, 97, 0.35));
}

.async-state-retry {
  min-height: 34px;
  padding: 0 12px;
  color: var(--button-primary-text, #06221d);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  background: var(--button-primary-background, #89e0c7);
  border: 1px solid var(--button-primary-border, #89e0c7);
  border-radius: 8px;
}

.async-state-retry:focus-visible {
  outline: 3px solid var(--focus-ring, rgba(137, 224, 199, 0.55));
  outline-offset: 2px;
}

@keyframes async-state-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (max-width: 520px) {
  .async-state-panel {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .async-state-retry {
    grid-column: 2;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .async-state-icon.is-loading {
    animation: none;
  }
}
</style>
