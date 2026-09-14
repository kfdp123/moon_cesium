<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  Download,
  Expand,
  Globe2,
  Grid2X2,
  Layers3,
  MapPin,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  X,
} from "@lucide/vue";
import MoonViewport from "./components/MoonViewport.vue";
import LayerPanel from "./components/LayerPanel.vue";
import { useExplorer } from "./stores/explorer";
import { epochs, landmarks, MOON_RADIUS_KM } from "./data/moon";
import type { CutawayMode, SceneMode } from "./types";

const explorer = useExplorer();
const viewport = ref<InstanceType<typeof MoonViewport>>();
const page = ref<"explore" | "evolution">("explore");
const aboutOpen = ref(false);
const helpOpen = ref(false);
const ready = ref(false);
const playing = ref(false);
const notice = ref("");
let playbackTimer: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
const landmark = computed(() =>
  landmarks.find((item) => item.id === explorer.selectedLandmark),
);
const cuts: { id: CutawayMode; label: string; fraction: string }[] = [
  { id: "full", label: "完整球", fraction: "1" },
  { id: "half", label: "移除一半", fraction: "½" },
  { id: "quarter", label: "移除 ¼", fraction: "¾" },
];

function pause() {
  clearInterval(playbackTimer);
  playing.value = false;
}

function setPage(value: typeof page.value) {
  pause();
  page.value = value;
  if (value === "evolution") {
    explorer.setMode("interior");
    explorer.setEpoch(0);
  } else {
    explorer.setEpoch(3);
    explorer.setMode("surface");
  }
}

function setMode(mode: SceneMode) {
  pause();
  explorer.setMode(mode);
}
function setEpoch(index: number) {
  pause();
  explorer.setEpoch(index);
}

function togglePlayback() {
  if (playing.value) {
    pause();
    return;
  }
  if (explorer.epochIndex === epochs.length - 1) explorer.setEpoch(0);
  playing.value = true;
  playbackTimer = setInterval(() => {
    if (explorer.epochIndex === epochs.length - 1) pause();
    else explorer.setEpoch(explorer.epochIndex + 1);
  }, 7000);
}

function toast(message: string) {
  notice.value = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = "";
  }, 3500);
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("浏览器未允许全屏，请使用窗口最大化。");
  }
}

