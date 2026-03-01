<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const emit = defineEmits(['close'])

const admins = ref([])
const managers = computed(() => {
  store.nodeVersion
  return store.getNodes()?.get({ filter: n => n.group === 'manager' }) || []
})

const newAdmin = reactive({ name: '', empId: '', password: '' })
const adminError = ref('')

const mgrPass = reactive({})
const mgrMsg  = reactive({})

onMounted(async () => { admins.value = await store.loadAdminList() })

function genPw(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function addAdmin() {
  adminError.value = ''
  if (!newAdmin.name || !newAdmin.empId || !newAdmin.password) { adminError.value = '全項目を入力してください'; return }
  try {
    await store.createAdmin(newAdmin.name, newAdmin.empId, newAdmin.password)
    admins.value = await store.loadAdminList()
    Object.assign(newAdmin, { name: '', empId: '', password: '' })
  } catch (e) { adminError.value = e.message }
}

async function removeAdmin(id) {
  if (!confirm('このアカウントを削除しますか？')) return
  await store.deleteAdmin(id)
  admins.value = await store.loadAdminList()
}

async function saveMgrPw(mgr) {
  const pw = mgrPass[mgr.id] || ''
  try {
    await store.saveMgrPassword(mgr.id, pw)
    mgrMsg[mgr.id] = '✅ 保存しました'
    setTimeout(() => { mgrMsg[mgr.id] = '' }, 2500)
  } catch (e) { mgrMsg[mgr.id] = '❌ ' + e.message }
}
</script>

<template>
  <Teleport to="body">
    <div class="em-modal-bg em-root" @click.self="emit('close')">
      <div class="em-modal" style="max-width: 600px;">
        <div class="em-modal-header">
          <div class="em-modal-title">👑 管理者パネル</div>
          <button class="em-modal-close" @click="emit('close')">×</button>
        </div>
        <div class="em-modal-body">

          <!-- 管理者アカウント一覧 -->
          <div class="em-view-title">管理者アカウント</div>
          <div v-if="!admins.length" class="em-no-assign">管理者なし</div>
          <div v-for="a in admins" :key="a.id" class="em-assign-item">
            <div style="flex: 1;">
              <div class="em-assign-name">👑 {{ a.name }}</div>
              <div style="font-size: 11px; color: var(--em-muted);">社員ID: {{ a.employee_id }}</div>
            </div>
            <button class="em-assign-del" @click="removeAdmin(a.id)">削除</button>
          </div>

          <hr class="em-divider">
          <div class="em-view-title">管理者を追加</div>
          <div class="em-form-group"><label class="em-label">名前</label><input class="em-input" v-model="newAdmin.name" placeholder="管理者名"></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="em-form-group"><label class="em-label">社員ID</label><input class="em-input" v-model="newAdmin.empId" placeholder="例: ADM001" style="font-family: monospace;"></div>
            <div class="em-form-group">
              <label class="em-label">パスワード</label>
              <div style="display: flex; gap: 5px;">
                <input class="em-input" v-model="newAdmin.password" style="flex: 1; margin: 0; font-family: monospace; font-size: 12px;">
                <button class="em-btn em-btn-ghost em-btn-sm" @click="newAdmin.password = genPw()" style="margin: 0;">生成</button>
              </div>
            </div>
          </div>
          <div v-if="adminError" style="font-size: 12px; color: #f87171; margin-bottom: 8px;">{{ adminError }}</div>
          <button class="em-btn" @click="addAdmin">管理者を追加</button>

          <hr class="em-divider">
          <!-- 担当者パスワード管理 -->
          <div class="em-view-title">担当者パスワード管理</div>
          <div v-if="!managers.length" class="em-no-assign">担当者なし</div>
          <div v-for="mgr in managers" :key="mgr.id" style="background: rgba(22,163,74,0.05); border: 1px solid rgba(22,163,74,0.2); border-radius: 8px; padding: 11px 13px; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--em-text); margin-bottom: 8px;">🟢 {{ mgr.label }}</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="text" class="em-input" v-model="mgrPass[mgr.id]" :placeholder="mgr.password ? '••••••••' : '未設定'" style="flex: 1; margin: 0; font-family: monospace; font-size: 12px;">
              <button class="em-btn em-btn-ghost em-btn-sm" @click="mgrPass[mgr.id] = genPw()" style="margin: 0;">生成</button>
              <button class="em-btn em-btn-sm em-btn-warning" @click="saveMgrPw(mgr)" style="margin: 0;">保存</button>
            </div>
            <div v-if="mgrMsg[mgr.id]" style="font-size: 12px; margin-top: 6px;" :style="{ color: mgrMsg[mgr.id]?.startsWith('✅') ? '#86efac' : '#fca5a5' }">{{ mgrMsg[mgr.id] }}</div>
          </div>
        </div>
        <div class="em-modal-actions">
          <button class="em-btn em-btn-secondary" @click="emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
