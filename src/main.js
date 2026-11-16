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
const keys = {};
const colliders = [];
const buildings = [];
const world = new THREE.Group();
const player = {
  position: new THREE.Vector3(0, 0, 9),
  velocity: new THREE.Vector3(),
  speed: 5.2,
  height: 1.75,
  onGround: true,
  group: new THREE.Group()
};
let car, carVelocity = 0;
const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3();

function mat(color, roughness=0.8, metalness=0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function box(w,h,d, material, x,y,z, parent=world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y,z);
  mesh.castShadow = true; mesh.receiveShadow = true;
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
  scene.fog = new THREE.FogExp2(0x080a12, 0.008);
  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  app.prepend(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0x9da9d9, 0x25202b, 1.5);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb8c6ff, 2.1);
  moon.position.set(-35, 65, 25); moon.castShadow = true;
  moon.shadow.mapSize.set(2048,2048);
  moon.shadow.camera.left = -65; moon.shadow.camera.right = 65;
  moon.shadow.camera.top = 65; moon.shadow.camera.bottom = -65;
  scene.add(moon);
  const purple = new THREE.PointLight(0x8b35ff, 22, 65);
  purple.position.set(0, 12, -15); scene.add(purple);
  const pink = new THREE.PointLight(0xff258f, 16, 45);
  pink.position.set(28, 9, 8); scene.add(pink);

  buildCity();
  buildPlayer();
  buildCar();
  scene.add(world);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', e => keys[e.code] = false);
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
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260,260), mat(0x171a22,0.95));
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.04; ground.receiveShadow = true; world.add(ground);

  // City blocks and road grid.
  const roadMat = mat(0x090b10,0.95);
  for (let i=-4;i<=4;i++) {
    box(260,0.04,9,roadMat, i*28,0.01,0);
    box(9,0.04,260,roadMat,0,0.012,i*28);
  }
  const lineMat = new THREE.MeshBasicMaterial({color:0x77727b});
  for(let i=-4;i<=4;i++){
    for(let z=-120;z<=120;z+=12){
      const dash = new THREE.Mesh(new THREE.BoxGeometry(.13,.025,4),lineMat);
      dash.position.set(i*28,0.045,z); world.add(dash);
    }
    for(let x=-120;x<=120;x+=12){
      const dash = new THREE.Mesh(new THREE.BoxGeometry(4,.025,.13),lineMat);
      dash.position.set(x,.045,i*28); world.add(dash);
    }
  }
  const sidewalk = mat(0x34333c);
  for(let i=-4;i<=4;i++){
    box(260,.16,2.1,sidewalk,i*28,0.04,5.7);
    box(260,.16,2.1,sidewalk,i*28,0.04,-5.7);
    box(2.1,.16,260,sidewalk,5.7,0.04,i*28);
    box(2.1,.16,260,sidewalk,-5.7,0.04,i*28);
  }

  const palette=[0x242633,0x292b39,0x343141,0x202b35,0x3b3044,0x28313a];
  for(let gx=-4;gx<=4;gx++) for(let gz=-4;gz<=4;gz++){
    if(Math.abs(gx)<=0 && Math.abs(gz)<=0) continue;
    const cx=gx*28+14, cz=gz*28+14;
    if(Math.random()<0.12) continue;
    const w=10+Math.random()*8, d=10+Math.random()*8;
    const h=9+Math.random()*38+(Math.abs(gx)+Math.abs(gz)<3?15:0);
    const building=box(w,h,d,mat(palette[Math.floor(Math.random()*palette.length)],0.72,0.18),cx,h/2,cz);
    colliders.push({x:cx,z:cz,hw:w/2+0.7,hd:d/2+0.7});
    buildings.push(building);
    // Lit window strips on two facades.
    const winMat=new THREE.MeshBasicMaterial({color:0xffd99b});
    for(let y=3;y<h-2;y+=3.2){
      for(let x=-w/2+1;x<w/2-0.5;x+=2.3){
        if(Math.random()>.35) continue;
        const win=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.25),winMat);
        win.position.set(cx+x,y,cz+d/2+.012); world.add(win);
      }
    }
    if(Math.random()<.4){
      const sign=box(w*.65,.7,.12,mat(0x7900ff,.35,.2),cx,h*.55,cz+d/2+.12);
      sign.material.emissive=new THREE.Color(0x4b00b0);
      sign.material.emissiveIntensity=1.6;
    }
  }
  // Streetlights
  for(let x=-112;x<=112;x+=28) for(let z=-112;z<=112;z+=28){
    const pole= new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,5,8),mat(0x454653));
    pole.position.set(x+7,2.5,z+7); world.add(pole);
    const lamp=new THREE.PointLight(0xffc98c,5,13); lamp.position.set(x+7,4.9,z+7); world.add(lamp);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),new THREE.MeshBasicMaterial({color:0xffe2b0}));
    bulb.position.copy(lamp.position); world.add(bulb);
  }
  // Distant skyline silhouettes.
  for(let i=0;i<35;i++){
    const h=18+Math.random()*48, x=(Math.random()-.5)*240, z=-135-Math.random()*28;
    box(8+Math.random()*12,h,8+Math.random()*12,mat(0x111522),x,h/2,z);
  }
}

