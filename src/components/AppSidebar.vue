<script setup>
import { ref, computed } from 'vue'
import { useEmployeeMapStore, getNodes, getEdges, parsePhones } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const props = defineProps({ networkRef: Object })
const emit  = defineEmits(['openSettings', 'openAdmin', 'openAddManager'])

const newEmployeeName = ref('')
const newSiteName     = ref('')
const searchQuery     = ref('')
const statsOpen       = ref(false)

// 表示状態（true = 表示中）
const vis = ref({
  employee: true, site: true, manager: true,
  home: true, support: true, manages: true, 'manager-site': true,
})

// ── 統計 ──
const empCount = computed(() => { store.nodeVersion; return getNodes()?.get({ filter: n => n.group === 'employee' }).length ?? 0 })
const siteCount = computed(() => { store.nodeVersion; return getNodes()?.get({ filter: n => n.group === 'site' }).length ?? 0 })
const mgrCount  = computed(() => { store.nodeVersion; return getNodes()?.get({ filter: n => n.group === 'manager' }).length ?? 0 })

// ── DB状態 ──
const dotColor = computed(() => ({ connected: '#22c55e', syncing: '#f59e0b', error: '#ef4444' })[store.dbStatus] ?? '#64748b')
const statusText  = computed(() => ({ connected: '接続中', syncing: '同期中...', error: 'DB接続エラー' })[store.dbStatus] ?? 'DB未接続')
const statusColor = computed(() => ({ connected: '#86efac', syncing: '#fcd34d', error: '#fca5a5' })[store.dbStatus] ?? 'var(--muted)')

// ── 検索 ──
const hits = computed(() => {
  store.nodeVersion
  const q = searchQuery.value.trim().toLowerCase()
  if (!q || !getNodes()) return []
  const labels = { label: '名前', employeeId: '社員ID', phone: '電話', email: 'メール', notes: 'メモ', gender: '性別', transport: '交通手段' }
  const res = []
  getNodes().forEach(node => {
    const fields = node.group === 'site' ? ['label'] : ['label', 'employeeId', 'phone', 'email', 'notes', 'gender', 'transport']
    for (const f of fields) {
      const val = f === 'phone' ? parsePhones(node.phone).join(' ').toLowerCase() : (node[f] || '').toLowerCase()
      if (val && val.includes(q)) { res.push({ node, matchField: labels[f], sub: f === 'phone' ? parsePhones(node.phone).join(', ') : (node[f] || '') }); break }
    }
  })
  return res
})

function groupLabel(g) { return g === 'employee' ? '従業員' : g === 'manager' ? '担当者' : '現場' }
function badgeClass(g) { return g === 'employee' ? 'badge-emp' : g === 'manager' ? 'badge-mgr' : 'badge-site' }

// ── 表示/非表示 ──
// ストアのモジュール変数 _nodes/_edges に直接アクセス（getNodes/getEdges経由）
function toggleVis(key) {
  vis.value[key] = !vis.value[key]
  const visible = vis.value[key]
  const nodes = getNodes()
  const edges = getEdges()

  console.log('[toggleVis]', key, '->', visible, 'nodes:', nodes?.length, 'edges:', edges?.length)

  if (!nodes || !edges) { console.warn('[toggleVis] DataSet not ready'); return }

  if (['employee', 'site', 'manager'].includes(key)) {
    // 対象グループの hidden を設定
    nodes.update(
      nodes.get({ filter: n => n.group === key })
           .map(n => ({ id: n.id, hidden: !visible }))
    )
    // 全エッジを vis オブジェクトから再計算
    edges.update(
      edges.get().map(e => {
        const fromGroup = nodes.get(e.from)?.group
        const toGroup   = nodes.get(e.to)?.group
        const fHidden = fromGroup ? !vis.value[fromGroup] : false
        const tHidden = toGroup   ? !vis.value[toGroup]   : false
        return { id: e.id, hidden: fHidden || tHidden }
      })
    )
  } else {
    // エッジタイプの表示切替
    edges.update(
      edges.get().map(e => {
        const isTarget =
          (key === 'home'         && !e.edgeType && (e.assignmentType || 'home') === 'home') ||
          (key === 'support'      && !e.edgeType && e.assignmentType === 'support') ||
          (key === 'manages'      && e.edgeType === 'manages') ||
          (key === 'manager-site' && e.edgeType === 'manager-site')
        return isTarget ? { id: e.id, hidden: !visible } : { id: e.id }
      })
    )
  }
}

// ── ノード追加 ──
async function doAddEmployee() {
  const name = newEmployeeName.value.trim()
  if (!name) { alert('従業員名を入力してください'); return }
  await store.addEmployee(name); newEmployeeName.value = ''
}
async function doAddSite() {
  const name = newSiteName.value.trim()
  if (!name) { alert('現場名を入力してください'); return }
  await store.addSite(name); newSiteName.value = ''
}
</script>

