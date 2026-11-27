import * as THREE from './vendor/three.module.min.js';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
function material(fragment,uniforms){return new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms,depthTest:false,depthWrite:false,toneMapped:false});}
export class ArtPipeline{
  constructor(renderer){
    this.renderer=renderer;this.size=new THREE.Vector2();this.high=true;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.quad.frustumCulled=false;this.scene.add(this.quad);
    const type=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
    this.hdr=type===THREE.HalfFloatType;
    this.sceneTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,samples:2});
    this.sceneTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const small=()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});
    this.bright=small();this.blurA=small();this.blurB=small();
    this.extract=material(`varying vec2 vUv;uniform sampler2D tColor;
      void main(){vec3 c=texture2D(tColor,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=smoothstep(1.05,2.6,l);gl_FragColor=vec4(c*k*.45,1.0);}`,{tColor:{value:this.sceneTarget.texture}});
    this.blur=material(`varying vec2 vUv;uniform sampler2D tColor;uniform vec2 uStep;
      void main(){vec3 c=texture2D(tColor,vUv).rgb*.227027;c+=texture2D(tColor,vUv+uStep*1.384615).rgb*.316216;c+=texture2D(tColor,vUv-uStep*1.384615).rgb*.316216;c+=texture2D(tColor,vUv+uStep*3.230769).rgb*.070270;c+=texture2D(tColor,vUv-uStep*3.230769).rgb*.070270;gl_FragColor=vec4(c,1.);}`,{tColor:{value:null},uStep:{value:new THREE.Vector2()}});
    this.output=material(`varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tGlow;uniform sampler2D tDepth;uniform vec2 uSun;uniform float uSunVisible;uniform float uAspect;uniform float uWarm;uniform float uExposure;uniform float uBloom;uniform vec2 uPixel;
      vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){
        float z=texture2D(tDepth,vUv).r;
        float viewDepth=(.12*42000.)/max(.12,42000.-z*(42000.-.12));
        vec3 sharp=texture2D(tColor,vUv).rgb;
        vec3 soft=sharp*.4;
        soft+=texture2D(tColor,vUv+vec2(uPixel.x*1.15,0.)).rgb*.15;
        soft+=texture2D(tColor,vUv-vec2(uPixel.x*1.15,0.)).rgb*.15;
        soft+=texture2D(tColor,vUv+vec2(0.,uPixel.y*1.15)).rgb*.15;
        soft+=texture2D(tColor,vUv-vec2(0.,uPixel.y*1.15)).rgb*.15;
        vec3 c=mix(sharp,soft,smoothstep(180.,1800.,viewDepth)*.72)+texture2D(tGlow,vUv).rgb*uBloom;
        float depth=texture2D(tDepth,clamp(uSun,vec2(.001),vec2(.999))).r;
        float openSky=step(.9999995,depth)*uSunVisible;
        vec2 d=(vUv-uSun)*vec2(uAspect,1.);float radius=length(d);
        float halo=exp(-radius*radius*21.)*.13+exp(-radius*radius*140.)*.17;
        float streak=exp(-abs(d.y)*180.)*exp(-abs(d.x)*5.)*.018;
        c+=vec3(1.,.62,.30)*(halo+streak)*openSky*uWarm;
        float lum=dot(c,vec3(.2126,.7152,.0722));c*=mix(vec3(.97,.975,1.035),vec3(1.),smoothstep(.1,1.4,lum));
        c=film(c*uExposure);float vignette=1.-.075*dot(vUv-.5,vUv-.5);c*=vignette;
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,{tColor:{value:this.sceneTarget.texture},tGlow:{value:this.blurB.texture},tDepth:{value:this.sceneTarget.depthTexture},uSun:{value:new THREE.Vector2(-1,-1)},uSunVisible:{value:0},uAspect:{value:1},uWarm:{value:1},uExposure:{value:.98},uBloom:{value:.34},uPixel:{value:new THREE.Vector2()}});
    renderer.info.autoReset=false;this.resize();
  }
  resize(){
    this.renderer.getDrawingBufferSize(this.size);const w=this.size.x,h=this.size.y;
    this.sceneTarget.setSize(w,h);for(const t of [this.bright,this.blurA,this.blurB])t.setSize(Math.max(1,Math.floor(w/5)),Math.max(1,Math.floor(h/5)));
    this.output.uniforms.uAspect.value=w/h;this.output.uniforms.uPixel.value.set(1/w,1/h);
  }
  setQuality(high){this.high=high;this.sceneTarget.samples=high?2:0;this.sceneTarget.dispose();this.resize();}
  pass(mat,target){this.quad.material=mat;this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);}
  render(scene,camera,sun,warm){
    const r=this.renderer;r.info.reset();r.setRenderTarget(this.sceneTarget);r.render(scene,camera);
    if(this.high){
      this.pass(this.extract,this.bright);
      this.blur.uniforms.tColor.value=this.bright.texture;this.blur.uniforms.uStep.value.set(2.0/this.bright.width,0);this.pass(this.blur,this.blurA);
      this.blur.uniforms.tColor.value=this.blurA.texture;this.blur.uniforms.uStep.value.set(0,2.0/this.blurA.height);this.pass(this.blur,this.blurB);
    }
    const sunPoint=camera.position.clone().addScaledVector(sun,1000).project(camera),forward=new THREE.Vector3();camera.getWorldDirection(forward);
    this.output.uniforms.uSun.value.set(sunPoint.x*.5+.5,sunPoint.y*.5+.5);
    this.output.uniforms.uSunVisible.value=forward.dot(sun)>.05&&Math.abs(sunPoint.x)<1.1&&Math.abs(sunPoint.y)<1.1?1:0;
    this.output.uniforms.uWarm.value=warm;this.output.uniforms.uExposure.value=warm>.5 ? .98:1.02;this.output.uniforms.uBloom.value=this.high ? .34:0;
    this.pass(this.output,null);
  }
}
