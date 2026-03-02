<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useEmployeeMapStore } from '@/stores/employeeMap'

const store = useEmployeeMapStore()
const container = ref(null)
const emit = defineEmits(['nodeClick', 'edgeClick', 'ready'])

let network = null
let _nodes = null
let _edges = null

onMounted(async () => {
  const vis = window.vis

  _nodes = new vis.DataSet([])
  _edges = new vis.DataSet([])

  store.injectDataSets(_nodes, _edges)

  const options = {
    nodes: {
      shape: 'dot', size: 25,
      font: { size: 14, color: '#f3f4f6', face: 'Noto Sans JP' },
      borderWidth: 2, borderWidthSelected: 4,
      shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 8 },
    },
    edges: {
      width: 2,
      smooth: { type: 'continuous', roundness: 0.5 },
      shadow: { enabled: true, color: 'rgba(0,0,0,0.2)', size: 5 },
    },
    groups: {
      employee: { color: { background: '#2563eb', border: '#1e40af', highlight: { background: '#3b82f6', border: '#2563eb' }, hover: { background: '#3b82f6', border: '#2563eb' } } },
      site:     { color: { background: '#dc2626', border: '#991b1b', highlight: { background: '#ef4444', border: '#dc2626' }, hover: { background: '#ef4444', border: '#dc2626' } } },
      manager:  { color: { background: '#16a34a', border: '#14532d', highlight: { background: '#22c55e', border: '#16a34a' }, hover: { background: '#22c55e', border: '#16a34a' } }, shape: 'diamond', size: 20 },
    },
    physics: {
      enabled: true,
      barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 200, springConstant: 0.04, damping: 0.09, avoidOverlap: 0.5 },
      stabilization: { enabled: true, iterations: 100 },
    },
    interaction: { hover: true, tooltipDelay: 100, dragNodes: true, dragView: true, zoomView: true },
  }

  network = new vis.Network(container.value, { nodes: _nodes, edges: _edges }, options)

  network.on('click', (params) => {
    if (params.nodes.length > 0) emit('nodeClick', params.nodes[0])
    else if (params.edges.length > 0) emit('edgeClick', params.edges[0])
  })

  emit('ready')

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('online', onOnline)
  if (network) network.destroy()
})

async function onVisibilityChange() {
  if (document.visibilityState === 'visible' && store.dbConnected) {
    await store.loadFromDb(true)
    store.subscribeRealtime()
    store.startPolling(5000)
  } else {
    store.stopPolling()
  }
}
async function onOnline() {
  if (store.dbConnected) {
    await store.loadFromDb(true)
    store.subscribeRealtime()
    store.startPolling(5000)
  }
}

function focusNode(nodeId) {
  network?.focus(nodeId, { scale: 1.2, animation: { duration: 400, easingFunction: 'easeInOutQuad' } })
  network?.selectNodes([nodeId])
}

// DataSet を外部に公開
function getNodes() { return _nodes }
function getEdges() { return _edges }

defineExpose({ focusNode, getNodes, getEdges })
</script>

<template>
  <div ref="container" class="em-network" />
</template>
