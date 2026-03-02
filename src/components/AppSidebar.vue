<script setup>
import { ref, computed } from 'vue'
import { useEmployeeMapStore, parsePhones } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
defineProps({ networkRef: Object })
const emit = defineEmits(['openSettings', 'openAdmin', 'openAddManager'])

const newEmployeeName = ref('')
const newSiteName     = ref('')
const searchQuery     = ref('')
const statsOpen       = ref(false)

const visState = ref({
  employee: true, site: true, manager: true,
  home: true, support: true, manages: true, 'manager-site': true,
})

const employeeCount = computed(() => { store.nodeVersion; return store.getNodes()?.get({ filter: n => n.group === 'employee' }).length ?? 0 })
const siteCount     = computed(() => { store.nodeVersion; return store.getNodes()?.get({ filter: n => n.group === 'site' }).length ?? 0 })
const managerCount  = computed(() => { store.nodeVersion; return store.getNodes()?.get({ filter: n => n.group === 'manager' }).length ?? 0 })

const dbStatusDot = computed(() => {
  const s = store.dbStatus
  if (s === 'connected')   return '#22c55e'
  if (s === 'syncing')     return '#f59e0b'
  if (s === 'error')       return '#ef4444'
  return '#64748b'
})
const dbStatusText = computed(() => {
  const s = store.dbStatus
  if (s === 'connected') return '接続中'
  if (s === 'syncing')   return '同期中...'
  if (s === 'error')     return 'DB接続エラー'
  return 'DB未接続'
})
const dbStatusColor = computed(() => {
  const s = store.dbStatus
  if (s === 'connected') return '#86efac'
  if (s === 'syncing')   return '#fcd34d'
  if (s === 'error')     return '#fca5a5'
  return 'var(--em-muted)'
})

const searchHits = computed(() => {
  store.nodeVersion
  const q = searchQuery.value.trim().toLowerCase()
  if (!q || !store.getNodes()) return []
  const fieldLabels = { label: '名前', employeeId: '社員ID', phone: '電話', email: 'メール', notes: 'メモ', gender: '性別', transport: '交通手段' }
  const result = []
  store.getNodes().forEach(node => {
    const fields = node.group === 'site' ? ['label'] : ['label', 'employeeId', 'phone', 'email', 'notes', 'gender', 'transport']
    for (const field of fields) {
      const val = field === 'phone' ? parsePhones(node.phone).join(' ').toLowerCase() : (node[field] || '').toLowerCase()
      if (val && val.includes(q)) {
        result.push({ node, matchField: fieldLabels[field], sub: field === 'phone' ? parsePhones(node.phone).join(', ') : (node[field] || '') })
        break
      }
    }
  })
  return result
})

function groupLabel(g) { return g === 'employee' ? '従業員' : g === 'manager' ? '担当者' : '現場' }

function focusNode(nodeId) {
  // networkRef.focusNode を呼ぶ
  const nr = defineProps.networkRef
}

function toggleVis(key) {
  visState.value[key] = !visState.value[key]
  const visible = visState.value[key]
  const nodes = store.getNodes()
  const edges = store.getEdges()
  if (!nodes || !edges) return
  if (['employee', 'site', 'manager'].includes(key)) {
    nodes.update(nodes.get({ filter: n => n.group === key }).map(n => ({ id: n.id, hidden: !visible })))
    const hiddenIds = new Set(nodes.get({ filter: n => n.hidden }).map(n => n.id))
    edges.update(edges.get().map(e => ({ id: e.id, hidden: hiddenIds.has(e.from) || hiddenIds.has(e.to) })))
  } else {
    edges.update(edges.get({ filter: e => {
      if (key === 'home')         return !e.edgeType && (e.assignmentType || 'home') === 'home'
      if (key === 'support')      return !e.edgeType && e.assignmentType === 'support'
      if (key === 'manages')      return e.edgeType === 'manages'
      if (key === 'manager-site') return e.edgeType === 'manager-site'
      return false
    }}).map(e => ({ id: e.id, hidden: !visible })))
  }
}

function nodeColor(key) {
  return key === 'employee' ? '#2563eb' : key === 'site' ? '#dc2626' : '#16a34a'
}
function nodeBtnStyle(key) {
  const c = key === 'employee' ? '37,99,235' : key === 'site' ? '220,38,38' : '22,163,74'
  return `background:rgba(${c},.25);border:1px solid rgba(${c},.5);`
}

async function doAddEmployee() {
  const name = newEmployeeName.value.trim()
  if (!name) { alert('従業員名を入力してください'); return }
  await store.addEmployee(name)
  newEmployeeName.value = ''
}
async function doAddSite() {
  const name = newSiteName.value.trim()
  if (!name) { alert('現場名を入力してください'); return }
  await store.addSite(name)
  newSiteName.value = ''
}
</script>

