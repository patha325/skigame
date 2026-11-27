// Independently implemented heightfield skiing. This is not Bonvo's physics code.
export const FIXED_STEP = 1 / 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class Skier {
  constructor(terrain,mode='ski') { this.terrain = terrain; this.mode=mode; this.reset(0, 0, 0); }
  reset(x, z, heading) {
    this.x = x; this.z = z; this.y = this.terrain.height(x, z);
    this.heading = heading; this.vx = Math.sin(heading) * 3;
    this.vz = Math.cos(heading) * 3;
    const [gx, gz] = this.terrain.gradient(x, z);
    this.vy = gx * this.vx + gz * this.vz;
    this.grounded = true; this.charge = 0; this.jumpWasDown = false;
    this.time = 0; this.distance = 0; this.airTime = 0; this.crashed = false;
    this.boostCharges=3;this.boostTime=0;this.spin=0;this.flip=0;this.flipVelocity=0;this.grab=null;this.lean=0;
  }
  get speed() { return Math.hypot(this.vx, this.vy, this.vz); }
  step(dt, input = {}) {
    if (this.crashed) return;
    const steer = clamp(input.steer || 0, -1, 1);
    const brake = !!input.brake, tuck = !!input.tuck, jump = !!input.jump;
    const oldX = this.x, oldZ = this.z;
    if(input.boostPressed&&this.boostCharges>=1){this.boostCharges-=1;this.boostTime=1.8;}
    this.boostTime=Math.max(0,this.boostTime-dt);this.boostCharges=Math.min(3,this.boostCharges+dt/9);
    this.lean+=(steer-this.lean)*Math.min(1,dt*6);
    const [gx, gz] = this.terrain.gradient(this.x, this.z);
    const norm = Math.hypot(gx, 1, gz);
    const nx = -gx / norm, ny = 1 / norm, nz = -gz / norm;
    if (this.grounded) {
      this.heading -= steer * (this.mode==='ski'?1.55:1.4) / (1 + this.speed / 25) * dt;
      let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      let fy = gx * fx + gz * fz;
      const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      // Project gravity onto the ground tangent, then damp lateral ski slip.
      this.vx += 9.81 * ny * nx * dt;
      this.vy += (-9.81 + 9.81 * ny * ny) * dt;
      this.vz += 9.81 * ny * nz * dt;
      if(this.boostTime>0){this.vx+=fx*3.7*dt;this.vy+=fy*3.7*dt;this.vz+=fz*3.7*dt;}
      const forward = this.vx * fx + this.vy * fy + this.vz * fz;
      const groomed = this.terrain.pisteDistance(this.x, this.z) < 24;
      const lateralKeep = Math.exp(-(brake ? 2.5 : groomed ? (this.mode==='ski'?9:7.5) : 4) * dt);
      this.vx = forward * fx + (this.vx - forward * fx) * lateralKeep;
      this.vy = forward * fy + (this.vy - forward * fy) * lateralKeep;
      this.vz = forward * fz + (this.vz - forward * fz) * lateralKeep;
      const speed = this.speed;
      const decel = (groomed ? 0.18 : 1.0) + (brake ? 10 : 0) + (tuck||this.boostTime>0 ? 0.0028 : 0.006) * speed * speed;
      const keep = speed > 0 ? Math.max(0, speed - decel * dt) / speed : 0;
      this.vx *= keep; this.vy *= keep; this.vz *= keep;
      if (jump) this.charge = Math.min(1, this.charge + dt / 0.5);
      if (!jump && this.jumpWasDown && this.charge > 0) {
        const impulse = 3 + this.charge * 3.5;
        this.vx += nx * impulse; this.vy += ny * impulse; this.vz += nz * impulse;
        this.y += 0.08; this.grounded = false; this.airTime = 0; this.charge = 0;
      }
    } else {
      this.vy -= 9.81 * dt; this.airTime += dt;
      this.heading -= steer * 1.8 * dt;
      this.spin-=steer*3.8*dt;
      if(input.flipPressed&&Math.abs(this.flipVelocity)<.01)this.flipVelocity=input.flipPressed*6.2;
      this.flip+=this.flipVelocity*dt;
      if(Math.abs(this.flip)>=Math.PI*2){this.flip=0;this.flipVelocity=0;}
      this.vx *= Math.exp(-0.015 * dt); this.vz *= Math.exp(-0.015 * dt);
    }
    this.grab=!this.grounded&&input.grab?(steer>.2?'Indy':steer<-.2?'Melon':input.tuck?'Nose grab':input.brake?'Tail grab':'Method'):null;
    if(this.grounded){this.spin*=Math.exp(-8*dt);this.flip*=Math.exp(-10*dt);this.flipVelocity=0;}
    this.jumpWasDown = jump;
    const speed = this.speed;
    if (speed > 45) { this.vx *= 45 / speed; this.vy *= 45 / speed; this.vz *= 45 / speed; }
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    const edge = this.terrain.half - 20;
    if (Math.abs(this.x) > edge || Math.abs(this.z) > edge) {
      this.x = clamp(this.x, -edge, edge); this.z = clamp(this.z, -edge, edge);
      this.vx = this.vz = 0;
    }
    const ground = this.terrain.height(this.x, this.z);
    if (this.grounded || (this.y <= ground && this.airTime > 0.03)) {
      if (!this.grounded && this.airTime > 0.2 && this.vy < -18) this.crashed = true;
      this.y = ground; this.grounded = true;
      const [dx, dz] = this.terrain.gradient(this.x, this.z);
      this.vy = dx * this.vx + dz * this.vz;
    }
    this.time += dt; this.distance += Math.hypot(this.x - oldX, this.z - oldZ);
  }
}
