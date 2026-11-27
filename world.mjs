import * as THREE from './vendor/three.module.min.js';
import {ArtPipeline} from './render-pipeline.mjs';
import {snowPine,createRider,buildEquipment} from './game-art.mjs';

const clamp=THREE.MathUtils.clamp;
const UP=new THREE.Vector3(0,1,0);
function hash(x,z,seed=0){let t=Math.imul(x^seed,374761393)+Math.imul(z,668265263)|0;t=Math.imul(t^(t>>>13),1274126177);return((t^(t>>>16))>>>0)/4294967296;}
function merged(parts){
  const p=[],n=[],c=[];
  for(const [geometry,color] of parts){const g=geometry.index?geometry.toNonIndexed():geometry;const a=g.attributes.position,b=g.attributes.normal,co=new THREE.Color(color);
    for(let i=0;i<a.count;i++){p.push(a.getX(i),a.getY(i),a.getZ(i));n.push(b.getX(i),b.getY(i),b.getZ(i));c.push(co.r,co.g,co.b);}if(g!==geometry)g.dispose();geometry.dispose();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));return g;
}
function pineGeometry(distant=false){
  const parts=[],tiers=distant?3:6,sides=distant?4:7;
  parts.push([new THREE.CylinderGeometry(.024,.037,.9,5).translate(0,.45,0),0x746253]);
  for(let j=0;j<tiers;j++){const y=.18+j*.12*(6/tiers),r=.23*(1-j/(tiers+1)),h=.36*(distant?1.2:1);
    parts.push([new THREE.ConeGeometry(r,h,sides).translate(0,y+h*.5,0),j%2?0x315053:0x244348]);
    parts.push([new THREE.ConeGeometry(r*.86,h*.76,sides).translate(0,y+h*.61+.02,0),j%2?0xe4ebef:0xf1f1ee]);}
  return merged(parts);
}
function gumGeometry(distant=false){
  const parts=[[new THREE.CylinderGeometry(.024,.046,.85,6).translate(0,.425,0),0xc5bfaf]];
  const count=distant?3:7;
  for(let i=0;i<count;i++){const a=i*2.399,x=Math.sin(a)*.19,z=Math.cos(a)*.19,y=.55+hash(i,5)*.34;
    parts.push([new THREE.IcosahedronGeometry(.18,distant?0:1).scale(1,.8,1).translate(x,y,z),0x526b67]);
    parts.push([new THREE.IcosahedronGeometry(.155,distant?0:1).scale(1,.44,1).translate(x,y+.09,z),0xe9eeec]);}
  return merged(parts);
}
export class MountainView{
  constructor(canvas){
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xd4bdcd,1000,6500);
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.12,42000);
    this.hemi=new THREE.HemisphereLight(0xc0cbed,0x8e7495,1.15);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffc18a,7.5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-72,right:72,top:72,bottom:-72,near:5,far:800});
    this.sun.shadow.bias=-.00014;this.sun.shadow.normalBias=.035;this.sun.shadow.radius=3;
    this.sun.shadow.camera.updateProjectionMatrix();this.scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight(0xe5dcea,.48);this.scene.add(this.fill,this.fill.target);
    this.root=new THREE.Group();this.scene.add(this.root);
    this.target=new THREE.Vector3();this.desired=new THREE.Vector3();this.normal=new THREE.Vector3();this.forward=new THREE.Vector3();this.right=new THREE.Vector3();this.matrix=new THREE.Matrix4();
    this.highQuality=true;this.sunDirection=new THREE.Vector3(.5,.14,-.85).normalize();this.mood='alpenglow';
    this.cameraReady=false;this.time=0;this.frame=0;this.wide=false;this.cameraDistance=4.5;this.cameraHeight=3.1;this.trailN=0;this.trailClock=0;
    this.makeSky();this.makeEnvironment();this.makeRider();this.makeContactShadow();this.pipeline=new ArtPipeline(this.renderer);
    canvas.__mountainView=this;
  }

  makeSky(){
    this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{uSun:{value:this.sunDirection},uWarm:{value:1}},
      vertexShader:'varying vec3 skyWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);skyWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
      fragmentShader:`varying vec3 skyWorld;uniform vec3 uSun;uniform float uWarm;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
        void main(){
          vec3 r=normalize(skyWorld-cameraPosition);float y=max(r.y,0.);
          float facing=pow(max(dot(normalize(r.xz),normalize(uSun.xz)),0.),9.);
          float low=exp(-y*5.);vec3 zenith=mix(vec3(.10,.25,.57),vec3(.58,.23,.29),uWarm);
          vec3 horizon=mix(vec3(.8,1.05,1.5),mix(vec3(.92,.56,.55),vec3(2.2,.73,.16),facing),uWarm);
          vec3 color=mix(zenith,horizon,low);
          vec2 p=r.xz/max(.07,y+.07)*vec2(.25,2.4);
          float clouds=ns(p*.8)*.56+ns(p*2.2)*.27+ns(p*5.4)*.12;
          float wisps=smoothstep(.53,.73,clouds)*smoothstep(.012,.14,y);
          color=mix(color,mix(vec3(1.4,1.45,1.6),vec3(1.45,.87,.83),uWarm),wisps*.45);
          float s=max(dot(r,uSun),0.);color+=vec3(1.5,.92,.4)*pow(s,90.)*uWarm;
          color+=vec3(25.,16.,7.)*smoothstep(.99990,.99997,s);
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
        }`});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(35000,32,16),this.skyMaterial);this.sky.frustumCulled=false;this.scene.add(this.sky);
  }
  makeEnvironment(){
    const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,128);
    g.addColorStop(0,'#9c9abb');g.addColorStop(.40,'#f1c9b5');g.addColorStop(.51,'#fff0d2');g.addColorStop(.56,'#b3bace');g.addColorStop(1,'#e1e6ef');ctx.fillStyle=g;ctx.fillRect(0,0,256,128);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.mapping=THREE.EquirectangularReflectionMapping;
    const generator=new THREE.PMREMGenerator(this.renderer);this.environment=generator.fromEquirectangular(tex);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.45;tex.dispose();generator.dispose();
  }

  clearWorld(){
    const textures=new Set();this.root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;m.map&&textures.add(m.map);m.dispose();}});
    textures.forEach(t=>t.dispose());this.pisteTexture?.dispose();this.root.clear();this.forest=null;this.markers=[];this.trails=[];
  }
  load(terrain,meta,profile){
    this.clearWorld();this.terrain=terrain;this.meta=meta;this.profile=profile;this.seed=[...profile.slug].reduce((s,c)=>(s*31+c.charCodeAt(0))|0,0);
    this.scene.fog.near=1100;this.scene.fog.far=Math.max(5000,Math.min(10500,terrain.side*1.1));
    this.makeTerrain();this.makeForest();this.makeLifts();this.makeTrails();this.cameraReady=false;this.forestCentre=null;
  }

  makeTerrain(){
    const t=this.terrain,n=Math.min(t.n-1,360),g=new THREE.PlaneGeometry(t.side,t.side,n,n);g.rotateX(-Math.PI/2);
    const pos=g.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,t.height(pos.getX(i),pos.getZ(i)));g.computeVertexNormals();
    this.pisteTexture=new THREE.DataTexture(Float32Array.from(t.distances,v=>v/10),t.n,t.n,THREE.RedFormat,THREE.FloatType);
    this.pisteTexture.minFilter=THREE.LinearFilter;this.pisteTexture.magFilter=THREE.LinearFilter;this.pisteTexture.needsUpdate=true;
    const mat=new THREE.MeshStandardMaterial({color:0xf2f3fa,roughness:.62,metalness:0,envMapIntensity:.65});
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uPiste:{value:this.pisteTexture},uSide:{value:t.side},uGroom:{value:this.groomDirection?.clone()??new THREE.Vector2(1,0)},uTreeline:{value:this.profile.forestLine}});
      this.snowShader=shader;
      shader.vertexShader='varying vec3 snowWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsnowWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=`varying vec3 snowWorld;uniform sampler2D uPiste;uniform float uSide;uniform vec2 uGroom;uniform float uTreeline;
        float grainSnow(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        vec3 snowBump(vec3 normalIn,float heightIn,vec3 viewPoint){
          vec3 dx=dFdx(viewPoint),dy=dFdy(viewPoint);
          vec3 rx=cross(dy,normalIn),ry=cross(normalIn,dx);float det=dot(dx,rx);
          return normalize(abs(det)*normalIn-sign(det)*(dFdx(heightIn)*rx+dFdy(heightIn)*ry));
        }
      `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float pisteD=texture2D(uPiste,(snowWorld.xz+uSide*.5)/uSide).r;
        float grooming=1.-smoothstep(17.,36.,pisteD);
        float groovePhase=dot(snowWorld.xz,uGroom)*62.83185;
        float grooveAA=1.-smoothstep(1.0,4.0,fwidth(groovePhase));
        float ridge=cos(groovePhase);
        float snowGrain=grainSnow(floor(snowWorld.xz*32.));
        diffuseColor.rgb*=1.-grooming*grooveAA*(.055+.055*ridge);
        diffuseColor.rgb*=.986+.018*snowGrain;
        float farForest=smoothstep(300.,1500.,length(vViewPosition))*(1.-smoothstep(uTreeline-40.,uTreeline+40.,snowWorld.y))*smoothstep(32.,65.,pisteD);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.70,.77,.79),farForest*.36);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float softDrifts=sin(snowWorld.x*.7+sin(snowWorld.z*.43))*sin(snowWorld.z*.57)*.012*(1.-grooming);
        float grooveHeight=sin(groovePhase)*.0034*grooveAA*grooming+softDrifts;
        normal=snowBump(normal,grooveHeight,-vViewPosition);
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.76,.40,grooming);');
    };
    const snow=new THREE.Mesh(g,mat);snow.receiveShadow=true;this.root.add(snow);
  }

  makeForest(){
    const gum=this.profile.treeType==='eucalypt';
    const material=(near,far)=>{
      const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,envMapIntensity:.22});
      m.onBeforeCompile=shader=>{
        shader.uniforms.uForestNear={value:near};shader.uniforms.uForestFar={value:far};
        shader.fragmentShader='uniform float uForestNear;uniform float uForestFar;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          float treeRange=length(vViewPosition);
          float visibility=smoothstep(uForestNear,uForestNear+80.,treeRange)*(1.-smoothstep(uForestFar-90.,uForestFar,treeRange));
          float screenNoise=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453);
          if(screenNoise>visibility)discard;
          #include <opaque_fragment>
        `);
      };return m;
    };
    this.forest=new THREE.InstancedMesh(gum?gumGeometry():snowPine(0),material(-100,365),1800);
    this.forest.castShadow=true;this.forest.receiveShadow=true;this.forest.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.forest.count=0;this.root.add(this.forest);
    this.middleForest=new THREE.InstancedMesh(gum?gumGeometry(true):snowPine(1),material(230,1150),11000);
    this.middleForest.receiveShadow=true;this.middleForest.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.middleForest.count=0;this.root.add(this.middleForest);
    const far=new THREE.InstancedMesh(gum?gumGeometry(true):snowPine(2),material(950,20000),38000);this.farForest=far;
    let n=0;const size=this.terrain.side*.97,step=Math.max(17,size/Math.sqrt(78000)),count=Math.ceil(size/step);
    for(let i=0;i<90000;i++){const row=i,col=i*3;
      if(n>=30000)break;
      const x=(hash(col,row,this.seed)-.5)*size,z=(hash(col,row,this.seed+17)-.5)*size,y=this.terrain.height(x,z);
      if(y>this.profile.forestLine+(hash(col,row,4)-.5)*55||this.terrain.pisteDistance(x,z)<34)continue;
      const s=10+hash(col,row,51)*11;this.matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,hash(col,row,56)*6.28),new THREE.Vector3(s*1.12,s,s*1.12));far.setMatrixAt(n++,this.matrix);
    }
    this.farTotal=n;far.count=this.highQuality?n:Math.min(n,13000);far.computeBoundingSphere();this.root.add(far);
  }

  refreshForest(x,z){
    if(this.forestCentre&&Math.hypot(x-this.forestCentre.x,z-this.forestCentre.z)<95)return;
    this.forestCentre={x,z};
    const populate=(mesh,step,radius,inner,max)=>{
      let n=0;const cx=Math.floor(x/step),cz=Math.floor(z/step),span=Math.ceil(radius/step);
      for(let j=cz-span;j<=cz+span;j++)for(let i=cx-span;i<=cx+span;i++){
        if(n>=max||hash(i,j,this.seed)<.11)continue;
        const px=(i+(hash(i,j,11)-.5)*.88)*step,pz=(j+(hash(i,j,23)-.5)*.88)*step,d=Math.hypot(px-x,pz-z);
        if(d>radius||d<inner||Math.abs(px)>this.terrain.half-20||Math.abs(pz)>this.terrain.half-20)continue;
        const h=this.terrain.height(px,pz),line=this.profile.forestLine+(hash(i,j,5)-.5)*55;
        if(h>line||this.terrain.pisteDistance(px,pz)<23+hash(i,j,7)*8)continue;
        const [gx,gz]=this.terrain.gradient(px,pz);if(Math.hypot(gx,gz)>1.15)continue;
        const s=9+hash(i,j,41)*11,q=new THREE.Quaternion().setFromAxisAngle(UP,hash(i,j,39)*Math.PI*2);
        this.matrix.compose(new THREE.Vector3(px,h,pz),q,new THREE.Vector3(s*(.95+hash(i,j,51)*.25),s,s));mesh.setMatrixAt(n++,this.matrix);
      }
      mesh.count=n;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    };
    populate(this.forest,10,350,0,this.highQuality?1400:700);populate(this.middleForest,15,1150,180,this.highQuality?7200:3600);
  }

  makeLifts(){
    this.liftPaths=[];const towers=[],chairs=[];
    for(const lift of this.meta.lifts){
      if(lift.points.length<2)continue;const points=[],raw=lift.points;
      for(let i=0;i<raw.length-1;i++){
        const a=raw[i],b=raw[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/25));
        for(let j=0;j<n;j++){const x=a[0]+dx*j/n,z=a[2]+dz*j/n;points.push(new THREE.Vector3(x,this.terrain.height(x,z)+11,z));}
      }
      const e=raw.at(-1);points.push(new THREE.Vector3(e[0],this.terrain.height(e[0],e[2])+11,e[2]));
      const curve=new THREE.CatmullRomCurve3(points),length=curve.getLength();
      this.root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(Math.ceil(length/10))),new THREE.LineBasicMaterial({color:0x343944,transparent:true,opacity:.75})));
      for(let d=0;d<length;d+=100){const p=curve.getPointAt(d/length),v=curve.getTangentAt(d/length);towers.push({p,v});}
      for(let d=40;d<length;d+=140){const p=curve.getPointAt(d/length),v=curve.getTangentAt(d/length);chairs.push({p,v});}
      this.liftPaths.push({name:lift.name,points:raw,curve,length});
    }
    const pole=merged([[new THREE.CylinderGeometry(.15,.22,10.8,6).translate(0,5.4,0),0x67767c],[new THREE.BoxGeometry(4.6,.24,.25).translate(0,10.6,0),0x3b454e],[new THREE.CylinderGeometry(.55,.55,1.7,10).translate(0,.85,0),0xd5672b],[new THREE.CylinderGeometry(.558,.558,.22,10).translate(0,.87,0),0xf3e8ce]]);
    const mesh=new THREE.InstancedMesh(pole,new THREE.MeshLambertMaterial({vertexColors:true}),towers.length);
    towers.forEach(({p,v},i)=>{this.matrix.compose(new THREE.Vector3(p.x,this.terrain.height(p.x,p.z),p.z),new THREE.Quaternion().setFromAxisAngle(UP,Math.atan2(v.x,v.z)),new THREE.Vector3(1,1,1));mesh.setMatrixAt(i,this.matrix);});mesh.castShadow=true;this.root.add(mesh);
    const chair=merged([[new THREE.CylinderGeometry(.035,.035,2.1,4).translate(0,-1.05,0),0x3d4550],[new THREE.BoxGeometry(1.55,.12,.5).translate(0,-2.2,0),0x263e4b],[new THREE.BoxGeometry(1.55,.6,.08).translate(0,-1.9,-.24),0x2d424c]]);
    const seats=new THREE.InstancedMesh(chair,new THREE.MeshLambertMaterial({vertexColors:true}),chairs.length);
    chairs.forEach(({p,v},i)=>{this.matrix.compose(p,new THREE.Quaternion().setFromAxisAngle(UP,Math.atan2(v.x,v.z)),new THREE.Vector3(1,1,1));seats.setMatrixAt(i,this.matrix);});seats.castShadow=true;this.root.add(seats);
  }
  setRun(run){
    if(this.markerGroup){this.root.remove(this.markerGroup);const materials=new Set();this.markerGroup.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>{m.map?.dispose();m.dispose();});}
    this.markerGroup=new THREE.Group();this.root.add(this.markerGroup);
    const points=[[],[]],white=0xf4ede4;
    for(let i=0;i<run.points.length-1;i++){
      const a=run.points[i],b=run.points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<1)continue;
      const n=Math.max(1,Math.ceil(len/80));
      for(let j=0;j<n;j++){const f=j/n,x=a[0]+dx*f,z=a[2]+dz*f;
        for(const s of [-1,1])points[s===-1?0:1].push([x-dz/len*17*s,z+dx/len*17*s]);
      }
    }
    for(let side=0;side<2;side++){
      const g=merged([[new THREE.CylinderGeometry(.033,.033,1.55,5).translate(0,.78,0),white],[new THREE.CylinderGeometry(.042,.042,.37,5).translate(0,1.35,0),side===0?0x387ca4:0xc95555]]);
      const m=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({vertexColors:true}),points[side].length);
      points[side].forEach(([x,z],i)=>{this.matrix.makeTranslation(x,this.terrain.height(x,z),z);m.setMatrixAt(i,this.matrix);});this.markerGroup.add(m);
    }
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.strokeStyle='#df7932';ctx.lineWidth=2;ctx.beginPath();
    for(let k=0;k<=64;k+=8){ctx.moveTo(k,0);ctx.lineTo(k,64);ctx.moveTo(0,k);ctx.lineTo(64,k);}ctx.stroke();
    const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(8,1);
    const net=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.2,side:THREE.DoubleSide,roughness:.8,depthWrite:false});
    const post=new THREE.MeshStandardMaterial({color:0xc45f27,roughness:.7});let distance=0,placed=0;
    for(let i=1;i<run.points.length&&placed<3;i++){
      const a=run.points[i-1],b=run.points[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);distance+=len;
      if(len<5||distance<25+placed*230)continue;
      const tx=dx/len,tz=dz/len,x=a[0]+tx*6+tz*24,z=a[2]+tz*6-tx*24;
      const start=this.terrain.height(x,z),end=this.terrain.height(x+tx*12,z+tz*12),middle=(start+end)/2;
      const fence=new THREE.Mesh(new THREE.PlaneGeometry(12,1.15),net);fence.position.set(x+tx*6,middle+.8,z+tz*6);fence.rotation.y=Math.atan2(-tz,tx);fence.rotation.z=Math.atan2(end-start,12);this.markerGroup.add(fence);
      for(const f of [0,.5,1]){const px=x+tx*12*f,pz=z+tz*12*f,pole=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,1.65,6),post);pole.position.set(px,this.terrain.height(px,pz)+.825,pz);pole.castShadow=true;this.markerGroup.add(pole);}
      placed++;
    }
    const p=run.points[0],q=run.points[1],h=Math.atan2(q[0]-p[0],q[2]-p[2]);this.groomDirection=new THREE.Vector2(Math.cos(h),-Math.sin(h));this.snowShader?.uniforms.uGroom.value.copy(this.groomDirection);
    this.runHeading=h;this.setWorldMood(this.mood);this.cameraReady=false;this.trailN=0;this.trailClock=0;for(const trail of this.trails??[])trail.geometry.setDrawRange(0,0);
  }

  makeTrails(){
    this.trails=[];for(let i=0;i<2;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6000*3),3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x7893aa,transparent:true,opacity:.29}));line.frustumCulled=false;this.root.add(line);this.trails.push(line);}
  }
  makeRider(){
    const rig=createRider();this.rider=rig.root;this.pose=rig.pose;this.human=rig.human;this.gear=rig.equipment;
    this.torso=rig.torso;this.head=rig.head;this.arms=rig.arms;this.feet=rig.feet;
    this.rider.scale.setScalar(1.08);this.scene.add(this.rider);this.setGear('ski');
  }

  makeContactShadow(){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,3,64,64,62);
    g.addColorStop(0,'rgba(44,36,64,.8)');g.addColorStop(.4,'rgba(44,36,64,.45)');g.addColorStop(1,'rgba(44,36,64,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.7).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    this.contactShadow.renderOrder=1;this.scene.add(this.contactShadow);
  }
  setGear(mode){
    this.mode=mode;buildEquipment(this.gear,mode);this.human.rotation.y=mode==='snowboard'?Math.PI/2:0;
  }

  setWorldMood(mood){
    this.mood=mood;const day=mood==='day';this.skyMaterial.uniforms.uWarm.value=day?0:1;
    this.sun.color.setHex(day?0xfff0d8:0xffba7b);this.sun.intensity=day?4.6:7.5;
    this.hemi.color.setHex(day?0xbcd7f7:0xc0cbed);this.hemi.groundColor.setHex(day?0x96a3ba:0x8e7495);
    this.scene.fog.color.setHex(day?0xc3d3e7:0xd4bdcd);
    if(this.runHeading!==undefined){const a=this.runHeading+.35,e=day ? .65:.13;this.sunDirection.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));}
  }

  setQuality(quality){
    const high=quality!=='low';this.renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));this.renderer.shadowMap.enabled=high;this.renderer.setSize(innerWidth,innerHeight);this.highQuality=high;this.pipeline.setQuality(high);this.forestCentre=null;if(this.farForest)this.farForest.count=high?this.farTotal:Math.min(this.farTotal,13000);
  }

  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.pipeline.resize();}

  addTrail(actor,dt){
    this.trailClock+=dt;if(!actor.grounded||actor.speed<1||this.trailClock<.055)return;this.trailClock=0;if(this.trailN>=6000)this.trailN=0;
    this.trails.forEach((line,i)=>{const side=(i-.5)*(this.mode==='ski' ? .30:.16),x=actor.x+Math.cos(actor.heading)*side,z=actor.z-Math.sin(actor.heading)*side;
      line.geometry.attributes.position.setXYZ(this.trailN,x,this.terrain.height(x,z)+.045,z);line.geometry.attributes.position.needsUpdate=true;line.geometry.setDrawRange(0,this.trailN+1);});this.trailN++;
  }
  update(dt,actor,input={},options={}){
    this.time+=dt;this.frame++;this.refreshForest(actor.x,actor.z);
    const [gx,gz]=this.terrain.gradient(actor.x,actor.z),h=actor.heading,speed=Math.hypot(actor.vx,actor.vy,actor.vz);
    this.rider.position.set(actor.x,actor.y+.025,actor.z);this.rider.quaternion.setFromAxisAngle(UP,h);
    this.pose.rotation.y=actor.spin??0;this.pose.rotation.x=(actor.flip??0)-Math.atan(gx*Math.sin(h)+gz*Math.cos(h))*.12;this.pose.rotation.z=(actor.lean??0)*.23;
    this.gear.rotation.x=-Math.atan(gx*Math.sin(h)+gz*Math.cos(h));this.gear.rotation.z=Math.atan(gx*Math.cos(h)-gz*Math.sin(h));
    this.torso.rotation.x=THREE.MathUtils.damp(this.torso.rotation.x,input.tuck ? .38:actor.charge ? .20:.02,9,dt);
    this.torso.position.y=THREE.MathUtils.damp(this.torso.position.y,(input.tuck||actor.charge>0) ? .67:.79,9,dt);
    const grab=!!actor.grab;this.arms.forEach((arm,i)=>{arm.rotation.x=THREE.MathUtils.damp(arm.rotation.x,grab?-1.1:input.tuck ? .75:.08,10,dt);arm.rotation.z=(i?1:-1)*(grab ? .50:.14);});
    this.head.rotation.y=this.mode==='snowboard'?-Math.PI/2:0;
    if(options.lieDown){this.rider.rotation.x=Math.PI/2;this.rider.position.y=actor.y+.30;}
    this.rider.visible=options.camera!=='first';const distance=this.cameraDistance+Math.min(.65,speed*.016);
    if(options.map){this.desired.set(actor.x,actor.y+1100,actor.z-220);this.target.set(actor.x,actor.y,actor.z);}
    else if(options.camera==='first'){this.desired.set(actor.x,actor.y+2.05,actor.z);this.target.set(actor.x+Math.sin(h)*25,actor.y+1.6,actor.z+Math.cos(h)*25);}
    else if(options.camera==='side'){this.desired.set(actor.x+Math.cos(h)*8-Math.sin(h)*3,actor.y+3.5,actor.z-Math.sin(h)*8-Math.cos(h)*3);this.target.set(actor.x,actor.y+1.1,actor.z);}
    else{this.desired.set(actor.x-Math.sin(h)*distance,actor.y+this.cameraHeight+Math.min(.20,speed*.005),actor.z-Math.cos(h)*distance);this.target.set(actor.x+Math.sin(h)*10,actor.y+.60,actor.z+Math.cos(h)*10);}
    this.desired.y=Math.max(this.desired.y,this.terrain.height(this.desired.x,this.desired.z)+.7);
    if(!this.cameraReady){this.camera.position.copy(this.desired);this.cameraReady=true;}else this.camera.position.lerp(this.desired,1-Math.exp(-6*dt));
    this.camera.lookAt(this.target);const fov=this.wide?85:58+Math.min(3,speed*.05);this.camera.fov=THREE.MathUtils.damp(this.camera.fov,fov,6,dt);this.camera.updateProjectionMatrix();
    this.sky.position.copy(this.camera.position);
    if(this.frame%4===1){
      const x=Math.round(actor.x/8)*8,z=Math.round(actor.z/8)*8;
      this.sun.target.position.set(x,actor.y,z);this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection,350);this.sun.target.updateMatrixWorld();
      this.fill.position.copy(this.camera.position).add(new THREE.Vector3(0,6,0));this.fill.target.position.set(actor.x,actor.y+1,actor.z);this.fill.target.updateMatrixWorld();
    }
    if(options.recordTrail)this.addTrail(actor,dt);
    this.contactShadow.position.set(actor.x,this.terrain.height(actor.x,actor.z)+.045,actor.z);
    this.normal.set(-gx,1,-gz).normalize();this.contactShadow.quaternion.setFromUnitVectors(UP,this.normal);
    const hover=Math.max(0,actor.y-this.terrain.height(actor.x,actor.z));this.contactShadow.material.opacity=Math.max(0,.38-hover*.06);this.contactShadow.scale.setScalar(1+Math.min(2,hover*.18));
    this.pipeline.render(this.scene,this.camera,this.sunDirection,this.mood==='day'?0:1);
  }
  photoMetrics(){
    const bounds=new THREE.Box3().setFromObject(this.rider),points=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new THREE.Vector3(x,y,z).project(this.camera));
    const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
    return {style:'sunset-helmet-0.3',mood:this.mood,cameraDistance:this.cameraDistance,riderScreenHeight:(maxY-minY)/2,trees:{near:this.forest.count,middle:this.middleForest.count,far:this.farForest.count},hdr:this.pipeline.hdr,triangles:this.renderer.info.render.triangles,drawCalls:this.renderer.info.render.calls};
  }
}
