import * as THREE from 'three';
import {Health,CollisionDamage,Performance,Gearbox,EngineAudio,DamageVisuals,VehicleHUD} from './vehicle.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],R=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),pick=a=>a[Math.random()*a.length|0];
const HALF=7.2,SEG=60,NSEG=9,VMAX=82,LANES=[-5.4,-1.8,1.8,5.4],COLORS=[0xe11d2e,0x2563eb,0xf5c518,0x16a34a,0xf2f2f2,0x9333ea];
const TIER_M=1250,MODES={endless:{tr:1,len:0},time:{tr:1,len:2500,time:75},traffic:{tr:1.7,len:2000,near:2},free:{tr:.5,len:1500}}; // TIER_M: metres per difficulty tier; len: level finish distance (m), 0 = endless
const ENV={
 city:{top:0x2f6fd0,bot:0xbcd8f0,sc:0xfff0d8,si:2.4,sd:[.35,.55,-.8],g:0x555a60,f:[60,430],hi:.7,rc:0xffffff,lamp:0xfff2c0},
 mountain:{top:0x1f5fae,bot:0xc3dcee,sc:0xfff4e0,si:2.4,sd:[-.4,.45,-.8],g:0x3d6e3b,f:[50,420],hi:.7,rc:0xffffff,lamp:0xfff2c0},
 desert:{top:0xd9864a,bot:0xffd9a0,sc:0xffc27a,si:2.8,sd:[-.5,.25,-.8],g:0xd2a05a,f:[50,450],hi:.8,rc:0xffe9cf,lamp:0xffe0a0},
 neon:{top:0x050218,bot:0x3a0f5c,sc:0xff6ad8,si:.5,sd:[.3,.35,-.85],g:0x08080f,f:[30,330],hi:.25,rc:0x9aa0c8,lamp:0x30e8ff,night:1}};
// ---- saved progress (validated) ----
const S={mode:'endless',env:'city',col:0,q:1,vol:.6,evol:.8,fvol:.8,shk:1,simp:false,mute:false,coins:0,best:{}};
try{const j=JSON.parse(localStorage.getItem('turborush3d.v1'));if(j&&typeof j==='object'){
 for(const k of['mode','env'])if(typeof j[k]==='string')S[k]=j[k];for(const k of['col','q','vol','coins','evol','fvol','shk'])if(Number.isFinite(j[k]))S[k]=j[k];S.mute=!!j.mute;S.simp=!!j.simp;
 if(j.best&&typeof j.best==='object')for(const k in j.best)if(Number.isFinite(j.best[k]))S.best[k]=j.best[k]}}catch(e){}
if(!MODES[S.mode])S.mode='endless';if(!ENV[S.env])S.env='city';S.col=cl(S.col|0,0,5);S.q=cl(S.q|0,0,2);S.vol=cl(S.vol,0,1);S.evol=cl(S.evol,0,1);S.fvol=cl(S.fvol,0,1);S.shk=cl(S.shk,0,1);
const save=()=>{try{localStorage.setItem('turborush3d.v1',JSON.stringify(S))}catch(e){}};
// ---- renderer / scene ----
let renderer;try{renderer=new THREE.WebGLRenderer({canvas:$('#c'),antialias:true,powerPreference:'high-performance'})}catch(e){document.body.insertAdjacentHTML('beforeend','<p class="err">WebGL is not available. Try a current version of Chrome, Edge, Firefox or Safari.</p>');throw e}
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('#c').addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);alert('The graphics context was lost. Reload the page to continue.')});
const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(62,1,.1,600);scene.add(cam);
const hemi=new THREE.HemisphereLight(0xffffff,0x444444,.7),dl=new THREE.DirectionalLight(0xffffff,2.4),head=new THREE.SpotLight(0xfff4d6,800,120,.55,.6,2),sdir=new THREE.Vector3();
scene.add(hemi,dl,dl.target,head,head.target);Object.assign(dl.shadow.camera,{left:-25,right:25,top:30,bottom:-30,near:1,far:140});dl.shadow.camera.updateProjectionMatrix();dl.shadow.bias=-.0005;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},bot:{value:new THREE.Color()},sd:{value:new THREE.Vector3()},sc:{value:new THREE.Color()}},
 vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 top,bot,sc,sd;varying vec3 p;void main(){float h=clamp(p.y*1.6+.12,0.,1.);vec3 c=mix(bot,top,pow(h,.7));float s=max(dot(p,sd),0.);c+=sc*(pow(s,700.)*4.+pow(s,10.)*.3);gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}'});
