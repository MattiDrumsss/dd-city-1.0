import * as THREE from 'three';
import './style.css';

const app = document.querySelector('#app');
const menu = document.querySelector('#menu');
const loading = document.querySelector('#loading');
const hud = document.querySelector('#hud');
const pause = document.querySelector('#pause');
const startBtn = document.querySelector('#startBtn');
const resumeBtn = document.querySelector('#resumeBtn');
const statusText = document.querySelector('#statusText');
const vehicleHint = document.querySelector('#vehicleHint');
const districtEl = document.querySelector('#district');
const toastEl = document.querySelector('#toast');

let renderer, scene, camera, clock;
let started = false, paused = false, pointerLocked = false;
let cameraMode = 'third';
let yaw = Math.PI, pitch = 0.12;
let inCar = false;
let toastTimer;
let hudClockTimer = 0;
const keys = {};
const colliders = [];
const world = new THREE.Group();
const player = {
  position: new THREE.Vector3(0, 0, 9), velocity: new THREE.Vector3(),
  speed: 5.2, onGround: true, group: new THREE.Group(), legs: [], arms: [], walkTime: 0
};
let car, carVelocity = 0, carWheels = [];
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const nextPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraDesired = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();

function mat(color, roughness=0.8, metalness=0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function addBox(w,h,d, material, x,y,z, parent=world, cast=false, receive=false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y,z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a12);
  scene.fog = new THREE.Fog(0x080a12, 75, 205);
  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 320);

  const lowPower = window.matchMedia('(max-width: 900px)').matches || (navigator.deviceMemory && navigator.deviceMemory <= 4);
  renderer = new THREE.WebGLRenderer({
    antialias: !lowPower && window.devicePixelRatio <= 1.5,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.35));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  app.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0x9da9d9, 0x25202b, 1.7));
  const moon = new THREE.DirectionalLight(0xb8c6ff, 1.35);
  moon.position.set(-35, 65, 25);
  scene.add(moon);
  // Pochi punti luce grandi: migliaia di luci dinamiche sono un ottimo modo per friggere gli FPS.
  const purple = new THREE.PointLight(0x8b35ff, 17, 58, 2);
  purple.position.set(0, 11, -15); scene.add(purple);
  const pink = new THREE.PointLight(0xff258f, 11, 42, 2);
  pink.position.set(28, 8, 8); scene.add(pink);

  buildCity();
  buildPlayer();
  buildCar();
  scene.add(world);
  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', e => { keys[e.code] = false; });
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (started && !paused && !pointerLocked) openPause();
  });
  renderer.domElement.addEventListener('click', () => {
    if (started && !paused && !pointerLocked) renderer.domElement.requestPointerLock();
  });
  animate();
}

