<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useEmployeeMapStore, calcAge, parsePhones , getNodes, getEdges} from '@/stores/employeeMap'

const store = useEmployeeMapStore()

const props = defineProps({ nodeId: String })
const emit = defineEmits(['close'])

const editMode = ref(false)

const form = reactive({
  label: '', employeeId: '', birthdate: '', gender: '', transport: '',
  phones: [''], email: '', notes: '',
  addSiteId: '', assignType: 'home', addEmpId: '',
})

const node = computed(() => {
  store.nodeVersion
  return props.nodeId ? getNodes()?.get(props.nodeId) : null
})

watch(() => props.nodeId, id => {
  if (!id) return
  const n = getNodes()?.get(id)
  if (!n) return
  editMode.value = false
  form.label = n.label
  form.employeeId = n.employeeId || ''
  form.birthdate = n.birthdate || ''
  form.gender = n.gender || ''
  form.transport = n.transport || ''
  form.phones = parsePhones(n.phone).length ? [...parsePhones(n.phone)] : ['']
  form.email = n.email || ''
  form.notes = n.notes || ''
  form.addSiteId = ''
  form.assignType = 'home'
  form.addEmpId = ''
}, { immediate: true })

const title = computed(() => {
  if (!node.value) return '詳細'
  if (node.value.group === 'employee') return '従業員 詳細'
  if (node.value.group === 'manager')  return '担当者 詳細'
  return '現場 詳細'
})

const canEdit = computed(() => store.canEdit(props.nodeId))

// ── View mode computed ──────────────────────────────────────────────────

const empHomeSites = computed(() => {
  store.edgeVersion
  if (!node.value || node.value.group !== 'employee') return []
  return getEdges().get({ filter: e => e.from === props.nodeId && (e.assignmentType || 'home') === 'home' && !e.edgeType })
    .map(e => ({ edgeId: e.id, label: getNodes().get(e.to)?.label || '?', slots: e.workingSlots || [] }))
})
const empSupportSites = computed(() => {
  store.edgeVersion
  if (!node.value || node.value.group !== 'employee') return []
  return getEdges().get({ filter: e => e.from === props.nodeId && e.assignmentType === 'support' && !e.edgeType })
    .map(e => ({ edgeId: e.id, label: getNodes().get(e.to)?.label || '?' }))
})
const siteAssignments = computed(() => {
  store.edgeVersion; store.nodeVersion
  if (!node.value || node.value.group !== 'site') return []
  return getEdges().get({ filter: e => e.to === props.nodeId && !e.edgeType })
    .sort((a, b) => ((a.assignmentType || 'home') === 'home' ? 0 : 1) - ((b.assignmentType || 'home') === 'home' ? 0 : 1))
    .map(e => {
      const emp = getNodes().get(e.from) || {}
      const age = calcAge(emp.birthdate)
      const info = [age !== null ? age + '歳' : null, emp.gender, emp.transport].filter(Boolean).join(' / ')
      return { edgeId: e.id, label: emp.label || '?', isHome: (e.assignmentType || 'home') === 'home', info }
    })
})
const managerEmployees = computed(() => {
  store.edgeVersion; store.nodeVersion
  if (!node.value || node.value.group !== 'manager') return []
  return getEdges().get({ filter: e => e.from === props.nodeId && e.edgeType === 'manages' })
    .map(e => {
      const emp = getNodes().get(e.to) || {}
      const age = calcAge(emp.birthdate)
      const info = [age !== null ? age + '歳' : null, emp.gender, emp.transport].filter(Boolean).join(' / ')
      const homeEdges = getEdges().get({ filter: e2 => e2.from === emp.id && (e2.assignmentType || 'home') === 'home' && !e2.edgeType })
      const homeNames = homeEdges.map(e2 => getNodes().get(e2.to)?.label).filter(Boolean)
      return { id: emp.id, label: emp.label || '?', info, homeNames }
    })
})
const managerSites = computed(() => {
  store.edgeVersion; store.nodeVersion
  if (!node.value || node.value.group !== 'manager') return []
  const siteMap = {}
  getEdges().get({ filter: e => e.from === props.nodeId && e.edgeType === 'manages' }).forEach(me => {
    const emp = getNodes().get(me.to)
    if (!emp) return
    getEdges().get({ filter: e2 => e2.from === emp.id && (e2.assignmentType || 'home') === 'home' && !e2.edgeType }).forEach(e2 => {
      const site = getNodes().get(e2.to); if (site) siteMap[site.id] = site
    })
  })
  return Object.values(siteMap)
})

// ── Edit mode computed ──────────────────────────────────────────────────