const sky=new THREE.Mesh(new THREE.SphereGeometry(500,24,12),skyMat);sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
const pm=new THREE.PMREMGenerator(renderer);let envRT=null;
// ---- textures & shared geometry ----
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function roadTex(){const c=cv(144,600),x=c.getContext('2d');x.fillStyle='#3a3c41';x.fillRect(0,0,144,600);for(let i=0;i<5000;i++){x.fillStyle=Math.random()<.5?'#33353a':'#464950';x.fillRect(Math.random()*144,Math.random()*600,2,2)}
 x.fillStyle='#eee';x.fillRect(2,0,3,600);x.fillRect(139,0,3,600);x.fillStyle='#e9b520';x.fillRect(69,0,2,600);x.fillRect(73,0,2,600);x.fillStyle='#ddd';for(let y=0;y<600;y+=100){x.fillRect(35,y,2,40);x.fillRect(107,y,2,40)}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
function winTex(on){const c=cv(64,128),x=c.getContext('2d');x.fillStyle=on?'#000':'#9aa7b5';x.fillRect(0,0,64,128);for(let i=0;i<8;i++)for(let j=0;j<16;j++){x.fillStyle=on?(Math.random()<.45?'#fff':'#111'):(Math.random()<.5?'#2c3e55':'#46607f');x.fillRect(i*8+1,j*8+2,6,4)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t}
const roadMat=new THREE.MeshStandardMaterial({map:roadTex(),roughness:.9}),roadG=new THREE.PlaneGeometry(HALF*2,SEG),groundG=new THREE.PlaneGeometry(600,SEG),barG=new THREE.BoxGeometry(.3,.9,SEG).translate(0,.45,0),stripG=new THREE.BoxGeometry(.2,.04,SEG);
// ---- cars (procedural) ----
function prof(pts,d,bev=.06){const sh=new THREE.Shape();pts.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));const g=new THREE.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelSize:bev,bevelThickness:bev,bevelSegments:2});g.translate(0,0,-d/2);g.rotateY(Math.PI/2);return g}
const bodyG=prof([[-2.1,0],[2.1,0],[2.1,.32],[1.4,.52],[.4,.6],[-1.5,.64],[-2.1,.68]],1.8),cabG=prof([[.7,.58],[.1,1.02],[-.95,1.02],[-1.6,.62]],1.4,.05),
 tyreG=new THREE.CylinderGeometry(.36,.36,.28,18).rotateZ(Math.PI/2),rimG=new THREE.CylinderGeometry(.21,.21,.3,10).rotateZ(Math.PI/2),boxG=new THREE.BoxGeometry(1,1,1),hlG=new THREE.BoxGeometry(.42,.12,.1),tlG=new THREE.BoxGeometry(.55,.1,.1),
 tyreM=new THREE.MeshStandardMaterial({color:0x111111,roughness:.9}),rimM=new THREE.MeshStandardMaterial({color:0xcfd4dc,metalness:1,roughness:.25}),glassM=new THREE.MeshStandardMaterial({color:0x0b1220,metalness:.9,roughness:.08}),
 hlM=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff2c8,emissiveIntensity:3}),trM=new THREE.MeshStandardMaterial({color:0xe6e6e6,roughness:.6});
function makeCar(color,truck){const g=new THREE.Group(),paint=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.28}),tail=new THREE.MeshStandardMaterial({color:0x300000,emissive:0xff1010,emissiveIntensity:.8}),wheels=[],fw=[];
 const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m)};
 if(truck){add(boxG,paint,0,1.5,-3.6,2.3,2.6,2.2);add(boxG,glassM,0,2.2,-4.72,2,.9,.06);add(boxG,trM,0,2.3,1.2,2.5,3.2,8.2);add(tlG,tail,-.8,.9,5.33);add(tlG,tail,.8,.9,5.33)}
 else{add(bodyG,paint,0,.3,0);add(cabG,glassM,0,.3,0);add(hlG,hlM,-.6,.55,-2.14);add(hlG,hlM,.6,.55,-2.14);add(tlG,tail,-.6,.62,2.14);add(tlG,tail,.6,.62,2.14);add(boxG,paint,0,1.08,1.9,1.6,.06,.4)}
 for(const z of truck?[-3.6,.8,2.8,4.4]:[-1.3,1.3])for(const s of[-1,1]){const st=new THREE.Group(),sp=new THREE.Group(),t=new THREE.Mesh(tyreG,tyreM);t.castShadow=true;st.position.set(s*(truck?1.15:.95),.36,z);sp.add(t,new THREE.Mesh(rimG,rimM));st.add(sp);g.add(st);wheels.push(sp);if(z===-1.3||z===-3.6)fw.push(st)}
 g.rotation.order='YXZ';return{g,paint,tail,wheels,fw,hw:truck?1.3:1,hl:truck?5.1:2.2}}
