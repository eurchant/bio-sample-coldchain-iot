<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AsyncStatePanel from '../components/AsyncStatePanel.vue'
import { formatTime, statusTone, taskLabel } from '../lib/format'
import { runtimeConfig } from '../services/config'
import { useAuthStore } from '../stores/auth'
import { useTaskDirectoryStore } from '../stores/taskDirectory'
import type { CreateTaskInput, Task, TaskStatus } from '../types/contracts'

type TaskForm = {
  sample_name: string
  batch: string
  receiver: string
  carrier: string
  expected_arrival: string
  box_id: string
  seal_id: string
  temperature_min: string
  temperature_max: string
}

const STATUS_OPTIONS: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'pending_pack', label: '待发出' },
  { value: 'pending_handoff', label: '待交接' },
  { value: 'in_transit', label: '运输中' },
  { value: 'arrived', label: '已到达' },
  { value: 'signed', label: '已签收' },
  { value: 'rejected', label: '已拒收' },
  { value: 'canceled', label: '已取消' },
]

const router = useRouter()
const auth = useAuthStore()
const store = useTaskDirectoryStore()
const keyword = ref('')
const selectedStatus = ref<TaskStatus | ''>('')
const formOpen = ref(false)
const editingTask = ref<Task | null>(null)
const formError = ref<string | null>(null)
const form = reactive<TaskForm>(emptyForm())

const isApiMode = computed(() => runtimeConfig.dataSource === 'api')
const canManageTasks = computed(() => auth.role === 'sender' || auth.role === 'admin')
const formTitle = computed(() => (editingTask.value ? `编辑 ${editingTask.value.task_id}` : '创建转运任务'))
const submittingLabel = computed(() => (editingTask.value ? '正在保存…' : '正在创建…'))

function emptyForm(): TaskForm {
  return {
    sample_name: '',
    batch: '',
    receiver: '',
    carrier: '',
    expected_arrival: '',
    box_id: '',
    seal_id: '',
    temperature_min: '',
    temperature_max: '',
  }
}

function resetForm(task: Task | null = null) {
  Object.assign(form, {
    sample_name: task?.sample_name ?? '',
    batch: task?.batch ?? '',
    receiver: task?.receiver ?? '',
    carrier: task?.carrier ?? '',
    expected_arrival: task?.expected_arrival ? task.expected_arrival.slice(0, 16) : '',
    box_id: task?.box_id ?? '',
    seal_id: task?.seal_id ?? '',
    temperature_min: task?.temperature_min?.toString() ?? '',
    temperature_max: task?.temperature_max?.toString() ?? '',
  })
  formError.value = null
}