const editAssignments = computed(() => {
  store.edgeVersion
  if (!node.value || node.value.group !== 'employee') return []
  return getEdges().get({ filter: e => e.from === props.nodeId && !e.edgeType })
    .map(e => ({ edgeId: e.id, label: getNodes().get(e.to)?.label || '?', isHome: (e.assignmentType || 'home') === 'home' }))
})
const availableSites = computed(() => {
  store.edgeVersion; store.nodeVersion
  if (!node.value) return []
  const connected = new Set(getEdges().get({ filter: e => e.from === props.nodeId && !e.edgeType }).map(e => e.to))
  return getNodes().get({ filter: n => n.group === 'site' && !connected.has(n.id) })
})
const editManagerEmps = computed(() => {
  store.edgeVersion
  if (!node.value || node.value.group !== 'manager') return []
  return getEdges().get({ filter: e => e.from === props.nodeId && e.edgeType === 'manages' })
    .map(e => ({ edgeId: e.id, label: getNodes().get(e.to)?.label || '?' }))
})
const availableEmps = computed(() => {
  store.edgeVersion; store.nodeVersion
  if (!node.value) return []
  const managed = new Set(getEdges().get({ filter: e => e.from === props.nodeId && e.edgeType === 'manages' }).map(e => e.to))
  return getNodes().get({ filter: n => n.group === 'employee' && !managed.has(n.id) })
})

// ── Actions ─────────────────────────────────────────────────────────────