const P={car:makeCar(COLORS[S.col]),x:0,z:0,v:0,vx:0,steer:0,yaw:0,pitch:0,drift:0,hp:100,t:0,coins:0,bonus:0,score:0};P.car.g.children.forEach(m=>m.castShadow=true);scene.add(P.car.g);
const HP=new Health(),CD=new CollisionDamage(),PF=new Performance(),GB=new Gearbox(),DV=new DamageVisuals(THREE,P.car),HUD=new VehicleHUD($),AU=new EngineAudio(S);DV.setBase(COLORS[S.col],100,S.simp);
const TR=[];for(let i=0;i<18;i++){const car=makeCar(0xffffff,i%4===3);car.g.visible=false;scene.add(car.g);TR.push({car,on:false,x:0,z:0,v:0,base:20,hit:false,passed:false,min:99})}
const CO=[],coinG=new THREE.CylinderGeometry(.5,.5,.1,16).rotateX(Math.PI/2),coinM=new THREE.MeshStandardMaterial({color:0xffc400,emissive:0xaa7000,emissiveIntensity:.6,metalness:1,roughness:.3});
for(let i=0;i<16;i++){const m=new THREE.Mesh(coinG,coinM);m.visible=false;scene.add(m);CO.push({m,on:false,x:0,z:0})}
// road hazards: construction barriers (pooled, destroyed on impact)
const HZ=[],hzC=cv(64,16),hzx=hzC.getContext('2d');hzx.fillStyle='#fff';hzx.fillRect(0,0,64,16);hzx.fillStyle='#ff6a00';for(let i=-1;i<5;i++){hzx.beginPath();hzx.moveTo(i*16,16);hzx.lineTo(i*16+8,16);hzx.lineTo(i*16+16,0);hzx.lineTo(i*16+8,0);hzx.fill()}
const hzM=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(hzC),roughness:.7});hzM.map.colorSpace=THREE.SRGBColorSpace;
for(let i=0;i<4;i++){const m=new THREE.Mesh(boxG,hzM);m.scale.set(2.4,.9,.5);m.position.y=.55;m.visible=false;m.castShadow=true;scene.add(m);HZ.push({m,on:false,x:0,z:0})}
// ---- environments (recycled segments with pooled props) ----
let segs=[],dispo=[],defs=[];const keep=o=>(dispo.push(o),o),LM=(c,o)=>keep(new THREE.MeshLambertMaterial({color:c,...o}));
const bx=(w,h,d)=>keep(new THREE.BoxGeometry(w,h,d).translate(0,h/2,0)),cy=(a,b,h,s=8)=>keep(new THREE.CylinderGeometry(a,b,h,s).translate(0,h/2,0)),cn=(r,h,s=7)=>keep(new THREE.ConeGeometry(r,h,s).translate(0,h/2,0)),
 ms=(g,m,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);return o};
function scatter(s){for(const p of s.props){const d=p.d,z=((p.j+.5+(d.j??.8)*(Math.random()-.5))/d.n-.5)*SEG;p.o.position.set(p.sd*(d.x[0]===d.x[1]?d.x[0]:R(d.x[0],d.x[1])),0,z);p.o.scale.setScalar(R(d.s[0],d.s[1]));p.o.rotation.y=d.rot?R(0,6.28):0}}
function buildEnv(k){const E=ENV[k];S.env=k;for(const s of segs)scene.remove(s.g);dispo.forEach(d=>d.dispose());dispo=[];segs=[];
 skyMat.uniforms.top.value.set(E.top);skyMat.uniforms.bot.value.set(E.bot);skyMat.uniforms.sc.value.set(E.sc);sdir.set(...E.sd).normalize();skyMat.uniforms.sd.value.copy(sdir);
 scene.fog=new THREE.Fog(E.bot,E.f[0],E.f[1]);renderer.setClearColor(E.bot);hemi.color.set(E.top);hemi.groundColor.set(E.g);hemi.intensity=E.hi;dl.color.set(E.sc);dl.intensity=E.si;head.visible=!!E.night;
 roadMat.color.set(E.rc);roadMat.roughness=E.night?.45:.9;
 if(envRT)envRT.dispose();const t=new THREE.Scene();t.add(new THREE.Mesh(sky.geometry,skyMat));envRT=pm.fromScene(t,0,1,1500);scene.environment=envRT.texture;
 const pole=LM(0x333840),lampM=LM(0x222222,{emissive:E.lamp,emissiveIntensity:E.night?2.5:.6}),poleG=cy(.12,.15,8),armG=bx(2.2,.25,.7);
 const lamp=sd=>{const g=new THREE.Group();g.add(ms(poleG,pole),ms(armG,lampM,-sd*1.1,8,0));return g};
 defs=[{mk:lamp,n:E.night||k==='city'?2:1,x:[9.1,9.1],s:[1,1],j:0}];
 if(k==='city'||k==='neon'){const n=k==='neon',wt=winTex(n),bm=n?[0xff2fd0,0x20e0ff,0xa855f7].map(c=>LM(0x151528,{map:wt,emissive:c,emissiveMap:wt})):[0xb8c4d0,0xd9d2c5,0x8fa3b8].map(c=>LM(c,{map:wt}));dispo.push(wt);
  const bg=[26,40,58,80].map(h=>{const g=new THREE.BoxGeometry(14,h,14).translate(0,h/2,0),u=g.attributes.uv;for(let i=0;i<u.count;i++)u.setXY(i,u.getX(i)*2,u.getY(i)*h/16);return keep(g)}),b=()=>ms(pick(bg),pick(bm));
  defs.push({mk:b,n:3,x:[17,32],s:[.8,1.2],j:.5},{mk:b,n:2,x:[45,80],s:[1,1.6],j:.8})}
 else if(k==='mountain'){const br=LM(0x5a3b22),gr=[LM(0x1f5a2b),LM(0x2a6b35)],rk=LM(0x8a8d93,{flatShading:true}),sn=LM(0xf4f7fa),mt=LM(0x6f7a8c,{flatShading:true}),tg=cy(.3,.4,2),c1=cn(2.6,6),c2=cn(1.9,5),rg=keep(new THREE.DodecahedronGeometry(2,0)),mg=cn(70,130),cg=cn(20,36);
  defs.push({mk:()=>{const g=new THREE.Group(),m=pick(gr);g.add(ms(tg,br),ms(c1,m,0,1.2),ms(c2,m,0,4.2));return g},n:5,x:[11,45],s:[.8,1.7],rot:1},{mk:()=>ms(rg,rk,0,.4),n:2,x:[11,30],s:[.6,2],rot:1},
   {mk:()=>{const g=new THREE.Group();g.add(ms(mg,mt),ms(cg,sn,0,94));return g},n:1,x:[90,230],s:[.8,1.5],j:.5})}
 else{const sd=LM(0xe2b46a),rk=LM(0xa65a36,{flatShading:true}),ms2=LM(0xb5653a),dn=keep(new THREE.SphereGeometry(1,14,8).scale(16,3.2,11)),rg=keep(new THREE.DodecahedronGeometry(2,0)),mg=cy(30,38,45);
  defs.push({mk:()=>ms(dn,sd),n:2,x:[18,70],s:[.7,1.8],rot:1},{mk:()=>ms(rg,rk,0,.4),n:3,x:[10,40],s:[.5,1.8],rot:1},{mk:()=>ms(mg,ms2),n:1,x:[100,230],s:[.8,1.8],j:.5,rot:1})}
 const gm=LM(E.g),bm2=LM(E.night?0x333344:0x9a9ea6),sm=LM(0x19e3ff,{emissive:0x19e3ff,emissiveIntensity:2});
 for(let i=0;i<NSEG;i++){const g=new THREE.Group(),s={g,props:[]},road=new THREE.Mesh(roadG,roadMat);road.rotation.x=-Math.PI/2;road.receiveShadow=true;g.add(road);
  for(const sd of[-1,1]){const gr=new THREE.Mesh(groundG,gm);gr.rotation.x=-Math.PI/2;gr.position.set(sd*(HALF+300),-.03,0);g.add(gr,ms(barG,bm2,sd*(HALF+.35),0,0));if(E.night)g.add(ms(stripG,sm,sd*(HALF-.5),.02,0));
   for(const d of defs)for(let j=0;j<d.n;j++){const o=d.mk(sd);g.add(o);s.props.push({o,d,sd,j})}}
  g.position.z=60-i*SEG;scene.add(g);segs.push(s);scatter(s)}}
