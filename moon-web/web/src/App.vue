<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  Download,
  Expand,
  Moon,
  Pause,
  Play,
  RotateCcw,
  X,
  Layers,
  SlidersHorizontal,
  MapPin,
  Footprints,
  Sun,
  Settings,
  HelpCircle,
  Type,
  Orbit,
} from "@lucide/vue";
import MoonViewport from "./components/MoonViewport.vue";
import ParameterPanel from "./components/ParameterPanel.vue";
import MapPanel from "./components/MapPanel.vue";
import PointPanel from "./components/PointPanel.vue";
import PointDetails from "./components/PointDetails.vue";
import AstronomyPanel from "./components/AstronomyPanel.vue";
import AstroTimeline from "./components/AstroTimeline.vue";
import OrbitalViewport from "./components/OrbitalViewport.vue";
import { useAstronomy } from "./stores/astronomy";
import { useExplorer } from "./stores/explorer";
import { useCatalog } from "./stores/catalog";
import { epochs } from "./data/moon";
import type { CutawayMode, NavigationMode } from "./types";
const explorer = useExplorer();
const catalog = useCatalog();
const astronomy = useAstronomy();
const viewport = ref<InstanceType<typeof MoonViewport>>();
const orbitalViewport = ref<InstanceType<typeof OrbitalViewport>>();
const activeViewport = computed(() =>
  astronomy.view === "moon" ? viewport.value : orbitalViewport.value,
);
type SceneMode = "explore" | "interior" | "roam" | "system";
type Tool = "parameters" | "maps" | "points" | "scenes" | "astronomy";
const sceneMode = ref<SceneMode>("explore");
const tab = ref<Tool | null>(null);
const ready = ref(false);
const playing = ref(false);
const aboutOpen = ref(false);
const notice = ref("");
const navigation = ref<NavigationMode>("orbit");
const largeText = ref(false);
const timeExpanded = ref(false);
const helpOpen = ref(false);
let shownRoamingHelp = false;
let interiorEpoch = 3;
let interiorCut: CutawayMode = "half";
const workspaces = [
  { id: "explore", label: "月球探索", icon: Moon },
  { id: "interior", label: "内部与演化", icon: Layers },
  { id: "roam", label: "月表漫游", icon: Footprints },
  { id: "system", label: "地月运动", icon: Orbit },
] as const;
const tools = computed(() => {
  if (sceneMode.value === "system")
    return [{ id: "astronomy", label: "运动设置", icon: Settings }] as const;
  if (sceneMode.value === "roam")
    return [
      { id: "scenes", label: "漫游方式", icon: Footprints },
      { id: "astronomy", label: "光照设置", icon: Sun },
    ] as const;
  return [
    { id: "parameters", label: "参数模型", icon: SlidersHorizontal },
    { id: "maps", label: "图层管理", icon: Layers },
    { id: "points", label: "点位管理", icon: MapPin },
    ...(sceneMode.value === "explore"
      ? [{ id: "astronomy" as const, label: "光照设置", icon: Sun }]
      : []),
  ] as const;
});
const toolTitle: Record<Tool, string> = {
  parameters: "月球参数模型",
  maps: "图层管理",
  points: "科普点位",
  scenes: "漫游方式",
  astronomy: "光照与运动设置",
};
const toolCaption: Record<Tool, string> = {
  parameters: "参数",
  maps: "图层",
  points: "点位",
  scenes: "漫游",
  astronomy: "光照",
};
const sceneName = computed(
  () => workspaces.find((item) => item.id === sceneMode.value)!.label,
);
const sceneNote = computed(() =>
  sceneMode.value === "system"
    ? astronomy.trueScale
      ? "真实大小与距离比例"
      : "距离 1/8 · 月球大小 3 倍"
    : sceneMode.value === "interior"
      ? `${explorer.epoch.label} · 教学示意`
      : sceneMode.value === "roam"
        ? "基地与人物为示意"
        : "现今月表 · 可点击查询",
);
function closeDetails() {
  explorer.selectedLayer = null;
  explorer.selectedLandmark = null;
}
watch(
  () => [explorer.selectedLayer, explorer.selectedLandmark],
  ([layer, point]) => {
    if (layer || point) tab.value = null;
  },
);
function openTool(tool: Tool) {
  closeDetails();
  tab.value = tab.value === tool ? null : tool;
}
function pauseDate() {
  astronomy.clock.shouldAnimate = false;
  astronomy.command++;
}
function selectWorkspace(value: SceneMode) {
  if (sceneMode.value === value) return;
  if (sceneMode.value === "interior") {
    interiorEpoch = explorer.epochIndex;
    interiorCut = explorer.cutaway;
  }
  explorer.rememberModel();
  stopNavigation();
  pause();
  closeDetails();
  tab.value = null;
  const view = value === "system" ? "system" : "moon";
  if (astronomy.view !== view) ready.value = false;
  astronomy.view = view;
  sceneMode.value = value;
  timeExpanded.value = value === "system";
  helpOpen.value = false;
  if (value === "interior") {
    pauseDate();
    astronomy.lighting = false;
    explorer.setEpoch(interiorEpoch);
    explorer.cutaway = interiorCut;
    tab.value = "parameters";
  } else {
    if (explorer.epochIndex !== 3) explorer.setEpoch(3);
    explorer.cutaway = "full";
    if (value === "roam") {
      pauseDate();
      tab.value = "scenes";
    }
    if (value === "system") astronomy.lighting = true;
  }
}
const landmark = computed(() =>
  catalog.points.find((p) => p.id === explorer.selectedLandmark),
);
const cuts: { id: CutawayMode; label: string }[] = [
  { id: "full", label: "完整球" },
  { id: "half", label: "移除一半" },
  { id: "quarter", label: "移除 ¼" },
];
const sceneModes: { id: NavigationMode; name: string; description: string }[] =
  [
    {
      id: "orbit",
      name: "自由观察",
      description: "拖动旋转月球，查看图层与圈层。",
    },
    {
      id: "first-person",
      name: "第一视角漫游",
      description: "在开阔月表步行，WASD 移动，方向键转头，Shift 加速。",
    },
    {
      id: "base-tour",
      name: "环游月面基地",
      description: "自动环绕示意基地，观察舱体、太阳能板和通信塔。",
    },
    {
      id: "third-person",
      name: "人物第三视角",
      description: "跟随宇航员探索月表，可自由走离基地，方向键调节视角。",
    },
  ];
