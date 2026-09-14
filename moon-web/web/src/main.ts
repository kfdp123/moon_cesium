import { createApp } from "vue";
import { createPinia } from "pinia";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";
import App from "./App.vue";

createApp(App).use(createPinia()).mount("#app");
