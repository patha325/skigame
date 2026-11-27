import * as THREE from './vendor/three.module.min.js';

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
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.88;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xbac4cf,1300,6000);
    this.camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.15,42000);
    this.hemi=new THREE.HemisphereLight(0xd7e7ff,0x71819a,1.25);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffe0b3,2.9);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);
    Object.assign(this.sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:10,far:650});this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.045;this.sun.shadow.radius=2;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun,this.sun.target);this.root=new THREE.Group();this.scene.add(this.root);
    this.target=new THREE.Vector3();this.desired=new THREE.Vector3();this.normal=new THREE.Vector3();this.forward=new THREE.Vector3();this.right=new THREE.Vector3();this.matrix=new THREE.Matrix4();
    this.cameraReady=false;this.time=0;this.frame=0;this.wide=false;this.cameraDistance=7.8;this.cameraHeight=3.0;this.trailN=0;this.trailClock=0;
    this.makeSky();this.makeRider();
  }
  makeSky(){
    this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{uSun:{value:new THREE.Vector3(-.55,.55,-.65).normalize()},uWarm:{value:1}},
      vertexShader:'varying vec3 skyWorld; void main(){vec4 p=modelMatrix*vec4(position,1.0);skyWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
      fragmentShader:`varying vec3 skyWorld; uniform vec3 uSun;uniform float uWarm;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      void main(){vec3 r=normalize(skyWorld-cameraPosition);float y=max(r.y,0.);float glow=pow(max(dot(r,uSun),0.),6.);
        vec3 horizon=mix(vec3(.61,.68,.75),vec3(.80,.65,.58),uWarm*.55+glow*.25);
        vec3 col=mix(horizon,vec3(.25,.40,.57),pow(clamp(y*1.5,0.,1.),.55));
        vec2 p=r.xz/max(.16,r.y+.18)*3.;float cloud=ns(p)*.55+ns(p*2.1)*.28+ns(p*4.2)*.13;
        cloud=smoothstep(.58,.76,cloud)*smoothstep(.02,.2,y)*.38;
        col=mix(col,vec3(.93,.86,.80),cloud);col+=vec3(1.,.82,.63)*pow(max(dot(r,uSun),0.),250.)*.6;
        col+=vec3(2.,1.6,1.1)*smoothstep(.9993,.9997,dot(r,uSun));gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(35000,32,16),this.skyMaterial);this.sky.frustumCulled=false;this.scene.add(this.sky);
  }
  clearWorld(){
    const textures=new Set();this.root.traverse(o=>{o.geometry?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;m.map&&textures.add(m.map);m.dispose();}});
    textures.forEach(t=>t.dispose());this.pisteTexture?.dispose();this.root.clear();this.forest=null;this.markers=[];this.trails=[];
  }
  load(terrain,meta,profile){
    this.clearWorld();this.terrain=terrain;this.meta=meta;this.profile=profile;this.seed=[...profile.slug].reduce((s,c)=>(s*31+c.charCodeAt(0))|0,0);
    this.scene.fog.near=1400;this.scene.fog.far=Math.max(5000,Math.min(10500,terrain.side*.9));
    this.makeTerrain();this.makeForest();this.makeLifts();this.makeTrails();this.cameraReady=false;this.forestCentre=null;
  }
  makeTerrain(){
    const t=this.terrain,n=Math.min(t.n-1,360),g=new THREE.PlaneGeometry(t.side,t.side,n,n);g.rotateX(-Math.PI/2);
    const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setY(i,t.height(pos.getX(i),pos.getZ(i)));
    g.computeVertexNormals();const data=Float32Array.from(t.distances,v=>v/10);
    this.pisteTexture=new THREE.DataTexture(data,t.n,t.n,THREE.RedFormat,THREE.FloatType);
    this.pisteTexture.minFilter=THREE.LinearFilter;this.pisteTexture.magFilter=THREE.LinearFilter;this.pisteTexture.needsUpdate=true;
    const mat=new THREE.MeshStandardMaterial({color:0xf0f0eb,roughness:.96,metalness:0});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uPiste={value:this.pisteTexture};shader.uniforms.uSide={value:t.side};shader.uniforms.uGroom={value:this.groomDirection?.clone()??new THREE.Vector2(1,0)};this.snowShader=shader;
      shader.vertexShader='varying vec3 snowWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nsnowWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader='varying vec3 snowWorld;uniform sampler2D uPiste;uniform float uSide;uniform vec2 uGroom;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float pd=texture2D(uPiste,(snowWorld.xz+uSide*.5)/uSide).r;
        float groom=1.-smoothstep(13.,33.,pd);float stripe=dot(snowWorld.xz,uGroom)*52.;
        float aa=1.-smoothstep(.7,3.,fwidth(stripe));float ripple=sin(stripe)*aa;
        float grain=fract(sin(dot(floor(snowWorld.xz*17.),vec2(12.9898,78.233)))*43758.5453);
        diffuseColor.rgb*=1.-groom*(.021+.027*ripple)-(.007+(.014*(1.-groom)))*grain;
        diffuseColor.rgb=mix(diffuseColor.rgb*.965,diffuseColor.rgb,groom);
      `);
    };
    const snow=new THREE.Mesh(g,mat);snow.receiveShadow=true;this.root.add(snow);
  }
  makeForest(){
    const gum=this.profile.treeType==='eucalypt';
    const material=new THREE.MeshLambertMaterial({vertexColors:true});
    this.forest=new THREE.InstancedMesh(gum?gumGeometry():pineGeometry(),material,2400);
    this.forest.castShadow=true;this.forest.receiveShadow=true;this.forest.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.forest.count=0;this.root.add(this.forest);
    const far=new THREE.InstancedMesh(gum?gumGeometry(true):pineGeometry(true),new THREE.MeshLambertMaterial({vertexColors:true}),4200);
    let n=0;const size=this.terrain.side*.95;
    for(let i=0;i<19000&&n<4200;i++){
      const x=(hash(i,3,this.seed)-.5)*size,z=(hash(i,7,this.seed)-.5)*size,y=this.terrain.height(x,z);
      if(y>this.profile.forestLine||this.terrain.pisteDistance(x,z)<32)continue;
      const s=8+hash(i,19,this.seed)*12;this.matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(UP,hash(i,21)*6.28),new THREE.Vector3(s,s,s));far.setMatrixAt(n++,this.matrix);
    }
    far.count=n;far.computeBoundingSphere();this.root.add(far);
  }
  refreshForest(x,z){
    if(this.forestCentre&&Math.hypot(x-this.forestCentre.x,z-this.forestCentre.z)<190)return;
    this.forestCentre={x,z};let n=0;const step=30,radius=820,cx=Math.floor(x/step),cz=Math.floor(z/step);
    for(let j=cz-29;j<=cz+29;j++)for(let i=cx-29;i<=cx+29;i++){
      if(n>=2400||hash(i,j,this.seed)<.17)continue;
      const px=(i+(hash(i,j,11)-.5)*.8)*step,pz=(j+(hash(i,j,23)-.5)*.8)*step;
      if(Math.hypot(px-x,pz-z)>radius||Math.abs(px)>this.terrain.half-35||Math.abs(pz)>this.terrain.half-35)continue;
      const h=this.terrain.height(px,pz),line=this.profile.forestLine+(hash(i,j,5)-.5)*60;
      if(h>line||this.terrain.pisteDistance(px,pz)<24+hash(i,j,7)*9)continue;
      const [gx,gz]=this.terrain.gradient(px,pz);if(Math.hypot(gx,gz)>.85)continue;
      const s=8+hash(i,j,41)*12,q=new THREE.Quaternion().setFromAxisAngle(UP,hash(i,j,39)*Math.PI*2);
      this.matrix.compose(new THREE.Vector3(px,h,pz),q,new THREE.Vector3(s*(.8+hash(i,j,51)*.25),s,s));this.forest.setMatrixAt(n++,this.matrix);
    }
    this.forest.count=n;this.forest.instanceMatrix.needsUpdate=true;this.forest.computeBoundingSphere();
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
    const pole=merged([[new THREE.CylinderGeometry(.15,.22,10.8,6).translate(0,5.4,0),0x67767c],[new THREE.BoxGeometry(3.5,.24,.25).translate(0,10.6,0),0x3b454e]]);
    const mesh=new THREE.InstancedMesh(pole,new THREE.MeshLambertMaterial({vertexColors:true}),towers.length);
    towers.forEach(({p,v},i)=>{this.matrix.compose(new THREE.Vector3(p.x,this.terrain.height(p.x,p.z),p.z),new THREE.Quaternion().setFromAxisAngle(UP,Math.atan2(v.x,v.z)),new THREE.Vector3(1,1,1));mesh.setMatrixAt(i,this.matrix);});mesh.castShadow=true;this.root.add(mesh);
    const chair=merged([[new THREE.CylinderGeometry(.035,.035,2.1,4).translate(0,-1.05,0),0x3d4550],[new THREE.BoxGeometry(1.55,.12,.5).translate(0,-2.2,0),0x263e4b],[new THREE.BoxGeometry(1.55,.6,.08).translate(0,-1.9,-.24),0x2d424c]]);
    const seats=new THREE.InstancedMesh(chair,new THREE.MeshLambertMaterial({vertexColors:true}),chairs.length);
    chairs.forEach(({p,v},i)=>{this.matrix.compose(p,new THREE.Quaternion().setFromAxisAngle(UP,Math.atan2(v.x,v.z)),new THREE.Vector3(1,1,1));seats.setMatrixAt(i,this.matrix);});seats.castShadow=true;this.root.add(seats);
  }
  setRun(run){
    if(this.markerGroup){this.root.remove(this.markerGroup);this.markerGroup.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
    this.markerGroup=new THREE.Group();this.root.add(this.markerGroup);let total=0;
    const white=new THREE.MeshLambertMaterial({color:0xf2f1eb}),red=new THREE.MeshLambertMaterial({color:0xcf4d6d}),blue=new THREE.MeshLambertMaterial({color:0x3783b7});
    for(let i=0;i<run.points.length-1;i++){
      const a=run.points[i],b=run.points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);if(len<1)continue;
      const spacing=90,n=Math.ceil(len/spacing);
      for(let j=0;j<n;j++){const f=j/n,x=a[0]+dx*f,z=a[2]+dz*f;
        for(const s of [-1,1]){const px=x-dz/len*17*s,pz=z+dx/len*17*s,h=this.terrain.height(px,pz),g=new THREE.Group();g.position.set(px,h,pz);
          const p=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.55,5),white);p.position.y=.78;g.add(p);
          const cap=new THREE.Mesh(new THREE.CylinderGeometry(.042,.042,.37,5),s===1?red:blue);cap.position.y=1.35;g.add(cap);this.markerGroup.add(g);}
      }total+=len;
    }
    const a=run.points[0],b=run.points[1],h=Math.atan2(b[0]-a[0],b[2]-a[2]);this.groomDirection=new THREE.Vector2(Math.cos(h),-Math.sin(h));this.snowShader?.uniforms.uGroom.value.copy(this.groomDirection);
    this.cameraReady=false;this.trailN=0;this.trailClock=0;for(const trail of this.trails??[])trail.geometry.setDrawRange(0,0);
  }
  makeTrails(){
    this.trails=[];for(let i=0;i<2;i++){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6000*3),3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x7893aa,transparent:true,opacity:.29}));line.frustumCulled=false;this.root.add(line);this.trails.push(line);}
  }
  makeRider(){
    this.rider=new THREE.Group();this.pose=new THREE.Group();this.pose.position.y=.85;this.rider.add(this.pose);
    this.human=new THREE.Group();this.human.position.y=-.85;this.gear=new THREE.Group();this.gear.position.y=-.85;this.pose.add(this.human,this.gear);this.scene.add(this.rider);
    const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.8});
    const jacket=mat(0xcc507b),stripe=mat(0x387e9e),navy=mat(0x20354d),skin=mat(0xf1c2aa),yellow=mat(0xdba52c),snow=mat(0xf3efe8),lens=mat(0x293c52);
    const part=(g,m,x,y,z,parent=this.human)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
    this.torso=new THREE.Group();this.torso.position.set(0,.62,0);this.human.add(this.torso);
    part(new THREE.CapsuleGeometry(.22,.23,6,12).scale(1.13,1,.82),jacket,0,.27,0,this.torso);
    for(const y of [.17,.36])part(new THREE.CylinderGeometry(.229,.229,.075,16).scale(1.12,1,.83),stripe,0,y,0,this.torso);
    part(new THREE.TorusGeometry(.19,.055,6,16).rotateX(Math.PI/2),snow,0,.56,0,this.torso);
    this.head=new THREE.Group();this.head.position.set(0,.72,.015);this.torso.add(this.head);
    part(new THREE.SphereGeometry(.24,20,14).scale(1,.96,.94),skin,0,0,0,this.head);
    part(new THREE.SphereGeometry(.255,20,14,0,Math.PI*2,0,Math.PI*.56).scale(1,1.12,1),yellow,0,.035,0,this.head);
    part(new THREE.CylinderGeometry(.259,.259,.095,20),yellow,0,.045,0,this.head);
    part(new THREE.SphereGeometry(.075,12,8),snow,0,.335,0,this.head);
    part(new THREE.SphereGeometry(.2,20,10).scale(1,.46,.35),snow,0,.005,.185,this.head);
    part(new THREE.SphereGeometry(.176,20,10).scale(1,.40,.27),lens,0,.012,.212,this.head);
    this.arms=[];
    for(const s of [-1,1]){
      const arm=new THREE.Group();arm.position.set(s*.27,.43,0);arm.rotation.z=s*.25;this.torso.add(arm);
      part(new THREE.CapsuleGeometry(.09,.22,5,10),jacket,0,-.13,0,arm);
      part(new THREE.SphereGeometry(.108,12,8),navy,0,-.35,.02,arm);this.arms.push(arm);
    }
    this.feet=[];for(const s of [-1,1]){
      const leg=new THREE.Group();leg.position.set(s*.14,.15,0);this.human.add(leg);
      part(new THREE.CapsuleGeometry(.105,.23,5,10),navy,0,.19,.035,leg);
      part(new THREE.CapsuleGeometry(.09,.15,5,10).rotateX(Math.PI/2),snow,0,.01,.045,leg);this.feet.push(leg);
    }
    this.setGear('snowboard');
  }
  setGear(mode){
    this.mode=mode;this.gear.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.gear.clear();
    const boardMaterial=new THREE.MeshStandardMaterial({color:0x2d718c,roughness:.42});
    const ski=(w,length,x)=>{const shape=new THREE.Shape();shape.moveTo(-w/2,-length/2+.18);shape.quadraticCurveTo(-w/2,-length/2,0,-length/2);shape.quadraticCurveTo(w/2,-length/2,w/2,-length/2+.18);shape.lineTo(w/2,length/2-.18);shape.quadraticCurveTo(w/2,length/2,0,length/2);shape.quadraticCurveTo(-w/2,length/2,-w/2,length/2-.18);shape.closePath();
      const g=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.015,bevelThickness:.01,bevelSegments:2,steps:1});g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,boardMaterial);m.position.set(x,.105,0);m.castShadow=true;this.gear.add(m);};
    if(mode==='ski'){ski(.12,1.75,-.14);ski(.12,1.75,.14);this.human.rotation.y=0;}
    else {ski(.31,1.42,0);this.human.rotation.y=Math.PI/2;}
  }
  setWorldMood(mood){
    const noon=mood==='day';this.skyMaterial.uniforms.uWarm.value=noon?.2:1;
    this.sun.color.setHex(noon?0xfff1d5:0xffddb2);this.sun.intensity=noon?2.7:2.9;this.renderer.toneMappingExposure=noon?.93:.88;
  }
  setQuality(quality){this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:1.5));this.renderer.shadowMap.enabled=quality!=='low';this.renderer.setSize(innerWidth,innerHeight);}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  addTrail(actor,dt){
    this.trailClock+=dt;if(!actor.grounded||actor.speed<1||this.trailClock<.055)return;this.trailClock=0;if(this.trailN>=6000)this.trailN=0;
    this.trails.forEach((line,i)=>{const side=(i-.5)*(this.mode==='ski'?.30:.16),x=actor.x+Math.cos(actor.heading)*side,z=actor.z-Math.sin(actor.heading)*side;
      line.geometry.attributes.position.setXYZ(this.trailN,x,this.terrain.height(x,z)+.045,z);line.geometry.attributes.position.needsUpdate=true;line.geometry.setDrawRange(0,this.trailN+1);});this.trailN++;
  }
  update(dt,actor,input={},options={}){
    this.time+=dt;this.frame++;this.refreshForest(actor.x,actor.z);
    const [gx,gz]=this.terrain.gradient(actor.x,actor.z);this.normal.set(-gx,1,-gz).normalize();if(!actor.grounded)this.normal.lerp(UP,.75).normalize();
    this.forward.set(Math.sin(actor.heading),gx*Math.sin(actor.heading)+gz*Math.cos(actor.heading),Math.cos(actor.heading)).normalize();this.right.crossVectors(this.normal,this.forward).normalize();this.forward.crossVectors(this.right,this.normal).normalize();this.matrix.makeBasis(this.right,this.normal,this.forward);
    this.rider.position.set(actor.x,actor.y+.025,actor.z);this.rider.quaternion.setFromRotationMatrix(this.matrix);
    this.pose.rotation.y=actor.spin??0;this.pose.rotation.x=actor.flip??0;this.pose.rotation.z=(actor.lean??0)*.34;
    this.torso.rotation.x=THREE.MathUtils.damp(this.torso.rotation.x,input.tuck?-.48:actor.charge?-.25:0,9,dt);
    this.torso.position.y=THREE.MathUtils.damp(this.torso.position.y,(input.tuck||actor.charge>0) ? .53 : .62,9,dt);
    const grab=!!actor.grab;
    this.arms.forEach((arm,i)=>{arm.rotation.x=THREE.MathUtils.damp(arm.rotation.x,grab?-1.1:input.tuck?-.95:-.18,10,dt);arm.rotation.z=(i?1:-1)*(grab?.55:.25);});
    this.head.rotation.y=this.mode==='snowboard'?-Math.PI/2:0;
    if(options.lieDown){this.rider.rotation.x=Math.PI/2;this.rider.position.y=actor.y+.25;}
    this.rider.visible=options.camera!=='first';
    const h=actor.heading,speed=Math.hypot(actor.vx,actor.vy,actor.vz),distance=this.cameraDistance+Math.min(4,speed*.09);
    if(options.map){this.desired.set(actor.x,actor.y+1100,actor.z-220);this.target.set(actor.x,actor.y,actor.z);}
    else if(options.camera==='first'){this.desired.set(actor.x,actor.y+1.5,actor.z);this.target.set(actor.x+Math.sin(h)*25,actor.y+1.2,actor.z+Math.cos(h)*25);}
    else if(options.camera==='side'){this.desired.set(actor.x+Math.cos(h)*12-Math.sin(h)*6,actor.y+4.1,actor.z-Math.sin(h)*12-Math.cos(h)*6);this.target.set(actor.x,actor.y+.9,actor.z);}
    else{this.desired.set(actor.x-Math.sin(h)*distance,actor.y+this.cameraHeight+speed*.035,actor.z-Math.cos(h)*distance);this.target.set(actor.x+Math.sin(h)*10,actor.y+1.0,actor.z+Math.cos(h)*10);}
    this.desired.y=Math.max(this.desired.y,this.terrain.height(this.desired.x,this.desired.z)+.75);
    if(!this.cameraReady){this.camera.position.copy(this.desired);this.cameraReady=true;}else this.camera.position.lerp(this.desired,1-Math.exp(-6*dt));
    this.camera.lookAt(this.target);const fov=this.wide?93:64+Math.min(6,speed*.12);this.camera.fov=THREE.MathUtils.damp(this.camera.fov,fov,6,dt);this.camera.updateProjectionMatrix();
    this.sky.position.copy(this.camera.position);
    if(this.frame%8===1){const x=Math.round(actor.x/10)*10,z=Math.round(actor.z/10)*10;this.sun.position.set(x-190,actor.y+290,z-210);this.sun.target.position.set(x,actor.y,z);this.sun.target.updateMatrixWorld();}
    if(options.recordTrail)this.addTrail(actor,dt);
    this.renderer.render(this.scene,this.camera);
  }
}
