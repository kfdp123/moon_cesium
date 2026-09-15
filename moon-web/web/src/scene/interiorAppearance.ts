import { Material, PerInstanceColorAppearance } from "cesium";

// Object-space grain stays attached to each layer while the camera or layer moves.
// This is illustrative rock texture, not a measured geological cross-section.
export function interiorAppearance(
  radius: number,
  cap: boolean,
  layerId: string,
) {
  const base = new PerInstanceColorAppearance({
    translucent: false,
    closed: true,
  });
  const vertexShaderSource = base.vertexShaderSource
    .replace("void main()", "out vec3 v_rockPosition;\nvoid main()")
    .replace(
      "v_color = color;",
      `v_color = color;\n v_rockPosition = (position3DHigh + position3DLow) / ${radius.toFixed(1)};`,
    );
  const appearance = new PerInstanceColorAppearance({
    translucent: false,
    closed: true,
    vertexShaderSource,
    fragmentShaderSource: `
in vec3 v_positionEC;
in vec3 v_normalEC;
in vec4 v_color;
in vec3 v_rockPosition;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {
  vec3 p = v_rockPosition;
  float grain = noise(p*24.0)*0.5 + noise(p*85.0)*0.3 + noise(p*260.0)*0.2;
  float veins = smoothstep(0.42,0.58,noise(p*12.0 + vec3(noise(p*8.0)*3.0)));
  vec3 normal = normalize(v_normalEC);
  float key = max(dot(normal, normalize(vec3(-0.35, 0.6, 1.0))), 0.0);
  float rim = pow(1.0-max(dot(normal, normalize(-v_positionEC)),0.0),3.0);
  vec3 color = czm_gammaCorrect(v_color).rgb;
  float texture = ${cap ? "0.68 + grain*0.48 + veins*0.1" : "0.76 + grain*0.32"};
  czm_materialInput inputData;
  inputData.str = p;
  inputData.normalEC = normal;
  czm_material process = czm_getMaterial(inputData);
  vec3 rock = color * texture * (0.46 + 0.54*key) + color*rim*0.1;
  out_FragColor = vec4(mix(rock, process.emission, process.alpha), 1.0);
}`,
  });
  appearance.material = new Material({
    fabric: {
      uniforms: {
        processTime: 0,
        processStage: 3,
        processLayer: layerId === "mantle" ? 1 : layerId === "crust" ? 0.55 : 0,
      },
      source: `
float noise(vec3 p);
czm_material czm_getMaterial(czm_materialInput inputData) {
  czm_material result = czm_getDefaultMaterial(inputData);
  vec3 p = inputData.str;
  float depth = length(p);
  float shallow = smoothstep(0.68, 0.86, depth);
  vec3 flow = p*18.0 + vec3(processTime*0.08,0.0,sin(processTime*0.2)*0.35);
  float ridge = abs(noise(flow + vec3(noise(p*6.0)*2.0))-0.5);
  float veins = 1.0-smoothstep(0.02,0.12,ridge);
  float settled = smoothstep(0.0,8.0,processTime);
  float heat = processStage < 0.5 ? 0.9 : processStage < 1.5 ? mix(0.55,0.18,settled) : processStage < 2.5 ? mix(0.28,0.035,settled) : 0.0;
  result.emission = mix(vec3(0.38,0.025,0.002),vec3(1.0,0.56,0.05),veins);
  result.alpha = heat * shallow * processLayer;
  return result;
}`,
    },
    translucent: false,
  });
  return appearance;
}
