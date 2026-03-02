<script setup>
import { ref, reactive } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
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

const fileInput = ref(null)
function triggerImport() { fileInput.value?.click() }
async function onImport(e) {
  const file = e.target.files[0]; if (!file) return
  if (!confirm('インポートすると既存データが上書きされます。続行しますか？')) return
  try { await store.importData(file); msg.value = 'インポート完了！' } catch (e) { alert(e.message) }
  e.target.value = ''
}
async function doReset() {
  if (!confirm('⚠️ 全データを削除します。この操作は元に戻せません。続行しますか？')) return
  await store.resetData()
  msg.value = 'データをリセットしました'
}
</script>

<template>
  <Teleport to="body">
    <div class="em-modal-bg em-root" @click.self="emit('close')">
      <div class="em-modal">
        <div class="em-modal-header">
          <div class="em-modal-title">⚙️ 設定</div>
          <button class="em-modal-close" @click="emit('close')">×</button>
        </div>
        <div class="em-modal-body">
          <div class="em-view-title">データベース接続</div>
          <div class="em-form-group">
            <label class="em-label">接続タイプ</label>
            <select class="em-select" v-model="dbType">
              <option value="supabase">Supabase</option>
              <option value="local">ローカル (PostgREST)</option>
            </select>
          </div>
          <div class="em-form-group">
            <label class="em-label">{{ dbType === 'supabase' ? 'Supabase URL' : 'PostgREST URL' }}</label>
            <input class="em-input" v-model="sbUrl" style="font-family:monospace;font-size:12px;"
              placeholder="" />
          </div>
          <div v-if="dbType === 'supabase'" class="em-form-group">
            <label class="em-label">anon key</label>
            <input class="em-input" v-model="sbKey" placeholder="" style="font-family:monospace;font-size:11px;" />
          </div>
          <button class="em-btn em-btn-warning" @click="saveDb" :disabled="saving">
            {{ saving ? '接続中...' : '接続して保存' }}
          </button>
          <div v-if="msg" style="margin-top:10px;font-size:13px;"
            :style="{ color: msg.includes('成功') || msg.includes('完了') ? '#86efac' : '#fca5a5' }">{{ msg }}</div>

          <hr class="em-divider">
          <div class="em-view-title">データ管理</div>
          <div style="display:flex;gap:10px;margin-bottom:10px;">
            <button class="em-btn em-btn-ghost" @click="store.exportData()" style="font-size:12px;padding:8px;">📥 エクスポート</button>
            <button class="em-btn em-btn-ghost" @click="triggerImport()" style="font-size:12px;padding:8px;">📤 インポート</button>
          </div>
          <input ref="fileInput" type="file" accept=".json" style="display:none;" @change="onImport">

          <div v-if="store.isAdmin">
            <hr class="em-divider">
            <div class="em-view-title">危険な操作</div>
            <button class="em-btn em-btn-danger" @click="doReset">⚠️ 全データをリセット</button>
          </div>
        </div>
        <div class="em-modal-actions">
          <button class="em-btn em-btn-secondary" @click="emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
