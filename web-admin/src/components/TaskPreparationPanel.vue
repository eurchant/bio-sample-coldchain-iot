<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { runtimeConfig } from '../services/config'
import { useTaskPreparationStore } from '../stores/taskPreparation'
import type { Task } from '../types/contracts'

const props = defineProps<{
  task: Task
  canManage: boolean
}>()

const emit = defineEmits<{ updated: [task: Task] }>()
const preparation = useTaskPreparationStore()
const selectedCarrierId = ref<number | null>(props.task.carrier_user_id ?? null)
const selectedReceiverId = ref<number | null>(props.task.receiver_user_id ?? null)
const precheckTemperature = ref<number | null>(props.task.precheck_temperature ?? null)
const precheckSealOk = ref(props.task.precheck_seal_ok ?? true)
const precheckNote = ref(props.task.precheck_note ?? '')
const precheckPassed = ref(true)

const isApiMode = computed(() => runtimeConfig.dataSource === 'api')
const canPrepare = computed(
  () => props.canManage && ['pending_pack', 'pending_handoff'].includes(props.task.status),
)
const hasBothAssignments = computed(() => Boolean(props.task.carrier_user_id && props.task.receiver_user_id))
const hasPassedPrecheck = computed(() => props.task.precheck_passed === true)

function syncForm(task: Task) {
  selectedCarrierId.value = task.carrier_user_id ?? null
  selectedReceiverId.value = task.receiver_user_id ?? null
  precheckTemperature.value = task.precheck_temperature ?? null
  precheckSealOk.value = task.precheck_seal_ok ?? true
  precheckNote.value = task.precheck_note ?? ''
}

async function loadCandidates() {
  if (canPrepare.value) await preparation.loadCandidates()
}

async function submitAssignment() {
  if (!selectedCarrierId.value || !selectedReceiverId.value) {
    preparation.error = '请同时选择承运方与接收方，再提交指派。'
    return
  }
  const task = await preparation.assign(props.task.task_id, {
    carrier_user_id: selectedCarrierId.value,
    receiver_user_id: selectedReceiverId.value,
  })
  if (task) emit('updated', task)
}

async function submitPrecheck() {
  const task = await preparation.precheck(props.task.task_id, {
    passed: precheckPassed.value,
    temperature: precheckTemperature.value,
    seal_ok: precheckSealOk.value,
    note: precheckNote.value.trim() || null,
  })
  if (task) emit('updated', task)
}

onMounted(loadCandidates)
watch(() => props.task, syncForm, { deep: true })
watch(canPrepare, (allowed) => {
  if (allowed) void loadCandidates()
})
</script>

<template>
  <article class="panel preparation-panel">
    <div class="card-heading">
      <div>
        <p class="section-kicker">DISPATCH PREREQUISITES</p>
        <h3>发出前准备</h3>
      </div>
      <span class="guarded-label">后端强校验</span>
    </div>
    <p class="preparation-intro">
      后端要求先指派承运方、接收方并完成装箱预检；未满足时“发出交接”会被拒绝。
    </p>

    <div class="preparation-checklist" aria-label="发出条件">
      <span :class="{ complete: hasBothAssignments }">{{ hasBothAssignments ? '✓' : '○' }} 已指派双方人员</span>
      <span :class="{ complete: hasPassedPrecheck }">{{ hasPassedPrecheck ? '✓' : '○' }} 装箱预检已通过</span>
    </div>

    <p v-if="!isApiMode" class="preparation-hint">Mock 模式不写入准备数据。切换至实时 API 后可使用正式流程。</p>
    <p v-else-if="!canManage" class="preparation-hint">仅任务发出方或管理员可配置此任务的发出前准备。</p>

    <template v-else>
      <div class="preparation-grid">
        <label>
          <span>承运方</span>
          <select v-model="selectedCarrierId" :disabled="preparation.loadingCandidates || !canPrepare">
            <option :value="null">请选择承运方</option>
            <option v-for="user in preparation.carriers" :key="user.user_id" :value="user.user_id">
              {{ user.display_name || user.name }} · {{ user.organization }}
            </option>
          </select>
        </label>
        <label>
          <span>接收方</span>
          <select v-model="selectedReceiverId" :disabled="preparation.loadingCandidates || !canPrepare">
            <option :value="null">请选择接收方</option>
            <option v-for="user in preparation.receivers" :key="user.user_id" :value="user.user_id">
              {{ user.display_name || user.name }} · {{ user.organization }}
            </option>
          </select>
        </label>
      </div>
      <button class="secondary-action compact-action" type="button" :disabled="!canPrepare || preparation.actionLoading !== null" @click="submitAssignment">
        {{ preparation.actionLoading === 'assign' ? '正在提交指派…' : '提交双方指派' }}
      </button>

      <div class="precheck-form">
        <label class="precheck-switch"><input v-model="precheckPassed" type="checkbox" :disabled="!canPrepare" /> 预检通过</label>
        <label>
          <span>预检温度（°C，可选）</span>
          <input v-model.number="precheckTemperature" type="number" step="0.1" :disabled="!canPrepare" />
        </label>
        <label class="precheck-switch"><input v-model="precheckSealOk" type="checkbox" :disabled="!canPrepare" /> 封签完好</label>
        <label class="precheck-note">
          <span>预检说明（可选）</span>
          <input v-model="precheckNote" maxlength="300" :disabled="!canPrepare" placeholder="例如：封签完整，温度符合要求" />
        </label>
      </div>
      <button class="primary-action compact-action" type="button" :disabled="!canPrepare || preparation.actionLoading !== null" @click="submitPrecheck">
        {{ preparation.actionLoading === 'precheck' ? '正在记录预检…' : '记录装箱预检' }}
      </button>
    </template>

    <p v-if="preparation.error" class="inline-feedback danger" role="alert">{{ preparation.error }}</p>
    <p v-else-if="preparation.message" class="inline-feedback success" role="status">{{ preparation.message }}</p>
  </article>
</template>

<style scoped>
.preparation-panel { margin-top: 1rem; }
.preparation-intro, .preparation-hint { color: var(--ink-muted); font-size: .88rem; line-height: 1.65; }
.preparation-checklist { display:flex; flex-wrap:wrap; gap:.55rem 1rem; margin:.85rem 0; font-size:.85rem; color:var(--ink-muted); }
.preparation-checklist .complete { color:var(--accent-strong); font-weight:700; }
.preparation-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }
label { display:grid; gap:.35rem; color:var(--ink-muted); font-size:.78rem; }
select,input { width:100%; min-height:2.35rem; box-sizing:border-box; border:1px solid var(--line); border-radius:.35rem; background:var(--panel-soft); color:var(--ink); padding:.4rem .55rem; }
.compact-action { min-height:2.5rem; margin-top:.75rem; padding:.55rem .9rem; }
.precheck-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.7rem; margin-top:1rem; }
.precheck-switch { display:flex; align-items:center; gap:.45rem; min-height:2.35rem; }
.precheck-switch input { width:auto; min-height:auto; }
.precheck-note { grid-column:span 2; }
.inline-feedback { margin:.8rem 0 0; font-size:.86rem; line-height:1.5; }
.danger { color:var(--danger); }.success { color:var(--accent-strong); }
@media (max-width:700px) { .preparation-grid,.precheck-form { grid-template-columns:1fr; }.precheck-note { grid-column:auto; } }
</style>
