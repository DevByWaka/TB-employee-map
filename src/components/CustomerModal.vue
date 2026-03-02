<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const props = defineProps({ edgeId: String })
const emit = defineEmits(['close'])

const editMode = ref(false)
const form = reactive({ customerName: '', contactPerson: '', contactPhone: '', contactEmail: '', customerNotes: '' })

const edge = computed(() => {
  store.edgeVersion
  return props.edgeId ? store.getEdges()?.get(props.edgeId) : null
})

const info = computed(() => {
  if (!edge.value) return ''
  return `${store.getNodes()?.get(edge.value.from)?.label || '?'} → ${store.getNodes()?.get(edge.value.to)?.label || '?'}`
})

watch(() => props.edgeId, id => {
  if (!id) return
  const e = store.getEdges()?.get(id)
  if (!e) return
  editMode.value = false
  Object.assign(form, { customerName: e.customerName || '', contactPerson: e.contactPerson || '', contactPhone: e.contactPhone || '', contactEmail: e.contactEmail || '', customerNotes: e.customerNotes || '' })
}, { immediate: true })

async function save() {
  await store.saveCustomerInfo(props.edgeId, { ...form })
  editMode.value = false
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">お客様情報</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn btn-sm" :class="editMode ? 'em-mode-edit' : 'em-mode-view'" @click="editMode = !editMode">
              {{ editMode ? '👁 表示' : '✏️ 編集' }}
            </button>
            <button class="modal-close" @click="emit('close')">×</button>
          </div>
        </div>

        <div class="modal-body">
          <div style="background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: var(--em-muted);">
            <strong style="color: var(--em-text);">担当:</strong> {{ info }}
          </div>

          <!-- 表示モード -->
          <template v-if="!editMode && edge">
            <div class="view-title">お客様情報</div>
            <div class="info-grid">
              <div class="info-item full"><div class="info-label">お客様名</div><div class="info-value" :class="{ empty: !edge.customerName }">{{ edge.customerName || '未入力' }}</div></div>
              <div class="info-item full"><div class="info-label">連絡先担当者</div><div class="info-value" :class="{ empty: !edge.contactPerson }">{{ edge.contactPerson || '未入力' }}</div></div>
              <div class="info-item"><div class="info-label">電話番号</div><div class="info-value" :class="{ empty: !edge.contactPhone }">{{ edge.contactPhone || '未入力' }}</div></div>
              <div class="info-item"><div class="info-label">メールアドレス</div><div class="info-value" :class="{ empty: !edge.contactEmail }">{{ edge.contactEmail || '未入力' }}</div></div>
              <div class="info-item full"><div class="info-label">備考</div><div class="info-value" :class="{ empty: !edge.customerNotes }">{{ edge.customerNotes || '未入力' }}</div></div>
            </div>
          </template>

          <!-- 編集モード -->
          <template v-if="editMode">
            <div class="form-group"><label class="label">お客様名</label><input class="input" v-model="form.customerName"></div>
            <div class="form-group"><label class="label">連絡先担当者</label><input class="input" v-model="form.contactPerson"></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group"><label class="label">電話番号</label><input type="tel" class="input" v-model="form.contactPhone"></div>
              <div class="form-group"><label class="label">メールアドレス</label><input type="email" class="input" v-model="form.contactEmail"></div>
            </div>
            <div class="form-group"><label class="label">備考</label><textarea class="textarea" v-model="form.customerNotes" style="min-height: 70px;"></textarea></div>
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
