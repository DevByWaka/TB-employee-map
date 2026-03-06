<script setup>
import { ref, reactive } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'
import { graphSettings } from '@/stores/graphSettings'

const store = useEmployeeMapStore()
const props = defineProps({ networkRef: Object })
const emit  = defineEmits(['close'])

const dbType = ref(localStorage.getItem('db_type') || 'supabase')
const sbUrl  = ref(localStorage.getItem('sb_url')  || '')
const sbKey  = ref(localStorage.getItem('sb_key')  || '')
const saving = ref(false)
const msg    = ref('')

async function saveDb() {
  if (!sbUrl.value) { msg.value = 'URLを入力してください'; return }
  saving.value = true; msg.value = ''
  try {
    await store.saveDbSettings(dbType.value, sbUrl.value.trim(), sbKey.value.trim())
    msg.value = store.dbConnected ? '接続成功！' : '接続できませんでした'
  } catch (e) {
    msg.value = 'エラー: ' + e.message
  } finally {
    saving.value = false
  }
}

// ── グラフ物理設定 ──
const physics = reactive({ ...graphSettings.values })

function applyGraph() {
  Object.assign(graphSettings.values, physics)
  graphSettings.save()
  props.networkRef?.applyPhysics()
}
function resetGraph() {
  graphSettings.reset()
  Object.assign(physics, graphSettings.values)
  props.networkRef?.applyPhysics()
}

// ── データ管理 ──
const fileInput = ref(null)
function triggerImport() { fileInput.value?.click() }
async function onImport(e) {
  const file = e.target.files[0]; if (!file) return
  if (!confirm('インポートすると既存データが上書きされます。続行しますか？')) return
  try { await store.importData(file); msg.value = 'インポート完了！' }
  catch (e) { alert(e.message) }
  e.target.value = ''
}
async function doReset() {
  if (!confirm('⚠️ 全データを削除します。この操作は元に戻せません。')) return
  await store.resetData(); msg.value = 'データをリセットしました'
}

function sliderStyle(val, min, max) {
  const pct = ((val - min) / (max - min)) * 100
  return `background: linear-gradient(to right, #3b82f6 ${pct}%, rgba(255,255,255,.1) ${pct}%)`
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <div class="modal-title">⚙️ 設定</div>
          <button class="modal-close" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">

          <!-- DB接続 -->
          <div class="view-title">データベース接続</div>
          <div class="form-group">
            <label class="label">接続タイプ</label>
            <select class="select" v-model="dbType">
              <option value="supabase">Supabase</option>
              <option value="local">ローカル (PostgREST)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">{{ dbType === 'supabase' ? 'Supabase URL' : 'PostgREST URL' }}</label>
            <input class="input" v-model="sbUrl" style="font-family:monospace;font-size:12px;" />
          </div>
          <div v-if="dbType === 'supabase'" class="form-group">
            <label class="label">anon key</label>
            <input class="input" v-model="sbKey" style="font-family:monospace;font-size:11px;" />
          </div>
          <button class="btn btn-warn" @click="saveDb" :disabled="saving">
            {{ saving ? '接続中...' : '接続して保存' }}
          </button>
          <div v-if="msg" style="margin-top:8px;font-size:13px;"
            :style="{ color: msg.includes('成功') || msg.includes('完了') ? '#86efac' : '#fca5a5' }">{{ msg }}</div>

          <!-- グラフ表示設定 -->
          <hr class="divider">
          <div class="view-title">グラフ表示設定</div>

          <div v-for="cfg in [
            { key: 'springLength',          label: 'ノード間距離',     min: 50,     max: 500,  step: 10,   unit: 'px' },
            { key: 'springConstant',        label: 'バネの硬さ',       min: 0.01,   max: 0.3,  step: 0.01, unit: '' },
            { key: 'gravitationalConstant', label: '反発力',           min: -20000, max: -500, step: 500,  unit: '' },
            { key: 'centralGravity',        label: '中心への引力',     min: 0,      max: 1,    step: 0.05, unit: '' },
            { key: 'damping',               label: '動きの収まりやすさ', min: 0.01,  max: 0.5,  step: 0.01, unit: '' },
            { key: 'avoidOverlap',          label: 'ノード重なり回避', min: 0,      max: 1,    step: 0.1,  unit: '' },
            { key: 'roundness',             label: '線の曲がり具合',   min: 0,      max: 1,    step: 0.05, unit: '' },
          ]" :key="cfg.key" style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label class="label" style="margin:0;">{{ cfg.label }}</label>
              <span style="font-size:12px;font-family:'IBM Plex Mono',monospace;color:#60a5fa;">
                {{ physics[cfg.key] }}{{ cfg.unit }}
              </span>
            </div>
            <input type="range"
              :min="cfg.min" :max="cfg.max" :step="cfg.step"
              v-model.number="physics[cfg.key]"
              :style="[sliderStyle(physics[cfg.key], cfg.min, cfg.max), 'width:100%;height:6px;border-radius:3px;outline:none;border:none;cursor:pointer;appearance:none;-webkit-appearance:none;']"
            />
          </div>

          <div style="display:flex;gap:8px;margin-top:4px;">
            <button class="btn" @click="applyGraph" style="flex:1;">✓ 適用</button>
            <button class="btn btn-ghost" @click="resetGraph" style="flex:1;">↺ リセット</button>
          </div>

          <!-- データ管理 -->
          <hr class="divider">
          <div class="view-title">データ管理</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button class="btn btn-ghost" @click="store.exportData()" style="font-size:12px;padding:8px;">📥 エクスポート</button>
            <button class="btn btn-ghost" @click="triggerImport()" style="font-size:12px;padding:8px;">📤 インポート</button>
          </div>
          <input ref="fileInput" type="file" accept=".json" style="display:none;" @change="onImport">

          <div v-if="store.isAdmin">
            <hr class="divider">
            <div class="view-title">危険な操作</div>
            <button class="btn btn-danger" @click="doReset">⚠️ 全データをリセット</button>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn btn-red" @click="emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
