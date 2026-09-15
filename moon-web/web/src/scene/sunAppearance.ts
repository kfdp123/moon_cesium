// Cesium's default Phong diffuse is camera-relative. These fragments use the
// selected DirectionalLight, with a small fixed ambient term for teaching views.
export const sunTextureFragment = `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec2 v_st;
void main() {
  czm_materialInput inputData;
  inputData.normalEC = normalize(v_normalEC);
  inputData.positionToEyeEC = -v_positionEC;
  inputData.st = v_st;
  czm_material material = czm_getMaterial(inputData);
  float light = 0.025 + 0.975 * max(dot(normalize(v_normalEC), czm_lightDirectionEC), 0.0);
  out_FragColor = vec4(material.diffuse * light, material.alpha);
}`;
export const sunColorFragment = `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;
void main() {
  float light = 0.025 + 0.975 * max(dot(normalize(v_normalEC), czm_lightDirectionEC), 0.0);
  out_FragColor = vec4(czm_gammaCorrect(v_color).rgb * light, v_color.a);
}`;
