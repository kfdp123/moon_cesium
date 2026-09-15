<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Cartesian3, JulianDate } from "cesium";
import { useAstronomy } from "../stores/astronomy";
import { lunarEphemeris } from "../scene/lunarEphemeris";
const astronomy = useAstronomy();
const emit = defineEmits<{ base: [] }>();
const info = ref(lunarEphemeris(astronomy.clock.currentTime));
let removeTick: () => void;
let updated = 0;
function update() {
  info.value = lunarEphemeris(astronomy.clock.currentTime);
}
watch(() => astronomy.command, update);
onMounted(() => {
  removeTick = astronomy.clock.onTick.addEventListener(() => {
    if (performance.now() - updated > 500) {
      updated = performance.now();
      update();
    }
  });
});
onBeforeUnmount(() => removeTick());
function shadowExample() {
  const lon = (-20 * Math.PI) / 180,
    lat = (10 * Math.PI) / 180;
  const normal = new Cartesian3(
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  );
  for (let hour = 0; hour < 720; hour++) {
    const time = JulianDate.addHours(
      astronomy.clock.currentTime,
      JulianDate.daysDifference(
        astronomy.clock.stopTime,
        astronomy.clock.currentTime,
      ) < 30
        ? -hour
        : hour,
      new JulianDate(),
    );
    const altitude = Cartesian3.dot(normal, lunarEphemeris(time).sunFixed);
    if (altitude > 0.3 && altitude < 0.55) {
      astronomy.seek(JulianDate.toIso8601(time));
      astronomy.lighting = true;
      astronomy.shadows = true;
      emit("base");
      return;
    }
  }
}
</script>
<template>
  <section class="panel-section astronomy-panel">
    <label class="checkbox-row"
      ><input
        type="checkbox"
        v-model="astronomy.lighting"
      />按日期模拟太阳光照</label
    >
    <template v-if="astronomy.view === 'moon'">
      <label class="checkbox-row"
        ><input
          type="checkbox"
          v-model="astronomy.inertialCamera"
        />观察自转（不跟随月面）</label
      >
      <label class="checkbox-row"
        ><input
          type="checkbox"
          v-model="astronomy.shadows"
        />基地模型地面投影</label
      >
      <button class="secondary-button" @click="shadowExample">
        前往基地看阴影
      </button>
      <p class="panel-note">
        阴影示例会跳到基地附近的白昼时刻。漫游中镜头随月面固定；退出后可继续观察自转。
      </p>
    </template>
    <label v-else class="checkbox-row"
      ><input
        type="checkbox"
        v-model="astronomy.trueScale"
      />真实大小与距离比例</label
    >
    <dl class="astronomy-facts">
      <div>
        <dt>地月中心距离</dt>
        <dd>{{ info.distanceKm.toFixed(0) }} km</dd>
      </div>
      <div>
        <dt>地心视角受光比例</dt>
        <dd>{{ (info.illuminatedFraction * 100).toFixed(1) }}%</dd>
      </div>
      <div>
        <dt>太阳直射经度</dt>
        <dd>{{ info.subsolarLongitude.toFixed(1) }}° E</dd>
      </div>
    </dl>
    <p class="panel-note">
      使用 Cesium 的现代日期解析近似。全景默认将距离缩为 1/8、月球放大 3
      倍；角位置与时间保持一致。太阳以光线方向表示，地球为示意球。
    </p>
    <p class="panel-note">
      地质年代与日期时间相互独立。阴影为基地模型向月面投影；未模拟地形自身遮挡、日月食、远古轨道、真实地球云层和月壤散射。
    </p>
  </section>
</template>
