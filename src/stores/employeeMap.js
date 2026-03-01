import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────

export function edgeStyle(type) {
  if (type === 'home')         return { color: { color: '#f97316', highlight: '#fb923c', hover: '#fb923c' }, width: 2, dashes: false }
  if (type === 'support')      return { color: { color: '#3b82f6', highlight: '#60a5fa', hover: '#60a5fa' }, width: 2, dashes: [6, 4] }
  if (type === 'manages')      return { color: { color: '#e2e8f0', highlight: '#ffffff', hover: '#ffffff' }, width: 1.5, dashes: [2, 3] }
  if (type === 'manager-site') return { color: { color: '#16a34a', highlight: '#22c55e', hover: '#22c55e' }, width: 1.5, dashes: [8, 4] }
  return { color: { color: '#64748b' }, width: 1, dashes: false }
}

export function calcAge(birthdate) {
  if (!birthdate) return null
  const today = new Date(), b = new Date(birthdate)
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
  return age
}

export function parsePhones(raw) {
  if (!raw) return []
  try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr.filter(Boolean) } catch (e) {}
  return raw ? [raw] : []
}

// ─────────────────────────────────────────────────────────────────────────────
// ローカル PostgREST クライアント
// ─────────────────────────────────────────────────────────────────────────────

function createLocalClient(baseUrl) {
  const url = baseUrl.replace(/\/$/, '')
  async function req(method, path, body, qs) {
    const endpoint = `${url}/${path}${qs ? '?' + qs : ''}`
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status === 204 || res.status === 201) return { data: [], error: null }
    const data = await res.json().catch(() => ({}))
    return res.ok ? { data, error: null } : { data: null, error: data }
  }
  function table(tableName) {
    let _filters = {}
    const q = {
      select() { return q },
      eq(col, val) { _filters[col] = 'eq.' + val; return q },
      neq(col, val) { _filters[col] = 'neq.' + val; return q },
      limit() { return q },
      order() { return q },
      async then(resolve) {
        try {
          const qs = new URLSearchParams({ select: '*', ...Object.fromEntries(Object.entries(_filters)) })
          resolve(await req('GET', tableName, undefined, qs.toString()))
        } catch (e) { resolve({ data: null, error: { message: e.message } }) }
      },
      upsert(rows) {
        const arr = Array.isArray(rows) ? rows : [rows]
        return { async then(resolve) {
          try { resolve(await req('POST', tableName + '?on_conflict=id', arr)) }
          catch (e) { resolve({ data: null, error: { message: e.message } }) }
        }}
      },
      insert(rows) {
        const arr = Array.isArray(rows) ? rows : [rows]
        return { async then(resolve) {
          try { resolve(await req('POST', tableName, arr)) }
          catch (e) { resolve({ data: null, error: { message: e.message } }) }
        }}
      },
      update(row) {
        return { eq(col, val) { return { async then(resolve) {
          try { resolve(await req('PATCH', tableName, row, `${col}=eq.${val}`)) }
          catch (e) { resolve({ data: null, error: { message: e.message } }) }
        }}}}
      },
      delete() {
        return {
          eq(col, val)  { return { async then(resolve) { try { resolve(await req('DELETE', tableName, undefined, `${col}=eq.${val}`)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } }}},
          neq(col, val) { return { async then(resolve) { try { resolve(await req('DELETE', tableName, undefined, `${col}=neq.${val}`)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } }}},
        }
      },
    }
    return q
  }
  return { from: table, channel: () => ({ on: () => ({ subscribe: () => {} }) }), removeChannel: () => {} }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase クライアント — シングルトン管理
// ─────────────────────────────────────────────────────────────────────────────

let _sbInstance = null
let _sbUrl = ''
let _sbType = ''

function getOrCreateClient(type, url, key) {
  // 同じ type + url なら既存インスタンスを返す（多重生成防止）
  if (_sbInstance && _sbType === type && _sbUrl === url) return _sbInstance
  _sbType = type
  _sbUrl = url
  if (type === 'local') {
    _sbInstance = createLocalClient(url)
  } else {
    _sbInstance = window.supabase.createClient(url, key)
  }
  return _sbInstance
}

// ─────────────────────────────────────────────────────────────────────────────
// DB 変換
// ─────────────────────────────────────────────────────────────────────────────

function dbNodeToVis(r) {
  return {
    id: r.id, label: r.label, group: r.node_group,
    employeeId: r.employee_id, birthdate: r.birthdate, gender: r.gender,
    transport: r.transport, phone: r.phone, email: r.email,
    notes: r.notes, title: r.title || r.label, password: r.password || null,
  }
}
function dbEdgeToVis(r) {
  const styleKey = r.edge_type === 'manages' ? 'manages'
    : r.edge_type === 'manager-site' ? 'manager-site'
    : (r.assignment_type || 'home')
  return {
    id: r.id, from: r.from_id, to: r.to_id,
    edgeType: r.edge_type, assignmentType: r.assignment_type,
    workingSlots: r.working_slots || [],
    customerName: r.customer_name || '', contactPerson: r.contact_person || '',
    contactPhone: r.contact_phone || '', contactEmail: r.contact_email || '',
    customerNotes: r.customer_notes || '', title: r.title || '',
    ...edgeStyle(styleKey),
  }
}
function visNodeToDb(n) {
  return {
    id: n.id, label: n.label, node_group: n.group,
    employee_id: n.employeeId || null, birthdate: n.birthdate || null,
    gender: n.gender || null, transport: n.transport || null,
    phone: n.phone || null, email: n.email || null,
    notes: n.notes || null, title: n.title || n.label,
    password: n.password || null,
  }
}
function visEdgeToDb(e) {
  return {
    id: e.id, from_id: e.from || e.from_id || null,
    to_id: e.to || e.to_id || null,
    edge_type: e.edgeType || null,
    assignment_type: e.assignmentType || 'home',
    working_slots: Array.isArray(e.workingSlots) ? e.workingSlots : [],
    customer_name: e.customerName || null, contact_person: e.contactPerson || null,
    contact_phone: e.contactPhone || null, contact_email: e.contactEmail || null,
    customer_notes: e.customerNotes || null, title: e.title || '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pinia Store
// ─────────────────────────────────────────────────────────────────────────────

export const useEmployeeMapStore = defineStore('employeeMap', () => {

  // ── vis.js DataSet 参照（NetworkGraph.onMounted で注入）──
  let _nodes = null
  let _edges = null

  // ── DB 設定（モジュールスコープのシングルトンと連動）──
  let dbType = ''

  // ── 状態 ──
  const dbStatus    = ref('disconnected')
  const dbConnected = ref(false)
  const currentUser = ref(null)
  const nodeVersion = ref(0)
  const edgeVersion = ref(0)

  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  // DataSet ゲッター
  function getNodes() { return _nodes }
  function getEdges() { return _edges }

  // DataSet 注入（NetworkGraph.onMounted から呼ぶ）
  function injectDataSets(nodes, edges) {
    _nodes = nodes
    _edges = edges
    nodes.on('*', () => { nodeVersion.value++ })
    edges.on('*', () => { edgeVersion.value++ })
  }

  // ── 権限 ──
  function canEdit(nodeId) {
    if (!currentUser.value) return false
    if (isAdmin.value) return true
    if (currentUser.value.role === 'manager') {
      if (currentUser.value.id === nodeId) return true
      const managed = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manages' })
      if (managed.some(e => e.to === nodeId)) return true
      const mySites = new Set()
      managed.forEach(e => { _edges.get({ filter: e2 => e2.from === e.to && !e2.edgeType }).forEach(e2 => mySites.add(e2.to)) })
      if (mySites.has(nodeId)) return true
    }
    return false
  }
  function canEditEdge(edgeId) {
    if (!currentUser.value) return false
    if (isAdmin.value) return true
    if (currentUser.value.role === 'manager') {
      const e = _edges?.get(edgeId)
      if (!e) return false
      return canEdit(e.from) || canEdit(e.to)
    }
    return false
  }

  // ── DB CRUD ──
  function sb() { return _sbInstance }
  async function dbUpsertNode(n) { if (sb() && dbConnected.value) await sb().from('nodes').upsert(visNodeToDb(n)) }
  async function dbUpsertEdge(e) {
    if (!sb() || !dbConnected.value) return
    const rec = visEdgeToDb(e)
    if (!rec.from_id || !rec.to_id) return
    await sb().from('edges').upsert(rec)
  }
  async function dbDeleteNode(id) { if (sb() && dbConnected.value) await sb().from('nodes').delete().eq('id', id) }
  async function dbDeleteEdge(id) { if (sb() && dbConnected.value) await sb().from('edges').delete().eq('id', id) }

  // ── DataSet マージ（_nodes/_edges が null なら何もしない）──
  function mergeNodes(incoming) {
    if (!_nodes) return
    const map = {}
    incoming.forEach(n => { map[n.id] = n })
    incoming.forEach(n => { if (_nodes.get(n.id)) _nodes.update(n); else _nodes.add(n) })
    _nodes.getIds().forEach(id => { if (!map[id]) _nodes.remove(id) })
    nodeVersion.value++
  }
  function mergeEdges(incoming) {
    if (!_edges) return
    const map = {}
    incoming.forEach(e => { map[e.id] = e })
    incoming.forEach(e => { if (_edges.get(e.id)) _edges.update(e); else _edges.add(e) })
    _edges.getIds().forEach(id => { if (!map[id]) _edges.remove(id) })
    edgeVersion.value++
  }

  // ── DB ロード ──
  async function loadFromDb(silent = false) {
    if (!sb()) return
    if (!silent) dbStatus.value = 'syncing'
    try {
      const [{ data: dbNodes, error: ne }, { data: dbEdges, error: ee }] = await Promise.all([
        sb().from('nodes').select('*'),
        sb().from('edges').select('*'),
      ])
      if (ne || ee) throw ne || ee
      // DataSet が注入済みの場合のみ書き込む
      if (_nodes && _edges) {
        mergeNodes((dbNodes || []).map(dbNodeToVis))
        mergeEdges((dbEdges || []).map(dbEdgeToVis))
      }
      dbStatus.value = 'connected'
      dbConnected.value = true
    } catch (err) {
      if (!silent) console.error('DB load error:', err)
      dbStatus.value = 'error'
      dbConnected.value = false
    }
  }

  // ── ポーリング ──
  let pollingTimer = null
  function startPolling(ms = 5000) {
    stopPolling()
    pollingTimer = setInterval(async () => {
      if (sb() && dbConnected.value && document.visibilityState === 'visible') await loadFromDb(true)
    }, ms)
  }
  function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
  }

  // ── Realtime ──
  let realtimeChannel = null
  function subscribeRealtime() {
    if (dbType === 'local') return
    if (realtimeChannel) { try { sb()?.removeChannel(realtimeChannel) } catch(e){} realtimeChannel = null }
    realtimeChannel = sb().channel('map-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, ({ eventType, new: n, old }) => {
        if (!_nodes) return
        if (eventType === 'INSERT' || eventType === 'UPDATE') { const v = dbNodeToVis(n); if (_nodes.get(v.id)) _nodes.update(v); else _nodes.add(v) }
        else if (eventType === 'DELETE' && _nodes.get(old.id)) _nodes.remove(old.id)
        nodeVersion.value++
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edges' }, ({ eventType, new: e, old }) => {
        if (!_edges) return
        if (eventType === 'INSERT' || eventType === 'UPDATE') { const v = dbEdgeToVis(e); if (_edges.get(v.id)) _edges.update(v); else _edges.add(v) }
        else if (eventType === 'DELETE' && _edges.get(old.id)) _edges.remove(old.id)
        edgeVersion.value++
      })
      .subscribe()
  }

  // ── 設定読み込み（起動時・初回のみ）──
  async function loadConfig() {
    // 既にクライアント生成済みなら何もしない
    if (_sbInstance && dbConnected.value) return true
    try {
      const res = await fetch('/config.json')
      const config = await res.json()
      const type = config.dbType || 'supabase'
      if (type === 'local' && config.local?.url && !config.local.url.includes('192.168.x')) {
        dbType = 'local'
        getOrCreateClient('local', config.local.url, '')
        return true
      }
      if (type === 'supabase' && config.supabase?.url && !config.supabase.url.includes('xxxxxxxx')) {
        dbType = 'supabase'
        getOrCreateClient('supabase', config.supabase.url, config.supabase.key)
        return true
      }
    } catch (e) {}
    // localStorage フォールバック
    const lsType = localStorage.getItem('db_type') || 'supabase'
    const lsUrl  = localStorage.getItem('sb_url')
    const lsKey  = localStorage.getItem('sb_key') || ''
    if (lsUrl) {
      dbType = lsType
      getOrCreateClient(lsType, lsUrl, lsKey)
      return true
    }
    return false
  }

  // ── DB接続設定保存（設定画面から）──
  async function saveDbSettings(type, url, key) {
    localStorage.setItem('db_type', type)
    localStorage.setItem('sb_url', url)
    localStorage.setItem('sb_key', key || '')
    stopPolling()
    if (realtimeChannel) { try { sb()?.removeChannel(realtimeChannel) } catch(e){} realtimeChannel = null }
    dbType = type
    // シングルトンを強制更新（URL変更時）
    _sbUrl = '' // リセットして再生成を促す
    getOrCreateClient(type, url, key || '')
    dbStatus.value = 'syncing'
    await loadFromDb()
    if (_nodes && _edges && dbConnected.value) {
      subscribeRealtime()
      startPolling(5000)
    }
  }

  // ── ログイン ──
  async function handleLogin(employeeId, password) {
    if (!sb()) throw new Error('DB未設定')
    const { data: admins } = await sb().from('admins').select('*').eq('employee_id', employeeId).eq('password', password).limit(1)
    if (admins && admins.length > 0) {
      currentUser.value = { id: admins[0].id, label: admins[0].name, employeeId: admins[0].employee_id, role: 'admin' }
      return
    }
    const { data: mgrs } = await sb().from('nodes').select('*').eq('node_group', 'manager').eq('employee_id', employeeId).eq('password', password).limit(1)
    if (!mgrs || mgrs.length === 0) throw new Error('認証失敗')
    currentUser.value = { id: mgrs[0].id, label: mgrs[0].label, employeeId: mgrs[0].employee_id, role: 'manager' }
  }

  function signOut() {
    stopPolling()
    if (realtimeChannel) { try { sb()?.removeChannel(realtimeChannel) } catch(e){} realtimeChannel = null }
    currentUser.value = null
    _nodes = null
    _edges = null
  }

  // ── ノード操作 ──
  async function addEmployee(name) {
    const n = { id: 'emp' + Date.now(), label: name, group: 'employee', title: '従業員: ' + name }
    _nodes.add(n); await dbUpsertNode(n)
  }
  async function addSite(name) {
    const n = { id: 'site' + Date.now(), label: name, group: 'site', title: '現場: ' + name }
    _nodes.add(n); await dbUpsertNode(n)
  }
  async function addManager(name, empId, password) {
    if (_nodes.get({ filter: n => n.employeeId === empId }).length > 0) throw new Error('この社員IDはすでに使用されています')
    const n = { id: 'manager' + Date.now(), label: name, group: 'manager', employeeId: empId, password, title: '担当者: ' + name }
    _nodes.add(n); await dbUpsertNode(n)
  }
  async function saveNodeBasic(nodeId, label, employeeId) {
    const node = _nodes.get(nodeId)
    const prefix = node.group === 'employee' ? '従業員: ' : node.group === 'manager' ? '担当者: ' : '現場: '
    const upd = { id: nodeId, label, title: prefix + label }
    if (node.group !== 'site') upd.employeeId = employeeId || null
    _nodes.update(upd)
    await dbUpsertNode(_nodes.get(nodeId))
  }
  async function saveEmployeeInfo(nodeId, info) {
    const { birthdate, gender, transport, phones, email, notes } = info
    const phone = phones.filter(p => p.trim()).length > 0 ? JSON.stringify(phones.filter(p => p.trim())) : null
    const node = _nodes.get(nodeId)
    let title = `従業員: ${node.label}`
    if (birthdate) { const age = calcAge(birthdate); title += `\n生年月日: ${birthdate}`; if (age !== null) title += `（${age}歳）` }
    if (gender) title += `\n性別: ${gender}`
    if (transport) title += `\n交通手段: ${transport}`
    if (phone) title += `\n電話: ${JSON.parse(phone).join(' / ')}`
    if (email) title += `\nメール: ${email}`
    if (notes) title += `\nメモ: ${notes}`
    _nodes.update({ id: nodeId, birthdate, gender, transport, phone, email, notes, title })
    await dbUpsertNode(_nodes.get(nodeId))
  }
  async function deleteNode(nodeId) {
    const conEdges = _edges.get({ filter: e => e.from === nodeId || e.to === nodeId })
    _edges.remove(conEdges.map(e => e.id))
    _nodes.remove(nodeId)
    await dbDeleteNode(nodeId)
    await syncAllManagerSiteEdges()
  }

  // ── エッジ操作 ──
  async function addAssignment(empId, siteId, assignType) {
    const emp = _nodes.get(empId), site = _nodes.get(siteId)
    const edge = { id: 'e' + Date.now(), from: empId, to: siteId, assignmentType: assignType, ...edgeStyle(assignType), title: `${emp.label} → ${site.label}（${assignType === 'home' ? '所属' : '応援'}）` }
    _edges.add(edge)
    await dbUpsertEdge(edge)
    if (assignType === 'home') await syncAllManagerSiteEdges()
  }
  async function removeAssignment(edgeId) {
    const e = _edges.get(edgeId)
    const wasHome = (e.assignmentType || 'home') === 'home'
    _edges.remove(edgeId)
    await dbDeleteEdge(edgeId)
    if (wasHome) await syncAllManagerSiteEdges()
  }
  async function addManagerEmployee(managerId, empId) {
    const emp = _nodes.get(empId), mgr = _nodes.get(managerId)
    const edge = { id: 'e' + Date.now(), from: managerId, to: empId, edgeType: 'manages', ...edgeStyle('manages'), title: `${mgr.label} → ${emp.label}（担当）` }
    _edges.add(edge)
    await dbUpsertEdge(edge)
    await syncManagerSiteEdges(managerId)
  }
  async function removeManagerEmployee(edgeId) {
    const e = _edges.get(edgeId)
    const mgrId = e.from
    _edges.remove(edgeId)
    await dbDeleteEdge(edgeId)
    await syncManagerSiteEdges(mgrId)
  }
  async function saveEdgeSlots(edgeId, workingSlots) {
    const e = _edges.get(edgeId)
    const from = _nodes.get(e.from)?.label || '', to = _nodes.get(e.to)?.label || ''
    let title = `${from} → ${to}`
    workingSlots.forEach((slot, i) => { if (slot.days.length > 0) { title += `\n[${i + 1}] ${slot.days.join('・')} ${slot.startTime}-${slot.endTime}`; if (slot.memo) title += ` (${slot.memo})` } })
    _edges.update({ id: edgeId, title, workingSlots })
    await dbUpsertEdge(_edges.get(edgeId))
  }
  async function saveCustomerInfo(edgeId, info) {
    _edges.update({ id: edgeId, ...info })
    await dbUpsertEdge(_edges.get(edgeId))
  }

  // ── 担当現場自動同期 ──
  async function syncManagerSiteEdges(managerId) {
    const mgr = _nodes.get(managerId); if (!mgr) return
    const oldEdges = _edges.get({ filter: e => e.from === managerId && e.edgeType === 'manager-site' })
    _edges.remove(oldEdges.map(e => e.id))
    for (const e of oldEdges) await dbDeleteEdge(e.id)
    const managesEdges = _edges.get({ filter: e => e.from === managerId && e.edgeType === 'manages' })
    const siteMap = {}
    managesEdges.forEach(me => {
      const emp = _nodes.get(me.to); if (!emp) return
      _edges.get({ filter: e => e.from === emp.id && (e.assignmentType || 'home') === 'home' && !e.edgeType }).forEach(e => {
        const site = _nodes.get(e.to); if (site) siteMap[site.id] = site
      })
    })
    for (const site of Object.values(siteMap)) {
      const newEdge = { id: `ms_${managerId}_${site.id}`, from: managerId, to: site.id, edgeType: 'manager-site', ...edgeStyle('manager-site'), title: `${mgr.label} → ${site.label}（担当現場）` }
      _edges.add(newEdge)
      await dbUpsertEdge(newEdge)
    }
  }
  async function syncAllManagerSiteEdges() {
    for (const mgr of _nodes.get({ filter: n => n.group === 'manager' })) await syncManagerSiteEdges(mgr.id)
  }

  // ── エクスポート / インポート ──
  function exportData() {
    const targetNodes = isAdmin.value ? _nodes.get() : (() => {
      const mEds = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manages' })
      const sEds = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manager-site' })
      const empIds = new Set(mEds.map(e => e.to)), siteIds = new Set(sEds.map(e => e.to))
      return _nodes.get({ filter: n => empIds.has(n.id) || siteIds.has(n.id) })
    })()
    const targetEdges = isAdmin.value ? _edges.get() : (() => {
      const ids = new Set(targetNodes.map(n => n.id))
      return _edges.get({ filter: e => (ids.has(e.from) || ids.has(e.to)) && e.edgeType !== 'manages' && e.edgeType !== 'manager-site' })
    })()
    const data = {
      version: 1, exportedAt: new Date().toISOString(),
      nodes: targetNodes.map(n => ({ id: n.id, label: n.label, group: n.group, employeeId: n.employeeId || null, birthdate: n.birthdate || null, gender: n.gender || null, transport: n.transport || null, phone: n.phone || null, email: n.email || null, notes: n.notes || null, title: n.title || null })),
      edges: targetEdges.map(e => ({ id: e.id, from: e.from, to: e.to, edgeType: e.edgeType || null, assignmentType: e.assignmentType || null, workingSlots: e.workingSlots || [], customerName: e.customerName || null, contactPerson: e.contactPerson || null, contactPhone: e.contactPhone || null, contactEmail: e.contactEmail || null, customerNotes: e.customerNotes || null })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `employee-map-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href)
  }
  async function importData(file) {
    let data
    try { data = JSON.parse(await file.text()) } catch (e) { throw new Error('JSONファイルの読み込みに失敗しました。') }
    if (!data.nodes || !data.edges) throw new Error('バックアップファイルの形式が正しくありません。')
    if (dbConnected.value) { await sb().from('edges').delete().neq('id', ''); await sb().from('nodes').delete().neq('id', '') }
    _edges.clear(); _nodes.clear()
    const visNodes = data.nodes.map(n => ({ ...n, title: n.title || n.label }))
    const visEdges = data.edges.map(e => { const st = e.edgeType === 'manages' ? 'manages' : e.edgeType === 'manager-site' ? 'manager-site' : e.assignmentType || 'home'; return { ...e, ...edgeStyle(st) } })
    _nodes.add(visNodes); _edges.add(visEdges)
    if (dbConnected.value) { await sb().from('nodes').insert(visNodes.map(visNodeToDb)); await sb().from('edges').insert(visEdges.map(visEdgeToDb)) }
  }
  async function resetData() {
    if (dbConnected.value) { await sb().from('edges').delete().neq('id', ''); await sb().from('nodes').delete().neq('id', '') }
    _nodes.clear(); _edges.clear()
  }

  // ── 管理者パネル ──
  async function loadAdminList() {
    if (!sb()) return []
    const { data } = await sb().from('admins').select('id,name,employee_id,created_at').order('created_at')
    return data || []
  }
  async function createAdmin(name, empId, password) {
    const { error } = await sb().from('admins').insert({ name, employee_id: empId, password })
    if (error) throw new Error(error.message?.includes('unique') ? '社員IDが既に使われています' : 'エラー: ' + error.message)
  }
  async function deleteAdmin(id) { await sb().from('admins').delete().eq('id', id) }
  async function saveMgrPassword(nodeId, password) {
    const { error } = await sb().from('nodes').update({ password: password || null }).eq('id', nodeId)
    if (error) throw new Error('エラー: ' + error.message)
    _nodes.update({ id: nodeId, password: password || null })
  }

  return {
    dbStatus, dbConnected, currentUser, nodeVersion, edgeVersion, isAdmin,
    getNodes, getEdges, injectDataSets,
    canEdit, canEditEdge,
    loadConfig, saveDbSettings, handleLogin, signOut,
    loadFromDb, startPolling, stopPolling, subscribeRealtime,
    addEmployee, addSite, addManager,
    saveNodeBasic, saveEmployeeInfo, deleteNode,
    addAssignment, removeAssignment, addManagerEmployee, removeManagerEmployee,
    saveEdgeSlots, saveCustomerInfo, syncAllManagerSiteEdges,
    exportData, importData, resetData,
    loadAdminList, createAdmin, deleteAdmin, saveMgrPassword,
  }
})
