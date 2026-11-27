import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import {snowPine,roundedBox,createRider,buildEquipment} from '../game-art.mjs';
test('forest detail decreases across LODs without corrupt vertices or losing the canopy',()=>{
  const counts=[];
  for(const level of [0,1,2]){
    const g=snowPine(level);g.computeBoundingBox();counts.push(g.attributes.position.count);
    assert.ok(g.boundingBox.max.y>.9&&g.boundingBox.max.y<1.5);
    for(const name of ['position','normal','color'])assert.ok(g.attributes[name].array.every(Number.isFinite));
    assert.ok(g.attributes.color.array.some(v=>v>.6),'Snow must remain represented in each LOD');g.dispose();
  }
  assert.ok(counts[0]>counts[1]&&counts[1]>counts[2]);
  assert.ok(counts[2]/3<45,'Distant trees must retain a small triangle budget');
});
test('rounded clothing has unit normals and stays inside its requested dimensions',()=>{
  const g=roundedBox(.7,1,.4,.05);g.computeBoundingBox();
  assert.ok(g.boundingBox.max.x<=.351&&g.boundingBox.min.x>=-.351);
  for(let i=0;i<g.attributes.normal.count;i++){const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i);assert.ok(Math.abs(n.length()-1)<1e-5);}
});
test('the rider and equipment remain finite when switching skis and snowboard repeatedly',()=>{
  const rig=createRider();rig.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(rig.root);assert.ok(bounds.max.y>2.2&&bounds.max.y<2.6);
  assert.ok(rig.arms.length===2&&rig.feet.length===2);
  for(const mode of ['ski','snowboard','ski']){
    buildEquipment(rig.equipment,mode);assert.ok(rig.equipment.children.length>0);
    rig.root.traverse(o=>{if(o.geometry)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
  }
});
