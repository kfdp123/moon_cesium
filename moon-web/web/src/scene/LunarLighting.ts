import {
  Cartesian3,
  DirectionalLight,
  JulianDate,
  Matrix3,
  ShadowMode,
  Viewer,
} from "cesium";
import { lunarEphemeris } from "./lunarEphemeris";

export interface LightingOptions {
  lighting: boolean;
  shadows: boolean;
  inertialCamera: boolean;
}
export class LunarLighting {
  private previous: JulianDate;
  private removeTick: () => void;
  private options: LightingOptions = {
    lighting: false,
    shadows: true,
    inertialCamera: true,
  };
  roaming = false;
  constructor(private viewer: Viewer) {
    this.previous = JulianDate.clone(viewer.clock.currentTime);
    this.removeTick = viewer.scene.preUpdate.addEventListener(() =>
      this.update(),
    );
  }
  configure(options: LightingOptions) {
    this.options = options;
    this.viewer.scene.requestRender();
  }
  private update() {
    const { scene, camera, clock } = this.viewer;
    const { lighting, shadows, inertialCamera } = this.options;
    scene.globe.enableLighting = lighting;
    scene.globe.lightingFadeOutDistance = 0;
    scene.globe.lightingFadeInDistance = 1;
    scene.globe.shadows =
      lighting && shadows ? ShadowMode.RECEIVE_ONLY : ShadowMode.DISABLED;
    this.viewer.shadows = lighting && shadows;
    scene.shadowMap.maximumDistance = 500;
    scene.shadowMap.softShadows = true;
    if (lighting) {
      const ephemeris = lunarEphemeris(clock.currentTime);
      (scene.light as DirectionalLight).direction = Cartesian3.negate(
        ephemeris.sunFixed,
        new Cartesian3(),
      );
      if (
        inertialCamera &&
        !this.roaming &&
        !JulianDate.equals(this.previous, clock.currentTime)
      ) {
        const previousRotation = lunarEphemeris(this.previous).moonToInertial;
        const rotation = Matrix3.multiply(
          ephemeris.inertialToMoon,
          previousRotation,
          new Matrix3(),
        );
        camera.setView({
          destination: Matrix3.multiplyByVector(
            rotation,
            camera.positionWC,
            new Cartesian3(),
          ),
          orientation: {
            direction: Matrix3.multiplyByVector(
              rotation,
              camera.directionWC,
              new Cartesian3(),
            ),
            up: Matrix3.multiplyByVector(
              rotation,
              camera.upWC,
              new Cartesian3(),
            ),
          },
        });
      }
    } else {
      (scene.light as DirectionalLight).direction = new Cartesian3(
        -1,
        -0.5,
        -0.35,
      );
    }
    if (!JulianDate.equals(this.previous, clock.currentTime))
      scene.requestRender();
    JulianDate.clone(clock.currentTime, this.previous);
  }
  dispose() {
    this.removeTick();
  }
}
