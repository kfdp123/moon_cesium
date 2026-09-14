<script setup lang="ts">
import { ref, watch } from "vue";
import type { LunarPoint } from "../types";
import ModelPreview from "./ModelPreview.vue";
const props = defineProps<{ point: LunarPoint }>();
const modelOpen = ref(false);
const failedImages = ref<string[]>([]);
watch(
  () => props.point.id,
  () => {
    modelOpen.value = false;
    failedImages.value = [];
  },
);
</script>
<template>
  <span class="eyebrow">{{ point.category }}</span>
  <h3>{{ point.name }}</h3>
  <p>{{ point.description || "暂无文字介绍，可在点位管理中补充。" }}</p>
  <span class="inline-note"
    >{{ point.longitude.toFixed(4) }}° E · {{ point.latitude.toFixed(4) }}°
    N</span
  >
  <h4>图片</h4>
  <p v-if="!point.images.length" class="empty-resource">暂无已核实图片</p>
  <figure v-for="item in point.images" :key="item.url">
    <img
      v-if="!failedImages.includes(item.url)"
      :src="item.url"
      :alt="item.title"
      loading="lazy"
      @error="failedImages.push(item.url)"
    />
    <p v-else>图片加载失败</p>
    <figcaption>{{ item.title }}</figcaption>
  </figure>
  <h4>三维模型</h4>
  <template v-if="point.modelUrl"
    ><button class="secondary-button" @click="modelOpen = !modelOpen">
      {{ modelOpen ? "关闭模型预览" : "打开模型预览" }}</button
    ><ModelPreview v-if="modelOpen" :key="point.modelUrl" :url="point.modelUrl"
  /></template>
  <p v-else class="empty-resource">暂无已核实模型</p>
  <h4>文献</h4>
  <p v-if="!point.references.length" class="empty-resource">暂无关联文献</p>
  <a
    v-for="link in point.references"
    :key="link.url"
    :href="link.url"
    target="_blank"
    rel="noreferrer"
    >{{ link.title }} ↗</a
  >
  <h4>相关链接</h4>
  <a
    v-for="link in point.links"
    :key="link.url"
    :href="link.url"
    target="_blank"
    rel="noreferrer"
    >{{ link.title }} ↗</a
  ><a v-if="point.source" :href="point.source" target="_blank" rel="noreferrer"
    >原始数据来源 ↗</a
  >
</template>
