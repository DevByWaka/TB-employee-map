<script setup>
import { ref } from 'vue'
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
  try { await store.importData(file); msg.value = 'インポート完了！' }
  catch (e) { alert(e.message) }
  e.target.value = ''
}
async function doReset() {
  if (!confirm('⚠️ 全データを削除します。この操作は元に戻せません。')) return
  await store.resetData(); msg.value = 'データをリセットしました'
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">⚙️ 設定</div>
          <button class="modal-close" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">
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