<template>
  <aside class="em-sidebar">
    <div class="em-logo">従業員配置マップ</div>
    <div class="em-subtitle">EMPLOYEE ALLOCATION</div>

    <!-- ユーザーバー -->
    <div class="em-status" style="margin-bottom:8px;">
      <span class="em-status-dot" style="background:#22c55e;"></span>
      <div style="min-width:0;flex:1;">
        <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;">{{ store.currentUser?.label }}</div>
        <div style="font-size:10px;color:var(--em-muted);">{{ store.isAdmin ? '管理者 👑' : '担当者' }}</div>
      </div>
      <button v-if="store.isAdmin" class="em-btn em-btn-sm" @click="emit('openAdmin')"
        style="margin:0;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.4);">👑</button>
      <button class="em-btn em-btn-sm em-btn-ghost" @click="store.signOut()" style="margin:0;">⏻</button>
    </div>

    <!-- DB状態 -->
    <div class="em-status">
      <span class="em-status-dot" :style="{ background: dbStatusDot }"></span>
      <span :style="{ color: dbStatusColor, fontSize: '12px' }">{{ dbStatusText }}</span>
    </div>

    <!-- 表示切替 -->
    <div class="em-section">
      <div class="em-section-title">表示切替</div>
      <div class="em-vis-label">ノード</div>
      <div class="em-vis-group cols-3" style="margin-bottom:8px;">
        <button v-for="vk in ['employee','site','manager']" :key="vk"
          class="em-btn em-vis-btn" :class="{ off: !visState[vk] }"
          :style="nodeBtnStyle(vk)" @click="toggleVis(vk)">
          <span class="em-dot8" :style="{ background: nodeColor(vk) }"></span>
          {{ { employee:'従業員', site:'現場', manager:'担当者' }[vk] }}
        </button>
      </div>
      <div class="em-vis-label">接続線</div>
      <div class="em-vis-group cols-2">
        <button class="em-btn em-vis-btn" :class="{ off: !visState.home }" @click="toggleVis('home')"
          style="background:rgba(249,115,22,.2);border:1px solid rgba(249,115,22,.5);">
          <span class="em-line" style="border-top:2px solid #f97316;"></span>所属
        </button>
        <button class="em-btn em-vis-btn" :class="{ off: !visState.support }" @click="toggleVis('support')"
          style="background:rgba(59,130,246,.2);border:1px solid rgba(59,130,246,.5);">
          <span class="em-line" style="border-top:2px dashed #3b82f6;"></span>応援
        </button>
        <button class="em-btn em-vis-btn" :class="{ off: !visState.manages }" @click="toggleVis('manages')"
          style="background:rgba(226,232,240,.1);border:1px solid rgba(226,232,240,.3);">
          <span class="em-line" style="border-top:2px dotted #e2e8f0;"></span>担当
        </button>
        <button class="em-btn em-vis-btn" :class="{ off: !visState['manager-site'] }" @click="toggleVis('manager-site')"
          style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.5);">
          <span class="em-line" style="border-top:2px dashed #16a34a;"></span>担当現場
        </button>
      </div>
    </div>

    <!-- 検索 -->
    <div class="em-section">
      <div class="em-section-title">🔍 検索</div>
      <input class="em-input" v-model="searchQuery" placeholder="" />
      <div v-if="searchQuery" style="margin-top:8px;">
        <div v-if="!searchHits.length" class="em-no-result">該当なし</div>
        <div v-for="hit in searchHits" :key="hit.node.id" class="em-search-item"
          @click="networkRef?.focusNode(hit.node.id)">
          <span class="em-badge" :class="hit.node.group">{{ groupLabel(hit.node.group) }}</span>
          <div style="flex:1;min-width:0;">
            <div class="em-search-name">{{ hit.node.label }}</div>
            <div v-if="hit.matchField !== '名前'" class="em-search-sub">{{ hit.matchField }}: {{ hit.sub }}</div>
          </div>
          <span class="em-search-field">{{ hit.matchField }}</span>
        </div>
      </div>
    </div>

    <!-- 従業員追加 -->
    <div class="em-section">
      <div class="em-section-title">従業員を追加</div>
      <div class="em-form-group">
        <label class="em-label">従業員名</label>
        <input class="em-input" v-model="newEmployeeName" placeholder="" @keydown.enter="doAddEmployee" />
      </div>
      <button class="em-btn" @click="doAddEmployee">従業員を追加</button>
    </div>

    <!-- 現場追加 -->
    <div class="em-section">
      <div class="em-section-title">現場を追加</div>
      <div class="em-form-group">
        <label class="em-label">現場名</label>
        <input class="em-input" v-model="newSiteName" placeholder="" @keydown.enter="doAddSite" />
      </div>
      <button class="em-btn" @click="doAddSite">現場を追加</button>
    </div>

    <!-- 担当者追加（管理者のみ） -->
    <div class="em-section" v-if="store.isAdmin">
      <div class="em-section-title">担当者を追加</div>
      <button class="em-btn" @click="emit('openAddManager')">担当者を追加</button>
    </div>

    <!-- 統計 -->
    <div class="em-section">
      <div class="em-section-title clickable" @click="statsOpen = !statsOpen">
        統計情報 <span style="margin-left:auto;font-size:10px;">{{ statsOpen ? '▼' : '▶' }}</span>
      </div>
      <div v-if="statsOpen" class="em-stats">
        <div class="em-stat"><div class="em-stat-num">{{ employeeCount }}</div><div class="em-stat-lbl">従業員</div></div>
        <div class="em-stat"><div class="em-stat-num">{{ siteCount }}</div><div class="em-stat-lbl">現場</div></div>
        <div class="em-stat"><div class="em-stat-num">{{ managerCount }}</div><div class="em-stat-lbl">担当者</div></div>
      </div>
    </div>

    <!-- 設定 -->
    <div style="padding-top:14px;display:flex;align-items:center;justify-content:space-between;">
      <button class="em-btn em-btn-sm em-btn-ghost" @click="emit('openSettings')" style="margin:0;">⚙️ 設定</button>
      <span style="font-size:11px;color:#334155;font-family:'IBM Plex Mono',monospace;">v2.0</span>
    </div>
  </aside>
</template>
