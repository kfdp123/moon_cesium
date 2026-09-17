<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowUpRight, BookOpen, MapPin } from "@lucide/vue";
import type { LunarPoint } from "../types";
import { pointStories } from "../data/pointStories";
import { pointModel } from "../data/pointModels";
import PointModelCard from "./PointModelCard.vue";
import type { PointModelState } from "../scene/PointModelLayer";

const props = defineProps<{
  point: LunarPoint;
  modelState: PointModelState | null;
}>();
const emit = defineEmits<{ loadModel: [] }>();
const failedImages = ref<string[]>([]);
const story = computed(() => pointStories[props.point.id]);
const images = computed(() =>
  props.point.images.filter((image) => !failedImages.value.includes(image.url)),
);
const paragraphs = computed(() =>
  props.point.description.split(/\n+/).filter(Boolean),
);
const coordinates = computed(
  () =>
    `${Math.abs(props.point.longitude).toFixed(2)}°${props.point.longitude < 0 ? "W" : "E"} · ${Math.abs(props.point.latitude).toFixed(2)}°${props.point.latitude < 0 ? "S" : "N"}`,
);
watch(
  () => props.point.id,
  () => {
    failedImages.value = [];
  },
);
</script>

<template>
  <article class="science-story" :key="point.id">
    <header class="science-story-header">
      <span class="science-story-category">{{ point.category }}</span>
      <h3>{{ point.name }}</h3>
      <p v-if="story" class="science-story-kicker">{{ story.kicker }}</p>
      <span class="science-story-location"
        ><MapPin :size="14" />{{ coordinates }}</span
      >
    </header>
    <figure v-if="images.length" class="science-story-cover">
      <img
        :src="images[0]!.url"
        :alt="images[0]!.title"
        @error="failedImages.push(images[0]!.url)"
      />
      <figcaption>
        {{ images[0]!.title
        }}<span
          v-if="
            story?.imageCredit && !images[0]!.title.includes(story.imageCredit)
          "
          >{{ story.imageCredit }}</span
        >
      </figcaption>
    </figure>
    <dl v-if="story?.facts.length" class="science-story-facts">
      <div v-for="fact in story.facts" :key="fact.label">
        <dt>{{ fact.label }}</dt>
        <dd>{{ fact.value }}</dd>
      </div>
    </dl>
    <div v-if="paragraphs.length" class="science-story-introduction">
      <p v-for="(paragraph, index) in paragraphs" :key="index">
        {{ paragraph }}
      </p>
    </div>
    <section v-if="pointModel(point)" class="science-story-model">
      <h4>走近现场<span>三维探索</span></h4>
      <PointModelCard
        :point="point"
        :state="modelState"
        @load="emit('loadModel')"
      />
    </section>
    <div v-if="images.length > 1" class="science-story-gallery">
      <figure v-for="item in images.slice(1)" :key="item.url">
        <img
          :src="item.url"
          :alt="item.title"
          loading="lazy"
          @error="failedImages.push(item.url)"
        />
        <figcaption>{{ item.title }}</figcaption>
      </figure>
    </div>
    <details v-if="point.references.length" class="science-story-resources">
      <summary>
        <BookOpen :size="17" />文献与延伸阅读<span>{{
          point.references.length
        }}</span>
      </summary>
      <a
        v-for="link in point.references"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noreferrer"
        >{{ link.title }}<ArrowUpRight :size="16"
      /></a>
    </details>
    <details
      v-if="point.links.length || point.source"
      class="science-story-resources"
    >
      <summary>
        资料链接<span>{{ point.links.length + (point.source ? 1 : 0) }}</span>
      </summary>
      <a
        v-for="link in point.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noreferrer"
        >{{ link.title }}<ArrowUpRight :size="16"
      /></a>
      <a
        v-if="point.source"
        :href="point.source"
        target="_blank"
        rel="noreferrer"
        >数据与任务资料<ArrowUpRight :size="16"
      /></a>
    </details>
  </article>
</template>
