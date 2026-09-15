import { defineStore } from "pinia";
import { ref } from "vue";
export const useRover = defineStore("rover", () => {
  const view = ref<"free" | "follow" | "first">("follow");
  const playing = ref(true);
  const speed = ref(3);
  const distance = ref(0);
  const status = ref("正在加载月球车模型…");
  const restart = ref(0);
  return { view, playing, speed, distance, status, restart };
});
