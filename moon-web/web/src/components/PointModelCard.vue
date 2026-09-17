<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Box, MapPin } from "@lucide/vue";
import type { LunarPoint } from "../types";
import { pointModel } from "../data/pointModels";
import type { PointModelState } from "../scene/PointModelLayer";
const props = defineProps<{
  point: LunarPoint;
  state: PointModelState | null;
}>();
const emit = defineEmits<{ load: [] }>();
const model = computed(() => pointModel(props.point));
const failedThumbnail = ref(false);
const thumbnail = computed(() =>
  failedThumbnail.value ? "" : model.value?.thumbnail,
);
const active = computed(() =>
  props.state?.pointId === props.point.id ? props.state : null,
);
const action = computed(() =>
  active.value?.status === "loading"
    ? "加载中…"
    : active.value?.status === "ready"
      ? "定位模型"
      : "加载到地图",
);
watch(
  () => [props.point.id, model.value?.url, model.value?.thumbnail],
  () => {
    failedThumbnail.value = false;
  },
  { immediate: true },
);
</script>
<template>
  <section v-if="model" class="point-model-card" aria-label="点位三维模型">
    <button
      class="model-thumbnail"
      :aria-label="`加载${model.title}`"
      :disabled="active?.status === 'loading'"
      @click="emit('load')"
    >
      <img
        v-if="thumbnail"
        :src="thumbnail"
        :alt="`${model.title}缩略图`"
        loading="lazy"
        @error="failedThumbnail = true"
      />
      <span v-else class="model-thumbnail-placeholder"
        ><Box :size="56" /><span>三维模型</span></span
      >
      <span class="model-thumbnail-action"
        ><MapPin :size="20" />{{ action }}</span
      >
    </button>
    <div class="point-model-caption">
      <strong>{{ model.title }}</strong>
      <p v-if="model.caption">{{ model.caption }}</p>
      <p v-if="active?.error" class="form-error" role="alert">
        {{ active.error }}
      </p>
    </div>
  </section>
  <p v-else class="empty-resource">暂无三维模型，可在点位管理中添加。</p>
</template>