function buildPlayer(){
  const g=player.group;
  const bodyMat=mat(0x252432,.65,.1), jacket=mat(0x171923,.65,.1), skin=mat(0xc58f70);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.55,5,10),jacket); torso.position.y=1.05; torso.castShadow=true; g.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.23,16,12),skin); head.position.y=1.72; head.castShadow=true; g.add(head);
  const legs=[];
  for(const x of [-.16,.16]){
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.55,4,8),bodyMat);
    leg.position.set(x,.42,0); leg.castShadow=true; g.add(leg); legs.push(leg);
  }
  for(const x of [-.43,.43]){
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.48,4,8),jacket);
    arm.position.set(x,1.12,0); arm.rotation.z=x<0?-.12:.12; arm.castShadow=true; g.add(arm);
  }
  g.position.copy(player.position); world.add(g);
  player.legs=legs;
}

function buildCar(){
  car=new THREE.Group();
  const shell=mat(0x6e20c9,.28,.65);
  const dark=mat(0x11131c,.25,.3);
  const glass=new THREE.MeshStandardMaterial({color:0x182333,metalness:.6,roughness:.18});
  box(2.1,.65,4.1,shell,0,.75,0,car);
  box(1.65,.72,1.9,glass,0,1.38,-.25,car);
  box(1.95,.12,1.0,shell,0,1.77,-.2,car);
  for(const x of [-1.03,1.03]) for(const z of [-1.35,1.35]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.25,16),dark);
    wheel.rotation.z=Math.PI/2; wheel.position.set(x,.42,z); wheel.castShadow=true; car.add(wheel);
  }
  const lightMat=new THREE.MeshBasicMaterial({color:0xddeeff});
  for(const x of [-.72,.72]){
    const light=new THREE.Mesh(new THREE.BoxGeometry(.38,.16,.05),lightMat);
    light.position.set(x,.83,2.06); car.add(light);
  }
  car.position.set(5,0,12); car.rotation.y=Math.PI; world.add(car);
}