function buildCity() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260,260), mat(0x171a22,1));
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.04;
  world.add(ground);

  const roadMat = mat(0x090b10,1);
  const sidewalkMat = mat(0x34333c,1);
  const roadDashMat = new THREE.MeshBasicMaterial({ color: 0x77727b });
  for (let i=-4;i<=4;i++) {
    addBox(260,.04,9,roadMat,i*28,.01,0);
    addBox(9,.04,260,roadMat,0,.012,i*28);
    addBox(260,.16,2.1,sidewalkMat,i*28,.04,5.7);
    addBox(260,.16,2.1,sidewalkMat,i*28,.04,-5.7);
    addBox(2.1,.16,260,sidewalkMat,5.7,.04,i*28);
    addBox(2.1,.16,260,sidewalkMat,-5.7,.04,i*28);
  }

  // Segnaletica stradale raggruppata in due InstancedMesh invece di centinaia di oggetti separati.
  const dashGeoH = new THREE.BoxGeometry(.13,.025,4);
  const dashGeoV = new THREE.BoxGeometry(4,.025,.13);
  const count = 9 * 21;
  const dashesH = new THREE.InstancedMesh(dashGeoH, roadDashMat, count);
  const dashesV = new THREE.InstancedMesh(dashGeoV, roadDashMat, count);
  const dummy = new THREE.Object3D();
  let index = 0;
  for(let i=-4;i<=4;i++) for(let z=-120;z<=120;z+=12) {
    dummy.position.set(i*28,.045,z); dummy.updateMatrix(); dashesH.setMatrixAt(index,dummy.matrix); index++;
  }
  index = 0;
  for(let i=-4;i<=4;i++) for(let x=-120;x<=120;x+=12) {
    dummy.position.set(x,.045,i*28); dummy.updateMatrix(); dashesV.setMatrixAt(index,dummy.matrix); index++;
  }
  world.add(dashesH,dashesV);

  const palette=[0x242633,0x292b39,0x343141,0x202b35,0x3b3044,0x28313a];
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd99b });
  const windowGeo = new THREE.PlaneGeometry(.8,1.25);
  const windowMatrices = [];
  for(let gx=-4;gx<=4;gx++) for(let gz=-4;gz<=4;gz++) {
    if(gx===0 && gz===0) continue;
    const cx=gx*28+14, cz=gz*28+14;
    if(Math.random()<0.16) continue;
    const w=10+Math.random()*8, d=10+Math.random()*8;
    const h=9+Math.random()*38+(Math.abs(gx)+Math.abs(gz)<3?15:0);
    const buildingMaterial=mat(palette[Math.floor(Math.random()*palette.length)],.86,.08);
    addBox(w,h,d,buildingMaterial,cx,h/2,cz);
    colliders.push({x:cx,z:cz,hw:w/2+.85,hd:d/2+.85});

    // Finestre istanziate: mantengono il dettaglio senza creare centinaia di draw call.
    for(let y=3;y<h-2;y+=3.2) for(let x=-w/2+1;x<w/2-.5;x+=2.3) {
      if(Math.random()>.34) continue;
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3(cx+x,y,cz+d/2+.014);
      const quat = new THREE.Quaternion();
      m.compose(pos,quat,new THREE.Vector3(1,1,1));
      windowMatrices.push(m);
    }
    if(Math.random()<.42) {
      const signMat=mat(0x7900ff,.45,.1);
      signMat.emissive=new THREE.Color(0x4b00b0);
      signMat.emissiveIntensity=1.4;
      addBox(w*.65,.7,.12,signMat,cx,h*.55,cz+d/2+.12);
    }
    // Piccoli volumi sul tetto per dare varietà alla skyline.
    if(Math.random()<.55) addBox(1.5,1.2,1.5,mat(0x171923),cx-w*.22,h+.6,cz);
  }
  const windows = new THREE.InstancedMesh(windowGeo,windowMaterial,Math.max(1,windowMatrices.length));
  windowMatrices.forEach((m,i)=>windows.setMatrixAt(i,m));
  windows.instanceMatrix.needsUpdate=true;
  world.add(windows);

  // Lampioni senza PointLight individuali: la luce è simulata da una lampada emissiva.
  const poleGeo = new THREE.CylinderGeometry(.07,.1,5,6);
  const poleMat = mat(0x454653);
  const poles = new THREE.InstancedMesh(poleGeo,poleMat,81);
  const bulbGeo = new THREE.SphereGeometry(.14,6,5);
  const bulbMat = new THREE.MeshBasicMaterial({color:0xffd69a});
  const bulbs = new THREE.InstancedMesh(bulbGeo,bulbMat,81);
  index=0;
  for(let x=-112;x<=112;x+=28) for(let z=-112;z<=112;z+=28) {
    dummy.position.set(x+7,2.5,z+7); dummy.rotation.set(0,0,0); dummy.updateMatrix(); poles.setMatrixAt(index,dummy.matrix);
    dummy.position.set(x+7,4.9,z+7); dummy.scale.setScalar(1); dummy.updateMatrix(); bulbs.setMatrixAt(index,dummy.matrix);
    index++;
  }
  world.add(poles,bulbs);

  for(let i=0;i<24;i++) {
    const h=18+Math.random()*48, x=(Math.random()-.5)*240, z=-135-Math.random()*28;
    addBox(8+Math.random()*12,h,8+Math.random()*12,mat(0x111522),x,h/2,z);
  }
}

