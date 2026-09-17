<script setup lang="ts">
import { computed, ref } from "vue";
import { useCatalog } from "../stores/catalog";
import { downloadJson, parsePoints, pointsGeoJson } from "../data/pointFiles";
import type { LunarPoint } from "../types";
import ResourceEditor from "./ResourceEditor.vue";
const catalog = useCatalog();
const emit = defineEmits<{ locate: [id: string] }>();
const query = ref("");
const category = ref("");
const page = ref(0);
const error = ref("");
const edit = ref<LunarPoint>();
const categories = computed(() => [
  ...new Set(catalog.points.map((p) => p.category)),
]);
const filtered = computed(() =>
  catalog.points.filter(
    (p) =>
      (!category.value || p.category === category.value) &&
      p.name.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const visible = computed(() =>
  filtered.value.slice(page.value * 20, (page.value + 1) * 20),
);
function create() {
  edit.value = {
    id: crypto.randomUUID(),
    name: "",
    category: "自定义",
    longitude: 0,
    latitude: 0,
    description: "",
    source: "",
    visible: true,
    images: [],
    modelUrl: "",
    references: [],
    links: [],
  };
}
function modify(point: LunarPoint) {
  edit.value = JSON.parse(JSON.stringify(point));
  error.value = "";
}
function save() {
  try {
    catalog.upsertPoint(edit.value!);
    edit.value = undefined;
    error.value = "";
  } catch (cause) {
    error.value = String(cause);
  }
}
async function importFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const incoming = parsePoints(JSON.parse(await file.text()));
    const merged = new Map(catalog.points.map((p) => [p.id, p]));
    for (const point of incoming) merged.set(point.id, point);
    catalog.points = [...merged.values()];
    catalog.savePoints();
    error.value = "";
  } catch (cause) {
    error.value = String(cause);
  }
  (event.target as HTMLInputElement).value = "";
}
function toggle(point: LunarPoint) {
  point.visible = !point.visible;
  try {
    catalog.savePoints();
  } catch (cause) {
    error.value = String(cause);
  }
}
</script>
<template>
  <section class="panel-section">
    <div class="section-label">
      资料管理 <small>{{ catalog.points.length }} 个</small>
    </div>
    <input
      class="search-input"
      aria-label="搜索点位"
      placeholder="搜索名称，如 Tycho、静海"
      v-model="query"
      @input="page = 0"
    />
    <label class="field"
      >类别<select v-model="category" @change="page = 0">
        <option value="">全部类别</option>
        <option v-for="value in categories" :key="value">{{ value }}</option>
      </select></label
    >
    <div class="compact-row">
      <button class="primary-button" @click="create">新增点位</button
      ><button
        class="secondary-button"
        @click="
          downloadJson('moon-points.geojson', pointsGeoJson(catalog.points))
        "
      >
        导出
      </button>
    </div>
    <details class="catalog-import">
      <summary>导入资料</summary>
      <label class="file-label"
        >导入 GeoJSON<input
          type="file"
          accept=".geojson,.json"
          @change="importFile"
      /></label>
    </details>
    <div v-for="point in visible" :key="point.id" class="point-row">
      <input
        type="checkbox"
        :checked="point.visible"
        :aria-label="`显示${point.name}`"
        @change="toggle(point)"
      />
      <button class="point-title" @click="emit('locate', point.id)">
        {{ point.name }}<small>{{ point.category }}</small>
      </button>
      <button
        class="secondary-button"
        @click="modify(point)"
        :aria-label="`编辑${point.name}`"
      >
        编辑
      </button>
    </div>
    <div class="compact-row">
      <button class="secondary-button" :disabled="page === 0" @click="page--">
        上一页</button
      ><small
        >{{ page + 1 }} /
        {{ Math.max(1, Math.ceil(filtered.length / 20)) }}</small
      ><button
        class="secondary-button"
        :disabled="(page + 1) * 20 >= filtered.length"
        @click="page++"
      >
        下一页
      </button>
    </div>
    <button class="text-button" @click="catalog.restorePoints()">
      恢复内置目录（覆盖本地修改）
    </button>
    <a
      class="text-button"
      href="https://planetarynames.wr.usgs.gov/GIS_Downloads"
      target="_blank"
      rel="noreferrer"
      >下载 USGS 完整矢量数据 ↗</a
    >
    <p v-if="error || catalog.error" class="form-error" role="alert">
      {{ error || catalog.error }}
    </p>
  </section>
  <Teleport to="body"
    ><div v-if="edit" class="modal-backdrop" @click.self="edit = undefined">
      <form
        class="modal point-editor"
        role="dialog"
        aria-modal="true"
        aria-label="编辑点位"
        @submit.prevent="save"
      >
        <button type="button" class="modal-close" @click="edit = undefined">
          关闭
        </button>
        <h2>点位资料</h2>
        <label class="field">名称<input v-model="edit.name" required /></label
        ><label class="field">类别<input v-model="edit.category" /></label>
        <div class="compact-row">
          <label class="field"
            >东经 / °<input
              type="number"
              v-model.number="edit.longitude"
              min="-180"
              max="180"
              step="any"
              required /></label
          ><label class="field"
            >纬度 / °<input
              type="number"
              v-model.number="edit.latitude"
              min="-90"
              max="90"
              step="any"
              required
          /></label>
        </div>
        <label class="field"
          >文字介绍<textarea v-model="edit.description" rows="4" /></label
        ><label class="field"
          >数据来源<input v-model="edit.source" placeholder="https://…"
        /></label>
        <ResourceEditor title="图片" v-model="edit.images" /><label
          class="field"
          >模型地址（GLB / glTF）<input
            v-model="edit.modelUrl"
            placeholder="https://…/model.glb"
        /></label>
        <ResourceEditor title="文献" v-model="edit.references" /><ResourceEditor
          title="相关链接"
          v-model="edit.links"
        />
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <div class="compact-row">
          <button class="primary-button" type="submit">保存点位</button
          ><button
            type="button"
            @click="
              catalog.removePoint(edit.id);
              edit = undefined;
            "
          >
            删除点位
          </button>
        </div>
      </form>
    </div></Teleport
  >
</template>
