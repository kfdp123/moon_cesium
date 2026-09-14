<script setup lang="ts">
import { ref, watch } from "vue";
const props = defineProps<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}>();
const emit = defineEmits<{ change: [value: number] }>();
const draft = ref(props.value);
watch(
  () => props.value,
  (value) => (draft.value = value),
);
function commit() {
  emit("change", draft.value);
}
function wheel(event: WheelEvent) {
  // Only a focused slider consumes the wheel; normal sidebar scrolling remains available.
  if (document.activeElement !== event.currentTarget) return;
  event.preventDefault();
  draft.value = Math.max(
    props.min,
    Math.min(
      props.max,
      draft.value + (event.deltaY < 0 ? props.step : -props.step),
    ),
  );
  commit();
}
</script>
<template>
  <div class="parameter-slider">
    <label class="field horizontal"
      >{{ label }} / km
      <input
        type="number"
        :aria-label="label"
        :min="min"
        :max="max"
        :step="step"
        :value="draft.toFixed(1)"
        @change="
          draft = Number(($event.target as HTMLInputElement).value);
          commit();
        "
      />
    </label>
    <input
      type="range"
      :aria-label="`${label}滑块`"
      :min="min"
      :max="max"
      :step="step"
      v-model.number="draft"
      @change="commit"
      @wheel="wheel"
    />
    <div class="slider-scale">
      <span>{{ min.toFixed(0) }}</span
      ><span>{{ max.toFixed(0) }} km</span>
    </div>
  </div>
</template>
