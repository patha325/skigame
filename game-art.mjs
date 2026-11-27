// Original procedural resort assets. Geometry is generated locally; no external models.
import * as THREE from './vendor/three.module.min.js';
export function artHash(a,b,seed=0){let n=Math.imul(a^seed,374761393)+Math.imul(b,668265263)|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function roundedBox(width,height,depth,radius=.05){
  const g=new THREE.BoxGeometry(width,height,depth,6,6,6),p=g.attributes.position,n=g.attributes.normal;
  const inner=new THREE.Vector3(width/2-radius,height/2-radius,depth/2-radius),v=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);c.set(THREE.MathUtils.clamp(v.x,-inner.x,inner.x),THREE.MathUtils.clamp(v.y,-inner.y,inner.y),THREE.MathUtils.clamp(v.z,-inner.z,inner.z));v.sub(c).normalize();n.setXYZ(i,v.x,v.y,v.z);v.multiplyScalar(radius).add(c);p.setXYZ(i,v.x,v.y,v.z);}
  return g;
}
export function snowPine(level=0){
  const pos=[],col=[],green=new THREE.Color(0x38574e),deep=new THREE.Color(0x253f3c),white=new THREE.Color(0xe3eaf2);
  const tiers=level===0?6:level===1?4:2,sides=level===0?8:level===1?6:4,rows=level===0?3:2;
  const tri=(a,b,c,color)=>{pos.push(...a,...c,...b);for(let i=0;i<3;i++)col.push(color.r,color.g,color.b);};
  function crown(y,r,h,index,snow){
    const rings=[];
    for(let row=0;row<rows;row++){const ring=[];for(let j=0;j<sides;j++){
      const angle=j/sides*Math.PI*2+index*.63,rough=.89+artHash(j,index,5)*.22;
      const size=row===0 ? .035:row===rows-1?1:.67;
      const radius=r*size*rough*(snow ? .94:1),droop=(row===rows-1?artHash(j,index,17)*.045:0);
      ring.push([Math.cos(angle)*radius,y+(row===0?h:row===rows-1?0:h*.39)+(snow ? .05:0)-droop,Math.sin(angle)*radius]);
    }rings.push(ring);}
    const color=snow?white:(index%2?green:deep);
    for(let row=0;row<rows-1;row++)for(let j=0;j<sides;j++){const k=(j+1)%sides;tri(rings[row][j],rings[row+1][j],rings[row+1][k],color);tri(rings[row][j],rings[row+1][k],rings[row][k],color);}
  }
  // A small exposed trunk and overlapping uneven boughs give a tree silhouette.
  const trunk=new THREE.CylinderGeometry(.018,.032,.9,5).translate(0,.45,0).toNonIndexed();
  const tp=trunk.attributes.position,bark=new THREE.Color(0x736254);
  for(let i=0;i<(level===2?0:tp.count);i++){pos.push(tp.getX(i),tp.getY(i),tp.getZ(i));col.push(bark.r,bark.g,bark.b);}trunk.dispose();
  for(let i=0;i<tiers;i++){const t=i/tiers,y=.13+t*.82,r=.275*Math.pow(1-t,.85),h=(level===2 ? .72:level===1 ? .49:.37)*(1-t*.32);crown(y,r,h,i,false);crown(y+.01,r,h,i,true);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}
export function createRider(){
  const root=new THREE.Group(),pose=new THREE.Group(),human=new THREE.Group(),equipment=new THREE.Group();
  root.add(pose);pose.position.y=1.05;human.position.y=-1.05;equipment.position.y=-1.05;pose.add(human,equipment);
  const matte=color=>new THREE.MeshStandardMaterial({color,roughness:.73,envMapIntensity:.4});
  const olive=matte(0x747869),cream=matte(0xc7c4b7),seam=matte(0x686c60),pants=matte(0x9b929d),boot=matte(0x383c44);
  const red=new THREE.MeshPhysicalMaterial({color:0xc4543f,roughness:.58,clearcoat:.12}),flap=matte(0xdf6b50),pocket=matte(0x9d3b30);
  const gold=new THREE.MeshPhysicalMaterial({color:0xdba047,roughness:.28,metalness:.04,clearcoat:.75,clearcoatRoughness:.25,envMapIntensity:1.2});
  const strap=matte(0x754c43),skin=matte(0xeec5ae),rubber=matte(0x51423f),white=matte(0xe7e6df);
  const glass=new THREE.MeshPhysicalMaterial({color:0x3c3446,roughness:.08,metalness:.3,clearcoat:1,envMapIntensity:1.2});
  const part=(g,m,x,y,z,parent=human)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const torso=new THREE.Group();torso.position.set(0,.79,0);human.add(torso);
  part(new THREE.CapsuleGeometry(.31,.43,8,18).scale(1.11,1,.78),olive,0,.38,0,torso);
  // Soft jacket panels, cuffs and seams; a separate padded backpack faces the camera.
  part(roundedBox(.61,.24,.44,.075),cream,0,.70,.008,torso);
  part(new THREE.TorusGeometry(.303,.018,5,24).rotateX(Math.PI/2).scale(1.10,.80,1),seam,0,.16,0,torso);
  part(roundedBox(.63,.10,.46,.035),seam,0,.01,0,torso);
  for(const s of [-1,1])part(roundedBox(.045,.58,.035,.015),strap,s*.19,.40,.25,torso);
  const pack=new THREE.Group();pack.position.set(0,.39,-.32);torso.add(pack);
  part(roundedBox(.50,.68,.22,.07),red,0,0,0,pack);
  part(roundedBox(.46,.16,.24,.045),flap,0,.25,-.015,pack);
  part(roundedBox(.33,.24,.065,.035),pocket,0,-.17,-.13,pack);
  part(roundedBox(.30,.018,.015,.006),flap,0,-.075,-.168,pack);
  for(const s of [-1,1])part(roundedBox(.023,.42,.025,.009),flap,s*.20,-.01,-.13,pack);
  const head=new THREE.Group();head.position.set(0,.99,.015);torso.add(head);
  part(new THREE.SphereGeometry(.345,24,18).scale(1,.88,.93),skin,0,0,0,head);
  part(new THREE.CylinderGeometry(.23,.23,.10,20),cream,0,-.25,0,head);
  part(new THREE.SphereGeometry(.431,28,18,0,Math.PI*2,0,Math.PI*.63).scale(1,1.02,1),gold,0,.085,0,head);
  part(new THREE.TorusGeometry(.412,.029,8,40).rotateX(Math.PI/2),strap,0,.00,0,head);
  part(roundedBox(.112,.069,.036,.015),rubber,0,-.027,-.413,head);
  part(new THREE.SphereGeometry(.307,24,12).scale(1,.48,.35),white,0,-.027,.263,head);
  part(new THREE.SphereGeometry(.274,24,12).scale(1,.44,.26),glass,0,-.015,.309,head);
  for(const s of [-1,1]){
    part(roundedBox(.035,.25,.04,.015),strap,s*.29,-.17,.023,head);
    part(roundedBox(.065,.025,.045,.009),rubber,s*.285,-.28,.027,head);
  }
  const arms=[],feet=[];
  for(const s of [-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.37,.69,0);torso.add(arm);
    part(new THREE.CapsuleGeometry(.122,.30,7,14),olive,0,-.20,.015,arm);
    part(new THREE.CapsuleGeometry(.127,.08,6,14),cream,0,-.055,0,arm);
    part(new THREE.CylinderGeometry(.116,.116,.095,14),cream,0,-.425,.014,arm);
    part(new THREE.SphereGeometry(.133,16,12).scale(1,1.08,.9),rubber,0,-.51,.04,arm);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(s*.18,0,0);human.add(leg);
    part(new THREE.CapsuleGeometry(.139,.36,7,14),pants,0,.57,0,leg);
    part(new THREE.CylinderGeometry(.136,.124,.23,16),boot,0,.31,.015,leg);
    part(roundedBox(.26,.25,.39,.07),boot,0,.15,.065,leg);
    for(const y of [.17,.23])part(roundedBox(.27,.029,.021,.009),white,0,y,.246,leg);
    part(roundedBox(.27,.052,.43,.02),rubber,0,.033,.075,leg);feet.push(leg);
  }
  return {root,pose,human,equipment,torso,head,arms,feet};
}
export function buildEquipment(group,mode){
  group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});group.clear();
  const top=new THREE.MeshPhysicalMaterial({color:0x424753,roughness:.34,clearcoat:.5}),tip=new THREE.MeshStandardMaterial({color:0xc56956,roughness:.5}),binding=new THREE.MeshStandardMaterial({color:0xdce2e5,roughness:.45});
  function ski(width,length,x){
    const segments=38,g=new THREE.PlaneGeometry(width,length,2,segments);g.rotateX(-Math.PI/2);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){const z=p.getZ(i),t=Math.abs(z)/(length*.5);p.setX(i,p.getX(i)*(1-.32*Math.pow(t,4)));p.setY(i,.065+Math.pow(Math.max(0,t-.73)/.27,2)*.13);}
    g.computeVertexNormals();const mesh=new THREE.Mesh(g,top);mesh.position.x=x;mesh.material.side=THREE.DoubleSide;mesh.castShadow=true;group.add(mesh);
    const accent=new THREE.Mesh(roundedBox(width*.86,.022,.23,.009),tip);accent.position.set(x,.139,length*.40);accent.rotation.x=-.12;group.add(accent);
    const mount=new THREE.Mesh(roundedBox(width*.83,.10,.18,.025),binding);mount.position.set(x,.13,.075);group.add(mount);
  }
  if(mode==='ski'){ski(.145,1.96,-.18);ski(.145,1.96,.18);}else ski(.345,1.63,0);
}
