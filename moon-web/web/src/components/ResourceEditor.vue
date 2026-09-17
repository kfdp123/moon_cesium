<script setup lang="ts">
import type { ResourceLink } from "../types";
defineProps<{ title: string }>();
const links = defineModel<ResourceLink[]>({ required: true });
</script>
<template>
  <fieldset class="resource-editor">
    <legend>{{ title }}</legend>
    <div v-for="(link, index) in links" :key="index" class="resource-row">
      <input
        v-model="link.title"
        aria-label="资料标题"
        placeholder="标题 / 署名"
      /><input
        v-model="link.url"
        aria-label="资料地址"
        placeholder="https://…"
      /><button
        class="text-button danger-button"
        type="button"
        @click="links.splice(index, 1)"
      >
        删除
      </button>
    </div>
    <button
      type="button"
      class="text-button"
      @click="links.push({ title: '', url: '' })"
    >
      ＋ 添加{{ title }}
    </button>
  </fieldset>
</template>
