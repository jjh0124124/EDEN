/* First-operation combat variant. The classic engine remains available to later bosses and the lab. */
window.EdenPsychic={install(api){
 const {Fighter,Boss,fx,sound}=api;
 const old={strike:Fighter.prototype.strike,input:Fighter.prototype.duelInput,skill:Fighter.prototype.duelSkill,update:Boss.prototype.update,recover:Fighter.prototype.recoverDrive};
 const cancel=p=>{api.cancel();p.attack=0;p.stepRemaining=0;p.linkWindow=0;p.finishWindow=0;p.buffer=null;p.charging=false;p.parryWindow=0;};
 function pose(p,mode,duration){cancel(p);p.attackSerial++;p.weaponMode=mode;p.attack=p.attackDuration=duration;p.attackKind=1;}
 function contact(p,kind,dmg,delay,w,h=48){api.slash({owner:'p',kind,followStartup:true,origin:12,x:p.face>0?p.x+12:p.x-w,y:p.y-5,w,h,delay,life:.10,dmg,dir:p.face});}
 Fighter.prototype.recoverDrive=function(){if(!this.duelMode)return old.recover.call(this);};
 Fighter.prototype.strike=function(heavy,charge){if(!this.duelMode)return old.strike.call(this,heavy,charge);pose(this,'psiJab',.24);this.combo=0;contact(this,'psiJab',12,.065,35);sound.tone(170,.04,'triangle',.015,85);};
 Fighter.prototype.duelInput=function(move){
  if(!this.duelMode)return old.input.call(this,move);
  if(this.ultimateT>0)return;
  if(pressedShift()&&this.driveLock<=0&&this.sp>=10){const dir=this.shiftIntent||move||this.face;this.shiftIntent=null;pose(this,'psiMove',.18);this.dashDir=dir;this.face=dir;this.dash=.18;this.inv=.15;this.driveLock=.38;this.sp-=10;this.vx=dir*300;fx('boost',this.x+9,this.y+30,-dir,.16,.45);return;}
  const key=this.buffer?.key;if(!key||this.dash>0||this.charging||this.attack>0&&!(key!=='j'&&this.linkWindow>0))return;
  if(key==='k'){if(this.parryLock<=0&&this.onGround){cancel(this);this.charging=true;this.parryTimer=.3;this.parryWindow=.14;this.parryLock=.55;this.vx=0;}return;}
  if(key==='j'){this.strike(false);return;}
  this.duelSkill(['q','w','e','r'].indexOf(key));
 };
 function pressedShift(){return api.pressed.has('shift');}
 Fighter.prototype.duelSkill=function(i){
  if(!this.duelMode)return old.skill.call(this,i);
  if(i<0||i>3||this.ultimateT>0||this.stun>0||this.hp<=0)return;
  if(i===3){old.skill.call(this,3);return;}
  if(i===2&&!this.onGround){this.buffer=null;return;}
  pose(this,['psiRise','psiPalm','psiGrab'][i],[.38,.50,.46][i]);
  if(i===0){if(this.onGround){this.vy=-195;this.onGround=false;}else this.vy=Math.max(35,this.vy);contact(this,'psiRise',23,.10,34,68);}
  if(i===1)contact(this,'psiPalm',32,.20,51);
  if(i===2)contact(this,'psiGrab',18,.18,30);
 };
 Boss.prototype.update=function(dt){
  if(this.d.type!=='surgeon')return old.update.call(this,dt);
  this.psiGrabLock=Math.max(0,(this.psiGrabLock||0)-dt);this.psiGuardLock=Math.max(0,(this.psiGuardLock||0)-dt);this.psiLaunchLock=Math.max(0,(this.psiLaunchLock||0)-dt);
  if(this.dead||this.tele>0||this.superLock>0||api.player.hp<=0){this.psiGuard=0;this.psiGuardWarn=0;this.psiGuardPending=false;if(this.dead||this.tele>0){this.psiLift=0;this.y=226-this.h;}old.update.call(this,dt);return;}
  if(this.psiGuard>0||this.psiGuardWarn>0){this.anim+=dt;this.inv=Math.max(0,this.inv-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);if(this.psiGuardWarn>0){this.psiGuardWarn=Math.max(0,this.psiGuardWarn-dt);if(!this.psiGuardWarn)this.psiGuard=.65;}else{this.psiGuard=Math.max(0,this.psiGuard-dt);if(!this.psiGuard){this.recovery=.32;this.t=.65;}}return;}
  old.update.call(this,dt);
  if(this.psiLift>0){this.psiLift=Math.max(0,this.psiLift-dt);this.y=226-this.h-Math.sin(Math.PI*this.psiLift/.4)*30;}
  if(this.psiGuardPending&&this.windup<=0&&this.release<=0&&!(this.recovery>0)&&!this.protocol&&!this.retreat&&this.tele<=0){this.psiGuardPending=false;this.psiGuardWarn=.28;this.psiGuardLock=3.5;this.dir=api.player.x+9<this.x+21?-1:1;api.message('SURGEON / 방어 준비 — 접근 E 잡기 또는 뒤로 이동',1);}
 };
 function hit(s,target){
  const p=api.player,isBoss=target.d?.type==='surgeon';
  if(target.dead||target.hp<=0||p.hp<=0||target.inv>0)return false;
  if(isBoss&&s.kind==='psiGrab'){
   if(target.psiGrabLock>0||target.windup>0||target.release>0||target.tele>0||target.protocol||target.superLock>0){sound.tone(95,.05,'triangle',.018);return false;}
   target.psiGuard=target.psiGuardWarn=0;target.psiGuardPending=false;target.psiGrabLock=3.5;target.recovery=.65;target.t=.9;target.approach=null;target.retreat=null;
  }else if(isBoss&&target.psiGuard>0&&s.dir===-target.dir){
   api.stop(.025,.45);target.hitFlash=.035;p.stepRemaining=7;p.stepDir=-s.dir;p.stepSpeed=120;fx('hit',s.dir>0?target.x:target.x+target.w,p.y+24,s.dir,.12,.45);sound.tone(520,.04,'triangle',.025,270);return false;
  }
  if(s.superStarter)p.confirmSuper(target);
  api.damage(target,s.dmg,s.interrupt);
  if(target.dead||target.hp<=0)return true;
  if(['psiJab','psiRise','psiGrab'].includes(s.kind)){p.linkWindow=.24;if(s.kind==='psiRise')p.finishWindow=.28;}
  if(isBoss&&s.kind==='psiJab'&&!(target.recovery>0)&&target.psiGuardLock<=0){target.psiChecks=(target.psiChecks||0)+1;if(target.psiChecks>=2){target.psiChecks=0;target.psiGuardPending=true;}}
  if(isBoss&&s.kind==='psiRise'&&target.recovery>0&&target.psiLaunchLock<=0){target.psiLift=.4;target.psiLaunchLock=3;target.recovery=Math.max(.6,target.recovery);target.t=Math.max(.9,target.t);}
  if(s.kind==='psiPalm'){api.stop(.065,1.4);target.recoil=s.dir*5;}
  if(s.kind==='psiGrab'){fx('superburst',target.x+target.w/2,p.y+24,s.dir,.16,.45);api.stop(.05,.8);}
  return true;
 }
 return {hit,ready:i=>i===3?api.player.superMeter>=100:i!==2||api.player.onGround,labels:['RISE','SHATTER','CLINCH','ZERO POINT']};
}};
