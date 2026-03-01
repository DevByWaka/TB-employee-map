<script setup>
import { ref } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

import LoginOverlay    from '@/components/LoginOverlay.vue'
import NetworkGraph    from '@/components/NetworkGraph.vue'
import AppSidebar      from '@/components/AppSidebar.vue'
import NodeModal       from '@/components/NodeModal.vue'
import EdgeModal       from '@/components/EdgeModal.vue'
import CustomerModal   from '@/components/CustomerModal.vue'
import AddManagerModal from '@/components/AddManagerModal.vue'
import SettingsModal   from '@/components/SettingsModal.vue'
import AdminPanel      from '@/components/AdminPanel.vue'

const store       = useEmployeeMapStore()
const networkRef  = ref(null)
const sidebarOpen = ref(true)

const activeNodeId       = ref(null)
const activeEdgeId       = ref(null)
const activeCustomerEdge = ref(null)
const showSettings       = ref(false)
const showAdmin          = ref(false)
const showAddManager     = ref(false)

function onNodeClick(nodeId) {
  const node = store.getNodes()?.get(nodeId)
  if (!node) return
  activeEdgeId.value = null
  activeCustomerEdge.value = null
  activeNodeId.value = nodeId
}

function onEdgeClick(edgeId) {
  const edge = store.getEdges()?.get(edgeId)
  if (!edge) return
  activeNodeId.value = null
  activeCustomerEdge.value = null
  if (edge.edgeType === 'manager-site') {
    activeCustomerEdge.value = edgeId
  } else if (edge.edgeType !== 'manages') {
    activeEdgeId.value = edgeId
  }
}

// ログイン完了 → グラフはこの後マウントされるので何もしない
function onLoggedIn() {}

// NetworkGraph の onMounted 完了後（DataSet注入済み）に呼ばれる
async function onGraphReady() {
  if (store.dbConnected) {
    await store.loadFromDb()
    store.subscribeRealtime()
    store.startPolling(5000)
  }
}
</script>

<template>
  <div class="em-root" style="height:100vh;overflow:hidden;">

    <LoginOverlay v-if="!store.currentUser" @loggedIn="onLoggedIn" />

    <template v-else>
      <button class="em-toggle" @click="sidebarOpen = !sidebarOpen">
        {{ sidebarOpen ? '◀' : '▶' }}
      </button>

      <div class="em-layout" :class="{ 'sidebar-hidden': !sidebarOpen }">
        <AppSidebar
          :networkRef="networkRef"
          @openSettings="showSettings = true"
          @openAdmin="showAdmin = true"
          @openAddManager="showAddManager = true"
        />
        <NetworkGraph
          ref="networkRef"
          @nodeClick="onNodeClick"
          @edgeClick="onEdgeClick"
          @ready="onGraphReady"
        />
      </div>

      <NodeModal       v-if="activeNodeId"       :nodeId="activeNodeId"       @close="activeNodeId = null" />
      <EdgeModal       v-if="activeEdgeId"       :edgeId="activeEdgeId"       @close="activeEdgeId = null" />
      <CustomerModal   v-if="activeCustomerEdge" :edgeId="activeCustomerEdge" @close="activeCustomerEdge = null" />
      <AddManagerModal v-if="showAddManager"     @close="showAddManager = false" />
      <SettingsModal   v-if="showSettings"       @close="showSettings = false" />
      <AdminPanel      v-if="showAdmin"          @close="showAdmin = false" />
    </template>

  </div>
</template>
