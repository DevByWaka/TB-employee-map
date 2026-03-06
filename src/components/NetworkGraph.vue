<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'
import { graphSettings } from '@/stores/graphSettings'

const store = useEmployeeMapStore()
const container = ref(null)
const emit = defineEmits(['nodeClick', 'edgeClick', 'ready'])

let network = null

function buildOptions() {
  const s = graphSettings.values
  return {
    nodes: {
      shape: 'dot', size: 25,
      font: { size: 14, color: '#f3f4f6', face: 'Noto Sans JP' },
      borderWidth: 2, borderWidthSelected: 4,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 8 },
    },
    edges: {
      width: 2,
      smooth: { type: 'continuous', roundness: s.roundness },
      shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5 },
    },
    groups: {
      employee: { color: { background: '#2563eb', border: '#1e40af', highlight: { background: '#3b82f6', border: '#2563eb' }, hover: { background: '#3b82f6', border: '#2563eb' } } },
      site:     { color: { background: '#dc2626', border: '#991b1b', highlight: { background: '#ef4444', border: '#dc2626' }, hover: { background: '#ef4444', border: '#dc2626' } } },
      manager:  { color: { background: '#16a34a', border: '#14532d', highlight: { background: '#22c55e', border: '#16a34a' }, hover: { background: '#22c55e', border: '#16a34a' } }, shape: 'diamond', size: 20 },
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: s.gravitationalConstant,
        centralGravity:        s.centralGravity,
        springLength:          s.springLength,
        springConstant:        s.springConstant,
        damping:               s.damping,
        avoidOverlap:          s.avoidOverlap,
      },
      stabilization: { enabled: true, iterations: 100 },
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
  }
}

onMounted(() => {
  const vis = window.vis
  const nodes = new vis.DataSet([])
  const edges = new vis.DataSet([])

  store.injectDataSets(nodes, edges)

  network = new vis.Network(container.value, { nodes, edges }, buildOptions())

  network.on('click', params => {
    if (params.nodes.length > 0) emit('nodeClick', params.nodes[0])
    else if (params.edges.length > 0) emit('edgeClick', params.edges[0])
  })

  emit('ready')

  document.addEventListener('visibilitychange', onVisChange)
  window.addEventListener('online', onOnline)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisChange)
  window.removeEventListener('online', onOnline)
  network?.destroy()
})

async function onVisChange() {
  if (document.visibilityState === 'visible' && store.dbConnected) {
    await store.loadFromDb(true); store.subscribeRealtime(); store.startPolling(5000)
  } else { store.stopPolling() }
}
async function onOnline() {
  if (store.dbConnected) { await store.loadFromDb(true); store.subscribeRealtime(); store.startPolling(5000) }
}

function focusNode(nodeId) {
  network?.focus(nodeId, { scale: 1.2, animation: { duration: 400, easingFunction: 'easeInOutQuad' } })
  network?.selectNodes([nodeId])
}

// 物理設定をリアルタイムで適用
function applyPhysics() {
  if (!network) return
  const s = graphSettings.values
  network.setOptions({
    edges: { smooth: { type: 'continuous', roundness: s.roundness } },
    physics: {
      barnesHut: {
        gravitationalConstant: s.gravitationalConstant,
        centralGravity:        s.centralGravity,
        springLength:          s.springLength,
        springConstant:        s.springConstant,
        damping:               s.damping,
        avoidOverlap:          s.avoidOverlap,
      },
    },
  })
}

defineExpose({ focusNode, applyPhysics })
</script>

<template>
  <div ref="container" class="network-canvas" />
</template>
