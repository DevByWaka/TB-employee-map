<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const emit  = defineEmits(['loggedIn'])

// ステップ管理: 'checking' → 'db' or 'login'
const step      = ref('checking')
const dbLoading = ref(false)
const dbError   = ref('')

const dbForm = reactive({
  type: localStorage.getItem('db_type') || 'supabase',
  url:  localStorage.getItem('sb_url')  || '',
  key:  localStorage.getItem('sb_key')  || '',
})

// 起動時: 保存済み設定があれば自動接続を試みる
onMounted(async () => {
  const ok = await store.loadConfig()
  if (ok) {
    // 接続確認（DataSetなしでOK）
    await store.loadFromDb()
    if (store.dbConnected) { step.value = 'login'; return }
  }
  step.value = 'db'
})

async function connectDb() {
  dbError.value = ''
  if (!dbForm.url.trim()) { dbError.value = 'URLを入力してください'; return }
  if (dbForm.type === 'supabase' && !dbForm.key.trim()) { dbError.value = 'anon keyを入力してください'; return }
  dbLoading.value = true
  try {
    await store.saveDbSettings(dbForm.type, dbForm.url.trim(), dbForm.key.trim())
    if (!store.dbConnected) throw new Error('接続できませんでした。URLとKeyを確認してください。')
    step.value = 'login'
  } catch (e) {
    dbError.value = e.message || '接続に失敗しました'
  } finally {
    dbLoading.value = false
  }
}

const loginForm    = reactive({ employeeId: '', password: '' })
const loginError   = ref('')
const loginLoading = ref(false)
const pwInput      = ref(null)

async function submitLogin() {
  loginError.value = ''
  loginLoading.value = true
  try {
    await store.handleLogin(loginForm.employeeId, loginForm.password)
    emit('loggedIn')
  } catch {
    loginError.value = '社員IDまたはパスワードが正しくありません'
  } finally {
    loginLoading.value = false
  }
}

function backToDb() {
  step.value = 'db'
  loginForm.employeeId = ''
  loginForm.password   = ''
  loginError.value     = ''
}
</script>

<template>
  <div class="em-login-bg em-root">

    <!-- 起動確認中 -->
    <div v-if="step === 'checking'" class="em-login-box" style="text-align:center;">
      <div class="em-logo">従業員配置マップ</div>
      <div style="padding:24px 0; color:var(--em-muted); font-size:13px;">⏳ 接続確認中...</div>
    </div>

    <!-- DB設定 -->
    <div v-else-if="step === 'db'" class="em-login-box">
      <div class="em-logo">従業員配置マップ</div>
      <div class="em-subtitle">SETUP — DATABASE CONNECTION</div>

      <div class="em-form-group">
        <label class="em-label">接続タイプ</label>
        <select class="em-select" v-model="dbForm.type">
          <option value="supabase">Supabase</option>
          <option value="local">ローカル（PostgREST）</option>
        </select>
      </div>

      <div class="em-form-group">
        <label class="em-label">{{ dbForm.type === 'supabase' ? 'Supabase URL' : 'PostgREST URL' }}</label>
        <input class="em-input" v-model="dbForm.url"
          :placeholder="dbForm.type === 'supabase' ? 'https://xxxx.supabase.co' : 'http://localhost:3000'"
          style="font-family:monospace;font-size:12px;"
          @keydown.enter="connectDb" />
      </div>

      <div v-if="dbForm.type === 'supabase'" class="em-form-group">
        <label class="em-label">anon key</label>
        <input class="em-input" v-model="dbForm.key"
          placeholder="eyJhbGciOi..."
          style="font-family:monospace;font-size:11px;"
          @keydown.enter="connectDb" />
      </div>

      <div style="min-height:18px;margin-bottom:10px;font-size:12px;color:#f87171;">{{ dbError }}</div>

      <button class="em-btn" @click="connectDb" :disabled="dbLoading">
        {{ dbLoading ? '接続中...' : '接続してログインへ →' }}
      </button>

      <p style="margin-top:14px;font-size:11px;color:var(--em-muted);line-height:1.6;">
        設定は次回から自動的に読み込まれます。<br>
        または <code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;">public/config.json</code> に記述することもできます。
      </p>
    </div>

    <!-- ログイン -->
    <div v-else-if="step === 'login'" class="em-login-box">
      <div class="em-logo">従業員配置マップ</div>
      <div class="em-subtitle">EMPLOYEE ALLOCATION</div>

      <div style="display:flex;align-items:center;gap:7px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:7px 11px;margin-bottom:18px;">
        <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;"></span>
        <span style="font-size:12px;color:#86efac;">DB接続済み</span>
        <button @click="backToDb" style="margin-left:auto;background:none;border:none;color:var(--em-muted);font-size:11px;cursor:pointer;text-decoration:underline;">変更</button>
      </div>

      <div class="em-form-group">
        <label class="em-label">社員ID</label>
        <input class="em-input" v-model="loginForm.employeeId" placeholder="例: EMP001"
          @keydown.enter="pwInput?.focus()" />
      </div>
      <div class="em-form-group" style="margin-bottom:16px;">
        <label class="em-label">パスワード</label>
        <input ref="pwInput" type="password" class="em-input" v-model="loginForm.password"
          placeholder="••••••••" @keydown.enter="submitLogin" />
      </div>

      <div style="min-height:18px;margin-bottom:10px;font-size:12px;color:#f87171;">{{ loginError }}</div>

      <button class="em-btn" @click="submitLogin" :disabled="loginLoading">
        {{ loginLoading ? 'ログイン中...' : 'ログイン' }}
      </button>
    </div>

  </div>
</template>