// ---- particles & speed lines ----
const NP=160,pp=new Float32Array(NP*3),pcol=new Float32Array(NP*4),pv=new Float32Array(NP*3),pa=new Float32Array(NP*3),pl=new Float32Array(NP),pmx=new Float32Array(NP).fill(1),pa0=new Float32Array(NP);let pi=0;
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));pg.setAttribute('color',new THREE.BufferAttribute(pcol,4));
const dc=cv(32,32),dx=dc.getContext('2d'),gd=dx.createRadialGradient(16,16,0,16,16,16);gd.addColorStop(0,'#fff');gd.addColorStop(1,'rgba(255,255,255,0)');dx.fillStyle=gd;dx.fillRect(0,0,32,32);
const pts=new THREE.Points(pg,new THREE.PointsMaterial({size:1.1,map:new THREE.CanvasTexture(dc),vertexColors:true,transparent:true,depthWrite:false}));pts.frustumCulled=false;scene.add(pts);
const emit=(x,y,z,vx,vy,vz,life,r,g,b,a)=>{const i=pi++%NP;pp.set([x,y,z],i*3);pv.set([vx,vy,vz],i*3);pl[i]=pmx[i]=life;pa.set([r,g,b],i*3);pa0[i]=a};
function updP(dt){for(let i=0;i<NP;i++){if(pl[i]<=0){pcol[i*4+3]=0;continue}pl[i]-=dt;const k=Math.max(pl[i],0)/pmx[i];for(let a=0;a<3;a++){pp[i*3+a]+=pv[i*3+a]*dt;pcol[i*4+a]=pa[i*3+a]}pv[i*3+1]+=(pa0[i]>.9?-12:1)*dt;pcol[i*4+3]=pa0[i]*k}pg.attributes.position.needsUpdate=pg.attributes.color.needsUpdate=true}
const NL=48,lp=new Float32Array(NL*6),lx=new Float32Array(NL),ly=new Float32Array(NL),lz=new Float32Array(NL);
const rl=(i,far)=>{const a=R(0,6.28),r=R(2.6,8);lx[i]=Math.cos(a)*r;ly[i]=Math.sin(a)*r*.6;lz[i]=far?-R(8,45):-R(1,45)};for(let i=0;i<NL;i++)rl(i);
const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(lp,3));const lm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,fog:false}),lines=new THREE.LineSegments(lg,lm);lines.frustumCulled=false;cam.add(lines);
function updL(dt){const op=cl((P.v-34)/40,0,.45);lm.opacity=op;lines.visible=op>.02&&state==='play';if(!lines.visible)return;const len=P.v*.05;for(let i=0;i<NL;i++){lz[i]+=P.v*dt*.8;if(lz[i]>-1)rl(i,1);lp.set([lx[i],ly[i],lz[i],lx[i],ly[i],lz[i]-len],i*6)}lg.attributes.position.needsUpdate=true}
// ---- audio (see vehicle.js EngineAudio) ----
const audioInit=()=>AU.init(),setVol=()=>AU.setVolumes(),tone=(...a)=>AU.tone(...a);
// ---- input ----
const K={u:0,d:0,l:0,r:0,s:0},kmap={KeyW:'u',ArrowUp:'u',KeyS:'d',ArrowDown:'d',KeyA:'l',ArrowLeft:'l',KeyD:'r',ArrowRight:'r',Space:'s'};let camMode=0;
addEventListener('keydown',e=>{const k=kmap[e.code];if(k){K[k]=1;if(state==='play')e.preventDefault();if(k==='d'&&!e.repeat&&state==='play'&&P.v>25)tone(320,.3,'sawtooth',.05,100)}
 if((e.code==='KeyG'||e.key==='g'||e.key==='G')&&!e.repeat&&state==='play'&&!P.dead){audioInit();if(GB.manual())AU.shift(true,GB.gear);e.preventDefault()}
 if(!e.repeat){if(e.code==='KeyC')camMode=(camMode+1)%3;if(e.code==='Escape'){if(state==='play')setPause(true);else if(state==='pause')setPause(false)}}});