function buildPlayer() {
  const g=player.group;
  const bodyMat=mat(0x252432,.72,.05), jacket=mat(0x171923,.72,.05), skin=mat(0xc58f70,.85,0);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.55,4,8),jacket);
  torso.position.y=1.05; g.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),skin);
  head.position.y=1.72; g.add(head);
  for(const x of [-.16,.16]) {
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.55,3,6),bodyMat);
    leg.position.set(x,.42,0); g.add(leg); player.legs.push(leg);
  }
  for(const x of [-.43,.43]) {
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,3,6),jacket);
    arm.position.set(x,1.12,0); arm.rotation.z=x<0?-.12:.12; g.add(arm); player.arms.push(arm);
  }
  // Giacca e scarpe: dettagli semplici, economici da renderizzare.
  const shoeMat=mat(0x090a10,.8,0);
  for(const x of [-.16,.16]) addBox(.22,.12,.34,shoeMat,x,.08,.06,g);
  g.position.copy(player.position);
  world.add(g);
}

function buildCar() {
  car=new THREE.Group();
  const shell=mat(0x6e20c9,.32,.5);
  const dark=mat(0x11131c,.35,.15);
  const glass=new THREE.MeshStandardMaterial({color:0x182333,metalness:.45,roughness:.24});
  addBox(2.1,.65,4.1,shell,0,.75,0,car);
  addBox(1.65,.72,1.9,glass,0,1.38,-.25,car);
  addBox(1.95,.12,1.0,shell,0,1.77,-.2,car);
  for(const x of [-1.03,1.03]) for(const z of [-1.35,1.35]) {
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.25,12),dark);
    wheel.rotation.z=Math.PI/2; wheel.position.set(x,.42,z); car.add(wheel); carWheels.push(wheel);
  }
  const lightMat=new THREE.MeshBasicMaterial({color:0xddeeff});
  const rearMat=new THREE.MeshBasicMaterial({color:0xff244d});
  for(const x of [-.72,.72]) {
    addBox(.38,.16,.05,lightMat,x,.83,2.06,car);
    addBox(.38,.16,.05,rearMat,x,.83,-2.06,car);
  }
  car.position.set(5,0,12); car.rotation.y=Math.PI; world.add(car);
}

function blocked(pos) {
  if(Math.abs(pos.x)>125 || Math.abs(pos.z)>125) return true;
  for(let i=0;i<colliders.length;i++) {
    const c=colliders[i];
    if(Math.abs(pos.x-c.x)<c.hw && Math.abs(pos.z-c.z)<c.hd) return true;
  }
  return false;
}
function onKeyDown(e) {
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if(keys[e.code]) return;
  keys[e.code]=true;
  if(e.code==='Escape' && started) { if(paused) closePause(); else openPause(); }
  if(!started || paused) return;
  if(e.code==='KeyV') { cameraMode=cameraMode==='third'?'first':'third'; showToast(cameraMode==='third'?'VISUALE TERZA PERSONA':'VISUALE PRIMA PERSONA'); }
  if(e.code==='KeyF') toggleCar();
}
function onMouseMove(e) {
  if(!pointerLocked || paused) return;
  yaw -= e.movementX*.0022;
  pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0017,-.5,.62);
}
function toggleCar() {
  if(inCar) {
    inCar=false;
    player.position.set(car.position.x+2.5,0,car.position.z);
    player.group.visible=true;
    statusText.textContent='A PIEDI';
    showToast('SEI SCESO DAL VEICOLO');
    return;
  }
  if(player.position.distanceTo(car.position)<4.5) {
    inCar=true; player.group.visible=false; statusText.textContent='ALLA GUIDA';
    showToast('VEICOLO PRESO');
  } else showToast('AVVICINATI A UN VEICOLO');
}

