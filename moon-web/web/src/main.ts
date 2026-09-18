import { createApp } from "vue";
import { createPinia } from "pinia";
import { Credit, CreditDisplay } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./style.css";
import "./workspace.css";
import "./immersive.css";
import "./geology.css";
import "./exploration.css";
import "./point-map.css";
import "./base-tour.css";
import App from "./App.vue";

// All viewers use local/NASA data, with ion imagery and geocoding disabled.
// Remove only the default logo; imagery and terrain attribution still renders.
CreditDisplay.cesiumCredit = new Credit("");
createApp(App).use(createPinia()).mount("#app");