async function saveBasic() {
  if (!form.label.trim()) { alert('名前を入力してください'); return }
  await store.saveNodeBasic(props.nodeId, form.label.trim(), form.employeeId.trim())
  editMode.value = false
}
async function saveEmployee() {
  await store.saveEmployeeInfo(props.nodeId, { birthdate: form.birthdate, gender: form.gender, transport: form.transport, phones: form.phones, email: form.email, notes: form.notes })
  editMode.value = false
}
async function doAddAssignment() {
  if (!form.addSiteId) { alert('現場を選択してください'); return }
  await store.addAssignment(props.nodeId, form.addSiteId, form.assignType)
  form.addSiteId = ''
}
async function doAddManagerEmp() {
  if (!form.addEmpId) { alert('従業員を選択してください'); return }
  await store.addManagerEmployee(props.nodeId, form.addEmpId)
  form.addEmpId = ''
}
async function doDeleteNode() {
  const n = getNodes().get(props.nodeId)
  if (!confirm(`「${n.label}」を削除しますか？\n関連する配置もすべて削除されます。`)) return
  await store.deleteNode(props.nodeId)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="!editMode && emit('close')">
      <div class="modal" style="max-width: 580px;">
        <div class="modal-header">
          <div class="modal-title">{{ title }}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button v-if="canEdit" class="btn btn btn-sm" :class="editMode ? 'em-mode-edit' : 'em-mode-view'" @click="editMode = !editMode">
              {{ editMode ? '👁 表示' : '✏️ 編集' }}
            </button>
            <button class="modal-close" @click="emit('close')">×</button>
          </div>
        </div>

        <div class="modal-body" v-if="node">

          <!-- ═══ 表示モード ═══ -->
          <template v-if="!editMode">
            <div class="view-title">基本情報</div>
            <div class="info-grid">
              <div class="info-item"><div class="info-label">名前</div><div class="info-value">{{ node.label }}</div></div>
              <div class="info-item"><div class="info-label">タイプ</div><div class="info-value">{{ node.group === 'employee' ? '従業員' : node.group === 'manager' ? '担当者' : '現場' }}</div></div>
              <div v-if="node.group !== 'site'" class="info-item">
                <div class="info-label">社員ID</div>
                <div class="info-value" :class="{ empty: !node.employeeId }">{{ node.employeeId || '未入力' }}</div>
              </div>
            </div>

            <!-- 従業員情報 -->
            <template v-if="node.group === 'employee'">
              <hr class="divider">
              <div class="view-title">従業員情報</div>
              <div class="info-grid">
                <div class="info-item"><div class="info-label">生年月日</div><div class="info-value" :class="{ empty: !node.birthdate }">{{ node.birthdate || '未入力' }}</div></div>
                <div class="info-item"><div class="info-label">年齢</div><div class="info-value" :class="{ empty: calcAge(node.birthdate) === null }">{{ calcAge(node.birthdate) !== null ? calcAge(node.birthdate) + '歳' : '未入力' }}</div></div>
                <div class="info-item"><div class="info-label">性別</div><div class="info-value" :class="{ empty: !node.gender }">{{ node.gender || '未入力' }}</div></div>
                <div class="info-item"><div class="info-label">交通手段</div><div class="info-value" :class="{ empty: !node.transport }">{{ node.transport || '未入力' }}</div></div>
                <div class="info-item full">
                  <div class="info-label">電話番号</div>
                  <div v-if="parsePhones(node.phone).length"><div v-for="p in parsePhones(node.phone)" :key="p" class="info-value">{{ p }}</div></div>
                  <div v-else class="info-value empty">未入力</div>
                </div>
                <div class="info-item full"><div class="info-label">メール</div><div class="info-value" :class="{ empty: !node.email }">{{ node.email || '未入力' }}</div></div>
                <div class="info-item full"><div class="info-label">メモ</div><div class="info-value" :class="{ empty: !node.notes }">{{ node.notes || '未入力' }}</div></div>
              </div>
              <hr class="divider">
              <div class="view-title" style="color: #fb923c;">🏠 所属現場</div>
              <div v-if="!empHomeSites.length" class="no-assign">所属現場なし</div>
              <div v-for="s in empHomeSites" :key="s.edgeId" class="assign-item">
                <div style="flex: 1;">
                  <div class="assign-name">{{ s.label }}</div>
                  <template v-for="(sl, i) in s.slots.filter(sl => sl.days.length)" :key="i">
                    <div class="day-badges"><span v-for="d in sl.days" :key="d" class="day-badge">{{ d }}</span></div>
                    <div class="slot-time">{{ sl.startTime }} – {{ sl.endTime }}</div>
                    <div v-if="sl.memo" class="slot-memo">{{ sl.memo }}</div>
                  </template>
                </div>
              </div>
              <div class="view-title" style="color: #60a5fa;">🤝 応援現場</div>
              <div v-if="!empSupportSites.length" class="no-assign">応援現場なし</div>
              <div v-for="s in empSupportSites" :key="s.edgeId" class="assign-item">
                <span class="assign-name">{{ s.label }}</span>
              </div>
            </template>

            <!-- 現場配置 -->
            <template v-if="node.group === 'site'">
              <hr class="divider">
              <div class="view-title">配置状況</div>
              <div v-if="!siteAssignments.length" class="no-assign">配置なし</div>
              <div v-for="a in siteAssignments" :key="a.edgeId" class="assign-item">
                <div style="flex: 1;">
                  <span class="assign-name">{{ a.label }}</span>
                  <span :style="{ color: a.isHome ? '#60a5fa' : '#fb923c', fontSize: '11px', marginLeft: '8px' }">{{ a.isHome ? '🏠 所属' : '🤝 応援' }}</span>
                  <div v-if="a.info" style="font-size: 11px; color: var(--em-muted); margin-top: 2px;">{{ a.info }}</div>
                </div>
              </div>
            </template>

            <!-- 担当者 -->
            <template v-if="node.group === 'manager'">
              <hr class="divider">
              <div class="view-title">担当従業員</div>
              <div v-if="!managerEmployees.length" class="no-assign">担当従業員なし</div>
              <div v-for="e in managerEmployees" :key="e.id" class="assign-item">
                <div style="flex: 1;">
                  <div class="assign-name">👤 {{ e.label }}</div>
                  <div v-if="e.info" style="font-size: 11px; color: var(--em-muted);">{{ e.info }}</div>
                  <div v-if="e.homeNames.length" style="font-size: 11px; color: #60a5fa; margin-top: 2px;">🏠 {{ e.homeNames.join('、') }}</div>
                </div>
              </div>
              <hr class="divider">
              <div class="view-title">担当現場</div>
              <div v-if="!managerSites.length" class="no-assign">担当現場なし</div>
              <div v-for="s in managerSites" :key="s.id" class="assign-item"><span class="assign-name">🏗 {{ s.label }}</span></div>
            </template>
          </template>

          <!-- ═══ 編集モード ═══ -->
          <template v-else>
            <div class="view-title">基本情報</div>
            <div class="form-group"><label class="label">名前</label><input class="input" v-model="form.label"></div>
            <div v-if="node.group !== 'site'" class="form-group"><label class="label">社員ID</label><input class="input" v-model="form.employeeId"></div>
            <button class="btn btn-warn" @click="saveBasic">基本情報を変更</button>

            <!-- 従業員情報編集 -->
            <template v-if="node.group === 'employee'">
              <hr class="divider">
              <div class="view-title">従業員情報</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="form-group"><label class="label">生年月日</label><input type="date" class="input" v-model="form.birthdate"></div>
                <div class="form-group">
                  <label class="label">性別</label>
                  <select class="select" v-model="form.gender">
                    <option value="">選択</option>
                    <option>男性</option><option>女性</option><option>その他</option><option>未記入</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="label">交通手段</label>
                <select class="select" v-model="form.transport">
                  <option value="">選択</option>
                  <option>徒歩</option><option>自転車</option><option>バイク</option><option>自動車</option><option>電車</option><option>バス</option><option>その他</option>
                </select>
              </div>
              <div class="form-group">
                <label class="label">電話番号</label>
                <div v-for="(_, i) in form.phones" :key="i" style="display: flex; gap: 6px; margin-bottom: 6px;">
                  <input type="tel" class="input" v-model="form.phones[i]" style="flex: 1; margin: 0;" placeholder="">
                  <button class="btn btn-danger btn-sm" @click="form.phones.splice(i, 1)" style="margin: 0; padding: 4px 8px;">✕</button>
                </div>
                <button class="btn" @click="form.phones.push('')" style="margin-top: 4px; padding: 6px; font-size: 12px;">＋ 番号を追加</button>
              </div>
              <div class="form-group"><label class="label">メール</label><input type="email" class="input" v-model="form.email"></div>
              <div class="form-group"><label class="label">メモ</label><textarea class="textarea" v-model="form.notes" style="min-height: 60px;"></textarea></div>
              <button class="btn btn-warn" @click="saveEmployee">従業員情報を保存</button>

              <hr class="divider">
              <div class="view-title">配置の管理</div>
              <div v-if="!editAssignments.length" class="no-assign">配置なし</div>
              <div v-for="a in editAssignments" :key="a.edgeId" class="assign-item">
                <div style="flex: 1;">
                  <span class="assign-name">{{ a.label }}</span>
                  <span :style="{ color: a.isHome ? '#60a5fa' : '#fb923c', fontSize: '11px', marginLeft: '6px' }">{{ a.isHome ? '🏠 所属' : '🤝 応援' }}</span>
                </div>
                <button class="assign-del" @click="store.removeAssignment(a.edgeId)">削除</button>
              </div>
              <div class="form-group" style="margin-top: 12px;"><label class="label">現場を追加</label>
                <select class="select" v-model="form.addSiteId">
                  <option value="">選択</option>
                  <option v-for="s in availableSites" :key="s.id" :value="s.id">{{ s.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="label">配置種別</label>
                <div style="display: flex; gap: 16px; padding: 6px 0;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="radio" v-model="form.assignType" value="home" style="width: auto;"> <span style="color: #fb923c;">🏠 所属現場</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
                    <input type="radio" v-model="form.assignType" value="support" style="width: auto;"> <span style="color: #60a5fa;">🤝 応援現場</span>
                  </label>
                </div>
              </div>
              <button class="btn" @click="doAddAssignment">配置を追加</button>
            </template>

            <!-- 担当者の従業員管理 -->
            <template v-if="node.group === 'manager'">
              <hr class="divider">
              <div class="view-title">担当従業員の管理</div>
              <div v-if="!editManagerEmps.length" class="no-assign">担当従業員なし</div>
              <div v-for="e in editManagerEmps" :key="e.edgeId" class="assign-item">
                <div style="flex: 1;"><span class="assign-name">👤 {{ e.label }}</span></div>
                <button class="assign-del" @click="store.removeManagerEmployee(e.edgeId)">削除</button>
              </div>
              <div class="form-group" style="margin-top: 12px;"><label class="label">従業員を追加</label>
                <select class="select" v-model="form.addEmpId">
                  <option value="">選択</option>
                  <option v-for="e in availableEmps" :key="e.id" :value="e.id">{{ e.label }}</option>
                </select>
              </div>
              <button class="btn" @click="doAddManagerEmp">担当従業員を追加</button>
            </template>

            <!-- 現場の配置（読み取り専用） -->
            <template v-if="node.group === 'site'">
              <hr class="divider">
              <div class="view-title">配置の管理</div>
              <div v-if="!siteAssignments.length" class="no-assign">配置なし</div>
              <div v-for="a in siteAssignments" :key="a.edgeId" class="assign-item">
                <div style="flex: 1;">
                  <span class="assign-name">{{ a.label }}</span>
                  <span :style="{ color: a.isHome ? '#60a5fa' : '#fb923c', fontSize: '11px', marginLeft: '8px' }">{{ a.isHome ? '🏠 所属' : '🤝 応援' }}</span>
                </div>
              </div>
            </template>
          </template>
        </div>

        <div class="modal-footer">
          <button v-if="editMode && store.isAdmin" class="btn btn-danger" @click="doDeleteNode" style="margin-right: auto;">🗑️ このノードを削除</button>
          <button class="btn btn-red" @click="emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
