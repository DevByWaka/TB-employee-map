// グラフ物理設定のシングルトン
// NetworkGraph と SettingsModal が同じインスタンスを参照する

const DEFAULTS = {
  springLength:          200,   // ノード間の距離
  springConstant:       0.04,   // バネの硬さ
  gravitationalConstant: -8000, // 引力（マイナスが反発）
  centralGravity:        0.3,   // 中心への引力
  damping:               0.09,  // 減衰（動きの収まりやすさ）
  avoidOverlap:          0.5,   // ノード重なり回避
  roundness:             0.5,   // 線の曲がり具合
}

const STORAGE_KEY = 'graph_physics'

function load() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULTS }
}

export const graphSettings = {
  values: load(),

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values))
  },

  reset() {
    this.values = { ...DEFAULTS }
    localStorage.removeItem(STORAGE_KEY)
  },
}