function openCreate() {
  editingTask.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(task: Task) {
  editingTask.value = task
  resetForm(task)
  formOpen.value = true
}

function closeForm() {
  if (store.submitting) return
  formOpen.value = false
  editingTask.value = null
  formError.value = null
}

function numberOrUndefined(value: string, label: string) {
  if (!value.trim()) return undefined
  const result = Number(value)
  if (!Number.isFinite(result)) throw new Error(`${label}必须是有效数字。`)
  return result
}

function trimOrUndefined(value: string) {
  const result = value.trim()
  return result || undefined
}

function buildInput(): CreateTaskInput {
  const sampleName = form.sample_name.trim()
  if (!sampleName) throw new Error('请填写样本名称。')

  const temperatureMin = numberOrUndefined(form.temperature_min, '最低温度')
  const temperatureMax = numberOrUndefined(form.temperature_max, '最高温度')
  if (temperatureMin !== undefined && temperatureMax !== undefined && temperatureMin > temperatureMax) {
    throw new Error('最低温度不能大于最高温度。')
  }

  return {
    sample_name: sampleName,
    batch: trimOrUndefined(form.batch),
    receiver: trimOrUndefined(form.receiver),
    carrier: trimOrUndefined(form.carrier),
    expected_arrival: form.expected_arrival ? new Date(form.expected_arrival).toISOString() : undefined,
    box_id: trimOrUndefined(form.box_id),
    seal_id: trimOrUndefined(form.seal_id),
    temperature_min: temperatureMin,
    temperature_max: temperatureMax,
  }
}

async function submitForm() {
  try {
    formError.value = null
    const input = buildInput()
    const task = editingTask.value
      ? await store.update(editingTask.value.task_id, input)
      : await store.create(input)
    if (!task) return
    closeForm()
    await router.push({ name: 'task-detail', params: { taskId: task.task_id } })
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '表单校验失败。'
  }
}

async function applyFilters() {
  await store.setFilters({
    keyword: keyword.value,
    status: selectedStatus.value || undefined,
  })
}

function openTask(task: Task) {
  void router.push({ name: 'task-detail', params: { taskId: task.task_id } })
}

onMounted(() => {
  void store.load()
})
</script>

<template>
  <section class="page-section task-directory-page" aria-labelledby="task-directory-title">
    <header class="page-heading task-directory-heading">
      <div>
        <p class="section-kicker">01 / AUTHORIZED TRANSIT QUEUE</p>
        <h2 id="task-directory-title">我的转运任务</h2>
        <p v-if="isApiMode">仅展示当前后端账号有权限访问的任务；任务状态和权限由服务端判定。</p>
        <p v-else>离线 Mock 模式只展示配置的演示任务，不会提交创建或编辑操作。</p>
      </div>
      <div class="task-directory-actions">
        <button class="ghost-button" type="button" :disabled="store.loading" @click="store.load()">
          {{ store.loading ? '同步中…' : '刷新列表' }}
        </button>
        <button
          v-if="isApiMode && canManageTasks"
          class="primary-action"
          type="button"
          @click="openCreate"
        >
          新建任务
        </button>
      </div>
    </header>

    <section class="task-filter-panel" aria-label="任务筛选">
      <label>
        <span>关键词</span>
        <input v-model="keyword" maxlength="120" placeholder="任务编号、样本或批次" @keyup.enter="applyFilters" />
      </label>
      <label>
        <span>状态</span>
        <select v-model="selectedStatus" @change="applyFilters">
          <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
      <button class="filter-submit" type="button" :disabled="store.loading" @click="applyFilters">筛选</button>
      <span class="task-filter-total">共 {{ store.result.total }} 项</span>
    </section>

    <p v-if="store.error" class="global-notice" role="alert">
      <span>任务列表提示：{{ store.error }}</span>
      <button type="button" @click="store.clearError()">关闭</button>
    </p>

    <AsyncStatePanel
      v-if="store.loading && !store.tasks.length"
      state="loading"
      title="正在读取授权任务"
      description="正在根据当前账号、筛选条件和分页参数向后端查询。"
    />

    <section v-else-if="store.tasks.length" class="task-directory-table" aria-label="转运任务列表">
      <div class="task-directory-row task-directory-head" role="row">
        <span>任务 / 样本</span>
        <span>来源 / 去向</span>
        <span>设备 / 箱体</span>
        <span>状态</span>
        <span>最近更新</span>
        <span>操作</span>
      </div>
      <article v-for="task in store.tasks" :key="task.task_id" class="task-directory-row" role="row">
        <button class="task-cell task-identity" type="button" @click="openTask(task)">
          <strong class="mono">{{ task.task_id }}</strong>
          <small>{{ task.sample_name }}</small>
          <em v-if="task.batch">批次 {{ task.batch }}</em>
        </button>
        <div class="task-cell task-route-summary">
          <strong>{{ task.sender }}</strong>
          <span>→</span>
          <strong>{{ task.receiver || '待指定接收方' }}</strong>
          <small>承运：{{ task.carrier || '待指定' }}</small>
        </div>
        <div class="task-cell">
          <strong class="mono">{{ task.device_id || '未绑定' }}</strong>
          <small>{{ task.box_id || '未登记箱体' }}</small>
        </div>
        <div class="task-cell">
          <em class="status-chip" :data-tone="statusTone(task.status)">{{ taskLabel(task.status) }}</em>
          <small v-if="task.abnormal_count">{{ task.abnormal_count }} 项异常</small>
        </div>
        <div class="task-cell"><time>{{ formatTime(task.updated_at) }}</time></div>
        <div class="task-cell task-row-actions">
          <button type="button" class="text-link" @click="openTask(task)">查看</button>
          <button
            v-if="isApiMode && canManageTasks && ['pending_pack', 'pending_handoff'].includes(task.status)"
            type="button"
            class="text-link"
            @click="openEdit(task)"
          >
            编辑
          </button>
        </div>
      </article>
    </section>

    <AsyncStatePanel
      v-else
      :state="store.error ? 'error' : 'empty'"
      title="没有可展示的任务"
      :description="isApiMode ? '当前账号尚未拥有任务，或筛选条件没有匹配结果。' : '请检查 Mock 任务配置后重新读取。'"
      @retry="store.load()"
    />

    <nav v-if="store.result.total > store.result.page_size" class="task-pagination" aria-label="任务分页">
      <button type="button" :disabled="store.loading || store.result.page <= 1" @click="store.goToPage(store.result.page - 1)">上一页</button>
      <span>第 {{ store.result.page }} / {{ store.totalPages }} 页</span>
      <button type="button" :disabled="store.loading || store.result.page >= store.totalPages" @click="store.goToPage(store.result.page + 1)">下一页</button>
    </nav>

    <div v-if="formOpen" class="modal-backdrop" role="presentation" @click.self="closeForm">
      <form class="task-form-modal" aria-modal="true" role="dialog" :aria-label="formTitle" @submit.prevent="submitForm">
        <button class="modal-close" type="button" aria-label="关闭" @click="closeForm">×</button>
        <p class="section-kicker">SERVER-BACKED TASK FORM</p>
        <h3>{{ formTitle }}</h3>
        <p>仅提交后端已定义的任务字段；创建请求会带一次性幂等键，避免网络重试重复建单。设备请在“设备台账”中通过专用绑定接口关联，避免出现任务与设备状态不一致。</p>
        <div class="task-form-grid">
          <label class="wide"><span>样本名称 *</span><input v-model="form.sample_name" maxlength="120" required /></label>
          <label><span>批次</span><input v-model="form.batch" maxlength="80" /></label>
          <label><span>预期到达</span><input v-model="form.expected_arrival" type="datetime-local" /></label>
          <label><span>接收单位</span><input v-model="form.receiver" maxlength="120" /></label>
          <label><span>承运人员 / 单位</span><input v-model="form.carrier" maxlength="120" /></label>
          <label><span>箱体编号</span><input v-model="form.box_id" maxlength="80" /></label>
          <label><span>封签编号</span><input v-model="form.seal_id" maxlength="80" /></label>
          <label><span>最低温度（°C）</span><input v-model="form.temperature_min" inputmode="decimal" /></label>
          <label><span>最高温度（°C）</span><input v-model="form.temperature_max" inputmode="decimal" /></label>
        </div>
        <p v-if="formError || store.error" class="login-error" role="alert">{{ formError || store.error }}</p>
        <footer class="modal-actions">
          <button class="ghost-button" type="button" :disabled="store.submitting" @click="closeForm">取消</button>
          <button class="primary-action modal-confirm" type="submit" :disabled="store.submitting">
            {{ store.submitting ? submittingLabel : editingTask ? '保存修改' : '创建并打开任务' }}
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>
