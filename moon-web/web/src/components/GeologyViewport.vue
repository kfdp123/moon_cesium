<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  ArrowLeft,
  Play,
  Pause,
  X,
  Eye,
  EyeOff,
  ExternalLink,
  Layers,
} from "@lucide/vue";
import { geologyExhibits } from "../data/lunarGeology";
import { GeologyScene, type GeologyView } from "../scene/GeologyScene";

const props = defineProps<{ initialStage: number }>();
const emit = defineEmits<{ ready: []; close: []; stage: [index: number] }>();
const container = ref<HTMLElement>();
const stage = ref(Math.min(props.initialStage, 2));
const phase = ref(2);
const playing = ref(false);
const selected = ref<string | null>(null);
const hidden = ref(new Set<string>());
const error = ref("");
const view = ref<GeologyView>("oblique");
const controlsOpen = ref(true);
const exhibit = computed(() => geologyExhibits[stage.value]!);
const detail = computed(() =>
  exhibit.value.parts.find((p) => p.id === selected.value),
);
let scene: GeologyScene | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function pause() {
  playing.value = false;
  clearInterval(timer);
  scene?.setRunning(false);
}
function play() {
  if (playing.value) {
    pause();
    return;
  }
  phase.value = 0;
  playing.value = true;
  scene?.setRunning(true);
  timer = setInterval(() => {
    if (phase.value < 2) phase.value++;
    else pause();
  }, 4000);
}
function setPhase(value: number) {
  pause();
  phase.value = value;
}
function chooseStage(index: number) {
  pause();
  selected.value = null;
  hidden.value = new Set();
  stage.value = index;
  phase.value = 2;
  emit("stage", index);
}
function available(id: string) {
  return (
    phase.value > 0 || !["magma", "lava", "breccia", "impact-melt"].includes(id)
  );
}
function select(id: string | null) {
  selected.value = id;
  if (id && hidden.value.has(id)) {
    const next = new Set(hidden.value);
    next.delete(id);
    hidden.value = next;
  }
}
function togglePart(id: string) {
  const next = new Set(hidden.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  hidden.value = next;
  if (selected.value === id && next.has(id)) selected.value = null;
}
function reset(pose: GeologyView = "oblique") {
  view.value = pose;
  scene?.reset(pose);
}
watch([stage, phase], () => {
  if (selected.value && !available(selected.value)) selected.value = null;
  scene?.setModel(stage.value, phase.value);
  scene?.select(selected.value, hidden.value);
});
watch([selected, hidden], () => scene?.select(selected.value, hidden.value));
function onVisibility() {
  if (document.hidden) pause();
}
onMounted(() => {
  try {
    scene = new GeologyScene(container.value!, select, (message) => {
      error.value = message;
      pause();
    });
    scene.setModel(stage.value, phase.value);
    emit("stage", stage.value);
    emit("ready");
  } catch (cause) {
    error.value = String(cause);
  }
  document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
  pause();
  document.removeEventListener("visibilitychange", onVisibility);
  scene?.dispose();
});
defineExpose({ reset, capture: () => scene?.capture() });
</script>

<template>
  <div class="geology-viewport" aria-label="月球局部构造展台">
    <div
      ref="container"
      class="geology-canvas"
      @pointerdown="pause"
      @wheel="pause"
    />
    <section class="geology-controls" aria-label="局部构造操作">
      <div class="geology-toolbar">
        <button class="text-button" @click="emit('close')">
          <ArrowLeft :size="18" />整体月球
        </button>
        <button
          class="icon-button"
          :aria-expanded="controlsOpen"
          aria-label="展开或收起构造操作"
          @click="controlsOpen = !controlsOpen"
        >
          <Layers :size="20" />
        </button>
      </div>
      <h2>{{ exhibit.name }}</h2>
      <p class="geology-subtitle">{{ exhibit.subtitle }}</p>
      <template v-if="controlsOpen">
        <div class="segmented-control" role="group" aria-label="局部模型视角">
          <button :aria-pressed="view === 'oblique'" @click="reset('oblique')">
            透视
          </button>
          <button :aria-pressed="view === 'top'" @click="reset('top')">
            俯视
          </button>
          <button :aria-pressed="view === 'section'" @click="reset('section')">
            剖面
          </button>
        </div>
        <div class="geology-parts" aria-label="构造部件">
          <div
            v-for="part in exhibit.parts"
            :key="part.id"
            class="geology-part"
          >
            <button
              class="geology-part-select"
              :aria-pressed="selected === part.id"
              :disabled="!available(part.id)"
              @click="select(selected === part.id ? null : part.id)"
            >
              <span :style="{ background: part.color }" />{{ part.name }}
            </button>
            <button
              class="icon-button"
              :aria-label="`${hidden.has(part.id) ? '显示' : '隐藏'}${part.name}`"
              :disabled="!available(part.id)"
              @click="togglePart(part.id)"
            >
              <EyeOff v-if="hidden.has(part.id)" :size="18" /><Eye
                v-else
                :size="18"
              />
            </button>
          </div>
        </div>
        <div class="geology-process">
          <div class="geology-process-heading">
            <strong>{{ exhibit.steps[phase] }}</strong
            ><span>{{ phase + 1 }} / 3</span>
          </div>
          <input
            aria-label="局部演化步骤"
            type="range"
            min="0"
            max="2"
            step="1"
            :value="phase"
            @input="setPhase(Number(($event.target as HTMLInputElement).value))"
          />
          <p>{{ exhibit.captions[phase] }}</p>
          <button class="primary-button" @click="play">
            <Pause v-if="playing" :size="18" /><Play v-else :size="18" />{{
              playing ? "暂停过程" : "播放过程"
            }}
          </button>
        </div>
      </template>
    </section>
    <aside v-if="detail" class="geology-detail" aria-label="局部构造详情">
      <div class="geology-detail-heading">
        <h2>{{ detail.name }}</h2>
        <button
          class="icon-button"
          aria-label="关闭构造详情"
          @click="select(null)"
        >
          <X :size="20" />
        </button>
      </div>
      <span class="geology-detail-rule" :style="{ background: detail.color }" />
      <p>{{ detail.description }}</p>
      <p>{{ detail.relationship }}</p>
      <details>
        <summary>文献与资料</summary>
        <a
          v-for="source in exhibit.sources"
          :key="source.url"
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ source.title }}<ExternalLink :size="15"
        /></a>
      </details>
    </aside>
    <div class="geology-stages" role="group" aria-label="局部地质场景">
      <span class="geology-badge">局部构造</span>
      <div>
        <button
          v-for="(item, index) in geologyExhibits"
          :key="item.id"
          :aria-pressed="stage === index"
          @click="chooseStage(index)"
        >
          <span class="geology-stage-number">0{{ index + 1 }}</span
          ><span>{{ item.name }}</span>
        </button>
      </div>
    </div>
    <div v-if="error" class="geology-error" role="alert">
      <strong>局部模型未能显示</strong>
      <p>{{ error }}</p>
      <button class="secondary-button" @click="emit('close')">
        返回整体月球
      </button>
    </div>
  </div>
</template>
