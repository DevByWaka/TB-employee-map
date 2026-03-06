<script setup>
import { ref, computed, watch } from 'vue'
import { useEmployeeMapStore , getNodes, getEdges} from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const props = defineProps({ edgeId: String })
const emit = defineEmits(['close'])

const editMode = ref(false)
const editSlots = ref([])

const edge = computed(() => {
  store.edgeVersion
  return props.edgeId ? getEdges()?.get(props.edgeId) : null
})

const edgeInfo = computed(() => {
  if (!edge.value) return ''
  const from = getNodes()?.get(edge.value.from)?.label || '?'
  const to   = getNodes()?.get(edge.value.to)?.label || '?'
  const badge = edge.value.edgeType === 'manages'
    ? '<span style="font-size:11px;color:#22c55e;">（担当）</span>'
    : edge.value.assignmentType === 'support'
      ? '<span style="font-size:11px;color:#fb923c;">🤝 応援</span>'
      : '<span style="font-size:11px;color:#60a5fa;">🏠 所属</span>'
  return `${from} → ${to} ${badge}`
})

const canEdit = computed(() => store.canEditEdge(props.edgeId))
const validSlots = computed(() => (edge.value?.workingSlots || []).filter(s => s.days.length > 0))

watch(() => props.edgeId, () => { editMode.value = false; editSlots.value = [] })

function startEdit() {
  const e = getEdges()?.get(props.edgeId)
  editSlots.value = e?.workingSlots?.length
    ? JSON.parse(JSON.stringify(e.workingSlots))
    : [{ days: [], startTime: '09:00', endTime: '18:00', memo: '' }]
  editMode.value = true
}
function removeSlot(i) {
  if (editSlots.value.length === 1) { alert('最低1つの時間帯が必要です'); return }
  editSlots.value.splice(i, 1)
}
async function save() {
  if (!editSlots.value.some(s => s.days.length > 0)) { alert('少なくとも1つの時間帯に曜日を選択してください'); return }
  await store.saveEdgeSlots(props.edgeId, editSlots.value)
  editMode.value = false
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">配置情報</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button v-if="canEdit" class="btn btn btn-sm" :class="editMode ? 'em-mode-edit' : 'em-mode-view'"
              @click="editMode ? editMode = false : startEdit()">
              {{ editMode ? '👁 表示' : '✏️ 編集' }}
            </button>
            <button class="modal-close" @click="emit('close')">×</button>
          </div>
        </div>

        <div class="modal-body">
          <div style="background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: var(--em-muted);">
            <strong style="color: var(--em-text);">配置:</strong>
            <span v-html="edgeInfo"></span>
          </div>

          <!-- 表示モード -->
          <template v-if="!editMode">
            <div class="view-title">勤務時間帯</div>
            <div v-if="!validSlots.length" class="no-assign">未設定</div>
            <div v-for="(slot, i) in validSlots" :key="i" class="slot-view">
              <div style="font-size: 11px; font-weight: 600; color: var(--em-muted); margin-bottom: 8px;">時間帯 {{ i + 1 }}</div>
              <div class="day-badges"><span v-for="d in slot.days" :key="d" class="day-badge">{{ d }}</span></div>
              <div class="slot-time">{{ slot.startTime }} – {{ slot.endTime }}</div>
              <div v-if="slot.memo" class="slot-memo">📝 {{ slot.memo }}</div>
            </div>
          </template>

          <!-- 編集モード -->
          <template v-else>
            <div class="view-title">勤務時間帯</div>
            <div v-for="(slot, i) in editSlots" :key="i" class="slot-edit">
              <div class="slot-head">
                <span class="slot-num">時間帯 {{ i + 1 }}</span>
                <button class="slot-del" @click="removeSlot(i)">削除</button>
              </div>
              <div class="form-group">
                <label class="label">勤務可能曜日</label>
                <div class="days-sel">
                  <label v-for="d in ['月','火','水','木','金','土','日']" :key="d" class="day-cb">
                    <input type="checkbox" :value="d" v-model="slot.days"> {{ d }}
                  </label>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group"><label class="label">開始時刻</label><input type="time" class="input" v-model="slot.startTime"></div>
                <div class="form-group"><label class="label">終了時刻</label><input type="time" class="input" v-model="slot.endTime"></div>
              </div>
              <div class="form-group"><label class="label">メモ</label><textarea class="textarea" v-model="slot.memo" style="min-height: 50px;"></textarea></div>
            </div>
            <button class="btn" @click="editSlots.push({ days: [], startTime: '09:00', endTime: '18:00', memo: '' })">
              勤務時間帯を追加
            </button>
          </template>
        </div>

        <div class="modal-footer">
          <button class="btn btn-red" @click="emit('close')">閉じる</button>
          <button v-if="editMode" class="btn btn-warn" @click="save">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