addEventListener('keyup',e=>{const k=kmap[e.code];if(k)K[k]=0});addEventListener('blur',()=>{for(const k in K)K[k]=0});
$$('#touch button').forEach(b=>{const k=b.dataset.k;b.addEventListener('pointerdown',e=>{e.preventDefault();K[k]=1;audioInit()});['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,()=>{K[k]=0}))});
document.addEventListener('touchmove',e=>{if(state==='play')e.preventDefault()},{passive:false});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')setPause(true)});
// ---- game state ----
let level=1,simT=0,slowT=0,state='menu',lvl=0,combo=0,comboT=0,cool=0,shake=0,coinT=2,last=performance.now(),acc=0,orbit=0;
const show=(id,v)=>{$(id).hidden=!v},pop=t=>{const p=$('#pop');p.textContent=t;p.classList.remove('go');void p.offsetWidth;p.classList.add('go')};
const ACCEL=[8.5,7,5.8,4.8,4,3.4],MSG=['','Moderate damage','Heavy damage','Critical damage!'];
function damage(d){const b0=HP.band;HP.hit(d);DV.update(HP.hp,S.simp);if(HP.band>b0&&HP.band<4)pop(MSG[HP.band]);if(HP.hp<=0&&!P.dead){P.dead=true;P.deadT=0;pop('Vehicle disabled')}}
function impact(type,kmh,o={}){if(HP.hp<=0)return;const d=CD.calc(type,kmh,{...o,hp:HP.hp}),sev=cl(d/40,0,1);damage(d);
 shake=Math.min(1.2,shake+.15+sev*1.1);P.v*=1-.06-sev*.14;combo=0;
 const n=Math.round((6+sev*30)*(S.simp?.4:1));for(let i=0;i<n;i++)emit(P.x+R(-.8,.8),.5,P.z-R(0,2),R(-6,6),R(1,6),R(-6,6),R(.25,.5),1,.7,.2,1);
 AU.impact(type,sev);if(d>=25)slowT=.5;if(d>=12&&HP.hp>0)pop('Impact -'+Math.round(d)+'%')}
function spawn(c,z){for(let t=0;t<6;t++){const l=pick(LANES);if(TR.every(o=>o===c||!o.on||o.x!==l||Math.abs(o.z-z)>40)){Object.assign(c,{x:l,z,base:Math.min(R(16,34)+lvl*1.5,46)*(c.car.hl>5?.8:1),on:true,hit:false,passed:false,min:99});c.v=c.base;c.car.g.visible=true;c.car.paint.color.setHSL(Math.random(),.55,.42);return}}c.on=false}
function step(dt){const m=MODES[S.mode];simT+=dt;CD.now=simT;comboT-=dt;if(comboT<=0)combo=0;
 const dead=P.dead,gas=dead?0:K.u,brk=dead?1:K.d,st=dead?0:K.r-K.l,v0=P.v,dr=!dead&&K.s&&P.v>14&&st!==0;
 PF.update(HP.hp,dt);const vt=Math.max(VMAX*PF.vmax,1),h=PF.hnd;
 let a=gas?ACCEL[GB.gear-1]*PF.acc*Math.max(1-(P.v/vt)**2,-1):0;if(gas&&GB.timer>0)a*=.45;if(P.v>vt)a-=(P.v-vt)*1.5;
 P.v=cl(P.v+(a-.25-(gas?0:1.2+.0004*P.v*P.v)-(brk?(dead?14:28):0)-(dr?4:0))*dt,0,VMAX+2);
 GB.update(P.v*3.6,dt,gas?1:0);if(GB.ev)AU.shift(GB.ev==='up',GB.gear);
 P.steer+=(st-P.steer)*Math.min(1,dt*9*h);const lat=14*cl(P.v/16,0,1)/(1+P.v/60)*(dr?1.35:1)*h,wob=h<.85?Math.sin(simT*2.3)*(.85-h)*14*cl(P.v/25,0,1)/(1+P.v/60):0;
 P.vx+=(P.steer*lat+wob-P.vx)*Math.min(1,(dr?2.4:10)*dt*h);P.x+=P.vx*dt;P.z-=P.v*dt;
 P.drift+=((dr?1:0)-P.drift)*Math.min(1,dt*6);if(dr)P.bonus+=dt*P.v*.6;
 const lim=HALF-1.15;if(Math.abs(P.x)>lim){const s=Math.sign(P.x),nw=CD.touch('wall'+s),ang=.35+.65*Math.min(1,Math.atan2(Math.abs(P.vx),Math.max(P.v,1))/.3);P.x=s*lim;
  if(nw){if(!dead&&(P.vx*s>1.2||v0>8))impact('barrier',v0*3.6,{angle:ang})}else if(!dead&&P.v>8)damage(.8*P.v*3.6/100*ang*dt);
  if(P.v>12&&Math.random()<.5)emit(P.x+s*.9,.4,P.z+R(-1,1),-s*R(1,3),R(1,3),R(2,6),.25,1,.7,.2,1);P.vx=-s*Math.abs(P.vx)*.3;P.v=Math.max(0,P.v-(4+P.v*.12)*dt)}
 if((dr||(brk&&P.v>30))&&Math.random()<.7)for(const s of[-.9,.9])emit(P.x+s,.15,P.z+1.3,R(-1,1),R(.5,1.5),R(2,5),R(.6,1),.85,.85,.85,.5);
 const n=Math.min(TR.length,Math.round((5+lvl*1.2)*m.tr));
 TR.forEach((c,i)=>{if(i>=n){c.on=false;c.car.g.visible=false;return}
  if(!c.on||c.z>P.z+40||c.z<P.z-430){c.on=false;spawn(c,P.z-R(150,400));if(!c.on)return}
  c.v=c.base;for(const o of TR)if(o!==c&&o.on&&o.x===c.x&&o.z<c.z&&c.z-o.z<24)c.v=Math.min(c.v,o.v);c.z-=c.v*dt;
  const dx=P.x-c.x,dz=P.z-c.z,ox=1+c.car.hw-Math.abs(dx),oz=2.1+c.car.hl-Math.abs(dz),big=c.car.hl>5?1.35:1;if(oz>-1)c.min=Math.min(c.min,Math.abs(dx));
  if(ox>0&&oz>0){c.hit=true;const nw=CD.touch('car'+i),rel=Math.hypot(Math.max(0,v0-c.v),P.vx)*3.6;
   if(oz<ox){P.z+=Math.sign(dz)*oz;if(nw&&!dead)impact('traffic',rel,{mult:big});if(dz>0)P.v=Math.min(P.v,c.v*.9)}
   else{P.x+=Math.sign(dx)*ox;if(nw&&!dead)impact('traffic',Math.max(rel,12),{angle:.75,mult:big});P.vx=Math.sign(dx)*5;P.v*=.97}}
  if(!c.passed&&c.z>P.z+c.car.hl+2.1){c.passed=true;if(!c.hit&&c.min<2.9&&P.v>22){combo=Math.min(combo+1,9);comboT=4;P.bonus+=100*combo*(m.near||1);if(m.time)P.t+=2;pop('Near miss x'+combo);tone(660,.12,'triangle',.2,990)}}});
 const hn=Math.min(HZ.length,lvl);
 HZ.forEach((hz,i)=>{if(i>=hn){hz.on=false;hz.m.visible=false;return}
  if(!hz.on){const l=pick(LANES),z=P.z-R(220,420);if(TR.every(o=>!o.on||o.x!==l||Math.abs(o.z-z)>45)&&HZ.every(o=>o===hz||!o.on||o.x!==l||Math.abs(o.z-z)>60)){Object.assign(hz,{on:true,x:l,z});hz.m.position.set(l,.55,z);hz.m.visible=true}return}
  if(hz.z>P.z+30){hz.on=false;hz.m.visible=false;return}
  if(!dead&&2.25-Math.abs(P.x-hz.x)>0&&2.45-Math.abs(P.z-hz.z)>0){if(CD.touch('hz'+i))impact('hazard',v0*3.6);for(let k=0;k<10;k++)emit(hz.x,.6,hz.z,R(-5,5),R(2,7),R(-5,5),.6,1,.45,.1,1);hz.on=false;hz.m.visible=false}});
 coinT-=dt;if(coinT<=0){coinT=R(3,6);const l=pick(LANES),z0=P.z-R(120,260);for(let i=0;i<5;i++){const c=CO.find(q=>!q.on);if(!c)break;Object.assign(c,{on:true,x:l,z:z0-i*6});c.m.position.set(l,1,c.z);c.m.visible=true}}
 for(const c of CO)if(c.on){if(c.z>P.z+10){c.on=false;c.m.visible=false}else if(!dead&&Math.abs(c.x-P.x)<1.6&&Math.abs(c.z-P.z)<2.5){c.on=false;c.m.visible=false;P.coins++;P.bonus+=50;if(m.time)P.t+=1;tone(1200,.1,'square',.12,1800)}}
 P.score=P.carry-P.z*.5+P.bonus;const nt=(level-1)*2+Math.floor(-P.z/TIER_M);if(nt>lvl){lvl=nt;pop('Traffic tier '+(lvl+1))}
 if(P.dead){P.deadT+=dt;if(P.v<1||P.deadT>3.5)return end('Vehicle destroyed',false)}
 if(m.time){P.t-=dt;if(P.t<=0)return end("Time's up",false)}
 if(m.len&&-P.z>=m.len)end('Level '+level+' complete',true)}
const bank=()=>{S.coins+=P.coins-P.banked;P.banked=P.coins};
function end(why,win){state='over';bank();const rec=S.mode!=='free'&&P.score>(S.best[S.mode]||0);if(rec)S.best[S.mode]=Math.floor(P.score);save();show('#hud',0);show('#touch',0);show('#over',1);$('#ot').textContent=why;$('#nx').hidden=!win;
 $('#os').innerHTML=`Score <b>${P.score|0}</b>${rec?' &mdash; new best!':''}<br>Level ${level}, ${(-P.z/1000).toFixed(2)} km, coins ${P.coins}<br>Car health ${HP.pct}%`;$('#rp').hidden=!(win&&HP.hp<100);syncRepair();K.u=K.d=K.l=K.r=K.s=0}
function reset(next){const m=MODES[S.mode];
 if(next){P.carry=P.score;P.bonus=0;if(m.time)P.t+=40}else{level=1;HP.reset();P.carry=P.bonus=P.coins=P.banked=0;P.t=m.time||0}
 Object.assign(P,{x:LANES[1],z:0,v:0,vx:0,steer:0,yaw:0,pitch:0,drift:0,dead:false,deadT:0,score:P.carry});
 lvl=(level-1)*2;combo=comboT=shake=slowT=0;coinT=2;simT=0;CD.reset();GB.reset();PF.snap(HP.hp);DV.update(HP.hp,S.simp);
 TR.forEach(c=>{c.on=false;c.car.g.visible=false});CO.forEach(c=>{c.on=false;c.m.visible=false});HZ.forEach(h=>{h.on=false;h.m.visible=false});
 segs.forEach((s,i)=>{s.g.position.z=60-i*SEG;scatter(s)});cb.set(P.x,3,P.z+8);lookV.set(P.x,1,P.z-14)}
function begin(next){audioInit();reset(next);state='play';['#menu','#pause','#over'].forEach(i=>show(i,0));show('#hud',1);show('#touch',1);$('#tmw').hidden=!MODES[S.mode].time;last=performance.now();acc=0;if(MODES[S.mode].len)pop('Level '+level)}
const startGame=()=>begin(false),nextLevel=()=>{level++;begin(true)};
function toMenu(){state='menu';reset(false);['#pause','#over','#hud','#touch'].forEach(i=>show(i,0));show('#menu',1);syncUI()}
function syncRepair(){const c=HP.repairCost;for(const b of[$('#rp'),$('#rp2')]){b.textContent=`Repair car (${c} coins)`;b.disabled=S.coins<c}}
function repair(){const c=HP.repairCost;if(HP.hp>=100||S.coins<c||P.dead)return;S.coins-=c;HP.repair();DV.update(100,S.simp);PF.snap(100);save();AU.tone(700,.15,'triangle',.15,1100);$('#rp').hidden=$('#rp2').hidden=true;syncUI()}
function setPause(p){if(p&&state==='play'){state='pause';$('#rp2').hidden=!(S.mode==='free'&&HP.hp<100&&!P.dead);syncRepair();show('#pause',1);K.u=K.d=K.l=K.r=K.s=0}else if(!p&&state==='pause'){state='play';show('#pause',0);last=performance.now();acc=0}}
// ---- visuals / camera ----
const cb=new THREE.Vector3(),lookV=new THREE.Vector3();
function camUpd(dt){const v=P.v/VMAX,k=1-Math.exp(-dt*5),kz=1-Math.exp(-dt*12);let tx,ty,tz,lx,lz;
 if(camMode===1){tx=P.x;ty=1.1;tz=P.z-.3;lx=P.x+P.vx*.2;lz=P.z-30}else{const f=camMode===2;tx=P.x*.8;ty=(f?5:3)+v*.8;tz=P.z+(f?11.5:7.5)+v*2.5;lx=P.x*.9+P.vx*.2;lz=P.z-14}
 const kk=camMode===1?1:k;cb.x+=(tx-cb.x)*kk;cb.y+=(ty-cb.y)*kk;cb.z+=(tz-cb.z)*(camMode===1?1:kz);lookV.x+=(lx-lookV.x)*kk;lookV.y=1;lookV.z+=(lz-lookV.z)*(camMode===1?1:kz);
 shake*=Math.exp(-dt*5);cam.position.copy(cb).add(new THREE.Vector3((Math.random()-.5)*shake*S.shk,(Math.random()-.5)*shake*S.shk,0));cam.lookAt(lookV);cam.rotateZ(-P.vx*.004);
 cam.fov+=(62+v*26-cam.fov)*k;cam.updateProjectionMatrix();P.car.g.visible=camMode!==1}
function dress(dt){const c=P.car;c.g.position.set(P.x,0,P.z);P.yaw+=(-P.vx*.025-P.steer*P.drift*.3-P.yaw)*Math.min(1,dt*10);P.pitch+=((K.d?.035:K.u?-.015:0)-P.pitch)*Math.min(1,dt*6);
 c.g.rotation.set(P.pitch,P.yaw,P.vx*.004);for(const w of c.wheels)w.rotation.x-=P.v*dt/.36;for(const f of c.fw)f.rotation.y=-P.steer*.4;c.tail.emissiveIntensity=K.d?4:.8;
 for(const t of TR)if(t.on){t.car.g.position.set(t.x,0,t.z);for(const w of t.car.wheels)w.rotation.x-=t.v*dt/.36;t.car.tail.emissiveIntensity=t.v<t.base-.1?4:.8}
 for(const q of CO)if(q.on)q.m.rotation.y+=dt*4;
 dl.position.set(P.x+sdir.x*50,sdir.y*50,P.z+sdir.z*50);dl.target.position.set(P.x,0,P.z);head.position.set(P.x,1,P.z-1.5);head.target.position.set(P.x,0,P.z-40);
 for(const s of segs)if(s.g.position.z-P.z>SEG*1.5){s.g.position.z-=NSEG*SEG;scatter(s)}
 updP(dt);updL(dt);camUpd(dt);sky.position.copy(cam.position);
 const kmh=P.v*3.6,m=MODES[S.mode];
 AU.update({rpm:GB.rpm,thr:K.u&&!P.dead?1:0,v:P.v,hp:HP.hp,slip:(P.drift>.3||(K.d&&P.v>25))?.1:0},dt);
 if(!S.simp&&HP.pct<=25&&Math.random()<(HP.pct<=10?.7:.3))emit(P.x+R(-.3,.3),1,P.z-1.4,R(-.4,.4),R(1,2.5),R(1,4),R(.9,1.5),.12,.12,.12,.6);
 if(!S.simp&&HP.pct<=10&&HP.pct>0&&Math.random()<.06)emit(P.x+R(-.5,.5),.9,P.z-1.6,R(-2,2),R(2,4),R(-2,2),.3,1,.7,.2,1);
 if(state==='play'){$('#spd').textContent=Math.round(kmh);$('#sc').textContent=P.score|0;$('#co').textContent=P.coins;$('#lv').textContent=level;$('#tr').textContent=lvl+1;
  $('#ds').textContent=(-P.z/1000).toFixed(2)+(m.len?' / '+(m.len/1000).toFixed(1):'');HUD.update(HP,GB);if(m.time)$('#tm').textContent=Math.max(0,Math.ceil(P.t))}}

function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;
 if(state==='play'){acc+=dt*(slowT>0?.35:1);slowT-=dt;let n=0;while(acc>=1/60&&n++<5&&state==='play'){step(1/60);acc-=1/60}dress(dt)}
 else if(state==='menu'){orbit+=dt*.35;cam.position.set(P.x+Math.sin(orbit)*7.5,2.2,Math.cos(orbit)*7.5);cam.lookAt(P.x,.8,0);cam.fov=45;cam.updateProjectionMatrix();sky.position.copy(cam.position);P.car.g.visible=true;P.car.g.position.set(P.x,0,0);updP(dt)}
 if(state!=='play')AU.silence();renderer.render(scene,cam)}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio,[1,1.5,2][S.q]));renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
