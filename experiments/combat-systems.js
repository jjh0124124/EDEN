// Injected only by the separate combat laboratory; never loaded by the main game.
const concept = ['pressure','thermal','clamp'].includes(globalThis.EDEN_LAB_CONCEPT) ? globalThis.EDEN_LAB_CONCEPT : 'pressure';
const labLabels = {pressure:['VAULT','PISTON','BRAKE','OVERDRIVE'],thermal:['BURST','—','EXHAUST','SUPER'],clamp:['VAULT','SALVAGE','CLAMP','SUPER']}[concept];
const labHints = {
  pressure:'Shift 이동 → E 제동 축압 / Q: 1칸 도약 / W: 전량 타격 / J 견제 / K 패링 축압',
  thermal:'J/Q 공격으로 발열 / E 반동 배기로 냉각 / 열 82 이상 공격 제한 / Shift 이동 / W 제거',
  clamp:'J 적중 + 보스 빈틈 → E 포획 / J 압착 / Q 넘어가기 / W 게이지 회수 / Shift 이동'
};
function labReady(i){
 const p=player,l=p.lab;if(i===3)return p.superMeter>=100;
 if(concept==='pressure')return i===2?p.onGround&&l.travel>=35&&Math.abs(p.vx)>=70&&l.pressure<2:p.onGround&&l.pressure>0;
 if(concept==='thermal')return i===0?l.heat<=65:i===2&&l.heat>0&&l.ventLock<=0&&p.sp>=10;
 return i===2?l.grip>0&&l.pinLock<=0&&p.onGround&&boss?.recovery>0&&boss.release<=0&&boss.windup<=0&&!boss.protocol:l.pin>0;
}
const originalReset=Fighter.prototype.reset, originalUpdate=Fighter.prototype.update, originalDamage=Fighter.prototype.damage, originalParry=Fighter.prototype.tryParry;
const originalSkill=Fighter.prototype.duelSkill;
Fighter.prototype.reset=function(){originalReset.call(this);this.lab={pressure:0,travel:0,bankLife:0,heat:0,ventLock:0,pin:0,pinLock:0,grip:0,gripTarget:null,spent:0,brakes:0,vents:0,catches:0,branches:{},denied:0};};
function labCancel(p){slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);hazards=hazards.filter(h=>h.owner!=='p'||h.delay<=0);p.attack=0;p.stepRemaining=0;p.linkWindow=0;p.finishWindow=0;p.buffer=null;p.charging=false;p.parryWindow=0;p.lab.cross=null;}
function labPose(p,mode,duration){labCancel(p);p.attackSerial++;p.weaponMode=mode;p.attack=p.attackDuration=duration;p.attackKind=1;}
function labContact(p,kind,damage,delay=.08,reach=40,extra={}){
 slashes.push({owner:'p',kind,followStartup:true,origin:10,x:p.face>0?p.x+10:p.x-reach,y:p.y-5,w:reach,h:48,delay,life:.10,dmg:damage,dir:p.face,...extra});
}
function labBranch(p,name){p.lab.branches[name]=(p.lab.branches[name]||0)+1;}
function labMove(p,direction,vent=false){
 labPose(p,'drive',.22);p.face=direction;p.dash=.20;p.dashDir=direction;p.vx=direction*300;p.inv=.16;p.driveLock=.38;p.sp-=10;
 if(vent){p.lab.heat=Math.max(0,p.lab.heat-40);p.lab.ventLock=.8;p.lab.vents++;}
 spriteEffect('boost',p.x+9,p.y+38,direction,.2,.7,true);labBranch(p,vent?'vent':'move');
}
function labRelease(p){
 if(p.lab.gripTarget){p.lab.gripTarget.superLock=0;p.lab.gripTarget=null;}
 p.lab.pin=0;p.attack=0;
}
Fighter.prototype.update=function(dt){
 const l=this.lab,x=this.x; l.ventLock=Math.max(0,l.ventLock-dt);l.pinLock=Math.max(0,l.pinLock-dt);l.grip=Math.max(0,l.grip-dt);
 l.bankLife=Math.max(0,l.bankLife-dt);if(!l.bankLife)l.pressure=0;
 l.heat=Math.max(0,l.heat-dt*5);
 if(l.pin>0){l.pin=Math.max(0,l.pin-dt);if(!l.pin||this.hp<=0||l.gripTarget?.dead){labRelease(this);}else{this.vx=0;this.stepRemaining=0;}}
 originalUpdate.call(this,dt);
 if(concept==='pressure'&&this.hp>0&&this.stun<=0&&this.onGround){l.travel=Math.min(80,l.travel+Math.abs(this.x-x));if(Math.abs(this.vx)<35&&this.dash<=0)l.travel=Math.max(0,l.travel-dt*60);}
 if(concept==='clamp'&&l.pin>0)this.vx=0;
 if(l.cross&&this.hp>0&&this.stun<=0){const c=l.cross;c.age+=dt;if(c.age>=.3){const step=Math.min(c.remaining,300*dt);this.x=clamp(this.x+c.dir*step,8,W-this.w-8);c.remaining-=step;}if(c.remaining<=0||this.onGround)l.cross=null;}
};
Fighter.prototype.damage=function(n,dir){const hp=this.hp;originalDamage.call(this,n,dir);if(this.hp<hp){if(this.lab.pin)labRelease(this);this.lab.travel=0;this.lab.grip=0;this.lab.cross=null;}};
Fighter.prototype.tryParry=function(s){const success=originalParry.call(this,s);if(success&&concept==='pressure'){this.lab.pressure=Math.min(2,this.lab.pressure+1);this.lab.bankLife=4;}return success;};
Fighter.prototype.strike=function(){
 if(!this.duelMode)return;
 if(concept==='clamp'&&this.lab.pin>0){labRelease(this);labPose(this,'heavy',.30);labContact(this,'cleave',30,.10,46);labBranch(this,'crush');return;}
 if(concept==='thermal'&&this.lab.heat>=82){this.lab.denied++;return;}
 labPose(this,'kick',.22);this.combo=1;this.comboT=.8;labContact(this,'kick',12);labBranch(this,'jab');
 if(concept==='thermal')this.lab.heat=Math.min(100,this.lab.heat+18);
};
Fighter.prototype.duelInput=function(move){
 const l=this.lab;
 if(pressed.has('shift')&&this.driveLock<=0&&this.sp>=10){if(l.pin)labRelease(this);const direction=this.shiftIntent||move||this.face;this.shiftIntent=null;labMove(this,direction);return;}
 const key=this.buffer?.key;if(!key)return;
 // Brake catches actual ground travel, including a running dash; no stationary charge.
 if(concept==='pressure'&&key==='e'&&this.onGround&&this.attack<=.22&&this.ultimateT<=0){
  this.buffer=null;if(l.travel<35||Math.abs(this.vx)<70||l.pressure>=2){l.denied++;return;}
  const gain=Math.min(2-l.pressure,Math.floor(l.travel/35));labPose(this,'hook',.14);this.dash=0;this.vx=0;l.travel=0;l.pressure+=gain;l.bankLife=4;l.brakes++;labBranch(this,'brake');return;
 }
 const pinned=concept==='clamp'&&l.pin>0;
 if(!pinned&&(this.dash>0||this.charging||this.attack>0&&!(key!=='j'&&this.linkWindow>0)))return;
 this.buffer=null;
 if(key==='k'&&!pinned&&this.parryLock<=0&&this.onGround){this.charging=true;this.parryTimer=.3;this.parryWindow=.14;this.parryLock=.55;this.vx=0;return;}
 if(key==='j'){this.strike();return;}
 this.duelSkill(['q','w','e','r'].indexOf(key));
};
Fighter.prototype.duelSkill=function(i){
 if(i<0||i>3||this.ultimateT>0||this.stun>0||this.hp<=0)return;
 const l=this.lab;
 if(i===3){if(l.pin)labRelease(this);originalSkill.call(this,3);return;}
 if(concept==='pressure'){
  if(i===2)return;
  if(l.pressure<1||!this.onGround){l.denied++;return;}
  const units=i===0?1:l.pressure;l.pressure-=units;l.spent+=units;labPose(this,i===0?'riser':'heavy',i===0?.34:.38);
  if(i===0){this.vy=-235;this.onGround=false;this.stepRemaining=52;this.stepDir=this.face;this.stepSpeed=240;labContact(this,'riser',18,.10,38,{offsetY:-18});labBranch(this,'vault');}
  else{this.vx=0;labContact(this,'cleave',units===2?36:22,.13,46,{interrupt:units===2});labBranch(this,units===2?'fullPiston':'piston');}
  spriteEffect('boost',this.x+9,this.y+38,this.face,.2,.7,true);
 }else if(concept==='thermal'){
  if(i===1)return; // Duplicate ranged attack intentionally removed in this candidate.
  if(i===2){if(l.heat<=0||l.ventLock>0||this.sp<10){l.denied++;return;}labMove(this,-this.face,true);return;}
  if(l.heat>65){l.denied++;return;}
  l.heat=Math.min(100,l.heat+35);labPose(this,'drive',.32);this.stepRemaining=48;this.stepDir=this.face;this.stepSpeed=230;labContact(this,'cleave',26,.12,42);labBranch(this,'burst');
 }else{
  if(i===2){
   const target=boss;
   if(!this.onGround||l.grip<=0||l.pinLock>0||!target||target.dead||target.tele>0||target.windup>0||target.release>0||target.protocol||!(target.recovery>0)||Math.abs(target.x+21-this.x-9)>64){l.denied++;return;}
   labPose(this,'hook',.55);this.vx=0;l.pin=.55;l.pinLock=4;l.grip=0;l.gripTarget=target;target.superLock=.55;target.recovery=Math.max(.8,target.recovery);l.catches++;labBranch(this,'clamp');return;
  }
  if(l.pin<=0){l.denied++;return;}
  const target=l.gripTarget;labRelease(this);
  if(i===0){labPose(this,'riser',.32);this.face=target.x+21>=this.x+9?1:-1;this.vy=-330;this.onGround=false;this.lab.cross={remaining:100,age:0,dir:this.face};labBranch(this,'cross');}
  else{labPose(this,'hook',.22);this.superMeter=Math.min(100,this.superMeter+18);labBranch(this,'salvage');}
 }
};
const originalConfirm=confirmHit;
confirmHit=function(s,target){originalConfirm(s,target);if(concept==='clamp'&&s.kind==='kick'&&target===boss&&!target.dead)player.lab.grip=.35;};
const normalHints=controlHints;
controlHints=function(){normalHints();const node=document.querySelector('#lab-stats');if(node){const l=player.lab;node.textContent=labHints[concept]+' | '+(concept==='pressure'?`축압 ${l.pressure}/2 (${l.bankLife.toFixed(1)}초)`:concept==='thermal'?`열 ${Math.round(l.heat)}/100`:`포획 ${l.pin>0?'고정':'해제'} · 재포획 ${l.pinLock.toFixed(1)}초`);}for(const [key,label] of Object.entries({shift:'이동 Shift',j:'견제 / 분기 J',q:labLabels[0]+' Q',w:labLabels[1]+' W',e:labLabels[2]+' E'})){const button=document.querySelector('[data-key="'+key+'"]');if(button)button.textContent=label;}};
function labRestart(){releaseInputs();dialogue=null;bossIndex=0;upgrade=0;augments=[0,0,0];startBoss(0);state='combat';player.face=1;}
window.edenLab={concept,restart:labRestart,snapshot(){return {concept,state,hp:player.hp,bossHp:boss?.hp,phase:boss?.phase,x:player.x,y:player.y,face:player.face,attack:player.attack,mode:player.weaponMode,lab:{...player.lab,gripTarget:!!player.lab.gripTarget}};}};
// This lab never advances into HOUND or writes the regular game's save key.
const normalUpdate=update;
update=function(dt){if(state==='reward'){if(pressed.has('enter'))labRestart();return;}normalUpdate(dt);};
labRestart();
