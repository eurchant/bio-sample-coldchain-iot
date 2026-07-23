<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import ThemeToggle from './components/ThemeToggle.vue'
import {
  SYSTEM_THEME_MEDIA_QUERY,
  applyThemePreference,
  getSystemPrefersDark,
  readThemePreference,
  saveThemePreference,
  type ThemePreference,
} from './lib/theme'
import { runtimeConfig } from './services/config'
import { AUTH_SESSION_INVALIDATED_EVENT } from './services/session'
import { hasRoleAccess, type DemoRole, useAuthStore } from './stores/auth'
import { useTaskStore } from './stores/task'

interface NavigationItem {
  label: string
  hint: string
  to: string
  roles?: readonly DemoRole[]
}

const store = useTaskStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const themePreference = ref<ThemePreference>(readThemePreference())

const currentTaskId = computed(() => {
  const routeTaskId = route.params.taskId
  if (typeof routeTaskId === 'string' && routeTaskId) return routeTaskId
  return store.activeTaskId || (runtimeConfig.dataSource === 'mock' ? runtimeConfig.taskId : null)
})
const navItems = computed<NavigationItem[]>(() => [
  { label: '任务总览', hint: 'TASK', to: '/tasks' },
  ...(runtimeConfig.dataSource === 'api'
    ? [{ label: '设备台账', hint: 'DEVICE', to: '/devices', roles: ['admin', 'sender'] as DemoRole[] }]
    : []),
  ...(currentTaskId.value
    ? [
        { label: '监控与交接', hint: 'LIVE', to: '/tasks/' + currentTaskId.value },
        { label: '路线与轨迹', hint: 'MAP', to: '/tasks/' + currentTaskId.value + '/map' },
        {
          label: '可信追溯',
          hint: 'TRACE',
          to: '/trace/' + currentTaskId.value,
          roles: ['admin', 'sender', 'receiver'] as DemoRole[],
        },
      ]
    : []),
  { label: '实时大屏', hint: 'SCREEN', to: '/screen', roles: ['admin'] as DemoRole[] },
])

const visibleNavItems = computed(() =>
  navItems.value.filter((item) => hasRoleAccess(auth.role, item.roles)),
)
const showApplicationShell = computed(() => auth.isAuthenticated && route.name !== 'login')
const sourceLabel = computed(() =>
  runtimeConfig.dataSource === 'mock' ? 'Mock 演示数据' : '实时 API 联调',
)

let pollingId: number | undefined
let systemThemeQuery: MediaQueryList | null = null

function stopPolling() {
  if (pollingId !== undefined) {
    window.clearInterval(pollingId)
    pollingId = undefined
  }
}

async function startPolling() {
  if (!auth.isAuthenticated) return
  if (runtimeConfig.dataSource === 'mock' || store.activeTaskId) {
    await store.bootstrap(store.activeTaskId ?? undefined)
  }
  if (!auth.isAuthenticated) return

  stopPolling()
  pollingId = window.setInterval(() => {
    void store.refreshMonitoring()
  }, runtimeConfig.pollingIntervalMs)
}

async function logout() {
  await auth.logout()
  void router.replace({ name: 'login' })
}

function handleSessionInvalidated() {
  auth.handleSessionInvalidated()
  if (route.name !== 'login') {
    void router.replace({ name: 'login', query: { redirect: route.fullPath } })
  }
}

function syncTheme() {
  applyThemePreference(themePreference.value, {
    systemPrefersDark: systemThemeQuery?.matches ?? getSystemPrefersDark(),
  })
}

function updateTheme(preference: ThemePreference) {
  themePreference.value = preference
  saveThemePreference(preference)
  syncTheme()
}

function syncSystemTheme() {
  if (themePreference.value === 'system') syncTheme()
}

onMounted(() => {
  systemThemeQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(SYSTEM_THEME_MEDIA_QUERY)
      : null
  systemThemeQuery?.addEventListener('change', syncSystemTheme)
  window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated)
  syncTheme()
  if (auth.isAuthenticated) void startPolling()
})

watch(
  () => auth.isAuthenticated,
  (authenticated) => {
    if (authenticated) {
      void startPolling()
    } else {
      stopPolling()
    }
  },
)

onUnmounted(() => {
  systemThemeQuery?.removeEventListener('change', syncSystemTheme)
  window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, handleSessionInvalidated)
  systemThemeQuery = null
  stopPolling()
})
</script>

<template>
  <RouterView v-if="!showApplicationShell" />

  <div v-else class="app-frame">
    <aside class="sidebar">
      <RouterLink class="brand" to="/" aria-label="返回任务总览">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>
          <strong>冷链转运</strong>
          <small>COLDCHAIN TRACE</small>
        </span>
      </RouterLink>

      <nav class="primary-nav" aria-label="主导航">
        <RouterLink
          v-for="item in visibleNavItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
        >
          <span class="nav-code">{{ item.hint }}</span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="side-status">
        <span class="status-pulse"></span>
        <div>
          <small>数据源</small>
          <strong>{{ sourceLabel }}</strong>
        </div>
      </div>

      <p class="side-footnote">
        演示增强模式<br />
        所有状态与告警由后端判定
      </p>
    </aside>

    <main class="content-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">BIOLOGICAL SAMPLE · TRANSIT CONTROL</p>
          <h1>生物样本冷链转运管理</h1>
        </div>
        <div class="topbar-actions">
          <ThemeToggle :model-value="themePreference" @update:model-value="updateTheme" />
          <div class="connection-state">
            <span :class="['connection-dot', { 'is-alert': Boolean(store.monitoringError) }]"></span>
            <span>{{ store.monitoringError ? '监测连接待恢复' : '监测连接正常' }}</span>
            <button class="icon-button" type="button" title="刷新数据" @click="store.bootstrap()">
              ↻
            </button>
          </div>
          <div class="identity-menu">
            <span>{{ auth.isApiMode ? '当前账号' : '演示身份' }}</span>
            <strong>{{ auth.isApiMode ? auth.displayName : auth.roleLabel }}</strong>
            <button type="button" @click="logout">退出</button>
          </div>
        </div>
      </header>

      <div v-if="store.error" class="global-notice" role="alert">
        <span>接口提示：{{ store.error }}</span>
        <button type="button" @click="store.clearError()">关闭</button>
      </div>

      <RouterView />
    </main>
  </div>
</template>