function update(dt) {
  if(!started || paused) return;
  if(inCar) {
    const accel=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    carVelocity += accel*dt*11;
    carVelocity *= Math.pow(keys.Space?.88:.982,dt*60);
    carVelocity=THREE.MathUtils.clamp(carVelocity,-9,25);
    const steer=(keys.KeyA?1:0)-(keys.KeyD?1:0);
    car.rotation.y += steer*dt*(.58+Math.abs(carVelocity)*.042)*Math.sign(carVelocity||1);
    forward.set(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));
    nextPosition.copy(car.position).addScaledVector(forward,carVelocity*dt);
    if(!blocked(nextPosition)) car.position.copy(nextPosition); else carVelocity *= -.12;
    carWheels.forEach(w=>w.rotation.x += carVelocity*dt*1.8);
    player.position.copy(car.position);
  } else {
    forward.set(-Math.sin(yaw),0,-Math.cos(yaw));
    right.set(Math.cos(yaw),0,-Math.sin(yaw));
    move.set(0,0,0);
    if(keys.KeyW) move.add(forward);
    if(keys.KeyS) move.sub(forward);
    if(keys.KeyD) move.add(right);
    if(keys.KeyA) move.sub(right);
    const moving=move.lengthSq()>0.001;
    if(moving) move.normalize();
    const speed=(keys.ShiftLeft||keys.ShiftRight)?8.2:player.speed;
    nextPosition.copy(player.position).addScaledVector(move,speed*dt);
    if(!blocked(nextPosition)) player.position.copy(nextPosition);
    if(keys.Space && player.onGround) { player.velocity.y=6.2; player.onGround=false; }
    player.velocity.y-=17*dt;
    player.position.y+=player.velocity.y*dt;
    if(player.position.y<0) { player.position.y=0; player.velocity.y=0; player.onGround=true; }
    player.group.position.copy(player.position);
    if(moving) {
      player.group.rotation.y=Math.atan2(-move.x,-move.z);
      player.walkTime += dt*(keys.ShiftLeft||keys.ShiftRight?12:8.5);
      const swing=Math.sin(player.walkTime)*.62;
      player.legs[0].rotation.x=swing; player.legs[1].rotation.x=-swing;
      player.arms[0].rotation.x=-swing*.55; player.arms[1].rotation.x=swing*.55;
    } else {
      player.legs.forEach(leg=>leg.rotation.x=THREE.MathUtils.damp(leg.rotation.x,0,10,dt));
      player.arms.forEach(arm=>arm.rotation.x=THREE.MathUtils.damp(arm.rotation.x,0,10,dt));
    }
  }

  updateCamera(dt);
  const p=inCar?car.position:player.position;
  const gx=Math.round(p.x/28), gz=Math.round(p.z/28);
  districtEl.textContent=(Math.abs(gx)+Math.abs(gz)<2)?'DOWNTOWN':(p.z>40?'BEACH DISTRICT':(p.x>35?'RICH DISTRICT':'CITY CENTER'));
  hudClockTimer-=dt;
  if(hudClockTimer<=0) {
    hudClockTimer=1;
    document.querySelector('#clock').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  }
  vehicleHint.classList.toggle('hidden',inCar || player.position.distanceTo(car.position)>5.2);
}

function updateCamera(dt) {
  const target=inCar?car.position:player.position;
  cameraTarget.set(target.x,target.y+(inCar?1.3:1.45),target.z);
  if(cameraMode==='first' && !inCar) {
    cameraDirection.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    camera.position.set(cameraTarget.x,cameraTarget.y+.35,cameraTarget.z);
    camera.lookAt(camera.position.clone().addScaledVector(cameraDirection,30));
  } else {
    const distance=inCar?8:6.2;
    cameraDesired.set(target.x+Math.sin(yaw)*distance, target.y+2.5+pitch*3, target.z+Math.cos(yaw)*distance);
    camera.position.lerp(cameraDesired,1-Math.exp(-8*dt));
    camera.lookAt(cameraTarget);
  }
}
function openPause() {
  paused=true; pause.classList.remove('hidden');
  if(document.pointerLockElement) document.exitPointerLock();
}
function closePause() {
  paused=false; pause.classList.add('hidden');
  renderer.domElement.requestPointerLock();
}
function onResize() {
  if(!renderer) return;
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  const lowPower=window.matchMedia('(max-width: 900px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.35));
}
function animate() {
  requestAnimationFrame(animate);
  const dt=Math.min(clock?clock.getDelta():.016,.05);
  if(started) update(dt);
  if(renderer && scene && camera) renderer.render(scene,camera);
}

startBtn.addEventListener('click',()=>{
  if(!renderer) init();
  menu.classList.add('hidden'); loading.classList.remove('hidden');
  setTimeout(()=>{
    loading.classList.add('hidden'); hud.classList.remove('hidden');
    started=true; renderer.domElement.requestPointerLock();
    showToast('BENVENUTO A D&D CITY');
  },650);
});
resumeBtn.addEventListener('click',closePause);
init();