let timer: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function pause() {
  clearInterval(timer);
  playing.value = false;
}
function toast(text: string) {
  notice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (notice.value = ""), 4500);
}
function stopNavigation() {
  if (navigation.value !== "orbit") viewport.value?.navigate("orbit");
  navigation.value = "orbit";
}
function selectEpoch(index: number) {
  explorer.rememberModel();
  astronomy.clock.shouldAnimate = false;
  astronomy.command++;
  astronomy.lighting = false;
  pause();
  stopNavigation();
  explorer.setEpoch(index);
  viewport.value?.reset();
}
async function selectCut(cut: CutawayMode) {
  pause();
  stopNavigation();
  explorer.cutaway = cut;
  await nextTick();
  viewport.value?.reset();
}
function navigate(mode: NavigationMode) {
  pause();
  if (mode === "orbit") {
    stopNavigation();
    tab.value = null;
    return;
  }
  navigation.value = mode;
  tab.value = null;
  closeDetails();
  pauseDate();
  if (!shownRoamingHelp) {
    helpOpen.value = true;
    shownRoamingHelp = true;
  }
  explorer.cutaway = "full";
  explorer.hiddenLayers = [];
  viewport.value?.navigate(mode);
}
function inspectBase() {
  selectWorkspace("roam");
  navigate("first-person");
  viewport.value?.inspectBase();
}
function locate(id: string) {
  pause();
  stopNavigation();
  explorer.cutaway = "full";
  const point = catalog.points.find((p) => p.id === id)!;
  point.visible = true;
  explorer.showLandmarks = true;
  explorer.hiddenLayers = [];
  explorer.selectedLayer = null;
  explorer.selectedLandmark = id;
  viewport.value?.flyTo(id);
}
function playback() {
  if (playing.value) {
    pause();
    return;
  }

  astronomy.clock.shouldAnimate = false;
  astronomy.command++;
  astronomy.lighting = false;
  stopNavigation();
  explorer.cutaway = "quarter";
  if (explorer.epochIndex === 3) explorer.setEpoch(0);
  viewport.value?.reset();
  playing.value = true;
  timer = setInterval(() => {
    if (explorer.epochIndex === 3) pause();
    else explorer.setEpoch(explorer.epochIndex + 1);
  }, 7000);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("浏览器未允许全屏，请最大化窗口。");
  }
}
async function downloadImage() {
  try {
    const url = activeViewport.value?.capture();
    if (!url) return;
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    context.fillStyle = "rgba(5,10,15,.9)";
    context.fillRect(0, canvas.height - 85, canvas.width, 85);
    context.fillStyle = "#fff";
    context.font = "14px sans-serif";
    context.fillText(
      `月见 · ${astronomy.view === "system" ? "地月全景" : explorer.epoch.age} · UTC ${astronomy.clock.currentTime.toString()} · ${astronomy.view === "system" ? (astronomy.trueScale ? "真实比例" : "距离1/8、月球大小3倍") : "圈层/基地/人物为教学示意"}`,
      20,
      canvas.height - 53,
      canvas.width - 40,
    );
    context.fillText(
      astronomy.view === "system"
        ? "月球影像：NASA LRO · 地球影像：NASA Blue Marble 2004-09 · 运动/大气：模拟"
        : `现今月表来源：${catalog.mapLayers
            .filter((l) => l.visible)
            .map((l) => l.name)
            .join(" / ")}`,
      20,
      canvas.height - 23,
      canvas.width - 40,
    );
    const link = document.createElement("a");
    link.download = `moon-${explorer.epoch.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (cause) {
    toast(`导出失败：${String(cause)}`);
  }
}
onMounted(() => {
  void catalog.load();
  try {
    explorer.loadModels();
  } catch (cause) {
    toast(`保存的模型读取失败：${String(cause)}`);
  }
});
onBeforeUnmount(() => {
  pause();
  clearTimeout(noticeTimer);
});
</script>

<template>
  <div
    class="immersive-app"
    :class="{
      'large-text': largeText,
      'time-expanded': timeExpanded,
      'geology-mode': sceneMode === 'interior',
    }"
  >
    <main class="scene-canvas" aria-label="月球探索工作区">
      <MoonViewport
        v-if="astronomy.view === 'moon'"
        ref="viewport"
        @ready="ready = true"
        @interact="pause"
      />
      <OrbitalViewport
        v-else
        ref="orbitalViewport"
        @ready="ready = true"
        @interact="pause"
      />
    </main>
    <header class="floating-header">
      <a
        class="brand"
        href="#"
        @click.prevent="
          stopNavigation();
          activeViewport?.reset();
        "
        ><span class="brand-symbol"><Moon :size="22" /></span
        ><strong>月见</strong></a
      >
      <nav class="scene-switcher" aria-label="观察场景">
        <button
          v-for="item in workspaces"
          :key="item.id"
          :aria-pressed="sceneMode === item.id"
          @click="selectWorkspace(item.id)"
        >
          <component :is="item.icon" :size="20" /><span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="floating-actions">
        <button
          class="icon-button"
          :aria-label="largeText ? '标准字号' : '大字模式'"
          :title="largeText ? '标准字号' : '大字模式'"
          :aria-pressed="largeText"
          @click="largeText = !largeText"
        >
          <Type :size="20" />
        </button>
        <button
          class="icon-button"
          aria-label="数据与说明"
          title="数据与说明"
          @click="aboutOpen = true"
        >
          <HelpCircle :size="20" />
        </button>
        <button
          class="icon-button"
          aria-label="全屏"
          title="全屏"
          @click="fullscreen"
        >
          <Expand :size="20" />
        </button>
      </div>
    </header>
    <div class="scene-caption">
      <strong>{{ sceneName }}</strong
      ><span>{{ sceneNote }}</span>
    </div>
    <div v-if="sceneMode === 'system'" class="earth-view-actions">
      <button
        class="secondary-button"
        :disabled="!ready"
        @click="orbitalViewport?.focusEarth()"
      >
        聚焦地球
      </button>
      <button
        class="secondary-button"
        :disabled="!ready"
        @click="orbitalViewport?.reset()"
      >
        返回地月全景
      </button>
    </div>
    <nav class="floating-tools" aria-label="场景工具">
      <button
        v-for="tool in tools"
        :key="tool.id"
        :aria-label="tool.label"
        :title="tool.label"
        :aria-pressed="tab === tool.id"
        @click="openTool(tool.id)"
      >
        <component :is="tool.icon" :size="21" /><span>{{
          tool.id === "astronomy" && sceneMode === "system"
            ? "设置"
            : toolCaption[tool.id]
        }}</span>
      </button>
      <div class="tool-divider" />
      <button
        aria-label="重置视角"
        title="重置视角"
        @click="
          pause();
          stopNavigation();
          activeViewport?.reset();
        "
      >
        <RotateCcw :size="21" /><span>复位</span>
      </button>
      <button
        aria-label="导出场景图片"
        title="导出场景图片"
        :disabled="!ready"
        @click="downloadImage"
      >
        <Download :size="21" /><span>截图</span>
      </button>
    </nav>
    <aside
      v-if="tab"
      class="floating-panel"
      :aria-label="toolTitle[tab]"
      @input="pause"
    >
      <div class="panel-heading">
        <h1>{{ toolTitle[tab] }}</h1>
        <button
          class="icon-button"
          aria-label="关闭操作面板"
          @click="tab = null"
        >
          <X :size="22" />
        </button>
      </div>
      <p v-if="tab === 'parameters'" class="intro">
        调整圈层与年代，查看月表和内部。当前参数为教学示意。
      </p>
      <div
        v-if="tab === 'parameters'"
        class="cutaway-options"
        aria-label="剖切方式"
      >
        <button
          v-for="cut in cuts"
          :key="cut.id"
          :class="{ active: explorer.cutaway === cut.id }"
          :aria-pressed="explorer.cutaway === cut.id"
          @click="selectCut(cut.id)"
        >
          <span class="cut-icon" :class="cut.id" /><small>{{
            cut.label
          }}</small>
        </button>
      </div>
      <ParameterPanel v-if="tab === 'parameters'" />
      <template v-if="tab === 'maps'"
        ><MapPanel @retry="viewport?.reloadMaps()" /><label class="checkbox-row"
          ><input
            type="checkbox"
            v-model="explorer.showGrid"
          />经纬网（完整球）</label
        ><label class="checkbox-row"
          ><input
            type="checkbox"
            v-model="explorer.showLandmarks"
          />显示点位</label
        ></template
      >
      <PointPanel v-if="tab === 'points'" @locate="locate" />
      <AstronomyPanel v-if="tab === 'astronomy'" @base="inspectBase" />
      <section v-if="tab === 'scenes'" class="panel-section">
        <div class="section-label">场景漫游</div>
        <button
          v-for="mode in sceneModes"
          :key="mode.id"
          class="navigation-card"
          :class="{ active: navigation === mode.id }"
          :disabled="!ready"
          @click="navigate(mode.id)"
        >
          <strong>{{ mode.name }}</strong
          ><small>{{ mode.description }}</small>
        </button>
        <p class="panel-note">
          从 20°W、10°N 附近的开阔月表出发，可走离基地。启用 DEM
          时随高程行走；近景月壤纹理、基地与人物为示意，全球数据不含米级地貌。
        </p>
      </section>
    </aside>
    <div
      v-if="astronomy.view === 'moon' && (explorer.selection || landmark)"
      class="detail-card rich-detail floating-detail"
    >
      <button
        class="icon-button detail-close"
        aria-label="关闭详情"
        @click="
          explorer.selectedLayer = null;
          explorer.selectedLandmark = null;
        "
      >
        <X :size="16" />
      </button>
      <PointDetails v-if="landmark" :point="landmark" />
      <template v-else-if="explorer.selection"
        ><span class="eyebrow">{{ explorer.selection.english }}</span>
        <h3>{{ explorer.selection.name }}</h3>
        <p>{{ explorer.selection.description }}</p>
        <dl>
          <div>
            <dt>半径范围 / km</dt>
            <dd>
              {{ explorer.selection.innerRadiusKm.toFixed(1) }}–{{
                explorer.selection.outerRadiusKm.toFixed(1)
              }}
            </dd>
          </div>
          <div>
            <dt>厚度 / km</dt>
            <dd>
              {{
                (
                  explorer.selection.outerRadiusKm -
                  explorer.selection.innerRadiusKm
                ).toFixed(1)
              }}
            </dd>
          </div>
        </dl>
        <span class="inline-note">当前参数为教学示意</span></template
      >
    </div>

    <div v-if="sceneMode === 'roam'" class="roaming-strip">
      <strong>{{ sceneModes.find((s) => s.id === navigation)?.name }}</strong>
      <button @click="helpOpen = !helpOpen">
        {{ helpOpen ? "收起操作说明" : "操作说明" }}
      </button>
      <button v-if="navigation !== 'orbit'" @click="stopNavigation">
        退出漫游
      </button>
      <button v-else @click="openTool('scenes')">选择漫游方式</button>
      <p v-if="helpOpen">
        点击月面后 WASD 移动 · 方向键转头 · Shift
        加速。输入框获得焦点时不会触发步行。
      </p>
    </div>
    <div class="floating-time">
      <AstroTimeline
        v-if="sceneMode !== 'interior'"
        :expanded="timeExpanded"
        @toggle="timeExpanded = !timeExpanded"
      />
      <section v-else class="timeline-panel" aria-label="演化阶段">
        <button
          class="play-button"
          :disabled="!ready"
          :aria-label="playing ? '暂停演示' : '播放演示'"
          @click="playback"
        >
          <Pause v-if="playing" :size="19" /><Play v-else :size="19" />
        </button>
        <div class="timeline-label">
          <strong>演化场景</strong><small>切换会载入该阶段参数</small>
        </div>
        <div class="timeline-track">
          <button
            v-for="(epoch, index) in epochs"
            :key="epoch.id"
            :class="{ active: explorer.epochIndex === index }"
            @click="selectEpoch(index)"
          >
            <span class="timeline-node" /><strong>{{ epoch.age }}</strong
            ><small>{{ epoch.label }}</small>
          </button>
        </div>
      </section>
    </div>
    <div class="scene-status" role="status">
      <span class="status-dot" :class="{ ready }" />{{
        ready ? "场景已就绪" : "正在准备场景"
      }}
    </div>
    <div v-if="sceneMode !== 'system'" class="source-credit">
      NASA / USGS · 现今数据与教学示意分开标注
    </div>
    <div
      v-if="aboutOpen"
      class="modal-backdrop"
      @click.self="aboutOpen = false"
    >
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="数据与说明"
      >
        <button class="modal-close" @click="aboutOpen = false">关闭</button>
        <h2>数据、模型与演示边界</h2>
        <p>
          三个早期阶段与现今状态共用一套参数化圈层。早期圈层参数尚待科学核定；当前叠加的地图属于现今月表，不是早期表面重建。
        </p>
        <p>
          NASA LRO 影像、LOLA 0.25° 高程与 NASA Trek
          在线图层已接入。高程为全球概览，尚不满足合同 0.0625°
          的最终数据要求，也不能支持基地尺度的真实地形细节。
        </p>
        <p>
          {{ catalog.points.length }} 个科普点位来自 USGS/IAU 地名目录与 LROC
          着陆目标资料。大地貌的矢量点表示中心，不是范围边界。可在点位管理中编辑、导入、导出。
        </p>
        <p>
          基地及人物是原创示意几何，漫游沿月球表面行走。年代参数、图层配置和点位修改可保存在本浏览器。后续接入服务端共享管理。
        </p>
        <a
          href="https://svs.gsfc.nasa.gov/4720/"
          target="_blank"
          rel="noreferrer"
          >NASA 影像与高程说明 ↗</a
        ><a
          href="https://planetarynames.wr.usgs.gov/GIS_Downloads"
          target="_blank"
          rel="noreferrer"
          >USGS / IAU 地名数据 ↗</a
        >
      </section>
    </div>
    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
  </div>
</template>
