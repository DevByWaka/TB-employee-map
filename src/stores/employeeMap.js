import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// vis.js DataSet シングルトン（モジュールスコープ = 常に同一インスタンス）
// ─────────────────────────────────────────────────────────────────────────────
let _nodes = null
let _edges = null

export function getNodes() { return _nodes }
export function getEdges() { return _edges }

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
  try { const a = JSON.parse(raw); if (Array.isArray(a)) return a.filter(Boolean) } catch {}
  return [raw]
}

// ─────────────────────────────────────────────────────────────────────────────
// ローカル PostgREST クライアント
// ─────────────────────────────────────────────────────────────────────────────
function createLocalClient(baseUrl) {
  const url = baseUrl.replace(/\/$/, '')
  async function req(method, path, body, qs) {
    const res = await fetch(`${url}/${path}${qs ? '?' + qs : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(method === 'POST' ? { Prefer: 'resolution=merge-duplicates' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (res.status === 204 || res.status === 201) return { data: [], error: null }
    const data = await res.json().catch(() => ({}))
    return res.ok ? { data, error: null } : { data: null, error: data }
  }
  function table(t) {
    let _f = {}
    const q = {
      select() { return q },
      eq(c, v)  { _f[c] = 'eq.'  + v; return q },
      neq(c, v) { _f[c] = 'neq.' + v; return q },
      limit() { return q }, order() { return q },
      async then(resolve) {
        try { resolve(await req('GET', t, undefined, new URLSearchParams({ select: '*', ...Object.fromEntries(Object.entries(_f)) }).toString())) }
        catch (e) { resolve({ data: null, error: { message: e.message } }) }
      },
      upsert(rows) { const a = Array.isArray(rows) ? rows : [rows]; return { async then(resolve) { try { resolve(await req('POST', t + '?on_conflict=id', a)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } } } },
      insert(rows) { const a = Array.isArray(rows) ? rows : [rows]; return { async then(resolve) { try { resolve(await req('POST', t, a)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } } } },
      update(row)  { return { eq(c, v) { return { async then(resolve) { try { resolve(await req('PATCH', t, row, `${c}=eq.${v}`)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } } } } } },
      delete()     { return { eq(c, v) { return { async then(resolve) { try { resolve(await req('DELETE', t, undefined, `${c}=eq.${v}`)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } } } }, neq(c, v) { return { async then(resolve) { try { resolve(await req('DELETE', t, undefined, `${c}=neq.${v}`)) } catch (e) { resolve({ data: null, error: { message: e.message } }) } } } } } },
    }
    return q
  }
  return { from: table, channel: () => ({ on: () => ({ subscribe: () => {} }) }), removeChannel: () => {} }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase クライアント シングルトン
// ─────────────────────────────────────────────────────────────────────────────
let _sb = null, _sbUrl = '', _sbType = ''
function getClient(type, url, key) {
  if (_sb && _sbType === type && _sbUrl === url) return _sb
  _sbType = type; _sbUrl = url
  _sb = type === 'local' ? createLocalClient(url) : window.supabase.createClient(url, key)
  return _sb
}

// ─────────────────────────────────────────────────────────────────────────────
// DB 変換
// ─────────────────────────────────────────────────────────────────────────────
function dbNodeToVis(r) {
  return { id: r.id, label: r.label, group: r.node_group, employeeId: r.employee_id, birthdate: r.birthdate, gender: r.gender, transport: r.transport, phone: r.phone, email: r.email, notes: r.notes, title: r.title || r.label, password: r.password || null }
}
function dbEdgeToVis(r) {
  const sk = r.edge_type === 'manages' ? 'manages' : r.edge_type === 'manager-site' ? 'manager-site' : (r.assignment_type || 'home')
  return { id: r.id, from: r.from_id, to: r.to_id, edgeType: r.edge_type, assignmentType: r.assignment_type, workingSlots: r.working_slots || [], customerName: r.customer_name || '', contactPerson: r.contact_person || '', contactPhone: r.contact_phone || '', contactEmail: r.contact_email || '', customerNotes: r.customer_notes || '', title: r.title || '', ...edgeStyle(sk) }
}
function visNodeToDb(n) {
  return { id: n.id, label: n.label, node_group: n.group, employee_id: n.employeeId || null, birthdate: n.birthdate || null, gender: n.gender || null, transport: n.transport || null, phone: n.phone || null, email: n.email || null, notes: n.notes || null, title: n.title || n.label, password: n.password || null }
}
function visEdgeToDb(e) {
  return { id: e.id, from_id: e.from || e.from_id || null, to_id: e.to || e.to_id || null, edge_type: e.edgeType || null, assignment_type: e.assignmentType || 'home', working_slots: Array.isArray(e.workingSlots) ? e.workingSlots : [], customer_name: e.customerName || null, contact_person: e.contactPerson || null, contact_phone: e.contactPhone || null, contact_email: e.contactEmail || null, customer_notes: e.customerNotes || null, title: e.title || '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useEmployeeMapStore = defineStore('employeeMap', () => {
  let dbType = ''
  const dbStatus    = ref('disconnected')
  const dbConnected = ref(false)
  const currentUser = ref(null)
  const nodeVersion = ref(0)
  const edgeVersion = ref(0)
  const isAdmin = computed(() => currentUser.value?.role === 'admin')

  // NetworkGraph.onMounted から呼ばれる。モジュール変数に代入する。
  function injectDataSets(nodes, edges) {
    _nodes = nodes
    _edges = edges
    nodes.on('*', () => { nodeVersion.value++ })
    edges.on('*', () => { edgeVersion.value++ })
    console.log('[store] DataSet injected. nodes:', nodes.length, 'edges:', edges.length)
  }

  const sb = () => _sb

  // ── 権限 ──
  function canEdit(nodeId) {
    if (!currentUser.value) return false
    if (isAdmin.value) return true
    if (currentUser.value.role === 'manager') {
      if (currentUser.value.id === nodeId) return true
      const managed = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manages' })
      if (managed.some(e => e.to === nodeId)) return true
      const sites = new Set()
      managed.forEach(e => { _edges.get({ filter: e2 => e2.from === e.to && !e2.edgeType }).forEach(e2 => sites.add(e2.to)) })
      if (sites.has(nodeId)) return true
    }
    return false
  }
  function canEditEdge(edgeId) {
    if (!currentUser.value) return false
    if (isAdmin.value) return true
    const e = _edges?.get(edgeId)
    return e ? (canEdit(e.from) || canEdit(e.to)) : false
  }

  // ── DB CRUD ──
  async function dbUpsertNode(n) { if (sb() && dbConnected.value) await sb().from('nodes').upsert(visNodeToDb(n)) }
  async function dbUpsertEdge(e) { if (!sb() || !dbConnected.value) return; const r = visEdgeToDb(e); if (r.from_id && r.to_id) await sb().from('edges').upsert(r) }
  async function dbDeleteNode(id) { if (sb() && dbConnected.value) await sb().from('nodes').delete().eq('id', id) }
  async function dbDeleteEdge(id) { if (sb() && dbConnected.value) await sb().from('edges').delete().eq('id', id) }

  function mergeNodes(incoming) {
    if (!_nodes) return
    const map = {}; incoming.forEach(n => { map[n.id] = n })
    incoming.forEach(n => { _nodes.get(n.id) ? _nodes.update(n) : _nodes.add(n) })
    _nodes.getIds().forEach(id => { if (!map[id]) _nodes.remove(id) })
    nodeVersion.value++
  }
  function mergeEdges(incoming) {
    if (!_edges) return
    const map = {}; incoming.forEach(e => { map[e.id] = e })
    incoming.forEach(e => { _edges.get(e.id) ? _edges.update(e) : _edges.add(e) })
    _edges.getIds().forEach(id => { if (!map[id]) _edges.remove(id) })
    edgeVersion.value++
  }

  // ── DB ロード ──
  async function loadFromDb(silent = false) {
    if (!sb()) return
    if (!silent) dbStatus.value = 'syncing'
    try {
      const [{ data: ns, error: ne }, { data: es, error: ee }] = await Promise.all([
        sb().from('nodes').select('*'), sb().from('edges').select('*')
      ])
      if (ne || ee) throw ne || ee
      if (_nodes && _edges) { mergeNodes((ns || []).map(dbNodeToVis)); mergeEdges((es || []).map(dbEdgeToVis)) }
      dbStatus.value = 'connected'; dbConnected.value = true
    } catch (err) {
      if (!silent) console.error('DB load error:', err)
      dbStatus.value = 'error'; dbConnected.value = false
    }
  }

  // ── ポーリング ──
  let pollingTimer = null
  function startPolling(ms = 5000) {
    stopPolling()
    pollingTimer = setInterval(async () => { if (sb() && dbConnected.value && document.visibilityState === 'visible') await loadFromDb(true) }, ms)
  }
  function stopPolling() { if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null } }

  // ── Realtime ──
  let rtChannel = null
  function subscribeRealtime() {
    if (dbType === 'local') return
    if (rtChannel) { try { sb()?.removeChannel(rtChannel) } catch {} rtChannel = null }
    rtChannel = sb().channel('map-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, ({ eventType, new: n, old }) => {
        if (!_nodes) return
        if (eventType !== 'DELETE') { const v = dbNodeToVis(n); _nodes.get(v.id) ? _nodes.update(v) : _nodes.add(v) }
        else if (_nodes.get(old.id)) _nodes.remove(old.id)
        nodeVersion.value++
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'edges' }, ({ eventType, new: e, old }) => {
        if (!_edges) return
        if (eventType !== 'DELETE') { const v = dbEdgeToVis(e); _edges.get(v.id) ? _edges.update(v) : _edges.add(v) }
        else if (_edges.get(old.id)) _edges.remove(old.id)
        edgeVersion.value++
      })
      .subscribe()
  }

  // ── 設定読み込み ──
  async function loadConfig() {
    if (_sb && dbConnected.value) return true
    try {
      const cfg = await fetch('/config.json').then(r => r.json())
      const t = cfg.dbType || 'supabase'
      if (t === 'local' && cfg.local?.url && !cfg.local.url.includes('192.168.x')) { dbType = 'local'; getClient('local', cfg.local.url, ''); return true }
      if (t === 'supabase' && cfg.supabase?.url && !cfg.supabase.url.includes('xxxxxxxx')) { dbType = 'supabase'; getClient('supabase', cfg.supabase.url, cfg.supabase.key); return true }
    } catch {}
    const lsType = localStorage.getItem('db_type') || 'supabase'
    const lsUrl  = localStorage.getItem('sb_url')
    const lsKey  = localStorage.getItem('sb_key') || ''
    if (lsUrl) { dbType = lsType; getClient(lsType, lsUrl, lsKey); return true }
    return false
  }

  async function saveDbSettings(type, url, key) {
    localStorage.setItem('db_type', type); localStorage.setItem('sb_url', url); localStorage.setItem('sb_key', key || '')
    stopPolling()
    if (rtChannel) { try { sb()?.removeChannel(rtChannel) } catch {} rtChannel = null }
    dbType = type; _sbUrl = ''; getClient(type, url, key || '')
    dbStatus.value = 'syncing'
    await loadFromDb()
    if (_nodes && _edges && dbConnected.value) { subscribeRealtime(); startPolling(5000) }
  }

  // ── ログイン ──
  async function handleLogin(employeeId, password) {
    if (!sb()) throw new Error('DB未設定')
    const { data: admins } = await sb().from('admins').select('*').eq('employee_id', employeeId).eq('password', password).limit(1)
    if (admins?.length > 0) { currentUser.value = { id: admins[0].id, label: admins[0].name, employeeId: admins[0].employee_id, role: 'admin' }; return }
    const { data: mgrs } = await sb().from('nodes').select('*').eq('node_group', 'manager').eq('employee_id', employeeId).eq('password', password).limit(1)
    if (!mgrs?.length) throw new Error('認証失敗')
    currentUser.value = { id: mgrs[0].id, label: mgrs[0].label, employeeId: mgrs[0].employee_id, role: 'manager' }
  }

  function signOut() {
    stopPolling()
    if (rtChannel) { try { sb()?.removeChannel(rtChannel) } catch {} rtChannel = null }
    currentUser.value = null; _nodes = null; _edges = null
  }

  // ── ノード操作 ──
  async function addEmployee(name) { const n = { id: 'emp' + Date.now(), label: name, group: 'employee', title: '従業員: ' + name }; _nodes.add(n); await dbUpsertNode(n) }
  async function addSite(name)     { const n = { id: 'site' + Date.now(), label: name, group: 'site', title: '現場: ' + name }; _nodes.add(n); await dbUpsertNode(n) }
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
    _nodes.update(upd); await dbUpsertNode(_nodes.get(nodeId))
    // 関連エッジの title を再生成
    await refreshEdgeTitles(nodeId, label)
  }

  async function refreshEdgeTitles(nodeId, newLabel) {
    const related = _edges.get({ filter: e => e.from === nodeId || e.to === nodeId })
    for (const e of related) {
      const fromLabel = e.from === nodeId ? newLabel : (_nodes.get(e.from)?.label || '?')
      const toLabel   = e.to   === nodeId ? newLabel : (_nodes.get(e.to)?.label   || '?')
      let title = ''
      if (e.edgeType === 'manages')      title = `${fromLabel} → ${toLabel}（担当）`
      else if (e.edgeType === 'manager-site') title = `${fromLabel} → ${toLabel}（担当現場）`
      else {
        const typeLabel = (e.assignmentType || 'home') === 'home' ? '所属' : '応援'
        title = `${fromLabel} → ${toLabel}（${typeLabel}）`
        // スロット情報があれば付加
        if (e.workingSlots?.length) {
          e.workingSlots.forEach((s, i) => {
            if (s.days?.length) {
              title += `
[${i+1}] ${s.days.join('・')} ${s.startTime}-${s.endTime}`
              if (s.memo) title += ` (${s.memo})`
            }
          })
        }
      }
      _edges.update({ id: e.id, title })
      await dbUpsertEdge(_edges.get(e.id))
    }
  }
  async function saveEmployeeInfo(nodeId, info) {
    const { birthdate, gender, transport, phones, email, notes } = info
    const phone = phones.filter(p => p.trim()).length > 0 ? JSON.stringify(phones.filter(p => p.trim())) : null
    const node = _nodes.get(nodeId)
    let title = `従業員: ${node.label}`
    if (birthdate) { const age = calcAge(birthdate); title += `\n生年月日: ${birthdate}`; if (age != null) title += `（${age}歳）` }
    if (gender)    title += `\n性別: ${gender}`
    if (transport) title += `\n交通手段: ${transport}`
    if (phone)     title += `\n電話: ${JSON.parse(phone).join(' / ')}`
    if (email)     title += `\nメール: ${email}`
    if (notes)     title += `\nメモ: ${notes}`
    _nodes.update({ id: nodeId, birthdate, gender, transport, phone, email, notes, title })
    await dbUpsertNode(_nodes.get(nodeId))
  }
  async function deleteNode(nodeId) {
    const conEdges = _edges.get({ filter: e => e.from === nodeId || e.to === nodeId })
    _edges.remove(conEdges.map(e => e.id)); _nodes.remove(nodeId)
    await dbDeleteNode(nodeId); await syncAllManagerSiteEdges()
  }

  // ── エッジ操作 ──
  async function addAssignment(empId, siteId, assignType) {
    const emp = _nodes.get(empId), site = _nodes.get(siteId)
    const edge = { id: 'e' + Date.now(), from: empId, to: siteId, assignmentType: assignType, ...edgeStyle(assignType), title: `${emp.label} → ${site.label}（${assignType === 'home' ? '所属' : '応援'}）` }
    _edges.add(edge); await dbUpsertEdge(edge)
    if (assignType === 'home') await syncAllManagerSiteEdges()
  }
  async function removeAssignment(edgeId) {
    const e = _edges.get(edgeId); const wasHome = (e.assignmentType || 'home') === 'home'
    _edges.remove(edgeId); await dbDeleteEdge(edgeId)
    if (wasHome) await syncAllManagerSiteEdges()
  }
  async function addManagerEmployee(managerId, empId) {
    const emp = _nodes.get(empId), mgr = _nodes.get(managerId)
    const edge = { id: 'e' + Date.now(), from: managerId, to: empId, edgeType: 'manages', ...edgeStyle('manages'), title: `${mgr.label} → ${emp.label}（担当）` }
    _edges.add(edge); await dbUpsertEdge(edge); await syncManagerSiteEdges(managerId)
  }
  async function removeManagerEmployee(edgeId) {
    const e = _edges.get(edgeId); const mgrId = e.from
    _edges.remove(edgeId); await dbDeleteEdge(edgeId); await syncManagerSiteEdges(mgrId)
  }
  async function saveEdgeSlots(edgeId, workingSlots) {
    const e = _edges.get(edgeId)
    const from = _nodes.get(e.from)?.label || '', to = _nodes.get(e.to)?.label || ''
    let title = `${from} → ${to}`
    workingSlots.forEach((s, i) => { if (s.days.length) { title += `\n[${i+1}] ${s.days.join('・')} ${s.startTime}-${s.endTime}`; if (s.memo) title += ` (${s.memo})` } })
    _edges.update({ id: edgeId, title, workingSlots }); await dbUpsertEdge(_edges.get(edgeId))
  }
  async function saveCustomerInfo(edgeId, info) { _edges.update({ id: edgeId, ...info }); await dbUpsertEdge(_edges.get(edgeId)) }

  // ── 担当現場自動同期 ──
  async function syncManagerSiteEdges(managerId) {
    const mgr = _nodes.get(managerId); if (!mgr) return
    const old = _edges.get({ filter: e => e.from === managerId && e.edgeType === 'manager-site' })
    _edges.remove(old.map(e => e.id)); for (const e of old) await dbDeleteEdge(e.id)
    const managesEdges = _edges.get({ filter: e => e.from === managerId && e.edgeType === 'manages' })
    const siteMap = {}
    managesEdges.forEach(me => {
      const emp = _nodes.get(me.to); if (!emp) return
      _edges.get({ filter: e => e.from === emp.id && (e.assignmentType || 'home') === 'home' && !e.edgeType }).forEach(e => { const s = _nodes.get(e.to); if (s) siteMap[s.id] = s })
    })
    for (const site of Object.values(siteMap)) {
      const ne = { id: `ms_${managerId}_${site.id}`, from: managerId, to: site.id, edgeType: 'manager-site', ...edgeStyle('manager-site'), title: `${mgr.label} → ${site.label}（担当現場）` }
      _edges.add(ne); await dbUpsertEdge(ne)
    }
  }
  async function syncAllManagerSiteEdges() {
    for (const mgr of _nodes.get({ filter: n => n.group === 'manager' })) await syncManagerSiteEdges(mgr.id)
  }

  // ── エクスポート / インポート ──
  function exportData() {
    const tn = isAdmin.value ? _nodes.get() : (() => {
      const mE = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manages' })
      const sE = _edges.get({ filter: e => e.from === currentUser.value.id && e.edgeType === 'manager-site' })
      const eIds = new Set(mE.map(e => e.to)), sIds = new Set(sE.map(e => e.to))
      return _nodes.get({ filter: n => eIds.has(n.id) || sIds.has(n.id) })
    })()
    const te = isAdmin.value ? _edges.get() : (() => {
      const ids = new Set(tn.map(n => n.id))
      return _edges.get({ filter: e => (ids.has(e.from) || ids.has(e.to)) && e.edgeType !== 'manages' && e.edgeType !== 'manager-site' })
    })()
    const data = {
      version: 1, exportedAt: new Date().toISOString(),
      nodes: tn.map(n => ({ id: n.id, label: n.label, group: n.group, employeeId: n.employeeId || null, birthdate: n.birthdate || null, gender: n.gender || null, transport: n.transport || null, phone: n.phone || null, email: n.email || null, notes: n.notes || null, title: n.title || null })),
      edges: te.map(e => ({ id: e.id, from: e.from, to: e.to, edgeType: e.edgeType || null, assignmentType: e.assignmentType || null, workingSlots: e.workingSlots || [], customerName: e.customerName || null, contactPerson: e.contactPerson || null, contactPhone: e.contactPhone || null, contactEmail: e.contactEmail || null, customerNotes: e.customerNotes || null })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `employee-map-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href)
  }
  async function importData(file) {
    let data; try { data = JSON.parse(await file.text()) } catch { throw new Error('JSONファイルの読み込みに失敗しました。') }
    if (!data.nodes || !data.edges) throw new Error('形式が正しくありません。')
    if (dbConnected.value) { await sb().from('edges').delete().neq('id', ''); await sb().from('nodes').delete().neq('id', '') }
    _edges.clear(); _nodes.clear()
    const vn = data.nodes.map(n => ({ ...n, title: n.title || n.label }))
    const ve = data.edges.map(e => { const st = e.edgeType === 'manages' ? 'manages' : e.edgeType === 'manager-site' ? 'manager-site' : e.assignmentType || 'home'; return { ...e, ...edgeStyle(st) } })
    _nodes.add(vn); _edges.add(ve)
    if (dbConnected.value) { await sb().from('nodes').insert(vn.map(visNodeToDb)); await sb().from('edges').insert(ve.map(visEdgeToDb)) }
  }
  async function resetData() {
    if (dbConnected.value) { await sb().from('edges').delete().neq('id', ''); await sb().from('nodes').delete().neq('id', '') }
    _nodes.clear(); _edges.clear()
  }

  // ── 管理者 ──
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
    injectDataSets, canEdit, canEditEdge,
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
