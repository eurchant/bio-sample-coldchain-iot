<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import { formatTime } from '../lib/format'
import { runtimeConfig } from '../services/config'
import { useAuthStore } from '../stores/auth'
import { useDeviceStore } from '../stores/device'
import type { Device } from '../types/contracts'

type DeviceForm = {
  device_id: string
  device_name: string
  model: string
}

const auth = useAuthStore()
const store = useDeviceStore()
const formOpen = ref(false)
const bindTarget = ref<Device | null>(null)
const historyTarget = ref<Device | null>(null)
const formError = ref<string | null>(null)
const bindTaskId = ref('')
const form = reactive<DeviceForm>(emptyForm())

const isApiMode = computed(() => runtimeConfig.dataSource === 'api')
const canManageDevices = computed(() => auth.role === 'sender' || auth.role === 'admin')
const dialogOpen = computed(() => formOpen.value || bindTarget.value !== null || historyTarget.value !== null)
const dialogTitle = computed(() => {
  if (formOpen.value) return '登记冷链设备'
  if (bindTarget.value) return `绑定 ${bindTarget.value.device_id}`
  return `绑定记录 ${historyTarget.value?.device_id ?? ''}`
})
const historyEntries = computed(() =>
  historyTarget.value ? store.bindingHistory[historyTarget.value.device_id] ?? [] : [],
)
const historyLoading = computed(
  () => historyTarget.value !== null && store.historyLoadingDeviceId === historyTarget.value.device_id,
)

function emptyForm(): DeviceForm {
  return { device_id: '', device_name: '', model: '' }
}

function deviceStatusLabel(device: Device) {
  const labels: Record<string, string> = {
    available: '可用',
    bound: '已绑定',
    online: '在线',
    offline: '离线',
  }
  return labels[device.status] ?? device.status
}

function deviceTone(device: Device) {
  if (device.status === 'offline') return 'danger'
  if (device.status === 'bound') return 'warning'
  if (device.status === 'available' || device.status === 'online') return 'safe'
  return 'neutral'
}

function resetForm() {
  Object.assign(form, emptyForm())
  formError.value = null
}

function openRegister() {
  bindTarget.value = null
  historyTarget.value = null
  resetForm()
  formOpen.value = true
}

function openBind(device: Device) {
  formOpen.value = false
  historyTarget.value = null
  bindTarget.value = device
  bindTaskId.value = ''
  formError.value = null
}

function openHistory(device: Device) {
  formOpen.value = false
  bindTarget.value = null
  historyTarget.value = device
  formError.value = null
  void store.loadBindings(device.device_id)
}

function closeDialog() {
  if (store.submitting) return
  formOpen.value = false
  bindTarget.value = null
  historyTarget.value = null
  bindTaskId.value = ''
  formError.value = null
}

async function submitRegister() {
  const deviceId = form.device_id.trim()
  if (!deviceId) {
    formError.value = '请填写设备编号。'
    return
  }

  const device = await store.register({
    device_id: deviceId,
    device_name: form.device_name.trim() || undefined,
    model: form.model.trim() || undefined,
  })
  if (device) closeDialog()
}

async function submitBind() {
  const taskId = bindTaskId.value.trim()
  if (!taskId) {
    formError.value = '请填写需要绑定的任务编号。'
    return
  }
  if (!bindTarget.value) return

  const binding = await store.bind(bindTarget.value.device_id, taskId)
  if (binding) closeDialog()
}

async function unbind(device: Device) {
  if (store.submitting) return
  await store.unbind(device.device_id)
}

onMounted(() => {
  if (isApiMode.value && canManageDevices.value) void store.load()
})
</script>

