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
  Compass,
  ChevronLeft,
  ChevronRight,
} from "@lucide/vue";
import MoonViewport from "./components/MoonViewport.vue";
import GeologyViewport from "./components/GeologyViewport.vue";
import { geologyExhibits } from "./data/lunarGeology";
import ParameterPanel from "./components/ParameterPanel.vue";
import MapPanel from "./components/MapPanel.vue";
import PointPanel from "./components/PointPanel.vue";
import PointDetails from "./components/PointDetails.vue";
import ExplorationWelcome from "./components/ExplorationWelcome.vue";
import { explorationThemes } from "./data/pointStories";
import AstronomyPanel from "./components/AstronomyPanel.vue";
import RoverControls from "./components/RoverControls.vue";
import InteriorControls from "./components/InteriorControls.vue";
import EvolutionTour from "./components/EvolutionTour.vue";
import { useEvolutionTour } from "./stores/evolutionTour";
import AstroTimeline from "./components/AstroTimeline.vue";
import OrbitalViewport from "./components/OrbitalViewport.vue";
import { useAstronomy } from "./stores/astronomy";
import { useExplorer } from "./stores/explorer";
import { useCatalog } from "./stores/catalog";
import { epochs } from "./data/moon";
import type { CutawayMode, NavigationMode, LunarPoint } from "./types";
import type { PointModelState } from "./scene/PointModelLayer";
const explorer = useExplorer();
const catalog = useCatalog();
const astronomy = useAstronomy();
const tour = useEvolutionTour();
const viewport = ref<InstanceType<typeof MoonViewport>>();
const mapModelState = ref<PointModelState | null>(null);
const orbitalViewport = ref<InstanceType<typeof OrbitalViewport>>();
const geologyViewport = ref<InstanceType<typeof GeologyViewport>>();
const geologyOpen = ref(false);
const geologyStage = ref(2);
const activeViewport = computed(() =>
  geologyOpen.value
    ? geologyViewport.value
    : astronomy.view === "moon"
      ? viewport.value
      : orbitalViewport.value,
);
type SceneMode = "explore" | "interior" | "roam" | "system";
type Tool = "parameters" | "maps" | "points" | "scenes" | "astronomy";
const sceneMode = ref<SceneMode>("explore");
const tab = ref<Tool | null>(null);
const welcomeOpen = ref(true);
const explorationTheme = ref<string | null>(null);
const themeStep = ref(0);
const availableThemes = computed(() => {
  const ids = new Set(catalog.points.map((point) => point.id));
  return explorationThemes
    .map((theme) => ({
      ...theme,
      pointIds: theme.pointIds.filter((id) => ids.has(id)),
    }))
    .filter((theme) => theme.pointIds.length);
});
const activeTheme = computed(() =>
  availableThemes.value.find((theme) => theme.id === explorationTheme.value),
);
const ready = ref(false);
const playing = computed(() => tour.playing);
const aboutOpen = ref(false);
const notice = ref("");
const navigation = ref<NavigationMode>("orbit");
const largeText = ref(false);
const timeExpanded = ref(false);
const helpOpen = ref(false);
let shownRoamingHelp = false;
let interiorEpoch = 3;
let interiorCut: CutawayMode = "quarter";
const workspaces = [
  { id: "explore", label: "月球探索", icon: Moon },
  { id: "interior", label: "内部与演化", icon: Layers },
  { id: "roam", label: "月表漫游", icon: Footprints },
  { id: "system", label: "地月运动", icon: Orbit },
] as const;
const tools = computed(() => {
  if (geologyOpen.value) return [];
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
    { id: "points", label: "科普探索", icon: MapPin },
    ...(sceneMode.value === "explore"
      ? [{ id: "astronomy" as const, label: "光照设置", icon: Sun }]
      : []),
  ] as const;
});
const toolTitle: Record<Tool, string> = {
  parameters: "月球参数模型",
  maps: "图层管理",
  points: "科普探索",
  scenes: "漫游方式",
  astronomy: "光照与运动设置",
};
const toolCaption: Record<Tool, string> = {
  parameters: "参数",
  maps: "图层",
  points: "科普",
  scenes: "漫游",
  astronomy: "光照",
};
const sceneName = computed(
  () => workspaces.find((item) => item.id === sceneMode.value)!.label,
);
function closeDetails() {
  explorer.selectedLayer = null;
  explorer.selectedLandmark = null;
}
function openGeology() {
  tour.stop();
  pauseDate();
  closeDetails();
  tab.value = null;
  ready.value = false;
  geologyOpen.value = true;
}
function closeGeology() {
  geologyOpen.value = false;
  ready.value = false;
}
watch(
  () => [explorer.selectedLayer, explorer.selectedLandmark],
  ([layer, point]) => {
    if (layer || point) {
      tab.value = null;
      welcomeOpen.value = false;
    }
  },
);
function openTool(tool: Tool) {
  if (tool === "points") endExplorationTheme();
  if (sceneMode.value === "interior") tour.pause();
  closeDetails();
  welcomeOpen.value = false;
  tab.value = tab.value === tool ? null : tool;
}
function pauseDate() {
  astronomy.clock.shouldAnimate = false;
  astronomy.command++;
}
function selectWorkspace(value: SceneMode) {
  if (sceneMode.value === value) return;
  viewport.value?.clearPointModel();
  endExplorationTheme();
  welcomeOpen.value = value === "explore";
  const leavingInterior = sceneMode.value === "interior";
  if (geologyOpen.value) {
    geologyOpen.value = false;
    ready.value = false;
  }
  tour.stop();
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
  explorer.exhibitEnabled = value === "interior";
  explorer.expanded = false;
  timeExpanded.value = value === "system";
  helpOpen.value = false;
  if (value === "interior") {
    explorer.evolutionRunning = true;
    pauseDate();
    astronomy.lighting = false;
    explorer.setEpoch(interiorEpoch);
    explorer.cutaway = interiorCut;
    void nextTick(() => viewport.value?.reset());
  } else {
    if (explorer.epochIndex !== 3) explorer.setEpoch(3);
    explorer.cutaway = "full";
    if (leavingInterior && value !== "system")
      void nextTick(() => viewport.value?.reset());
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
      id: "rover",
      name: "月球车轨迹行驶",
      description: "沿月面路线自动行驶，切换自由、固定跟随和车载第一视角。",
    },
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
      description: "环绕月面基地，观察舱体、太阳能板和通信塔。",
    },
    {
      id: "third-person",
      name: "人物第三视角",
      description: "跟随宇航员探索月表，可自由走离基地，方向键调节视角。",
    },
  ];
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function pause() {
  tour.pause();
}
watch(
  () => tour.command,
  async () => {
    tab.value = null;
    await nextTick();
    if (tour.active && !explorer.selectedLayer) viewport.value?.reset();
  },
);
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
  tour.stop();
  explorer.rememberModel();
  astronomy.clock.shouldAnimate = false;
  astronomy.command++;
  astronomy.lighting = false;
  pause();
  stopNavigation();
  explorer.setEpoch(index);
  explorer.evolutionRunning = true;
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
async function locate(id: string) {
  const point = catalog.points.find((p) => p.id === id);
  if (!point) return;
  pause();
  stopNavigation();
  if (sceneMode.value !== "explore") selectWorkspace("explore");
  welcomeOpen.value = false;
  explorer.cutaway = "full";
  point.visible = true;
  explorer.showLandmarks = true;
  explorer.hiddenLayers = [];
  explorer.selectedLayer = null;
  explorer.selectedLandmark = id;
  await nextTick();
  viewport.value?.flyTo(id);
}
async function startExplorationTheme(id: string) {
  const theme = availableThemes.value.find((item) => item.id === id);
  if (!theme) return;
  explorationTheme.value = id;
  themeStep.value = 0;
  for (const point of catalog.points)
    if (theme.pointIds.includes(point.id)) point.visible = true;
  await locate(theme.pointIds[0]!);
  viewport.value?.setTheme(theme.pointIds);
}
function stepExplorationTheme(direction: number) {
  const theme = activeTheme.value!;
  themeStep.value =
    (themeStep.value + direction + theme.pointIds.length) %
    theme.pointIds.length;
  viewport.value?.clearPointModel();
  void locate(theme.pointIds[themeStep.value]!);
}
function endExplorationTheme() {
  explorationTheme.value = null;
  viewport.value?.setTheme([]);
}
async function loadPointModel(point: LunarPoint) {
  pause();
  pauseDate();
  stopNavigation();
  if (sceneMode.value !== "explore") selectWorkspace("explore");
  explorer.cutaway = "full";
  explorer.hiddenLayers = [];
  await nextTick();
  viewport.value?.loadPointModel(point);
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
  tour.resume();
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
      geologyOpen.value
        ? `${geologyExhibits[geologyStage.value]!.name} · 月球局部构造`
        : `${sceneName.value} · ${astronomy.view === "system" ? "地月全景" : explorer.epoch.age} · UTC ${astronomy.clock.currentTime.toString()}`,
      20,
      canvas.height - 53,
      canvas.width - 40,
    );
    context.fillText(
      geologyOpen.value
        ? "科学参考：NASA / LPI"
        : astronomy.view === "system"
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
    link.download = geologyOpen.value
      ? `lunar-geology-${geologyExhibits[geologyStage.value]!.id}.png`
      : `moon-${explorer.epoch.id}.png`;
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
      <GeologyViewport
        v-if="geologyOpen"
        ref="geologyViewport"
        :initial-stage="explorer.epochIndex"
        @ready="ready = true"
        @close="closeGeology"
        @stage="geologyStage = $event"
      />
      <MoonViewport
        v-else-if="astronomy.view === 'moon'"
        ref="viewport"
        @ready="ready = true"
        @interact="pause"
        @point-model="mapModelState = $event"
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
        ><strong>{{ sceneName }}</strong></a
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
    <InteriorControls
      v-if="sceneMode === 'interior' && !geologyOpen"
      @overview="viewport?.reset()"
      @local="openGeology"
    />
    <EvolutionTour v-if="sceneMode === 'interior' && !geologyOpen" />
    <ExplorationWelcome
      v-if="sceneMode === 'explore' && welcomeOpen && !tab && !landmark"
      :points="catalog.points"
      @close="welcomeOpen = false"
      @locate="locate"
      @theme="startExplorationTheme"
    />
    <button
      v-if="
        sceneMode === 'explore' &&
        !welcomeOpen &&
        !tab &&
        !activeTheme &&
        !mapModelState
      "
      class="exploration-return secondary-button"
      @click="
        closeDetails();
        welcomeOpen = true;
        viewport?.reset();
      "
    >
      <Compass :size="19" />精选探索
    </button>
    <div
      v-if="activeTheme && sceneMode === 'explore' && !mapModelState"
      class="exploration-tour"
      aria-label="科普线路"
    >
      <div>
        <span
          >科普线路 · {{ themeStep + 1 }} /
          {{ activeTheme.pointIds.length }}</span
        ><strong>{{ activeTheme.title }}</strong>
      </div>
      <button
        class="icon-button"
        aria-label="上一个科普地点"
        @click="stepExplorationTheme(-1)"
      >
        <ChevronLeft :size="21" />
      </button>
      <button class="primary-button" @click="stepExplorationTheme(1)">
        下一站<ChevronRight :size="18" />
      </button>
      <button
        class="icon-button"
        aria-label="结束科普线路"
        @click="endExplorationTheme"
      >
        <X :size="18" />
      </button>
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
        @click="orbitalViewport?.focusMoon()"
      >
        聚焦月球
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
        <details>
          <summary>场景说明</summary>
          <p class="panel-note">
            从 20°W、10°N 附近的月表出发。启用 DEM 后沿地形高程行走。
          </p>
        </details>
      </section>
    </aside>
    <div
      v-if="
        !geologyOpen &&
        astronomy.view === 'moon' &&
        (explorer.selection || landmark)
      "
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
      <PointDetails
        v-if="landmark"
        :point="landmark"
        :model-state="mapModelState"
        @load-model="loadPointModel(landmark)"
      />
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
      </template>
    </div>

    <div v-if="sceneMode === 'roam'" class="roaming-strip">
      <strong>{{ sceneModes.find((s) => s.id === navigation)?.name }}</strong>
      <RoverControls v-if="navigation === 'rover'" />
      <button v-else class="text-button" @click="helpOpen = !helpOpen">
        {{ helpOpen ? "收起操作说明" : "操作说明" }}
      </button>
      <button
        v-if="navigation !== 'orbit'"
        class="secondary-button"
        @click="stopNavigation"
      >
        退出漫游
      </button>
      <button v-else class="primary-button" @click="openTool('scenes')">
        选择漫游方式
      </button>
      <p v-if="helpOpen && navigation !== 'rover'">
        点击月面后 WASD 移动 · 方向键转头 · Shift
        加速。输入框获得焦点时不会触发步行。
      </p>
    </div>
    <div
      v-if="mapModelState"
      class="map-model-actions"
      aria-label="地图模型操作"
    >
      <strong>{{ mapModelState.title }}</strong>
      <button
        class="secondary-button"
        :disabled="mapModelState.status !== 'ready'"
        @click="viewport?.focusPointModel()"
      >
        聚焦模型
      </button>
      <button
        class="icon-button"
        aria-label="移除地图模型"
        title="移除模型"
        @click="viewport?.clearPointModel()"
      >
        <X :size="20" />
      </button>
    </div>
    <div v-if="!geologyOpen" class="floating-time">
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
          <strong>演化场景</strong><small>播放分步讲解</small>
        </div>
        <div class="timeline-track">
          <button
            v-for="(epoch, index) in epochs"
            :key="epoch.id"
            :class="{ active: explorer.epochIndex === index }"
            :aria-pressed="explorer.epochIndex === index"
            @click="selectEpoch(index)"
          >
            <span class="timeline-node" /><strong>{{ epoch.age }}</strong
            ><small>{{ epoch.label }}</small>
          </button>
        </div>
      </section>
    </div>
    <div
      class="scene-status"
      :class="{ 'visually-hidden': ready }"
      role="status"
    >
      <span class="status-dot" :class="{ ready }" />{{
        ready ? "场景已就绪" : "正在准备场景"
      }}
    </div>
    <div v-if="sceneMode !== 'system'" class="source-credit">
      {{ geologyOpen ? "原创模型 · NASA / LPI 科学参考" : "NASA / USGS" }}
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
        <h2>数据与资料</h2>
        <p>
          月表影像来自 NASA LRO，地形采用 LOLA 0.25° 高程网格，在线专题地图由
          NASA Trek 提供。
        </p>
        <p>
          科普目录收录 {{ catalog.points.length }} 个地点，地名与命名范围来自
          USGS / IAU，着陆点资料来自 LROC。
        </p>
        <p>
          图片署名与文献随地点展板展示。可在科普探索的资料管理中编辑、导入与导出点位资料。
        </p>
        <p>年代参数、图层配置和点位修改保存在当前浏览器。</p>
        <p>
          内部与演化提供岩浆海、分异与火山、撞击与冷却三个过程的局部构造观察，部件详情附
          NASA / LPI 参考资料。
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
