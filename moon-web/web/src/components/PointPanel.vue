<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleDot,
  Orbit,
  Rocket,
  Search,
  Settings2,
  Truck,
} from "@lucide/vue";
import { useCatalog } from "../stores/catalog";
import { curatedPointIds, pointStories } from "../data/pointStories";
import PointManagement from "./PointManagement.vue";

const catalog = useCatalog();
const emit = defineEmits<{ locate: [id: string] }>();
const managementOpen = ref(false);
const query = ref("");
const category = ref("精选");
const page = ref(0);
const pageSize = 18;
const categories = computed(() => [
  "精选",
  "全部",
  ...new Set(catalog.points.map((point) => point.category)),
]);
const filtered = computed(() => {
  const search = query.value.trim().toLowerCase();
  const selected = catalog.points.filter(
    (point) =>
      (!search ||
        `${point.name} ${point.description}`.toLowerCase().includes(search)) &&
      (category.value === "全部" ||
        category.value === "精选" ||
        point.category === category.value),
  );
  if (category.value === "精选" && !search) {
    return curatedPointIds.flatMap(
      (id) => selected.find((point) => point.id === id) ?? [],
    );
  }
  return selected.sort(
    (a, b) =>
      Number(b.name.toLowerCase().includes(search)) -
        Number(a.name.toLowerCase().includes(search)) ||
      Number(Boolean(pointStories[b.id])) - Number(Boolean(pointStories[a.id])),
  );
});
const visible = computed(() =>
  filtered.value.slice(page.value * pageSize, (page.value + 1) * pageSize),
);
const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);
watch([query, category], () => {
  page.value = 0;
});
function categoryIcon(value: string) {
  if (value === "着陆点") return Rocket;
  if (value === "巡视器") return Truck;
  if (value === "月海") return Orbit;
  return CircleDot;
}
</script>

<template>
  <div class="science-browser">
    <template v-if="!managementOpen">
      <div class="science-browser-heading">
        <span>从足迹，读懂月球</span>
        <button class="science-manage-button" @click="managementOpen = true">
          <Settings2 :size="17" />资料管理
        </button>
      </div>
      <label class="science-search">
        <Search :size="18" />
        <input
          v-model="query"
          aria-label="搜索点位"
          placeholder="搜索月海、环形山、探测任务"
        />
      </label>
      <div class="science-categories" aria-label="点位类别">
        <button
          v-for="value in categories"
          :key="value"
          :class="{ active: category === value }"
          :aria-pressed="category === value"
          @click="category = value"
        >
          {{ value }}
        </button>
      </div>
      <div class="science-browser-count">
        <strong>{{
          category === "精选" && !query
            ? "值得一看的月球现场"
            : `${filtered.length} 处探索目标`
        }}</strong>
      </div>
      <div class="science-point-list">
        <button
          v-for="point in visible"
          :key="point.id"
          class="science-point-card point-title"
          @click="emit('locate', point.id)"
        >
          <span
            class="science-point-image"
            :class="{ 'has-image': point.images.length }"
          >
            <img
              v-if="point.images.length"
              :src="point.images[0]!.url"
              :alt="point.images[0]!.title"
              loading="lazy"
            />
            <component
              :is="categoryIcon(point.category)"
              v-else
              :size="28"
              :stroke-width="1.4"
            />
          </span>
          <span class="science-point-copy">
            <small>{{ point.category }}</small>
            <strong>{{ point.name }}</strong>
            <span v-if="pointStories[point.id]" class="science-point-hook">{{
              pointStories[point.id]!.kicker
            }}</span>
          </span>
          <ArrowUpRight :size="18" class="science-point-arrow" />
        </button>
      </div>
      <p v-if="!visible.length" class="science-no-results">
        没有找到匹配的地点
      </p>
      <div v-if="pageCount > 1" class="science-pagination">
        <button class="secondary-button" :disabled="page === 0" @click="page--">
          上一页
        </button>
        <span>{{ page + 1 }} / {{ pageCount }}</span>
        <button
          class="secondary-button"
          :disabled="page + 1 >= pageCount"
          @click="page++"
        >
          下一页
        </button>
      </div>
    </template>
    <template v-else>
      <button class="science-back-button" @click="managementOpen = false">
        <ArrowLeft :size="18" />返回科普探索
      </button>
      <PointManagement @locate="emit('locate', $event)" />
    </template>
  </div>
</template>
