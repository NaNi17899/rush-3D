const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class Health {
  constructor(){this.max=100;this.reset()}
  reset(){this.hp=this.max}
  hit(amount){this.hp=clamp(this.hp- Math.max(0,amount),0,this.max)}
  repair(){this.hp=this.max}
  get pct(){return Math.round(this.hp)}
  get band(){return this.hp<=0?4:this.hp<=10?3:this.hp<=35?2:this.hp<=70?1:0}
  get repairCost(){return Math.max(1,Math.ceil((this.max-this.hp)*.35))}
}

export class CollisionDamage {
  constructor(){this.now=0;this.last=new Map()}
  reset(){this.last.clear()}
  touch(id){
    const previous=this.last.get(id)||-Infinity;
    if(this.now-previous<.45)return false;
    this.last.set(id,this.now);
    return true;
  }
  calc(type,kmh,options={}){
    const base={barrier:1.15,traffic:1,hazard:1.25}[type]||1;
    const relative=clamp(kmh/55,0,2.2);
    const angle=options.angle||1;
    const mult=options.mult||1;
    const healthFactor=options.hp===undefined?1:.7+options.hp/100*.3;
    return clamp((4+relative*18)*base*angle*mult*healthFactor,1,45);
  }
}

export class Performance {
  constructor(){this.vmax=1;this.acc=1;this.hnd=1;this.snap(100)}
  snap(hp){this.hp=hp;this.update(hp,0)}
  update(hp,dt){
    this.hp=hp;
    const damage=1-hp/100;
    const targetV=1-damage*.28;
    const targetA=1-damage*.4;
    const targetH=1-damage*.32;
    const blend=dt?Math.min(1,dt*4):1;
    this.vmax+=(targetV-this.vmax)*blend;
    this.acc+=(targetA-this.acc)*blend;
    this.hnd+=(targetH-this.hnd)*blend;
  }
}

export class Gearbox {
  constructor(){this.points=[60,125,170,210,250];this.reset()}
  reset(){this.gear=1;this.rpm=900;this.timer=0;this.ev=''}
  shiftUp(){
    if(this.gear>=6)return false;
    this.gear++;
    this.timer=.22;
    this.ev='up';
    return true;
  }
  shiftDown(){
    if(this.gear<=1)return false;
    this.gear--;
    this.timer=.18;
    this.ev='down';
    return true;
  }
  manual(){
    return this.shiftUp();
  }
  update(kmh,dt,throttle){
    this.ev='';
    this.timer=Math.max(0,this.timer-dt);
    const up=this.points[this.gear-1];
    const down=this.gear>1?this.points[this.gear-2]*.72:0;
    if(throttle&&kmh>up&&this.gear<6)this.shiftUp();
    else if(this.gear>1&&kmh<down)this.shiftDown();
    const range=this.gear===1?60:this.points[this.gear-2]||250;
    this.rpm=clamp(850+kmh/range*5750,850,6800);
  }
}

