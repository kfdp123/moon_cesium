<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  Compass,
  Download,
  Expand,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
  Layers,
  SlidersHorizontal,
  MapPin,
  Footprints,
  PanelLeftClose,
  PanelLeftOpen,
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
const tab = ref<"parameters" | "maps" | "points" | "scenes" | "astronomy">(
  "parameters",
);
const ready = ref(false);
const playing = ref(false);
const aboutOpen = ref(false);
const notice = ref("");
const navigation = ref<NavigationMode>("orbit");
const largeText = ref(false);
const panelOpen = ref(true);
const workspaces = [
  { id: "parameters", label: "参数模型", icon: SlidersHorizontal },
  { id: "maps", label: "图层管理", icon: Layers },
  { id: "points", label: "点位管理", icon: MapPin },
  { id: "scenes", label: "漫游场景", icon: Footprints },
  { id: "astronomy", label: "天体运动", icon: Orbit },
] as const;
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
  const wasRoaming = navigation.value !== "orbit";
  navigation.value = "orbit";
  viewport.value?.navigate("orbit");
  if (wasRoaming) viewport.value?.reset();
}
function changeAstroView(view: "moon" | "system") {
  stopNavigation();
  pause();
  explorer.selectedLayer = null;
  explorer.selectedLandmark = null;
  if (astronomy.view !== view) ready.value = false;
  astronomy.view = view;
}
function selectWorkspace(value: typeof tab.value) {
  tab.value = value;
  panelOpen.value = true;
  if (value === "astronomy") {
    pause();
    astronomy.timelineMode = "date";
    astronomy.lighting = true;
  } else if (astronomy.view === "system") changeAstroView("moon");
}
function selectEpoch(index: number) {
  changeAstroView("moon");
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
  navigation.value = mode;
  if (mode !== "orbit") {
    explorer.cutaway = "full";
    explorer.hiddenLayers = [];
  }
  viewport.value?.navigate(mode);
  if (mode === "orbit") viewport.value?.reset();
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
  changeAstroView("moon");
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
        ? "月球影像：NASA LRO 展示贴图 · 天体运动：Cesium 解析近似 · 地球：示意球"
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
    class="app-shell"
    :class="{ 'large-text': largeText, 'panel-collapsed': !panelOpen }"
  >
    <header class="app-header">
      <a
        class="brand"
        href="#"
        @click.prevent="
          stopNavigation();
          activeViewport?.reset();
        "
        ><span class="brand-symbol"><Moon :size="22" /></span
        ><strong>月见</strong><span class="brand-divider" /><span
          class="brand-subtitle"
          >MOON EXPLORER</span
        ></a
      >
      <nav aria-label="工作区">
        <button
          v-for="item in workspaces"
          :key="item.id"
          :class="{ active: tab === item.id }"
          :aria-pressed="tab === item.id"
          @click="selectWorkspace(item.id)"
        >
          <component :is="item.icon" :size="20" />{{ item.label }}
        </button>
      </nav>
      <div class="header-actions">
        <button
          class="text-size-button"
          :aria-pressed="largeText"
          @click="largeText = !largeText"
        >
          <Type :size="20" />{{ largeText ? "标准字号" : "大字模式" }}
        </button>
        <button @click="aboutOpen = true">数据与说明</button
        ><button class="icon-button" aria-label="全屏" @click="fullscreen">
          <Expand :size="18" />
        </button>
      </div>
    </header>
    <main class="workspace">
      <aside
        v-show="panelOpen"
        class="left-panel"
        @input="
          pause();
          if (tab !== 'astronomy') stopNavigation();
        "
      >
        <div class="panel-heading">
          <h1 class="workspace-title">
            {{
              {
                parameters: "月球参数模型",
                maps: "图层管理",
                points: "科普点位",
                scenes: "月表漫游",
                astronomy: "自转、公转与光照",
              }[tab]
            }}
          </h1>
          <button
            class="icon-button"
            aria-label="收起操作面板"
            @click="panelOpen = false"
          >
            <PanelLeftClose :size="22" />
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
          ><MapPanel @retry="viewport?.reloadMaps()" /><label
            class="checkbox-row"
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
        <AstronomyPanel
          v-if="tab === 'astronomy'"
          @view="changeAstroView"
          @base="
            navigate('first-person');
            viewport?.inspectBase();
          "
        />
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
          <p class="panel-note">
            更大的太阳系场景可扩展，当前优先完成月球。<a
              href="https://github.com/sanderblue/solar-system-threejs"
              target="_blank"
              rel="noreferrer"
              >查看开源参考 ↗</a
            >
          </p>
        </section>
        <div class="sidebar-footer">
          <span class="status-dot" :class="{ ready }" />{{
            ready ? "场景已就绪" : "正在准备场景"
          }}<span>月球探索工作台</span>
        </div>
      </aside>
      <section class="scene-stage" aria-label="月球探索工作区">
        <button
          v-if="!panelOpen"
          class="show-panel-button"
          @click="panelOpen = true"
        >
          <PanelLeftOpen :size="20" />展开操作面板
        </button>
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
        <div class="scene-heading">
          <span class="eyebrow"
            >月球 · {{ navigation === "orbit" ? "三维探索" : "月表漫游" }}</span
          >
          <h2>
            {{
              astronomy.view === "system"
                ? "地月系统 · 惯性视角"
                : explorer.epoch.label
            }}
          </h2>
          <span class="scene-subtitle">{{
            astronomy.view === "system"
              ? astronomy.trueScale
                ? "真实大小与距离比例"
                : "距离压缩为 1/8 · 月球放大 3 倍"
              : `${explorer.epoch.age} · ${explorer.layers.length} 个圈层 · 半径 ${explorer.radiusKm.toFixed(1)} km`
          }}</span>
        </div>
        <div class="scene-tag illustrative">
          <span />{{
            astronomy.view === "system"
              ? "天体运动 · 解析近似"
              : "参数模型 · 教学示意"
          }}
        </div>
        <div class="scene-toolbar">
          <button
            class="icon-button"
            aria-label="放大"
            @click="activeViewport?.zoom('in')"
          >
            <Plus :size="18" /></button
          ><button
            class="icon-button"
            aria-label="缩小"
            @click="activeViewport?.zoom('out')"
          >
            <Minus :size="18" /></button
          ><button
            class="icon-button"
            aria-label="重置视角"
            @click="
              pause();
              stopNavigation();
              activeViewport?.reset();
            "
          >
            <RotateCcw :size="18" /></button
          ><button
            class="icon-button"
            aria-label="导出场景图片"
            :disabled="!ready"
            @click="downloadImage"
          >
            <Download :size="18" />
          </button>
        </div>
        <div v-if="navigation !== 'orbit'" class="roaming-help">
          <strong>{{
            sceneModes.find((s) => s.id === navigation)?.name
          }}</strong
          ><span>点击场景后 WASD 移动 · 方向键转头 · Shift 加速</span
          ><button @click="navigate('orbit')">退出漫游</button>
        </div>
        <div v-else class="orbit-label">
          <Compass :size="15" /><span>拖动旋转 · 滚轮缩放 · 点击探索</span>
        </div>
        <div
          v-if="astronomy.view === 'moon' && (explorer.selection || landmark)"
          class="detail-card rich-detail"
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
        <div
          v-else-if="navigation === 'orbit' && astronomy.view === 'moon'"
          class="moon-facts"
        >
          <div>
            <span>剖切方式</span
            ><strong class="fact-text">{{
              cuts.find((c) => c.id === explorer.cutaway)?.label
            }}</strong>
          </div>
          <div>
            <span>当前阶段</span
            ><strong class="fact-text">{{ explorer.epoch.age }}</strong>
          </div>
          <div>
            <span>点位目录</span
            ><strong>{{ catalog.points.length }}<small> 个</small></strong>
          </div>
        </div>
      </section>
    </main>
    <div class="time-dock">
      <div class="time-mode-tabs" aria-label="时间轴类型">
        <button
          :aria-pressed="astronomy.timelineMode === 'date'"
          @click="
            astronomy.timelineMode = 'date';
            pause();
          "
        >
          日期时间 · 天体运动
        </button>
        <button
          :aria-pressed="astronomy.timelineMode === 'geology'"
          @click="astronomy.timelineMode = 'geology'"
        >
          地质年代 · 内部演化
        </button>
      </div>
      <AstroTimeline v-if="astronomy.timelineMode === 'date'" />
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
    <footer class="app-footer">
      <span>月见 · 月表与内部统一参数展示</span
      ><span>NASA / USGS · 现今数据与早期示意分开标注</span>
    </footer>
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