function applyQ(){dl.castShadow=S.q>0;const r=S.q>1?2048:1024;dl.shadow.mapSize.set(r,r);if(dl.shadow.map){dl.shadow.map.dispose();dl.shadow.map=null}resize()}
// ---- menu wiring ----
const sw=$('#cols');COLORS.forEach((c,i)=>{const b=document.createElement('button');b.className='sw';b.dataset.col=i;b.setAttribute('aria-label','Paint '+(i+1));b.style.background='#'+c.toString(16).padStart(6,'0');sw.append(b)});
function syncUI(){$$('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));$$('#envs button').forEach(b=>b.classList.toggle('on',b.dataset.env===S.env));$$('#cols button').forEach(b=>b.classList.toggle('on',+b.dataset.col===S.col));
 $('#q').value=S.q;$('#vol').value=S.vol;$('#evol').value=S.evol;$('#fvol').value=S.fvol;$('#shk').value=S.shk;$('#simp').checked=S.simp;$('#mute').checked=S.mute;$('#best').textContent=`Best ${S.best[S.mode]||0} in this mode. Total coins ${S.coins}.`}
const click=()=>{audioInit();tone(500,.05,'square',.08)};
$('#modes').onclick=e=>{const b=e.target.closest('button');if(b){S.mode=b.dataset.mode;click();save();syncUI()}};
$('#envs').onclick=e=>{const b=e.target.closest('button');if(b){click();buildEnv(b.dataset.env);reset();save();syncUI()}};
$('#cols').onclick=e=>{const b=e.target.closest('button');if(b){S.col=+b.dataset.col;DV.setBase(COLORS[S.col],HP.hp,S.simp);click();save();syncUI()}};
$('#q').onchange=e=>{S.q=+e.target.value;applyQ();save()};$('#vol').oninput=e=>{S.vol=+e.target.value;setVol();save()};$('#mute').onchange=e=>{S.mute=e.target.checked;setVol();save()};
$('#play').onclick=startGame;$('#pb').onclick=()=>setPause(true);$('#resume').onclick=()=>setPause(false);$('#rst1').onclick=$('#rst2').onclick=startGame;$('#mn1').onclick=$('#mn2').onclick=toMenu;
$('#evol').oninput=e=>{S.evol=+e.target.value;AU.setVolumes();save()};$('#fvol').oninput=e=>{S.fvol=+e.target.value;AU.setVolumes();save()};$('#shk').oninput=e=>{S.shk=+e.target.value;save()};
$('#simp').onchange=e=>{S.simp=e.target.checked;DV.update(HP.hp,S.simp);save()};$('#nx').onclick=nextLevel;$('#rp').onclick=$('#rp2').onclick=repair;
addEventListener('resize',resize);
buildEnv(S.env);applyQ();reset();syncUI();requestAnimationFrame(t=>{last=t;frame(t)});
