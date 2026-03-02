<script setup>
import { ref } from 'vue'
import { useEmployeeMapStore, getEdges } from '@/stores/employeeMap'

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

const activeNode     = ref(null)
const activeEdge     = ref(null)
const activeCustomer = ref(null)
const showSettings   = ref(false)
const showAdmin      = ref(false)
const showAddMgr     = ref(false)

function onNodeClick(id) {
  activeEdge.value = null; activeCustomer.value = null; activeNode.value = id
}
function onEdgeClick(id) {
  activeNode.value = null; activeCustomer.value = null; activeEdge.value = null
  const edge = getEdges()?.get(id)
  if (!edge) return
  if (edge.edgeType === 'manager-site') activeCustomer.value = id
  else if (edge.edgeType !== 'manages') activeEdge.value = id
}

async function onGraphReady() {
  if (store.dbConnected) {
    await store.loadFromDb()
    store.subscribeRealtime()
    store.startPolling(5000)
  }
}
</script>

<template>
  <div class="app-root" style="height:100vh;overflow:hidden;">
    <LoginOverlay v-if="!store.currentUser" @loggedIn="() => {}" />

    <template v-else>
      <div class="layout" :class="{ 'sidebar-hidden': !sidebarOpen }">
        <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen">
          {{ sidebarOpen ? '◀' : '▶' }}
        </button>

        <AppSidebar
          :networkRef="networkRef"
          @openSettings="showSettings = true"
          @openAdmin="showAdmin = true"
          @openAddManager="showAddMgr = true"
        />

        <NetworkGraph
          ref="networkRef"
          @nodeClick="onNodeClick"
          @edgeClick="onEdgeClick"
          @ready="onGraphReady"
        />
      </div>

      <NodeModal       v-if="activeNode"     :nodeId="activeNode"     @close="activeNode = null" />
      <EdgeModal       v-if="activeEdge"     :edgeId="activeEdge"     @close="activeEdge = null" />
      <CustomerModal   v-if="activeCustomer" :edgeId="activeCustomer" @close="activeCustomer = null" />
      <AddManagerModal v-if="showAddMgr"     @close="showAddMgr = false" />
      <SettingsModal   v-if="showSettings"   @close="showSettings = false" />
      <AdminPanel      v-if="showAdmin"      @close="showAdmin = false" />
    </template>
  </div>
</template>
