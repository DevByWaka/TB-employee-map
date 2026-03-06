<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useEmployeeMapStore , getNodes} from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const emit = defineEmits(['close'])

const admins = ref([])
const managers = computed(() => {
  store.nodeVersion
  return getNodes()?.get({ filter: n => n.group === 'manager' }) || []
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
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal" style="max-width: 600px;">
        <div class="modal-header">
          <div class="modal-title">👑 管理者パネル</div>
          <button class="modal-close" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">

          <!-- 管理者アカウント一覧 -->
          <div class="view-title">管理者アカウント</div>
          <div v-if="!admins.length" class="no-assign">管理者なし</div>
          <div v-for="a in admins" :key="a.id" class="assign-item">
            <div style="flex: 1;">
              <div class="assign-name">👑 {{ a.name }}</div>
              <div style="font-size: 11px; color: var(--em-muted);">社員ID: {{ a.employee_id }}</div>
            </div>
            <button class="assign-del" @click="removeAdmin(a.id)">削除</button>
          </div>

          <hr class="divider">
          <div class="view-title">管理者を追加</div>
          <div class="form-group"><label class="label">名前</label><input class="input" v-model="newAdmin.name" placeholder=""></div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="form-group"><label class="label">社員ID</label><input class="input" v-model="newAdmin.empId" placeholder="" style="font-family: monospace;"></div>
            <div class="form-group">
              <label class="label">パスワード</label>
              <div style="display: flex; gap: 5px;">
                <input class="input" v-model="newAdmin.password" style="flex: 1; margin: 0; font-family: monospace; font-size: 12px;">
                <button class="btn btn-ghost btn-sm" @click="newAdmin.password = genPw()" style="margin: 0;">生成</button>
              </div>
            </div>
          </div>
          <div v-if="adminError" style="font-size: 12px; color: #f87171; margin-bottom: 8px;">{{ adminError }}</div>
          <button class="btn" @click="addAdmin">管理者を追加</button>

          <hr class="divider">
          <!-- 担当者パスワード管理 -->
          <div class="view-title">担当者パスワード管理</div>
          <div v-if="!managers.length" class="no-assign">担当者なし</div>
          <div v-for="mgr in managers" :key="mgr.id" style="background: rgba(22,163,74,0.05); border: 1px solid rgba(22,163,74,0.2); border-radius: 8px; padding: 11px 13px; margin-bottom: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--em-text); margin-bottom: 8px;">🟢 {{ mgr.label }}</div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="text" class="input" v-model="mgrPass[mgr.id]" :placeholder="mgr.password ? '••••••••' : '未設定'" style="flex: 1; margin: 0; font-family: monospace; font-size: 12px;">
              <button class="btn btn-ghost btn-sm" @click="mgrPass[mgr.id] = genPw()" style="margin: 0;">生成</button>
              <button class="btn btn-sm btn-warn" @click="saveMgrPw(mgr)" style="margin: 0;">保存</button>
            </div>
            <div v-if="mgrMsg[mgr.id]" style="font-size: 12px; margin-top: 6px;" :style="{ color: mgrMsg[mgr.id]?.startsWith('✅') ? '#86efac' : '#fca5a5' }">{{ mgrMsg[mgr.id] }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-red" @click="emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