export class EngineAudio {
  constructor(settings){
    this.settings=settings;
    this.ctx=null;
    this.engine=[];
    this.engineGain=null;
    this.exhaustGain=null;
    this.exhaustFilter=null;
    this.exhaustSource=null;
    this.master=null;
    this.shiftCut=0;
  }
  init(){
    if(this.ctx){
      if(this.ctx.state==='suspended')this.ctx.resume();
      return;
    }
    this.ctx=new AudioContext();
    this.master=this.ctx.createGain();
    this.engineGain=this.ctx.createGain();
    this.exhaustGain=this.ctx.createGain();
    this.exhaustFilter=this.ctx.createBiquadFilter();
    this.master.connect(this.ctx.destination);
    this.engineGain.connect(this.master);
    this.exhaustFilter.connect(this.exhaustGain);
    this.exhaustGain.connect(this.master);
    this.master.gain.value=0;
    this.engineGain.gain.value=0;
    this.exhaustGain.gain.value=0;
    this.exhaustFilter.type='bandpass';
    this.exhaustFilter.frequency.value=900;
    this.exhaustFilter.Q.value=.7;
    for(const [type,ratio,gain] of [['sawtooth',1,.55],['triangle',2,.2],['square',.5,.08]]){
      const oscillator=this.ctx.createOscillator();
      const harmonicGain=this.ctx.createGain();
      oscillator.type=type;
      oscillator.frequency.value=55*ratio;
      harmonicGain.gain.value=gain;
      oscillator.connect(harmonicGain);
      harmonicGain.connect(this.engineGain);
      oscillator.start();
      this.engine.push({oscillator,harmonicGain,ratio});
    }
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*2,this.ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    this.exhaustSource=this.ctx.createBufferSource();
    this.exhaustSource.buffer=buffer;
    this.exhaustSource.loop=true;
    this.exhaustSource.connect(this.exhaustFilter);
    this.exhaustSource.start();
    this.setVolumes();
  }
  setVolumes(){
    if(!this.ctx)return;
    this.master.gain.setTargetAtTime(this.settings.mute?0:this.settings.vol,this.ctx.currentTime,.03);
  }
  tone(frequency,duration,type='sine',volume=.1,endFrequency=frequency){
    if(!this.ctx||this.settings.mute)return;
    const now=this.ctx.currentTime;
    const oscillator=this.ctx.createOscillator();
    const gain=this.ctx.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),now+duration);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(volume*this.settings.fvol,now+.008);
    gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain);gain.connect(this.master);
    oscillator.start(now);oscillator.stop(now+duration+.02);
  }
  shift(up,gear){
    if(!this.ctx||this.settings.mute)return;
    const now=this.ctx.currentTime;
    const cut=.055;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setTargetAtTime(0,now,.008);
    this.engineGain.gain.setTargetAtTime(.055*this.settings.evol,now+cut,.035);
    this.exhaustGain.gain.setTargetAtTime(.012*this.settings.evol,now,.03);
    this.tone(up?105:72,.16,'triangle',.2,up?62:118);
    this.tone(up?330:190,.08,'square',.12,up?470:120);
  }
  impact(type,severity){
    this.tone(type==='barrier'?90:130,.18,'sawtooth',.22,45);
  }
  update(values,dt){
    if(!this.ctx||!this.engine.length)return;
    const now=this.ctx.currentTime;
    const rpmRatio=values.rpm/850;
    const fundamental=24+values.rpm*.018;
    for(const harmonic of this.engine){
      harmonic.oscillator.frequency.setTargetAtTime(fundamental*harmonic.ratio,now,.035);
    }
    const throttle=values.thr?1:0;
    const load=clamp(values.v/VMAX_AUDIO,0,1);
    const engineLevel=clamp((.025+throttle*.075+load*.035)*this.settings.evol,.002,.14);
    const exhaustLevel=clamp((throttle*.035+load*.025)*this.settings.evol,.001,.065);
    this.engineGain.gain.setTargetAtTime(engineLevel,now,.045);
    this.exhaustGain.gain.setTargetAtTime(exhaustLevel,now,.07);
    this.exhaustFilter.frequency.setTargetAtTime(550+rpmRatio*850+throttle*900,now,.08);
  }
  silence(){
    if(this.engineGain&&this.ctx)this.engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,.08);
    if(this.exhaustGain&&this.ctx)this.exhaustGain.gain.setTargetAtTime(0,this.ctx.currentTime,.08);
  }
}

const VMAX_AUDIO=82;

export class DamageVisuals {
  constructor(THREE,vehicle){this.THREE=THREE;this.vehicle=vehicle;this.base=0xffffff}
  setBase(color,hp,simple){this.base=color;this.update(hp,simple)}
  update(hp,simple){
    const damage=1-hp/100;
    this.vehicle.paint.color.set(this.base);
    this.vehicle.paint.roughness=.28+damage*.55;
    this.vehicle.paint.emissiveIntensity=simple?0:damage*.35;
    if(this.vehicle.tail)this.vehicle.tail.emissiveIntensity=.8+damage*2;
  }
}

export class VehicleHUD {
  constructor(select){this.$=select}
  update(health,gearbox){
    const bar=this.$('#hbar i');
    const hp=this.$('#hp');
    this.$('#hpv').textContent=`${health.pct}%`;
    bar.style.width=`${health.pct}%`;
    bar.dataset.b=health.band;
    hp.classList.toggle('crit',health.band>=3);
    this.$('#hst').textContent=health.band===0?'✓ Excellent':health.band===1?'⚠ Damaged':health.band===2?'⚠ Heavy damage':health.band===3?'⚠ Critical damage':'✕ Disabled';
    this.$('#gear').textContent=gearbox.gear;
    this.$('#rpm').textContent=Math.round(gearbox.rpm);
    this.$('#rbar i').style.width=`${clamp((gearbox.rpm-850)/5950*100,0,100)}%`;
  }
}
