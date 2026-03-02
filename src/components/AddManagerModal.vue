<script setup>
import { ref, reactive } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const emit = defineEmits(['close'])

const form = reactive({ name: '', empId: '', password: '' })
const error = ref('')

function genPw() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  form.password = pw
}

async function submit() {
  error.value = ''
  if (!form.name)     { error.value = '担当者名を入力してください'; return }
  if (!form.empId)    { error.value = '社員IDを入力してください'; return }
  if (!form.password) { error.value = 'パスワードを入力してください'; return }
  try {
    await store.addManager(form.name, form.empId, form.password)
    form.name = ''; form.empId = ''; form.password = ''
    emit('close')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg app-root" @click.self="emit('close')">
      <div class="modal" style="max-width: 420px;">
        <div class="modal-header">
          <div class="modal-title">担当者を追加</div>
          <button class="modal-close" @click="emit('close')">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group"><label class="label">担当者名 *</label><input class="input" v-model="form.name" placeholder=""></div>
          <div class="form-group"><label class="label">社員ID *</label><input class="input" v-model="form.empId" placeholder="" style="font-family: monospace;"></div>
          <div class="form-group">
            <label class="label">パスワード *</label>
            <div style="display: flex; gap: 6px;">
              <input class="input" v-model="form.password" placeholder="" style="flex: 1; margin: 0; font-family: monospace;">
              <button class="btn btn-ghost btn-sm" @click="genPw" style="margin: 0; flex-shrink: 0;">生成</button>
            </div>
          </div>
          <div style="min-height: 18px; font-size: 12px; color: #f87171; margin-bottom: 8px;">{{ error }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="submit">追加する</button>
          <button class="btn btn-red" @click="emit('close')">キャンセル</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