async function downloadImage() {
  const url = viewport.value?.capture();
  if (!url) return;
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#0a1016";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  context.fillStyle = "rgba(5, 10, 15, .85)";
  context.fillRect(0, canvas.height - 70, canvas.width, 70);
  context.font = "16px sans-serif";
  context.fillStyle = "#e4ecea";
  const caption =
    explorer.mode === "interior"
      ? `${explorer.epoch.age} · 内部结构为模拟示意，非科研结论`
      : "月表影像：NASA Scientific Visualization Studio / LRO";
  context.fillText(`月见 · ${caption}`, 24, canvas.height - 28);
  const link = document.createElement("a");
  link.download = `moon-${explorer.mode}-${explorer.epoch.id}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("已导出带来源说明的场景图片");
}

function locate(id: string) {
  pause();
  explorer.selectedLandmark = id;
  viewport.value?.flyTo(id);
}

onBeforeUnmount(() => {
  pause();
  clearTimeout(noticeTimer);
});
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <a class="brand" href="#" @click.prevent="setPage('explore')"
        ><span class="brand-symbol"><Moon :size="22" /></span
        ><strong>月见</strong><span class="brand-divider" /><span
          class="brand-subtitle"
          >MOON EXPLORER</span
        ></a
      >
      <nav aria-label="主要导航">
        <button
          :class="{ active: page === 'explore' }"
          @click="setPage('explore')"
        >
          月球探索</button
        ><button
          :class="{ active: page === 'evolution' }"
          @click="setPage('evolution')"
        >
          演化之旅</button
        ><button @click="aboutOpen = true">
          关于项目 <ArrowDownRight :size="13" />
        </button>
      </nav>
      <div class="header-actions">
        <span class="prototype-badge">技术预览 · 0.1</span
        ><button
          class="icon-button"
          aria-label="使用帮助"
          @click="helpOpen = true"
        >
          <CircleHelp :size="18" /></button
        ><button class="icon-button" aria-label="切换全屏" @click="fullscreen">
          <Expand :size="18" />
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="left-panel">
        <div class="eyebrow">
          <span class="tiny-line" />{{
            page === "evolution"
              ? "A JOURNEY THROUGH TIME"
              : "OUR NEAREST WORLD"
          }}
        </div>
        <h1>
          {{
            page === "evolution" ? "月球的时间简史" : "一颗月球，\n不止一面。"
          }}
        </h1>
        <p class="intro">
          {{
            page === "evolution"
              ? "穿越早期演化的不同阶段，观察月表之下的结构如何改变。"
              : "从月表的明暗纹理，到深处的岩石与金属。换个角度，重新认识月球。"
          }}
        </p>

        <div class="mode-switch" aria-label="显示模式">
          <button
            :class="{ active: explorer.mode === 'surface' }"
            @click="setMode('surface')"
          >
            <Globe2 :size="16" />月表
          </button>
          <button
            :class="{ active: explorer.mode === 'interior' }"
            @click="setMode('interior')"
          >
            <Layers3 :size="16" />内部结构
          </button>
        </div>

        <template v-if="explorer.mode === 'interior'">
          <section class="panel-section">
            <div class="section-label">
              <ScanLine :size="14" /><span>打开月球</span>
            </div>
            <div class="cutaway-options">
              <button
                v-for="cut in cuts"
                :key="cut.id"
                :class="{ active: explorer.cutaway === cut.id }"
                :aria-pressed="explorer.cutaway === cut.id"
                @click="
                  pause();
                  explorer.cutaway = cut.id;
                "
              >
                <span class="cut-icon" :class="cut.id" /><small>{{
                  cut.label
                }}</small>
              </button>
            </div>
          </section>
          <LayerPanel />
          <div class="data-note">
            <span class="amber-dot" />
            <p>
              内部结构为<strong>模拟示意</strong
              ><br />按模型比例显示，参数待科学核定
            </p>
          </div>
        </template>
        <template v-else>
          <section class="panel-section">
            <div class="section-label">
              <Grid2X2 :size="14" /><span>月表图层</span>
            </div>
            <div class="setting-row">
              <span>月表影像 <small>NASA · LRO</small></span
              ><span class="fixed-check"><Check :size="14" /></span>
            </div>
            <button
              class="setting-row"
              :aria-pressed="explorer.showGrid"
              @click="explorer.showGrid = !explorer.showGrid"
            >
              <span>经纬网格</span
              ><span class="switch" :class="{ on: explorer.showGrid }" />
            </button>
            <button
              class="setting-row"
              :aria-pressed="explorer.showLandmarks"
              @click="explorer.showLandmarks = !explorer.showLandmarks"
            >
              <span>探索地标</span
              ><span class="switch" :class="{ on: explorer.showLandmarks }" />
            </button>
          </section>
          <section class="panel-section">
            <div class="section-label">
              <MapPin :size="14" /><span>从这里开始</span>
            </div>
            <button
              v-for="place in landmarks"
              :key="place.id"
              class="landmark-button"
              @click="locate(place.id)"
            >
              <span
                >{{ place.name
                }}<small
                  >{{ place.latitude.toFixed(2) }}° /
                  {{ place.longitude.toFixed(2) }}°</small
                ></span
              ><ArrowRight :size="15" />
            </button>
          </section>
          <button class="discovery-card" @click="setMode('interior')">
            <span class="discovery-icon"><Layers3 :size="20" /></span
            ><span
              ><strong>看看月表之下</strong
              ><small>打开剖面，认识内部圈层</small></span
            ><ArrowRight :size="16" />
          </button>
        </template>
        <div class="sidebar-footer">
          <span class="status-dot" :class="{ ready }" />{{
            ready ? "场景已就绪" : "正在准备场景"
          }}<span>01 / 月球</span>
        </div>
      </aside>

      <section class="scene-stage" aria-label="月球探索工作区">
        <MoonViewport ref="viewport" @ready="ready = true" @interact="pause" />
        <div class="scene-heading">
          <span class="eyebrow">{{
            explorer.mode === "surface"
              ? "THE LUNAR SURFACE"
              : "BENEATH THE SURFACE"
          }}</span>
          <h2>
            {{
              explorer.mode === "surface" ? "月球表面" : explorer.epoch.label
            }}
          </h2>
          <span class="scene-subtitle">{{
            explorer.mode === "surface"
              ? "LRO 月表影像 · 球面展示"
              : explorer.epoch.age + " · 圈层结构示意"
          }}</span>
        </div>
        <div
          class="scene-tag"
          :class="{ illustrative: explorer.mode === 'interior' }"
        >
          <span />{{ explorer.mode === "surface" ? "NASA LRO" : "模拟示意" }}
        </div>
        <div class="scene-toolbar">
          <button
            class="icon-button"
            aria-label="放大"
            @click="
              pause();
              viewport?.zoom('in');
            "
          >
            <Plus :size="18" /></button
          ><button
            class="icon-button"
            aria-label="缩小"
            @click="
              pause();
              viewport?.zoom('out');
            "
          >
            <Minus :size="18" /></button
          ><span /><button
            class="icon-button"
            aria-label="重置视角"
            @click="
              pause();
              viewport?.reset();
            "
          >
            <RotateCcw :size="17" /></button
          ><button
            class="icon-button"
            aria-label="导出场景图片"
            :disabled="!ready"
            @click="downloadImage"
          >
            <Download :size="17" />
          </button>
        </div>
        <div class="orbit-label">
          <Compass :size="15" /><span
            >拖动旋转 <i /> 滚轮缩放 <i /> 点击探索</span
          >
        </div>
        <div v-if="explorer.selection || landmark" class="detail-card">
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
          <template v-if="explorer.selection"
            ><span
              class="eyebrow"
              :style="{ color: explorer.selection.color }"
              >{{ explorer.selection.english }}</span
            >
            <h3>{{ explorer.selection.name }}</h3>
            <p>{{ explorer.selection.description }}</p>
            <dl>
              <div>
                <dt>半径范围</dt>
                <dd>
                  {{ explorer.selection.innerRadiusKm }}–{{
                    explorer.selection.outerRadiusKm
                  }}
                  <small>km</small>
                </dd>
              </div>
              <div>
                <dt>圈层厚度</dt>
                <dd>
                  {{
                    (
                      explorer.selection.outerRadiusKm -
                      explorer.selection.innerRadiusKm
                    ).toFixed(1)
                  }}
                  <small>km</small>
                </dd>
              </div>
            </dl>
            <span class="inline-note"
              >模拟参数 · {{ explorer.epoch.age }}</span
            ></template
          >
          <template v-else-if="landmark"
            ><span class="eyebrow">LUNAR LANDMARK</span>
            <h3>{{ landmark.name }}</h3>
            <p>{{ landmark.description }}</p>
            <a :href="landmark.source" target="_blank" rel="noreferrer"
              >了解更多 · NASA <ArrowRight :size="13" /></a
          ></template>
        </div>
        <div v-else-if="page === 'evolution'" class="story-card">
          <span class="eyebrow">0{{ explorer.epochIndex + 1 }} / 04</span>
          <h3>{{ explorer.epoch.title }}</h3>
          <p>{{ explorer.epoch.description }}</p>
          <span class="inline-note">{{ explorer.epoch.event }}</span>
        </div>
        <div v-if="page === 'explore'" class="moon-facts">
          <div>
            <span>参考半径</span
            ><strong
              >{{ MOON_RADIUS_KM.toLocaleString() }}<small> km</small></strong
            >
          </div>
          <div>
            <span>当前视图</span
            ><strong class="fact-text">{{
              explorer.mode === "surface" ? "月表影像" : "内部剖面"
            }}</strong>
          </div>
          <div>
            <span>探索方式</span><strong class="fact-text">自由交互</strong>
          </div>
        </div>
      </section>
    </main>

    <section
      v-if="page === 'evolution'"
      class="timeline-panel"
      aria-label="演化阶段"
    >
      <button
        class="play-button"
        :aria-label="playing ? '暂停演示' : '播放演示'"
        :disabled="!ready"
        @click="togglePlayback"
      >
        <Pause v-if="playing" :size="19" /><Play v-else :size="19" />
      </button>
      <div class="timeline-label">
        <strong>{{ playing ? "正在演示" : "演化时间轴" }}</strong
        ><small>阶段切换 · 教学示意</small>
      </div>
      <div class="timeline-track">
        <button
          v-for="(epoch, index) in epochs"
          :key="epoch.id"
          :class="{
            active: explorer.epochIndex === index,
            passed: explorer.epochIndex > index,
          }"
          @click="setEpoch(index)"
        >
          <span class="timeline-node" /><strong>{{ epoch.age }}</strong
          ><small>{{ epoch.label }}</small>
        </button>
      </div>
      <div class="step-buttons">
        <button
          class="icon-button"
          aria-label="上一阶段"
          :disabled="explorer.epochIndex === 0"
          @click="setEpoch(explorer.epochIndex - 1)"
        >
          <ChevronLeft :size="19" /></button
        ><button
          class="icon-button"
          aria-label="下一阶段"
          :disabled="explorer.epochIndex === 3"
          @click="setEpoch(explorer.epochIndex + 1)"
        >
          <ChevronRight :size="19" />
        </button>
      </div>
    </section>
    <footer class="app-footer">
      <span>月见 <i /> 让遥远的世界，更近一步</span
      ><span
        >月表影像：NASA Scientific Visualization Studio
        <button @click="aboutOpen = true">
          数据与来源 <ArrowDownRight :size="12" /></button
      ></span>
    </footer>

    <div
      v-if="aboutOpen || helpOpen"
      class="modal-backdrop"
      @click.self="
        aboutOpen = false;
        helpOpen = false;
      "
      @keydown.esc="
        aboutOpen = false;
        helpOpen = false;
      "
    >
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-label="aboutOpen ? '关于项目' : '使用帮助'"
        tabindex="-1"
      >
        <button
          autofocus
          class="icon-button modal-close"
          aria-label="关闭窗口"
          @click="
            aboutOpen = false;
            helpOpen = false;
          "
        >
          <X :size="20" /></button
        ><BookOpen :size="26" class="modal-icon" />
        <h2>{{ aboutOpen ? "关于月见" : "开始你的月球探索" }}</h2>
        <template v-if="aboutOpen"
          ><p>
            一个面向科普演示的月球 Web
            系统。当前为首个技术原型：验证月表浏览、真实几何剖切、圈层拾取和阶段切换。
          </p>
          <h3>数据与表现边界</h3>
          <p>
            月表使用 NASA LRO 展示影像映射到球面，尚未加载真实 DEM
            地形。内部尺寸、早期场景和阶段变化是模拟示意，不是科研计算结果。
          </p>
          <p>
            参考球半径为 1,737.4
            km；显示、选择与参数使用同一份场景配置。真实模型、热状态与重力成果将在后续版本接入。
          </p>
          <a
            href="https://svs.gsfc.nasa.gov/4720/"
            target="_blank"
            rel="noreferrer"
            >NASA SVS · CGI Moon Kit <ArrowRight :size="14" /></a
          ><a
            href="https://github.com/kfdp123/moon_cesium"
            target="_blank"
            rel="noreferrer"
            >项目代码仓库 <ArrowRight :size="14" /></a
        ></template>
        <template v-else
          ><ol>
            <li>
              <strong>旋转与缩放</strong>
              <p>拖动月球改变视角，滚动鼠标滚轮调整距离。</p>
            </li>
            <li>
              <strong>打开内部结构</strong>
              <p>选择“内部结构”，再切换完整球、移除一半或移除四分之一。</p>
            </li>
            <li>
              <strong>认识圈层</strong>
              <p>
                点击可见切面或左侧圈层名称，查看示意尺寸与说明；眼睛按钮控制显隐。
              </p>
            </li>
            <li>
              <strong>穿越演化阶段</strong>
              <p>
                进入“演化之旅”，点击时间轴或播放。直接操作三维场景会暂停演示。
              </p>
            </li>
          </ol></template
        >
      </section>
    </div>
    <div v-if="notice" class="toast" role="status">{{ notice }}</div>
  </div>
</template>