<template>
  <aside class="sidebar app-root">
    <div class="logo">従業員配置マップ</div>
    <div class="subtitle">EMPLOYEE ALLOCATION</div>

    <!-- ユーザー -->
    <div class="status-bar" style="margin-bottom:8px;">
      <span class="status-dot" style="background:#22c55e;"></span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ store.currentUser?.label }}</div>
        <div style="font-size:10px;color:var(--muted);">{{ store.isAdmin ? '管理者 👑' : '担当者' }}</div>
      </div>
      <button v-if="store.isAdmin" class="btn btn-sm" @click="emit('openAdmin')"
        style="margin:0;background:rgba(251,191,36,.15);border:1px solid rgba(251,191,36,.4);">👑</button>
      <button class="btn btn-sm btn-ghost" @click="store.signOut()" style="margin:0;">⏻</button>
    </div>

    <!-- DB状態 -->
    <div class="status-bar">
      <span class="status-dot" :style="{ background: dotColor }"></span>
      <span :style="{ color: statusColor, fontSize: '12px' }">{{ statusText }}</span>
    </div>

    <!-- 表示切替 -->
    <div class="section">
      <div class="section-title">表示切替</div>
      <div class="vis-label">ノード</div>
      <div class="vis-grid-3" style="margin-bottom:8px;">
        <button
          v-for="(cfg, key) in { employee: { label:'従業員', color:'#2563eb', rgba:'37,99,235' }, site: { label:'現場', color:'#dc2626', rgba:'220,38,38' }, manager: { label:'担当者', color:'#16a34a', rgba:'22,163,74' } }"
          :key="key" class="vis-btn" :class="{ off: !vis[key] }"
          :style="`background:rgba(${cfg.rgba},.2);border-color:rgba(${cfg.rgba},.5);color:#fff;`"
          @click="toggleVis(key)">
          <span class="dot8" :style="{ background: cfg.color }"></span>{{ cfg.label }}
        </button>
      </div>
      <div class="vis-label">接続線</div>
      <div class="vis-grid-2">
        <button class="vis-btn" :class="{ off: !vis.home }" @click="toggleVis('home')"
          style="background:rgba(249,115,22,.2);border:1px solid rgba(249,115,22,.5);color:#f97316;">
          <span class="line2" style="border-color:#f97316;"></span>所属
        </button>
        <button class="vis-btn" :class="{ off: !vis.support }" @click="toggleVis('support')"
          style="background:rgba(59,130,246,.2);border:1px solid rgba(59,130,246,.5);color:#3b82f6;">
          <span class="line2d" style="border-color:#3b82f6;"></span>応援
        </button>
        <button class="vis-btn" :class="{ off: !vis.manages }" @click="toggleVis('manages')"
          style="background:rgba(226,232,240,.1);border:1px solid rgba(226,232,240,.3);color:#e2e8f0;">
          <span class="line2d" style="border-color:#e2e8f0;"></span>担当
        </button>
        <button class="vis-btn" :class="{ off: !vis['manager-site'] }" @click="toggleVis('manager-site')"
          style="background:rgba(22,163,74,.2);border:1px solid rgba(22,163,74,.5);color:#16a34a;">
          <span class="line2d" style="border-color:#16a34a;"></span>担当現場
        </button>
      </div>
    </div>

    <!-- 検索 -->
    <div class="section">
      <div class="section-title">🔍 検索</div>
      <input class="input" v-model="searchQuery" />
      <div v-if="searchQuery" style="margin-top:8px;">
        <div v-if="!hits.length" class="no-result">該当なし</div>
        <div v-for="hit in hits" :key="hit.node.id" class="search-item"
          @click="props.networkRef?.focusNode(hit.node.id)">
          <span class="badge" :class="badgeClass(hit.node.group)">{{ groupLabel(hit.node.group) }}</span>
          <div style="flex:1;min-width:0;">
            <div class="search-name">{{ hit.node.label }}</div>
            <div v-if="hit.matchField !== '名前'" class="search-sub">{{ hit.matchField }}: {{ hit.sub }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 従業員追加 -->
    <div class="section">
      <div class="section-title">従業員を追加</div>
      <div class="form-group">
        <label class="label">従業員名</label>
        <input class="input" v-model="newEmployeeName" @keydown.enter="doAddEmployee" />
      </div>
      <button class="btn" @click="doAddEmployee">従業員を追加</button>
    </div>

    <!-- 現場追加 -->
    <div class="section">
      <div class="section-title">現場を追加</div>
      <div class="form-group">
        <label class="label">現場名</label>
        <input class="input" v-model="newSiteName" @keydown.enter="doAddSite" />
      </div>
      <button class="btn" @click="doAddSite">現場を追加</button>
    </div>

    <!-- 担当者追加（管理者のみ） -->
    <div class="section" v-if="store.isAdmin">
      <div class="section-title">担当者を追加</div>
      <button class="btn" @click="emit('openAddManager')">担当者を追加</button>
    </div>

    <!-- 統計 -->
    <div class="section">
      <div class="section-title clickable" @click="statsOpen = !statsOpen">
        統計情報 <span style="margin-left:auto;font-size:10px;">{{ statsOpen ? '▼' : '▶' }}</span>
      </div>
      <div v-if="statsOpen" class="stats">
        <div class="stat"><div class="stat-num">{{ empCount }}</div><div class="stat-lbl">従業員</div></div>
        <div class="stat"><div class="stat-num">{{ siteCount }}</div><div class="stat-lbl">現場</div></div>
        <div class="stat"><div class="stat-num">{{ mgrCount }}</div><div class="stat-lbl">担当者</div></div>
      </div>
    </div>

    <!-- 設定 -->
    <div style="padding-top:12px;display:flex;align-items:center;justify-content:space-between;">
      <button class="btn btn-sm btn-ghost" @click="emit('openSettings')" style="margin:0;">⚙️ 設定</button>
      <span style="font-size:10px;color:#334155;font-family:'IBM Plex Mono',monospace;">v3.0</span>
    </div>
  </aside>
</template>
