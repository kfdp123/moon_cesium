<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight, Compass, X } from "@lucide/vue";
import type { LunarPoint } from "../types";
import { curatedPointIds, explorationThemes } from "../data/pointStories";

const props = defineProps<{ points: LunarPoint[] }>();
const emit = defineEmits<{
  locate: [id: string];
  theme: [id: string];
  close: [];
}>();
const featured = computed(() =>
  curatedPointIds
    .slice(0, 3)
    .flatMap((id) => props.points.find((point) => point.id === id) ?? []),
);
</script>

<template>
  <aside class="exploration-welcome" aria-label="精选探索">
    <header>
      <span><Compass :size="19" />精选探索</span
      ><button
        class="icon-button"
        aria-label="收起精选探索"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </header>
    <h2>月球，近一点</h2>
    <div class="exploration-theme-list">
      <button
        v-for="theme in explorationThemes"
        :key="theme.id"
        class="exploration-theme-card"
        :disabled="
          !theme.pointIds.some((id) => points.some((point) => point.id === id))
        "
        @click="emit('theme', theme.id)"
      >
        <img :src="theme.image" :alt="theme.title" />
        <span class="exploration-theme-copy"
          ><strong>{{ theme.title }}</strong
          ><span>{{ theme.subtitle }}</span></span
        >
        <span class="exploration-theme-arrow"><ArrowRight :size="19" /></span>
      </button>
    </div>
    <div v-if="featured.length" class="exploration-shortcuts">
      <span>直达月面</span>
      <button
        v-for="point in featured"
        :key="point.id"
        @click="emit('locate', point.id)"
      >
        {{ point.name }}<ArrowRight :size="14" />
      </button>
    </div>
  </aside>
</template>
