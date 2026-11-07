// render/postfx.js — one full-screen pass: colour grade, day/night tint, vignette, 0.5 % grain.
// Bloom is a separate AdvancedBloomFilter on the "lights" layer only (scene.js).
import { Filter, GlProgram } from 'pixi.js';

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;
const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uTime;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uVignette;
uniform float uGrain;
uniform float uWarm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  vec3 col = c.rgb;
  // gentle filmic grade: lift shadows slightly green-blue, add contrast
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
  col = mix(col, col * vec3(1.02, 1.0, 0.95), uWarm);
  // day/night tint (multiply toward a cool blue at night)
  col = mix(col, col * uTint, uTintAmt);
  // vignette
  vec2 d = uv - 0.5; d.x *= uOutputFrame.z / uOutputFrame.w;
  float v = 1.0 - smoothstep(0.35, 1.05, length(d) * 1.45);
  col *= mix(1.0 - uVignette, 1.0, v);
  // grain
  col += (hash(uv * uOutputFrame.zw + fract(uTime)) - 0.5) * uGrain;
  finalColor = vec4(col, c.a);
}
`;

export class PostFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'cf-postfx' }),
      resources: {
        postUniforms: {
          uTime: { value: 0, type: 'f32' },
          uTint: { value: [0.55, 0.68, 1.1], type: 'vec3<f32>' },
          uTintAmt: { value: 0, type: 'f32' },
          uVignette: { value: 0.38, type: 'f32' },
          uGrain: { value: 0.025, type: 'f32' },
          uWarm: { value: 0.5, type: 'f32' },
        },
      },
    });
  }
  set(time, sun) {
    const u = this.resources.postUniforms.uniforms;
    u.uTime = time;
    u.uTintAmt = 0.55 * (1 - sun);       // never fully dark: legibility first
    u.uWarm = 0.3 + 0.5 * sun;
  }
}
