/* ZERO's first-operation psychic combat. The underlying fighter and boss stay shared. */
window.EdenPsychic={install(api){
 const {Fighter,Boss,fx,sound}=api;
 const cooldowns=[3,9,12], costs=[12,20,18];
 const old={strike:Fighter.prototype.strike,input:Fighter.prototype.duelInput,skill:Fighter.prototype.duelSkill,update:Boss.prototype.update,recover:Fighter.prototype.recoverDrive};
 const cancel=p=>{api.cancel();p.attack=0;p.stepRemaining=0;p.linkWindow=0;p.finishWindow=0;p.buffer=null;p.charging=false;p.parryWindow=0;};
 function pose(p,mode,duration){cancel(p);p.attackSerial++;p.weaponMode=mode;p.attack=p.attackDuration=duration;p.attackKind=1;}
 function contact(p,kind,dmg,delay,w,h=48,extra={}){api.slash({owner:'p',kind,followStartup:true,origin:12,x:p.face>0?p.x+12:p.x-w,y:p.y-5,w,h,delay,life:.10,dmg,dir:p.face,...extra});}
 function gathering(p,kind,duration,scale){const e=fx(kind,p.x+9,p.y+22,p.face,duration,scale);e.trackPlayer=true;e.castId=p.attackSerial;e.cancelWithAttack=true;}
 function shard(p,delay,dmg,large=false,superShot=false,shardIndex=0){
  api.projectile({kind:'psiShard',owner:'p',dir:p.face,x:p.x+9+p.face*20,y:p.y+18,vx:p.face*(superShot?580:320),vy:0,r:large?8:6,delay,life:superShot?.42:.78,dmg,large,superShot,shardIndex,followWeapon:true,followOffsetY:18,castId:p.attackSerial});
 }
 Fighter.prototype.recoverDrive=function(){if(!this.duelMode)return old.recover.call(this);};
 Fighter.prototype.strike=function(heavy,charge){if(!this.duelMode)return old.strike.call(this,heavy,charge);const hand=this.comboT>0?1-(this.psiHand||0):0;pose(this,'psiJab',.24);this.psiHand=hand;this.attackKind=hand+1;this.comboT=.75;this.combo=0;contact(this,'psiJab',12,.065,35);sound.tone(170,.04,'triangle',.015,85);};
 Fighter.prototype.duelInput=function(move){
  if(!this.duelMode)return old.input.call(this,move);
  if(this.ultimateT>0)return;
  const freeStep=this.parryFollow>0,stepCost=freeStep?0:10;
  if(api.pressed.has('shift')&&this.driveLock<=0&&this.sp>=stepCost){const dir=this.shiftIntent||move||this.face;this.shiftIntent=null;pose(this,'psiMove',.18);this.parryFollow=0;this.dashDir=dir;this.face=dir;this.dash=.18;this.inv=.15;this.driveLock=.38;this.sp-=stepCost;this.vx=dir*300;fx('boost',this.x+9,this.y+30,-dir,.16,.45);if(freeStep)api.message('PARRY STEP / SP 무소모 이동',.65);return;}
  const key=this.buffer?.key;if(!key||this.dash>0||this.charging||this.attack>0&&!(key!=='j'&&this.linkWindow>0))return;
  if(key==='k'){
   if(this.parryFollow>0){this.face=this.parryFacing||this.face;pose(this,'psiCounter',.46);this.parryFollow=0;this.parryFlash=0;contact(this,'psiCounter',44,.12,115,60,{offsetY:-12});gathering(this,'psiGather',.13,.55);sound.tone(95,.08,'triangle',.03,170);}
   else if(this.parryLock<=0&&this.onGround){cancel(this);this.charging=true;this.parryTimer=.3;this.parryWindow=.14;this.parryLock=.55;this.vx=0;}
   else this.buffer=null;
   return;
  }
  if(key==='j'){this.strike(false);return;}
  this.duelSkill(['q','w','e','r'].indexOf(key));
 };
 Fighter.prototype.duelSkill=function(i){
  if(!this.duelMode)return old.skill.call(this,i);
  if(i<0||i>3||this.ultimateT>0||this.stun>0||this.hp<=0)return;
  if(i===3){
   if(this.superMeter<100||api.boss?.operation){this.buffer=null;api.message(api.boss?.operation?'수술 장치 해제 후 R 사용':'R / 게이지 100% 필요',.9);return;}
   this.superMeter=0;const first=!this.superCinematicPlayed,duration=first?5:2;this.superCinematicPlayed=true;
   pose(this,'psiSuper',duration);this.ultimateT=this.ultimateDuration=duration;this.vx=0;
   gathering(this,'psiGather',first?1.65:.35,1.15);
   const barrage=[5,5,5,5,5,5,5,4,4,4];
   barrage.forEach((damage,j)=>shard(this,first?2.1+j*.12:.12+j*.065,damage,j===9,true,j));
   contact(this,'psiFinalWave',109,first?4.2:1.2,230,72,{offsetY:-12});
   api.message('초염동 폭쇄 / Shift로 중단 및 회피',1.2);sound.tone(55,.2,'triangle',.04,175);return;
  }
  const cost=costs[i];if(this.sp<cost||this.cool[i]>0){this.buffer=null;api.message(this.cool[i]>0?'기술 재사용 대기 중':'SP 부족 / 잠시 기다리기',.65);return;}
  this.sp-=cost;this.cool[i]=cooldowns[i];pose(this,['psiShock','psiBarrage','psiBlast'][i],[.20,1,.30][i]);
  if(i===0){gathering(this,'psiGather',.08,.35);contact(this,'psiShock',24,.055,76,42,{offsetY:0});}
  if(i===1){gathering(this,'psiGather',.36,.7);[10,10,10,10,18].forEach((d,j)=>shard(this,[.14,.30,.46,.62,.80][j],d,j===4,false,j));}
  if(i===2){const radius=64;api.slash({owner:'p',kind:'psiBlast',x:this.x+9-radius,y:this.y+24-radius,w:radius*2,h:radius*2,radius,followCenter:true,delay:.04,life:.10,dmg:32,dir:this.face});}
 };
 function release(s){
  const p=api.player,x=p.x+9+s.dir*15,y=p.y+21;
  if(s.kind==='psiShock'){fx('psiWave',x,y,s.dir,.25,.9);sound.tone(235,.07,'triangle',.035,90);}
  if(s.kind==='psiCounter'){fx('psiCounterFx',p.x+9+s.dir*60,y,s.dir,.36,1);sound.tone(90,.13,'triangle',.04,35);}
  if(s.kind==='psiBlast'){fx('psiPulse',p.x+9,p.y+24,1,.36,1);api.stop(.025,.9);sound.noise(.07,.03);sound.tone(80,.10,'triangle',.035,30);}
  if(s.kind==='psiFinalWave'){fx('psiBeam',x,y,s.dir,.55,1);sound.noise(.12,.045);sound.tone(55,.22,'triangle',.05,22);}
 }
 function projectileRelease(h){fx('psiWave',h.x,h.y,h.dir,.15,h.large?.55:.3);sound.tone(h.large?95:230,.045,'triangle',.018,h.large?45:130);}
 Boss.prototype.update=function(dt){
  if(this.d.type!=='surgeon'||this.phase===2)return old.update.call(this,dt);
  this.psiStagger=Math.max(0,(this.psiStagger||0)-dt);this.psiGuardLock=Math.max(0,(this.psiGuardLock||0)-dt);this.rearCounterLock=Math.max(0,(this.rearCounterLock||0)-dt);
  if(this.dead||this.tele>0||this.superLock>0||api.player.hp<=0){this.psiGuard=0;this.psiGuardWarn=0;this.psiGuardPending=false;old.update.call(this,dt);return;}
  if(this.psiGuard>0||this.psiGuardWarn>0){this.anim+=dt;this.inv=Math.max(0,this.inv-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);if(this.psiGuardWarn>0){this.psiGuardWarn=Math.max(0,this.psiGuardWarn-dt);if(!this.psiGuardWarn)this.psiGuard=.65;}else{this.psiGuard=Math.max(0,this.psiGuard-dt);if(!this.psiGuard){const p=api.player;if(Math.abs(p.x+p.w/2-this.x-this.w/2)<100){this.target={x:p.x+9,y:p.y+23};this.dir=this.target.x<this.x+this.w/2?-1:1;this.move=0;this.counterCast=false;this.windup=this.windupMax=.75;this.recovery=0;this.t=0;api.message('COUNTER INCISION / 방어 후 절개 — 점프 또는 K',1);sound.tone(310,.09,'triangle',.03,150);}else{this.recovery=.32;this.t=.65;}}}return;}
  old.update.call(this,dt);
  if(this.psiGuardPending&&this.windup<=0&&this.release<=0&&!(this.recovery>0)&&!this.protocol&&!this.followup&&!this.retreat&&this.tele<=0){this.psiGuardPending=false;this.psiGuardWarn=.28;this.psiGuardLock=3.5;this.dir=api.player.x+9<this.x+21?-1:1;api.message('SURGEON / 방어 준비 — 뒤로 이동하거나 공격을 피하세요',1);}
 };
 function hit(s,target){
  const p=api.player,isBoss=target.d?.type==='surgeon';
  if(target.dead||target.hp<=0||p.hp<=0||target.inv>0||isBoss&&target.operation)return false;
  const dir=s.kind==='psiBlast'?(Math.sign(target.x+target.w/2-p.x-9)||p.face):s.dir;
  if(isBoss&&target.psiGuard>0&&dir===-target.dir){api.stop(.025,.45);target.hitFlash=.035;fx('hit',dir>0?target.x:target.x+target.w,p.y+24,dir,.12,.45);sound.tone(520,.04,'triangle',.025,270);api.message('정면 방어 / 뒤로 이동하거나 공격을 피하세요',.8);return false;}
  api.damage(target,s.dmg,false);
  if(s.kind==='psiShock'){fx('psiBind',target.x+target.w/2,target.y+target.h*.5,dir,.20,.6);}
  if(s.kind==='psiFinalWave'){api.stop(.065,1.4);api.invert(.045);sound.noise(.10,.04);}
  if(target.dead||target.hp<=0)return true;
  if(isBoss&&target.phase===1&&dir===target.dir&&(target.windup>0||target.release>0)&&target.rearCounterLock<=0){target.rearChecks=(target.rearChecks||0)+1;if(target.rearChecks>=2){target.rearChecks=0;target.rearCounterPending=true;}}
  if(['psiJab','psiShock','psiCounter'].includes(s.kind))p.linkWindow=.24;
  if(isBoss&&target.phase===1&&s.kind==='psiJab'&&!(target.recovery>0)&&target.psiGuardLock<=0){target.psiChecks=(target.psiChecks||0)+1;if(target.psiChecks>=2){target.psiChecks=0;target.psiGuardPending=true;}}
  return true;
 }
 return {hit,release,projectileRelease,cooldowns,ready:i=>i===3?api.player.superMeter>=100&&!api.boss?.operation:api.player.cool[i]<=0&&api.player.sp>=costs[i],labels:['SHOCK','SHARDS','BURST','ZERO POINT']};
}};
