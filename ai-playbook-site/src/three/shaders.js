/* Shared GLSL snippets */

export const NOISE = /* glsl */ `
vec3 hash33(vec3 p){
  p = fract(p * vec3(.1031,.1030,.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash33(i+vec3(0,0,0)),f-vec3(0,0,0)), dot(hash33(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(hash33(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash33(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash33(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash33(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(hash33(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash33(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
}
vec3 curl(vec3 p){
  float e = .1;
  vec3 dx = vec3(e,0,0), dy = vec3(0,e,0), dz = vec3(0,0,e);
  float x = vnoise(p+dy) - vnoise(p-dy) - vnoise(p+dz) + vnoise(p-dz);
  float y = vnoise(p+dz) - vnoise(p-dz) - vnoise(p+dx) + vnoise(p-dx);
  float z = vnoise(p+dx) - vnoise(p-dx) - vnoise(p+dy) + vnoise(p-dy);
  return vec3(x,y,z) / (2.0*e);
}
`

/** Soft round sprite, premultiplied for additive blending. */
export const POINT_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a * (0.6 + 0.4 * smoothstep(0.18, 0.0, d) * 2.0);
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
}
`

/** Camera-facing glow quad (use inside <Billboard>). */
export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`
export const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform float uPower; uniform float uRays; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float g = pow(max(0.0, 1.0 - r), uPower);
  float ang = atan(p.y, p.x);
  float rays = 0.0;
  if (uRays > 0.0) {
    rays = pow(abs(sin(ang * 9.0 + uTime * 0.25)) * abs(sin(ang * 23.0 - uTime * 0.4)), 3.0);
    rays *= smoothstep(1.0, 0.1, r) * uRays;
  }
  vec3 col = uColor * (g + rays);
  gl_FragColor = vec4(col * uOpacity, 1.0);
}
`