<template>
  <section class="page-section device-directory-page" aria-labelledby="device-directory-title">
    <header class="page-heading task-directory-heading">
      <div>
        <p class="section-kicker">03 / DEVICE LEDGER &amp; BINDING</p>
        <h2 id="device-directory-title">设备台账与任务绑定</h2>
        <p>
          设备可登记、绑定或解绑；在线状态、电量和当前任务均以服务端返回为准。设备密钥不会在浏览器中录入或保存。
        </p>
      </div>
      <div class="task-directory-actions">
        <button class="ghost-button" type="button" :disabled="store.loading || !isApiMode" @click="store.load()">
          {{ store.loading ? '同步中…' : '刷新台账' }}
        </button>
        <button v-if="isApiMode && canManageDevices" class="primary-action" type="button" @click="openRegister">
          登记设备
        </button>
      </div>
    </header>

    <p class="device-security-note" role="note">
      设备编号、名称和型号可通过当前接口登记。生产环境的 <code>device_secret</code> 必须通过受控的设备初始化流程下发，不能写入 Web 表单、前端配置或仓库。
    </p>

    <p v-if="store.error" class="global-notice" role="alert">
      <span>设备台账提示：{{ store.error }}</span>
      <button type="button" @click="store.clearError()">关闭</button>
    </p>

    <AsyncStatePanel
      v-if="store.loading && !store.devices.length"
      state="loading"
      title="正在读取设备台账"
      description="正在获取当前账号可管理的冷链设备。"
    />

    <section v-else-if="store.devices.length" class="device-directory-table" aria-label="设备台账">
      <div class="device-directory-row device-directory-head" role="row">
        <span>设备</span>
        <span>状态 / 型号</span>
        <span>当前任务</span>
        <span>电量 / 最近心跳</span>
        <span>操作</span>
      </div>
      <article v-for="device in store.devices" :key="device.device_id" class="device-directory-row" role="row">
        <div class="device-cell">
          <strong class="mono">{{ device.device_id }}</strong>
          <small>{{ device.device_name || '未命名设备' }}</small>
        </div>
        <div class="device-cell">
          <em class="status-chip" :data-tone="deviceTone(device)">{{ deviceStatusLabel(device) }}</em>
          <small>{{ device.model || '型号待登记' }}</small>
        </div>
        <div class="device-cell">
          <RouterLink
            v-if="device.current_task_id"
            class="text-link mono"
            :to="{ name: 'task-detail', params: { taskId: device.current_task_id } }"
          >
            {{ device.current_task_id }}
          </RouterLink>
          <small v-else>当前未绑定任务</small>
        </div>
        <div class="device-cell">
          <strong>{{ device.battery === null || device.battery === undefined ? '—' : `${device.battery}%` }}</strong>
          <small>{{ formatTime(device.last_seen_at) }}</small>
        </div>
        <div class="device-cell device-row-actions">
          <button class="text-link" type="button" :disabled="store.submitting" @click="openHistory(device)">
            绑定记录
          </button>
          <button
            v-if="canManageDevices && !device.current_task_id"
            class="text-link"
            type="button"
            :disabled="store.submitting"
            @click="openBind(device)"
          >
            绑定任务
          </button>
          <button
            v-else-if="canManageDevices"
            class="text-link is-danger"
            type="button"
            :disabled="store.submitting"
            @click="unbind(device)"
          >
            {{ store.submitting ? '处理中…' : '解绑' }}
          </button>
        </div>
      </article>
    </section>

    <AsyncStatePanel
      v-else
      :state="store.error ? 'error' : 'empty'"
      :title="isApiMode ? '暂无已登记设备' : '设备管理需要正式 API'"
      :description="store.error ? '设备台账读取失败，请确认后端服务和登录会话后重试。' : isApiMode ? '可先登记已有的硬件设备，再将设备绑定到具体转运任务。' : 'Mock 模式不会伪造设备登记或绑定写操作；请切换到正式 API 模式后使用。'"
      :retryable="isApiMode"
      @retry="isApiMode && store.load()"
    />

    <div v-if="dialogOpen" class="modal-backdrop" role="presentation" @click.self="closeDialog">
      <form
        v-if="formOpen"
        class="task-form-modal device-form-modal"
        aria-modal="true"
        role="dialog"
        :aria-label="dialogTitle"
        @submit.prevent="submitRegister"
      >
        <button class="modal-close" type="button" aria-label="关闭" @click="closeDialog">×</button>
        <p class="section-kicker">SERVER-BACKED DEVICE REGISTRATION</p>
        <h3>{{ dialogTitle }}</h3>
        <p>登记操作只提交后端已定义的设备编号、名称和型号；同一编号会由服务端按其既定规则更新。</p>
        <div class="task-form-grid">
          <label class="wide"><span>设备编号 *</span><input v-model="form.device_id" maxlength="80" required /></label>
          <label><span>设备名称</span><input v-model="form.device_name" maxlength="120" /></label>
          <label><span>设备型号</span><input v-model="form.model" maxlength="120" /></label>
        </div>
        <p class="device-form-secret-note">不在此页面输入设备密钥。请由硬件负责人通过受控初始化流程完成密钥配置。</p>
        <p v-if="formError || store.error" class="login-error" role="alert">{{ formError || store.error }}</p>
        <footer class="modal-actions">
          <button class="ghost-button" type="button" :disabled="store.submitting" @click="closeDialog">取消</button>
          <button class="primary-action modal-confirm" type="submit" :disabled="store.submitting">
            {{ store.submitting ? '正在登记…' : '确认登记' }}
          </button>
        </footer>
      </form>

      <form
        v-else-if="bindTarget"
        class="task-form-modal device-form-modal"
        aria-modal="true"
        role="dialog"
        :aria-label="dialogTitle"
        @submit.prevent="submitBind"
      >
        <button class="modal-close" type="button" aria-label="关闭" @click="closeDialog">×</button>
        <p class="section-kicker">SERVER-BACKED DEVICE BINDING</p>
        <h3>{{ dialogTitle }}</h3>
        <p>绑定后，后端会校验任务是否存在、当前账号是否可修改该任务，以及设备是否已绑定到其他任务。</p>
        <div class="task-form-grid">
          <label class="wide"><span>目标任务编号 *</span><input v-model="bindTaskId" maxlength="80" required placeholder="例如 TASK-001" /></label>
        </div>
        <p v-if="formError || store.error" class="login-error" role="alert">{{ formError || store.error }}</p>
        <footer class="modal-actions">
          <button class="ghost-button" type="button" :disabled="store.submitting" @click="closeDialog">取消</button>
          <button class="primary-action modal-confirm" type="submit" :disabled="store.submitting">
            {{ store.submitting ? '正在绑定…' : '确认绑定' }}
          </button>
        </footer>
      </form>

      <section
        v-else-if="historyTarget"
        class="task-form-modal device-form-modal"
        aria-modal="true"
        role="dialog"
        :aria-label="dialogTitle"
      >
        <button class="modal-close" type="button" aria-label="关闭" @click="closeDialog">×</button>
        <p class="section-kicker">SERVER-BACKED BINDING HISTORY</p>
        <h3>{{ dialogTitle }}</h3>
        <p>记录来自设备专属绑定历史接口；当前状态仍以设备台账中的“当前任务”为准。</p>
        <AsyncStatePanel
          v-if="historyLoading"
          state="loading"
          title="正在读取绑定记录"
          description="正在查询服务端的设备任务关联历史。"
          :retryable="false"
        />
        <AsyncStatePanel
          v-else-if="store.error"
          state="error"
          title="绑定记录读取失败"
          :description="store.error"
          @retry="historyTarget && store.loadBindings(historyTarget.device_id)"
        />
        <ol v-else-if="historyEntries.length" class="binding-history-list">
          <li v-for="entry in historyEntries" :key="entry.id ?? `${entry.device_id}-${entry.task_id}-${entry.bound_at}`">
            <strong class="mono">{{ entry.task_id }}</strong>
            <em class="status-chip" :data-tone="entry.status === 'bound' ? 'warning' : 'neutral'">{{ entry.status === 'bound' ? '当前绑定' : '已解绑' }}</em>
            <time>绑定：{{ formatTime(entry.bound_at) }}</time>
            <small v-if="entry.unbound_at">解绑：{{ formatTime(entry.unbound_at) }}</small>
          </li>
        </ol>
        <AsyncStatePanel
          v-else
          state="empty"
          title="暂无绑定记录"
          description="服务端暂未返回该设备的历史绑定数据。"
          :retryable="false"
        />
        <footer class="modal-actions">
          <button class="ghost-button" type="button" @click="closeDialog">关闭</button>
        </footer>
      </section>
    </div>
  </section>
</template>