function blocked(pos){
  if(Math.abs(pos.x)>125 || Math.abs(pos.z)>125) return true;
  return colliders.some(c=>Math.abs(pos.x-c.x)<c.hw && Math.abs(pos.z-c.z)<c.hd);
}
function onKeyDown(e){
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code]=true;
  if(e.code==='Escape' && started){ if(paused) closePause(); else openPause(); }
  if(!started || paused) return;
  if(e.code==='KeyV'){ cameraMode=cameraMode==='third'?'first':'third'; showToast(cameraMode==='third'?'VISUALE TERZA PERSONA':'VISUALE PRIMA PERSONA'); }
  if(e.code==='KeyF') toggleCar();
}
function onMouseMove(e){
  if(!pointerLocked || paused) return;
  yaw -= e.movementX*0.0024;
  pitch = THREE.MathUtils.clamp(pitch-e.movementY*0.0018,-0.55,0.65);
}
function toggleCar(){
  if(inCar){
    inCar=false;
    player.position.set(car.position.x+2.2,0,car.position.z);
    player.group.visible=true;
    statusText.textContent='A PIEDI';
    showToast('SEI SCESO DAL VEICOLO');
    return;
  }
  const distance=player.position.distanceTo(car.position);
  if(distance<4.2){
    inCar=true; player.group.visible=false;
    statusText.textContent='ALLA GUIDA';
    showToast('VEICOLO PRESO');
  } else showToast('AVVICINATI A UN VEICOLO');
}
function update(dt){
  if(!started || paused) return;
  if(inCar){
    const accel=(keys.KeyW?1:0)-(keys.KeyS?1:0);
    carVelocity += accel*dt*13;
    carVelocity *= Math.pow(keys.Space?.90:.975,dt*60);
    carVelocity=THREE.MathUtils.clamp(carVelocity,-8,22);
    const steer=(keys.KeyA?1:0)-(keys.KeyD?1:0);
    car.rotation.y += steer*dt*(0.7+Math.abs(carVelocity)*.045)*Math.sign(carVelocity||1);
    const forward=new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));
    const next=car.position.clone().addScaledVector(forward,carVelocity*dt);
    if(!blocked(next)) car.position.copy(next); else carVelocity=0;
    player.position.copy(car.position);
  } else {
    const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const move=new THREE.Vector3();
    if(keys.KeyW) move.add(forward);
    if(keys.KeyS) move.sub(forward);
    if(keys.KeyD) move.add(right);
    if(keys.KeyA) move.sub(right);
    if(move.lengthSq()>0) move.normalize();
    const speed=keys.ShiftLeft||keys.ShiftRight?8.5:player.speed;
    const next=player.position.clone().addScaledVector(move,speed*dt);
    if(!blocked(next)) player.position.copy(next);
    if(keys.Space && player.onGround){ player.velocity.y=6.2; player.onGround=false; }
    player.velocity.y-=18*dt;
    player.position.y+=player.velocity.y*dt;
    if(player.position.y<0){player.position.y=0;player.velocity.y=0;player.onGround=true;}
    player.group.position.copy(player.position);
    if(move.lengthSq()>0.01){
      player.group.rotation.y=Math.atan2(-move.x,-move.z);
      const swing=Math.sin(performance.now()*.012)*.55;
      player.legs[0].rotation.x=swing; player.legs[1].rotation.x=-swing;
    } else { player.legs[0].rotation.x*=.8; player.legs[1].rotation.x*=.8; }
  }
  updateCamera(dt);
  const p=inCar?car.position:player.position;
  const gx=Math.round(p.x/28), gz=Math.round(p.z/28);
  districtEl.textContent=(Math.abs(gx)+Math.abs(gz)<2)?'DOWNTOWN':(p.z>40?'BEACH DISTRICT':(p.x>35?'RICH DISTRICT':'CITY CENTER'));
  const d=new Date(); document.querySelector('#clock').textContent=d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
  vehicleHint.classList.toggle('hidden',inCar || player.position.distanceTo(car.position)>5.2);
}
function updateCamera(dt){
  const target=inCar?car.position:player.position;
  const lookAt=target.clone().add(new THREE.Vector3(0,inCar?1.3:1.45,0));
  if(cameraMode==='first' && !inCar){
    const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    camera.position.copy(lookAt).add(new THREE.Vector3(0,.35,0));
    camera.lookAt(camera.position.clone().add(dir.multiplyScalar(30)));
  } else {
    const distance=inCar?8:6.2;
    const desired=target.clone().add(new THREE.Vector3(Math.sin(yaw)*distance,2.5+pitch*3,Math.cos(yaw)*distance));
    camera.position.lerp(desired,1-Math.pow(.001,dt));
    camera.lookAt(lookAt);
  }
}
function openPause(){
  paused=true; pause.classList.remove('hidden');
  if(document.pointerLockElement) document.exitPointerLock();
}
function closePause(){
  paused=false; pause.classList.add('hidden');
  renderer.domElement.requestPointerLock();
}
function onResize(){
  if(!renderer) return;
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock?clock.getDelta():0.016,.04);
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
  },900);
});
resumeBtn.addEventListener('click',closePause);

init();
