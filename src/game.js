(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = 480, H = 270, FLOOR = 226;
  ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  const RED = '#e30b32', PALE = '#d9d6d2', DARK = '#080a0c';

  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const rnd = (a,b) => a+Math.random()*(b-a);
  const hit = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const slashHit=(s,b)=>{if(!s.radius)return hit(s,b);const x=s.x+s.radius,y=s.y+s.radius,dx=x-clamp(x,b.x,b.x+b.w),dy=y-clamp(y,b.y,b.y+b.h);return dx*dx+dy*dy<=s.radius*s.radius;};
  const keys = new Set(), pressed = new Set();
  const inputSources=new Map();
  function inputDown(source,k){if(k==='shift')player.shiftIntent=(keys.has('d')?1:0)-(keys.has('a')?1:0);inputSources.set(source,k);if(!keys.has(k))pressed.add(k);keys.add(k);}
  function inputUp(source){const k=inputSources.get(source);inputSources.delete(source);if(![...inputSources.values()].includes(k))keys.delete(k);}
  function inputKey(e){
    if(/^Key[A-Z]$/.test(e.code))return e.code.slice(3).toLowerCase();
    return ({Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ArrowLeft:'a',ArrowRight:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',Enter:'enter',NumpadEnter:'enter',Escape:'escape'})[e.code]||e.key.toLowerCase();
  }
  function releaseInputs(){inputSources.clear();keys.clear();pressed.clear();player.charging=false;player.charge=0;player.buffer=null;player.pendingJump=false;player.jumpBuffer=0;player.shiftIntent=null;document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
  addEventListener('blur',()=>{releaseInputs();if(state==='combat'||state==='explore')paused=true;});
  addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=inputKey(e);if(e.target?.closest?.('button,summary')&&[' ','enter'].includes(k))return;inputDown('key:'+(e.code||e.key),k);if([' ','a','d','arrowup','arrowdown','shift','enter'].includes(k))e.preventDefault();});
  addEventListener('keyup',e=>inputUp('key:'+(e.code||e.key)));
  const nextButton=document.querySelector('#advance');
  const controlStatus=document.querySelector('#control-status');
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;e.preventDefault();audio.wake();canvas.focus({preventScroll:true});button.setPointerCapture(e.pointerId);
      const k=button===nextButton&&paused?'escape':button.dataset.key;
      inputDown('pointer:'+e.pointerId,k);button.classList.add('held');
    });
    const release=e=>{if(e.type==='pointercancel'&&button.dataset.key==='k'){player.charging=false;player.charge=0;player.buffer=null;player.pendingJump=false;}inputUp('pointer:'+e.pointerId);button.classList.remove('held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',e=>{if(e.detail===0){audio.wake();pressed.add(button===nextButton&&paused?'escape':button.dataset.key);canvas.focus({preventScroll:true});}});
  });
  canvas.addEventListener('pointerdown',e=>{audio.wake();canvas.focus({preventScroll:true});if(paused)pressed.add('escape');else if(state==='title'){
    const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height,index=Math.floor((y-164)/23),count=load()?2:1;
    if(x>=310&&x<=455&&y>=164&&index>=0&&index<count)menu=index;
    pressed.add('enter');
  }else if(dialogue||['interlude','intro','gameover','ending'].includes(state))pressed.add('enter');});

  const BOSSES = [
    {id:'SURGEON', ko:'생명을 집도하는 자', zone:'폐쇄된 수술 성당', hp:1800, color:'#eee9e4', intro:'치유는 실패를 연장할 뿐.\n나는 너를 완성하겠다.', type:'surgeon'}
  ];

  const STORY = [
    ['FIRST DEPLOYMENT','특수전투개체 00, 기동.','성당 심부의 생명 반응을 제거하라.']
  ];

  let state='title', bossIndex=0, boss=null, paused=false, menu=0, time=0, shake=0, flash=0, invertFlash=0, deathTimer=0;
  let particles=[], hazards=[], slashes=[], messages=[], damageNumbers=[], echoes=[];
  let hitstop=0, dialogue=null, dialogueStep=0, checkpointStage='explore', room=null, upgrade=0, archiveCount=0, defeatCount=0;
  let recoveredRecords=new Set();
  let augments=[0,0,0], chain=0, chainTimer=0, bestChain=0, battleSeconds=0;
  const SKILLS=['LAHAT / 삼연 절단','RAIL / 척추 관통','PILE / 지각 파쇄','GUILLOTINE / 압착 단두각'];
  const COMMS = [
    [['CONTROL','00, 신경 접속 확인. 수술 성당의 집도의가 명령을 거부했다.'],['ZERO','제 신경 증폭기의 제조번호가 수술대에도 새겨져 있습니다.'],['CONTROL','관련 없는 정보다. 표적을 해체하라.']]
  ];

  const RECORDS = [
    '수술 기록 00: 육체는 거부 반응을 보였다. 신경 역장은 마취 중에도 수술 도구를 부쉈다.'
  ];

  const PHASE_LINES=['마취를 중단한다. 이제 깨어 있는 채로 완성되어라.'];
  const PATTERNS=[['절개 탄막','수직 봉합']];
  const TACTICS=['절개·관통은 점프 또는 K 패링. 낙하는 표식 확인.'];
  const saveKey='eden-save-v1';
  const save = () => {try{localStorage.setItem(saveKey, JSON.stringify({boss:bossIndex, stage:checkpointStage, upgrade, augments, archives:archiveCount, records:[...recoveredRecords], defeats:defeatCount, complete:state==='ending'}));}catch{message('저장 불가 — 브라우저 저장소를 확인하세요',3);} };
  const load = () => {try{const s=JSON.parse(localStorage.getItem(saveKey));if(!s||!Number.isInteger(s.boss)||s.boss<0)return null;if(s.boss!==0||s.stage==='reward')return {boss:0,stage:'explore',upgrade:0,augments:[0,0,0],archives:0,records:[],defeats:0,complete:false};return {...s,upgrade:0,augments:[0,0,0],records:(s.records||[]).filter(i=>i===0)};}catch{return null;} };
  const clearSave = () => {try{localStorage.removeItem(saveKey);}catch{}};

  const audio = new EdenPresentation.Soundtrack();
  addEventListener('keydown',()=>audio.wake());

  // Presentation only: recoil never changes world positions or hitboxes.
  function contactFeedback(target,power,damage){
    if(player.duelMode&&!target.d&&player.ultimateT<=0)player.superMeter=Math.min(100,player.superMeter+damage*.35);
    const tier=power>=50?2:power>=22?1:0,dir=target.x>=player.x?1:-1;
    hitstop=Math.max(hitstop,(player.duelMode?[.045,.05,.065]:[.022,.042,.065])[tier]);shake=Math.max(shake,[.65,1.2,1.8][tier]);
    target.recoil=dir*(player.duelMode?[3,3.5,4.5]:[1.5,2.5,3.5])[tier];target.contactFlash=.07;target.hitFlash=.07;
    const x=player.duelMode?clamp(player.x+9+player.face*28,target.x+4,target.x+target.w-4):target.x+target.w*.5,y=player.duelMode?clamp(player.y+(globalThis.EdenPsychic?12:25),target.y+8,target.y+target.h-8):target.y+target.h*.6;
    if(player.duelMode)spriteEffect('hit',x,y,dir,.18+tier*.025,.7+tier*.18);else{impact(x,y,power);burst(x,y,tier?'#ffd7a0':PALE,4+tier*2,45+tier*15);}
    damageNumbers.push({x:x+(chain%3-1)*7,y:target.y-4,life:.55,text:damage,strong:tier>0});damageNumbers=damageNumbers.slice(-8);
    audio.noise(.025+tier*.015,.025+tier*.006);audio.tone([145,85,58][tier],.055+tier*.025,'triangle',.035+tier*.008,[65,48,30][tier]);
  }
  function cameraKick(){if(shake)ctx.translate(Math.round(Math.sin(time*83)*shake),Math.round(Math.cos(time*71)*shake*.45));}
  function psychicLift(target){return target===player.superTarget&&player.superCompressed&&player.ultimateT>0?8*Math.sin(Math.PI*clamp(1-player.ultimateT/(player.ultimateDuration||1.55),0,1)):0;}
  function settleFeedback(dt){
    for(const target of [boss,...(room?.drones||[])])if(target){target.recoil=(target.recoil||0)*Math.exp(-dt*24);target.contactFlash=Math.max(0,(target.contactFlash||0)-dt);}
  }

  class Fighter {
    constructor(){ this.reset(); }
    reset(){ Object.assign(this,{duelMode:bossIndex===0,diveUsed:false,attackSerial:0,shiftIntent:null,superTarget:null,superMeter:0,superCompressed:false,superCinematicPlayed:false,ultimateT:0,parryFacing:0,parryTimer:0,driveLock:0,jumpBuffer:0,coyote:0,landing:0,stridePhase:0,reverseDrive:0,driveTime:0,stepSpeed:180,dashDir:1,x:65,y:FLOOR-48,w:19,h:48,vx:0,vy:0,face:1,hp:100,maxHp:100,sp:100,onGround:true,attack:0,attackKind:0,weaponMode:'kick',inv:0,dash:0,stun:0,combo:0,comboT:0,linkWindow:0,finishWindow:0,stepRemaining:0,stepDir:1,pendingJump:false,buffer:null,charging:false,charge:0,chargeLevel:0,parryWindow:0,parryLock:0,parryFollow:0,parryFlash:0,cool:[0,0,0,0]}); }
    recoverDrive(){
      if(!this.duelMode||this.hp<=0||!(state==='explore'||state==='combat'&&boss?.d.type==='surgeon'&&!boss.dead))return;
      this.reverseDrive=1;this.driveTime=6;
      audio.tone(660,.09,'triangle',.03,990);
    }
    tryParry(s){
      if(!this.duelMode||!(state==='combat'&&boss?.d.type==='surgeon'&&!boss.dead||state==='explore'&&s.projectile)||!s.parryable||s.kind!=='scalpel'||s.owner!=='b'||this.hp<=0||!this.charging||this.parryWindow<=0||!this.onGround||this.stun>0||this.dash>0||this.inv>0||this.face!==-s.dir||!s.projectile&&Math.sign(boss.x+boss.w/2-this.x-this.w/2)!==this.face)return false;
      this.parryWindow=0;this.charging=false;this.parryTimer=0;this.superMeter=Math.min(100,this.superMeter+14);this.parryFollow=psychic ? .65 : .3;this.parryFacing=this.face;this.parryFlash=.16;this.recoverDrive();
      if(boss){boss.release=0;boss.followup=null;boss.hitFlash=.12;boss.recoil=this.face*3;}
      if(s.pincer){hazards=hazards.filter(h=>!h.pincerField);boss.recovery=Math.max(boss.recovery||0,1.35);boss.t=Math.max(boss.t,1.9);boss.speech='내 도구가 역류하다니.';boss.speechT=1.8;audio.tone(110,.16,'triangle',.035,45);}
      if(s.protocolFinal){boss.recovery=Math.max(boss.recovery,2.1);boss.t=Math.max(boss.t,2.65);}
      // Normal parries keep recovery; the once-only protocol finisher offers a longer opening.
      hitstop=Math.max(hitstop,.045);shake=Math.max(shake,.65);
      spriteEffect('hit',this.x+9+this.face*12,this.y+32,this.face,.2,.9);
      audio.noise(.025,.025);audio.tone(880,.07,'triangle',.04,330);
      message(s.pincer?'PINCER BREAK / 봉쇄 해제 — 반격 기회':s.protocolFinal?'REVERSE SUTURE // 봉합 역류 — 반격':(psychic?'PARRY // K 반격 또는 Shift 무소모 이동':'PARRY // Shift 추진 반격 · J/Q 연계'),s.pincer||s.protocolFinal?1.2:.8);
      return true;
    }
    hurtbox(){return {x:this.x+4,y:this.y+8,w:11,h:this.h-12};}
    damage(n,dir){ if(this.inv>0||this.hp<=0||boss?.dead)return;this.charging=false;this.charge=0;this.buffer=null;this.pendingJump=false;this.jumpBuffer=0;this.coyote=0;if(this.duelMode){slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);hazards=hazards.filter(h=>h.owner!=='p'||!(h.delay>0));this.attack=0;this.combo=0;this.comboT=0;if(psychic){this.ultimateT=0;this.superTarget=null;this.parryFollow=0;}}this.linkWindow=0;this.finishWindow=0;this.stepRemaining=0;if(this.weaponMode==='crown'){slashes=slashes.filter(s=>s.kind!=='guillotine'||s.delay<=0);this.attack=0;}if(this.duelMode)this.superMeter=Math.min(100,this.superMeter+n*.6);this.hp-=Math.max(1,Math.round(n*(1-Math.min(.4,augments[2]*.08))));chain=0;chainTimer=0;this.vx=dir*95;this.vy=-90;this.onGround=false;this.inv=.55;this.stun=.18;shake=Math.max(shake,1.8);hitstop=Math.max(hitstop,.04);if(this.duelMode)spriteEffect('hit',this.x+9,this.y+24,dir,.2,.85);else burst(this.x+9,this.y+20,RED,6,70);audio.noise(.07,.04);audio.tone(52,.11,'sawtooth',.04,20); if(this.hp<=0){this.hp=0;deathTimer=1.4;defeatCount++;} }
    update(dt){
      for(const key of ['parryWindow','parryLock','parryFollow','parryFlash'])this[key]=Math.max(0,this[key]-dt);
      if(this.superTarget?.hp<=0){this.ultimateT=0;this.attack=0;this.superTarget=null;this.inv=Math.min(this.inv,.14);}this.ultimateT=Math.max(0,this.ultimateT-dt);this.driveLock=Math.max(0,this.driveLock-dt);if(this.duelMode&&this.charging){this.parryTimer=Math.max(0,this.parryTimer-dt);if(!this.parryTimer){this.charging=false;if(this.buffer?.counterIntent&&!this.parryFollow)this.buffer=null;}}
      this.driveTime=Math.max(0,this.driveTime-dt);if(!this.driveTime)this.reverseDrive=0;
      this.linkWindow=Math.max(0,this.linkWindow-dt);this.finishWindow=Math.max(0,this.finishWindow-dt);
      if(this.pendingJump){pressed.add(' ');this.pendingJump=false;}
      if(this.duelMode){this.landing=Math.max(0,this.landing-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.coyote=this.onGround?.08:Math.max(0,this.coyote-dt);if(pressed.has(' ')||pressed.has('space')||pressed.has('arrowup'))this.jumpBuffer=.10;}
      if(this.buffer){this.buffer.ttl-=dt;if(this.buffer.ttl<=0)this.buffer=null;}
      if(this.buffer?.key==='shift'){pressed.add('shift');this.buffer=null;}
      if(psychic&&this.duelMode&&this.ultimateT>0&&pressed.has('shift')&&this.driveLock<=0&&this.sp>=10){this.ultimateT=0;this.attack=0;this.superTarget=null;}
      if(this.stun>0){this.charging=false;this.charge=0;}
      this.inv=Math.max(0,this.inv-dt);this.attack=Math.max(0,this.attack-dt);this.stun=Math.max(0,this.stun-dt);this.comboT-=dt;if(this.comboT<0)this.combo=0;
      this.cool=this.cool.map(v=>Math.max(0,v-dt*(1+augments[1]*.15)));this.sp=Math.min(100,this.sp+(10+augments[1]*3)*dt);
      if(this.stun<=0&&this.hp>0&&(this.ultimateT<=0||psychic&&this.duelMode)){
        let move=(keys.has('d')?1:0)-(keys.has('a')?1:0);if(move&&!(this.duelMode&&pressed.has('shift'))&&this.dash<=0&&!(this.attack>0&&(this.weaponMode==='crown'||this.duelMode)))this.face=move;
        this.vx=this.dash>0?(this.duelMode?this.dashDir:this.face)*300:lerp(this.vx,move*(this.charging?(this.duelMode?0:70):this.duelMode&&this.attack>0&&this.onGround?72:this.duelMode?132:112),clamp(dt*14,0,1));
        if(this.duelMode?this.jumpBuffer>0&&(this.onGround||this.coyote>0):(pressed.has(' ')||pressed.has('space')||pressed.has('arrowup'))&&this.onGround){this.vy=-205;this.onGround=false;this.jumpBuffer=0;this.coyote=0;this.landing=0;audio.tone(110,.08,'square',.025,45);}
        if(this.duelMode)this.duelInput(move);else{
        if(pressed.has('shift')&&this.dash<=0&&this.sp>=12){if(this.duelMode){slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);hazards=hazards.filter(h=>h.owner!=='p'||!(h.delay>0));this.attack=0;this.combo=0;this.comboT=0;this.linkWindow=0;}this.charging=false;this.charge=0;this.buffer=null;this.stepRemaining=0;this.finishWindow=0;this.dash=.28;this.inv=.34;this.sp-=12;this.dashDir=this.duelMode?(move||this.face):this.face;this.vx=this.dashDir*300;if(this.duelMode)spriteEffect('boost',this.x+9,this.y+this.h-10,this.dashDir,.22,.7);else burst(this.x+10,this.y+35,'#bbc0c3',8,45);audio.tone(75,.1,'sawtooth',.03,30);}
        if(this.buffer?.key==='k'&&(this.attack<=0||this.duelMode&&this.linkWindow>0)&&this.dash<=0&&!this.charging){const compressed=this.duelMode&&this.attack>0&&this.linkWindow>0;if(compressed){this.attack=0;this.linkWindow=0;this.finishWindow=0;this.stepRemaining=0;slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);}if(!compressed&&this.buffer.parry&&this.onGround&&this.inv<=0&&this.parryLock<=0){this.parryWindow=.12;this.parryLock=.7;}this.buffer=null;this.charging=true;this.charge=compressed?.18:0;this.chargeLevel=0;audio.tone(90,.12,'triangle',.035,180);}
        if(this.charging&&this.parryFollow>0&&this.reverseDrive>0&&this.buffer?.key==='q'){this.charging=false;this.charge=0;this.parryWindow=0;}
        if(this.charging&&this.parryFollow>0&&(pressed.has('j')||this.buffer?.key==='j')){this.charging=false;this.charge=0;this.parryWindow=0;this.parryFollow=0;this.buffer=null;this.strike(false);}
        if(this.charging){
          if(keys.has('k')){this.charge=Math.min(1.2,this.charge+dt);const level=this.charge>=.65?2:this.charge>=.4?1:0;if(level>this.chargeLevel){this.chargeLevel=level;audio.tone(level===2?660:330,.13,'triangle',.045);burst(this.x+10,this.y+35,level===2?'#86f4ef':RED,9,35);}}
          else{const amount=this.charge;this.charging=false;this.charge=0;this.strike(true,amount);}
        }
        if(this.buffer&&(this.attack<=0||((this.buffer.key==='q'||this.duelMode&&this.buffer.key==='e')&&this.linkWindow>0)||(this.buffer.key==='r'&&this.finishWindow>0))&&!this.charging&&this.dash<=0){const key=this.buffer.key;this.buffer=null;if(key==='j')this.strike(false);else this.skill(['q','w','e','r'].indexOf(key));}
        }
      }
      if(this.dash>0)echoes.push({x:this.x,y:this.y,face:this.face,onGround:this.onGround,life:.18});
      this.dash=Math.max(0,this.dash-dt);this.vy+=470*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;
      if(this.y+this.h>=FLOOR){if(this.duelMode&&!this.onGround&&this.vy>80)this.landing=.10;this.y=FLOOR-this.h;this.vy=0;this.onGround=true;this.diveUsed=false;}
      if(this.stepRemaining>0&&this.stun<=0&&this.dash<=0){let step=Math.min(this.stepRemaining,(this.stepSpeed||180)*dt);
        if(this.duelMode&&['drive','heavy','riser'].includes(this.weaponMode)&&this.stepDir===this.face&&boss&&!boss.dead&&this.y+this.h>boss.y&&this.y<boss.y+boss.h){
          const gap=this.stepDir>0?boss.x-this.x-this.w-2:this.x-boss.x-boss.w-2;
          if((boss.x+boss.w/2-this.x-this.w/2)*this.stepDir>0)step=Math.min(step,Math.max(0,gap));
        }
        this.x+=step*this.stepDir;this.stepRemaining-=step;}
      this.x=clamp(this.x,8,W-this.w-8);if(this.duelMode&&this.onGround&&this.attack<=0&&this.dash<=0)this.stridePhase+=Math.abs(this.vx)*dt/9;
    }
    strike(heavy,charge=0){
      if(this.duelMode&&!heavy&&!this.onGround){
        if(this.diveUsed)return;
        this.diveUsed=true;this.attackSerial++;this.weaponMode='dive';this.attack=this.attackDuration=.34;this.combo=0;this.linkWindow=0;this.finishWindow=0;
        this.vy=230;this.stepRemaining=38;this.stepDir=this.face;this.stepSpeed=240;
        slashes.push({owner:'p',kind:'dive',castId:this.attackSerial,followStartup:true,attached:true,origin:10,offsetY:22,x:this.x+10,y:this.y+22,w:30,h:30,delay:.07,life:.22,dmg:24,dir:this.face});
        spriteEffect('boost',this.x+9,this.y+34,this.face,.2,.65,true);return;
      }
      this.attackSerial++;this.stepSpeed=180;this.parryFlash=0;this.parryFollow=0;this.parryWindow=0;this.linkWindow=0;this.finishWindow=0;this.stepRemaining=0;this.combo=heavy?0:(this.combo%3)+1;this.comboT=.85;this.attackDuration=heavy?.46:[.24,.27,.4][this.combo-1];this.attack=this.attackDuration;this.weaponMode=heavy?'heavy':'kick';if(!heavy&&(this.combo===2||this.duelMode)){this.stepRemaining=this.combo===2?18:this.combo===3?12:8;this.stepDir=this.face;}this.attackKind=heavy?2:this.combo;const tier=charge>=.65?2:charge>=.4?1:0,reach=heavy?(this.duelMode?[40,44,48]:[62,82,104])[tier]:[40,32,52][this.combo-1],dmg=heavy?[22,34,52][tier]:[12,15,24][this.combo-1];if(heavy&&this.duelMode&&tier>0){this.stepRemaining=[0,16,32][tier];this.stepDir=this.face;this.stepSpeed=300;spriteEffect('boost',this.x+9,this.y+this.h-10,this.face,.18,.45+tier*.15,true);}slashes.push({owner:'p',followStartup:this.duelMode,origin:14,kind:heavy?'cleave':'kick',combo:this.combo,tier,x:this.face>0?this.x+14:this.x-reach,y:this.y-5,w:reach,h:48,life:.2,delay:heavy?.12:this.combo===3?.11:.06,dmg,interrupt:heavy&&tier===2,dir:this.face});audio.noise(.035,.012);audio.tone(heavy?120:[200,175,145][this.combo-1],.07,'triangle',.015,40);}
    duelInput(move){
      if(pressed.has('shift')&&this.driveLock<=0&&this.sp>=12){
        const intent=this.shiftIntent??move;this.shiftIntent=null;
        this.charging=false;this.parryWindow=0;this.buffer=null;this.stepRemaining=0;this.attack=0;this.combo=0;this.linkWindow=0;
        slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);hazards=hazards.filter(h=>h.owner!=='p'||!(h.delay>0));
        const opponent=state==='combat'&&boss&&!boss.dead?Math.sign(boss.x+boss.w/2-this.x-9)||this.face:this.face;
        if(intent===-opponent){this.face=opponent;this.dash=.22;this.inv=.28;this.dashDir=intent;this.vx=intent*300;this.sp-=12;this.driveLock=.35;spriteEffect('boost',this.x+9,this.y+38,intent,.2,.7);}
        else {if(intent)this.face=intent;this.duelSkill(4);}
      }
      if(this.buffer?.key==='k'&&this.attack<=0&&this.dash<=0&&!this.charging&&this.parryLock<=0&&this.onGround){
        this.buffer=null;this.charging=true;this.parryTimer=.3;this.parryWindow=.14;this.parryLock=.55;this.vx=0;audio.tone(320,.06,'triangle',.025,140);
      }
      if(this.parryFollow>0&&this.buffer)this.charging=false;
      if(this.buffer&&!this.charging&&this.dash<=0&&(this.attack<=0||(this.buffer.key!=='j'||!this.onGround&&this.weaponMode==='riser')&&(this.linkWindow>0||this.buffer.key==='r'&&this.finishWindow>0))){
        const key=this.buffer.key;if(key==='k')return;this.buffer=null;
        if(key==='j')this.strike(false);else this.duelSkill(['q','w','e','r'].indexOf(key));
      }
    }
    duelSkill(i){
      if(i<0||this.ultimateT>0||this.stun>0||this.hp<=0)return;
      const costs=[14,16,12,0,this.reverseDrive?8:12];
      if(this.sp<costs[i]||(i<3&&this.cool[i]>0))return;
      if(i===3&&this.superMeter<100){message('ZERO POINT / 공격·방어로 게이지 충전',.7);return;}
      this.charging=false;this.parryWindow=0;this.buffer=null;this.linkWindow=0;this.finishWindow=0;this.stepRemaining=0;
      this.sp-=costs[i];if(i<3)this.cool[i]=[.65,.9,.8][i];
      this.attackSerial++;this.weaponMode=['riser','recoil','hook','super','drive'][i];this.attackDuration=[.48,.42,.4,.48,.44][i];this.attack=this.attackDuration;this.attackKind=3;
      const melee=(kind,delay,w,h,dmg,extra={})=>slashes.push({owner:'p',followStartup:true,origin:10,kind,x:this.face>0?this.x+10:this.x-w,y:this.y-5,w,h,delay,life:.12,dmg,dir:this.face,...extra});
      if(i===0){if(this.onGround){this.vy=-205;this.onGround=false;}else this.vy=Math.max(this.vy,30);this.stepRemaining=12;this.stepDir=this.face;this.stepSpeed=180;melee('riser',.11,40,65,23,{offsetY:this.vy>0?0:-18});}
      if(i===1)hazards.push({kind:'rail',owner:'p',x:this.x+9+this.face*20,y:this.y+30,vx:this.face*300,vy:0,r:6,delay:.16,life:.3,dmg:22,followWeapon:true,recoil:true,castId:this.attackSerial,dir:this.face});
      if(i===2)melee('hook',.14,52,48,18);
      if(i===3){this.superMeter=0;hitstop=Math.max(hitstop,.045);melee('super',.16,44,54,10,{superStarter:true});audio.tone(65,.18,'triangle',.05,220);}
      if(i===4){const boosted=this.reverseDrive>0;this.driveLock=.5;this.stepRemaining=boosted?72:56;this.stepDir=this.face;this.stepSpeed=280;this.inv=.08;this.reverseDrive=0;this.driveTime=0;
        melee('triple',.10,40,45,10,{segment:0});melee('triple',.23,40,45,16,{segment:2,interrupt:boosted});spriteEffect('boost',this.x+9,this.y+38,this.face,.3,boosted?1.1:.8,true);}
      audio.tone(150+i*30,.055,'triangle',.02,65);
    }
    confirmSuper(target){
      this.superTarget=target;this.ultimateT=.82;this.attack=this.attackDuration=.82;this.vx=0;this.stepRemaining=0;this.inv=.9;
      target.superLock=.84;target.windup=0;target.retreat=null;if(target.protocol)target.cancelProtocol();target.recovery=1.1;target.t=1.5;
      hazards=hazards.filter(h=>h.owner!=='b');slashes=slashes.filter(s=>s.owner!=='b');
      for(const [delay,dmg] of [[.16,18],[.35,22],[.59,50]])slashes.push({owner:'p',kind:'super',target,dir:this.face,x:target.x,y:target.y,w:target.w,h:target.h,life:.12,delay,dmg,superHit:true});
      spriteEffect('superburst',target.x+target.w/2,player.y+24,this.face,.22,.8);audio.tone(48,.2,'sawtooth',.04,120);
    }
    skill(i){ if(this.duelMode)return this.duelSkill(i);const boosted=i===0&&this.duelMode&&this.reverseDrive>0;const costs=[boosted?12:24,30,24,55], cds=[3.5,5,3,11];if(i===2&&!this.onGround){message('PILE // 착지 후 발동',.7);return;}const linked=((i===0||this.duelMode&&i===2)&&this.linkWindow>0)||(i===3&&this.finishWindow>0);if(this.charging||(this.cool[i]>0&&!(i===0&&(linked||boosted)))||this.sp<costs[i])return;this.linkWindow=0;this.finishWindow=0;this.stepRemaining=0;this.cool[i]=cds[i];this.sp-=costs[i];this.weaponMode=i===0&&this.duelMode?'drive':['triple','rail','pile','crown'][i];this.attackDuration=[this.duelMode?.52:.6,.65,.7,.72][i];this.attack=this.attackDuration;this.attackKind=i===0?3:2;message((linked?'LINK // ':'')+(this.duelMode?[boosted?'REVERSE DRIVE / 회수 추진각':'DRIVE / 관통 추진각','RAIL / 경골 레일건','HEEL ANCHOR / 접지 말뚝','SCISSOR LOCK / 협착 절단'][i]:SKILLS[i]),.9);audio.noise(.05,.012);
      if(i===0){
        if(this.duelMode){
          this.stepRemaining=boosted?66:38;this.stepDir=this.face;this.stepSpeed=boosted?260:190;
          if(boosted){this.reverseDrive=0;this.driveTime=0;}
          this.parryFollow=0;this.parryFlash=0;
          spriteEffect('boost',this.x+9,this.y+this.h-10,this.face,.32,boosted?1.1:.85,true);
          for(let j=0;j<2;j++)slashes.push({owner:'p',followStartup:true,origin:10,kind:'triple',segment:j===1?2:0,x:this.face>0?this.x+10:this.x-40,y:this.y-5,w:40,h:45,life:.12,delay:[.14,.28][j],dmg:[17,22][j],dir:this.face});
        }else{this.inv=.5;for(let j=0;j<3;j++)slashes.push({owner:'p',origin:10,kind:'triple',segment:j,x:this.face>0?this.x+10:this.x-40,y:this.y-5,w:40,h:45,life:.14,delay:[.08,.18,.3][j],dmg:13,dir:this.face});}
      }
      if(i===1){hazards.push({kind:'rail',owner:'p',x:this.x+9+this.face*20,y:this.y+22,vx:this.face*300,vy:0,r:8,delay:.34,life:1.5,dmg:25});}
      if(i===2)hazards.push({kind:'pillar',owner:'p',x:this.x+9+this.face*(this.duelMode?56:38),y:FLOOR,delay:.28,life:.45,dmg:30});
      if(i===3){slashes.push({owner:'p',kind:'guillotine',follow:true,x:this.face>0?this.x+14:this.x-48,y:this.y-8,w:48,h:54,life:.18,delay:.18,dmg:68,dir:this.face});}
      audio.tone(100+i*30,.1,'triangle',.018,20);
    }
    draw(){
      ctx.save();
      if(this.attack>0&&!this.duelMode){const progress=1-this.attack/this.attackDuration;ctx.translate(this.face*(progress<.25?-1.5:progress>.7?-1:1),0);}
      EdenPresentation.drawZero(ctx,this,time);ctx.restore();
      if(!this.charging||this.duelMode)return;
      const P=EdenPresentation,progress=clamp(this.charge/.65,0,1),color=progress===1?'#86f4ef':RED,x=this.x+9,y=this.y+32;
      P.rect(ctx,x-18,this.y-12,36,4,'#101721');P.rect(ctx,x-17,this.y-11,34*progress,2,color);
      ctx.fillStyle=color;ctx.font='6px monospace';ctx.textAlign='center';ctx.fillText(progress===1?'BREAK READY':'CHARGING',x,this.y-16);ctx.textAlign='left';
    }
  }
  const player=new Fighter();

  class Boss {
    constructor(data){this.d=data;this.x=365;this.h=data.type==='surgeon'?100:72;this.y=FLOOR-this.h;this.w=42;this.hp=data.hp;this.maxHp=data.hp;this.phase=1;this.t=1.4;this.anim=0;this.inv=1;this.dead=false;this.dir=-1;this.tele=0;this.windup=0;this.move=0;this.hitFlash=0;this.deathAge=0;this.guardBroken=0;this.release=0;}
    hurt(n,interrupt=false){if(this.inv>0||this.dead||player.hp<=0)return;
      if(this.d.type==='surgeon'){
        if(this.windup<=0&&!(this.recovery>0)&&!this.protocol&&!this.retreat)this.pressure=(this.pressure||0)+n;
        if(interrupt&&this.windup>0&&!(this.breakLock>0)){if(this.protocol)this.cancelProtocol();this.windup=0;this.breakLock=4;this.recovery=2;this.t=2.3;message('CAST BREAK // 봉합 신경 절단',1.3);burst(this.x+20,this.y+40,'#86f4ef',24,100);audio.tone(170,.3,'square',.045,40);}
        if(this.recovery>0)n*=1.25;
      }
      const damage=Math.round(n*(1+upgrade*.08+augments[0]*.12));chain++;chainTimer=2.4;bestChain=Math.max(bestChain,chain);this.hp-=damage;if(player.duelMode&&player.ultimateT<=0)player.superMeter=Math.min(100,player.superMeter+damage*.35);contactFeedback(this,n,damage);this.inv=.045;player.sp=Math.min(100,player.sp+2);
      if(this.hp<=0){this.hp=0;this.dead=true;if(this.d.type==='surgeon'){this.protocol=null;this.operation=null;this.followup=null;player.ultimateT=0;player.attack=0;player.superTarget=null;}this.inv=99;deathTimer=2.6;hazards=[];slashes=[];message('TARGET DISMANTLED // 코어 회수',2.4);burst(this.x+20,this.y+25,'#eee',22,140);audio.tone(38,1.1,'sawtooth',.06,16);return;}
      this.checkPhase();
    }
    checkPhase(){
      if(this.hp<=this.maxHp*.5&&this.phase===1&&!(this.superLock>0)){this.phase=2;this.inv=psychic&&this.d.type==='surgeon'?7:1.6;this.tele=this.inv;this.windup=0;this.t=psychic&&this.d.type==='surgeon'?1.1:1.8;hazards=[];if(this.d.type==='surgeon'){slashes=slashes.filter(s=>s.owner!=='b');this.operation=null;this.followup=null;this.release=0;this.recovery=0;this.retreat=null;this.pressure=0;this.counterReady=false;this.rearCounterPending=false;this.rearChecks=0;this.psiGuard=this.psiGuardWarn=0;this.psiGuardPending=false;this.seraphCycle=0;this.seraphFinalUsed=false;this.seraphDive=null;}message(PHASE_LINES[bossIndex],3);burst(this.x+20,this.y+25,RED,18,110);audio.tone(38,.7,'sawtooth',.07,15);}
    }
    update(dt){if(psychic&&this.phase===2&&this.d.type==='surgeon'&&this.tele>0&&EdenPresentation.seraphStatus&&EdenPresentation.seraphStatus!=='ready')return;this.anim+=dt;this.speechT=Math.max(0,(this.speechT||0)-dt);this.breakLock=Math.max(0,(this.breakLock||0)-dt);this.recovery=Math.max(0,(this.recovery||0)-dt);this.release=Math.max(0,this.release-dt);this.guardBroken=Math.max(0,(this.guardBroken||0)-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);this.inv=Math.max(0,this.inv-dt);const oldTele=this.tele;this.tele=Math.max(0,this.tele-dt);if(psychic&&this.phase===2&&this.d.type==='surgeon'&&oldTele>0){this.updateSeraphTransition(oldTele);if(!this.tele)this.y=FLOOR-this.h-15;}if(this.dead){this.deathAge+=dt;this.deathOpacity=Math.max(.05,1-this.deathAge/2.6);return;}if(this.superLock>0){this.superLock=Math.max(0,this.superLock-dt);if(!this.superLock)this.checkPhase();return;}if(player.hp<=0||this.tele>0)return;if(this.windup<=0&&!(this.d.type==='surgeon'&&this.release>0))this.dir=player.x<this.x?-1:1;
      if(psychic&&this.phase===2&&this.d.type==='surgeon')this.updateSeraph(dt);else this.updateSurgeon(dt);
    }
    cancelProtocol(){
      this.protocol=null;this.windup=0;this.release=0;
      hazards=hazards.filter(h=>!h.protocol);slashes=slashes.filter(s=>!s.protocolFinal);
    }
    beginProtocolCast(wave){
      this.counterCast=false;
      this.protocol={wave,waiting:false,timer:wave<2?.85:.95};
      this.move=wave<2?1:0;this.target={x:player.x+9,y:player.y+23};
      this.dir=this.target.x<this.x+this.w/2?-1:1;
      this.windup=this.windupMax=this.protocol.timer;
      audio.tone(wave<2?440:220,.12,'triangle',.035,wave<2?660:110);
      if(wave===0)message('SURGEON // 네 움직임까지 봉합하겠다.',1.4);
    }
    updateProtocol(dt){
      const protocol=this.protocol;protocol.timer-=dt;
      if(!protocol.waiting)this.windup=Math.max(0,protocol.timer);
      if(protocol.timer>0)return;
      if(protocol.waiting){this.beginProtocolCast(protocol.wave+1);return;}
      this.windup=0;const before=hazards.length;this.act();
      audio.tone(protocol.wave<2?165:85,.09,'triangle',.035,45);
      if(protocol.wave<2){
        for(const h of hazards.slice(before))h.protocol=true;
        protocol.waiting=true;protocol.timer=1.55;
      }else{
        slashes[slashes.length-1].protocolFinal=true;
        this.protocol=null;this.recovery=1.65;this.t=2.4;
      }
    }
    anchor(){
      if(this.dead||this.d.type!=='surgeon')return;
      this.anchorTime=1.4;this.pressure=0;this.counterReady=false;
      if(this.retreat){this.retreat=null;this.recovery=Math.max(this.recovery||0,.65);this.t=Math.max(this.t,1);}
      message('HEEL ANCHOR // 봉합 이동 고정',.8);audio.tone(105,.12,'triangle',.04,45);
    }
    breakAnchor(){
      if(this.d.type!=='surgeon'||this.dead||this.tele>0||this.windup>0||this.release>0||this.protocol||this.superLock>0||!(this.anchorTime>0)||!(this.recovery>0)||this.breakLock>0)return false;
      this.anchorTime=0;this.breakLock=4;this.recovery=Math.min(1.65,Math.max(.95,this.recovery+.35));this.t=Math.max(this.t,this.recovery+.4);
      this.hitFlash=.12;this.recoil=player.face*4;player.superMeter=Math.min(100,player.superMeter+10);
      hitstop=Math.max(hitstop,.055);
      audio.tone(95,.1,'triangle',.035,38);message('JOINT BREAK // 관절 파괴 — 연계 기회',.85);return true;
    }
    updateRetreat(dt){
      const r=this.retreat;
      if(r.warn>0){r.warn=Math.max(0,r.warn-dt);return;}
      r.age+=dt;this.x=lerp(r.from,r.to,clamp(r.age/.32,0,1));
      if(r.age>=.32){this.retreat=null;this.recovery=.45;this.t=.8;this.counterReady=true;}
    }
    preparePincer(){let x=clamp(this.target.x+this.dir*55,15,465);if(Math.abs(x-this.target.x)<35)x=clamp(this.target.x-this.dir*55,15,465);this.pincerX=x;this.speech='퇴로부터 봉합하지.';this.speechT=2;}
    beginOperation(){
      const positions=this.x<180?[235,390]:this.x>260?[65,225]:[40,380];
      this.operationUsed=true;if(this.phase===2)this.phase2OperationUsed=true;
      const duration=this.phase===2?5.8:6.5;this.operation={time:duration,nodes:positions.map(x=>({x,y:FLOOR-60,w:28,h:60,hp:36,maxHp:36}))};
      this.windup=this.windupMax=duration;this.move=0;this.counterCast=false;this.release=0;this.recovery=0;this.speech='저항은 마취하지 않겠다.';this.speechT=2;
      hazards=hazards.filter(h=>h.owner!=='b');slashes=slashes.filter(s=>s.owner!=='b');
      message(this.phase===2?'FINAL OPERATION / 수술 장치 재전개':'OPERATING FIELD / 장치 2개 파괴 또는 점프 회피',2.5);audio.tone(75,.3,'triangle',.045,35);
    }
    endOperation(broken){
      const op=this.operation;if(!op)return;this.operation=null;this.windup=0;this.release=broken?0:.45;this.recovery=broken?2:1.65;this.t=this.recovery+.55;
      if(broken){this.psiStagger=.6;message('SYSTEM BREAK / 수술 중단 — 반격 기회',1.4);hitstop=Math.max(hitstop,.06);audio.tone(90,.2,'triangle',.04,45);return;}
      for(const [left,right] of operationSegments(op)){
        slashes.push({kind:'operationWave',owner:'b',x:left,y:FLOOR-23,w:right-left,h:23,life:.2,delay:.12,dmg:24,dir:this.dir});
        const pieces=Math.max(1,Math.ceil((right-left)/65)),width=(right-left)/pieces;
        for(let i=0;i<pieces;i++)spriteEffect('psiUp',left+width*(i+.5),FLOOR,1,.38,Math.min(.5,width/(384*.33)));
      }
      hitstop=Math.max(hitstop,.055);shake=Math.max(shake,2.1);message('EXTRACTION / 절개 파동 — 점프 또는 파괴 지점',1.2);audio.noise(.09,.035);audio.tone(48,.28,'sawtooth',.05,25);
    }
    updateOperation(dt){this.operation.time=Math.max(0,this.operation.time-dt);this.windup=this.operation.time;if(!this.operation.time)this.endOperation(false);}
    // SERAPH is isolated to the existing SURGEON's second phase.
    updateSeraphTransition(previous){
      const before=7-previous,now=7-this.tele;
      for(const [at,note] of [[1.25,105],[2.25,145],[3.2,220],[3.75,260],[4.3,300],[5.1,390],[6.15,520]])if(before<at&&now>=at){
        audio.tone(note,.16,'triangle',.03,note*.55);
        if(at===2.25||at===5.1){spriteEffect('seraphCore',this.x+21,this.y+(at===5.1?-3:50),1,.65,at===5.1?1.2:.8);audio.noise(.06,.02);}
      }
    }
    beginSeraph(move){
      this.seraphMove=move;this.seraphTarget={x:clamp(player.x+9,30,450),y:player.y+24};this.dir=this.seraphTarget.x<this.x+21?-1:1;
      this.windup=this.windupMax={cleave:.95,descent:1.2,feathers:1.1,halo:1.3,final:2.15}[move];
      this.seraphLockAt={cleave:.55,feathers:.65,halo:.70,final:.85}[move]||0;this.seraphLocked=move==='descent';
      this.speechT=0;
      const hint={cleave:'SERAPHIC CLEAVE / 날개 절단 — 점프 또는 정면 K',descent:'DIVINE DESCENT / 낙하 지점에서 벗어나기',feathers:'CRIMSON FEATHERS / 상단 다음 하단 — 이동 또는 점프',halo:'HALO JUDGMENT / 광선 — 점프 또는 뒤로 이동',final:'FINAL REVELATION / 하단 광선 — 점프 또는 뒤로 이동'}[move];
      message(hint,move==='final'?2.1:1.5);audio.tone(move==='final'?65:280,.12,'triangle',.03,move==='final'?170:140);
    }
    performSeraph(){
      const dir=this.dir,origin=this.x+21,move=this.seraphMove;this.release=.4;this.t=.4;
      if(move==='cleave'){
        this.recovery=1.25;spriteEffect('seraphSweep',origin+dir*48,FLOOR-34,dir,.42,1);
        slashes.push({kind:'scalpel',seraph:true,seraphImpact:true,owner:'b',parryable:true,x:dir>0?origin:origin-120,y:FLOOR-27,w:120,h:24,life:.16,delay:.09,dmg:16,dir});
      }else if(move==='descent'){
        this.recovery=1.6;this.seraphDive={time:.34,from:this.x,fromY:this.y,to:clamp(this.seraphTarget.x-21,45,395)};
        audio.tone(310,.12,'triangle',.028,80);
      }else if(move==='feathers'){
        this.recovery=2.15;for(let wave=0;wave<3;wave++)for(let i=0;i<8;i++){
          const low=wave===1;hazards.push({kind:'needle',seraphFeather:true,owner:'b',dir,x:origin+dir*18,y:FLOOR-(low?14:76)+(i%4-1.5)*2,vx:dir*(170+(i%4)*7),vy:0,r:3,delay:.10+wave*.55+i*.025,life:3.2,dmg:8});
        }
        spriteEffect('seraphCore',origin,this.y+25,dir,.4,.6);audio.tone(560,.15,'triangle',.025,240);
      }else{
        const final=move==='final',x=dir>0?origin:8,width=dir>0?472-origin:origin-8,y=FLOOR-(final?34:27),height=final?34:20;
        this.recovery=final?2.35:1.55;
        hazards.push({kind:'beam',seraphBeam:true,seraphFinal:final,sourceX:origin,sourceY:this.y-3,owner:'b',dir,x,y,w:width,h:height,life:final?.34:.28,maxLife:final?.34:.28,delay:.12,dmg:final?26:19});
        spriteEffect('seraphCharge',origin,this.y+18,dir,.48,final?1.35:.8);
        if(!final)audio.tone(130,.12,'triangle',.025,65);
      }
    }
    updateSeraph(dt){
      this.seraphMoving=false;
      if(this.seraphDive){
        const d=this.seraphDive;d.time=Math.max(0,d.time-dt);const u=1-d.time/.34;
        this.x=lerp(d.from,d.to,u*u*(3-2*u));this.y=lerp(d.fromY,FLOOR-this.h,u);
        if(!d.hit&&hit({x:this.x-4,y:this.y+55,w:this.w+8,h:45},player.hurtbox())){d.hit=true;const cut={kind:'scalpel',owner:'b',parryable:true,dir:this.dir};if(player.tryParry(cut))d.parried=true;else player.damage(16,this.dir);}
        if(!d.time){this.seraphDive=null;const x=this.x+21;spriteEffect('seraphImpact',x,FLOOR-6,1,.48,1);if(!d.parried)slashes.push({kind:'scalpel',seraph:true,owner:'b',parryable:false,x:x-44,y:FLOOR-27,w:88,h:25,life:.16,delay:.04,dmg:18,dir:this.dir});shake=Math.max(shake,1.8);audio.noise(.08,.03);audio.tone(65,.12,'triangle',.04,28);}
        return;
      }
      const ascent=this.windup>0&&this.seraphMove==='descent'?25*(1-this.windup/this.windupMax):0;
      const hover=FLOOR-this.h-15-Math.sin(this.anim*2.8)*2-ascent;this.y=lerp(this.y,hover,clamp(dt*7,0,1));
      if(this.windup>0){
        if(!this.seraphLocked){
          const side=Math.sign(player.x+9-this.x-21);if(side)this.dir=side;
          if(this.windup-dt<=this.seraphLockAt){this.seraphLocked=true;audio.tone(480,.045,'triangle',.02,350);}
        }
        this.windup=Math.max(0,this.windup-dt);
        if(!this.windup)this.performSeraph();return;
      }
      if(this.recovery>0||this.release>0)return;
      this.t-=dt;
      if(this.t>0){const gap=player.x-this.x;if(Math.abs(gap)>130){this.seraphMoving=true;this.x=clamp(this.x+Math.sign(gap)*48*dt,45,395);}return;}
      if(this.hp<=this.maxHp*.25&&!this.seraphFinalUsed){this.seraphFinalUsed=true;this.beginSeraph('final');return;}
      const cycle=['cleave','feathers','descent','halo'];const move=cycle[this.seraphCycle%cycle.length];this.seraphCycle++;this.beginSeraph(move);
    }
    updateSurgeon(dt){
      this.retreatCooldown=Math.max(0,(this.retreatCooldown||0)-dt);
      this.anchorTime=Math.max(0,(this.anchorTime||0)-dt);
      this.pressure=Math.max(0,(this.pressure||0)-dt*6);
      if(this.operation){this.updateOperation(dt);return;}
      if(this.followup){const f=this.followup;f.time-=dt;if(f.x===null&&f.time<=.55){f.x=clamp(player.x+9,15,465);message('RE-SUTURE / 봉합 추적 — 표식에서 이동',.9);audio.tone(440,.08,'triangle',.03,150);}if(f.time<=0){hazards.push({kind:'syringe',owner:'b',x:f.x,y:38,vy:190,r:6,life:1.4,dmg:12,delay:.08});this.followup=null;this.recovery=Math.max(this.recovery||0,.7);this.t=Math.max(this.t,1.4);}}
      if(this.retreat){this.updateRetreat(dt);return;}
      if(this.protocol){this.updateProtocol(dt);return;}
      if(this.phase===2&&!this.protocolUsed&&this.windup<=0&&this.recovery<=0){
        this.protocolUsed=true;this.beginProtocolCast(0);return;
      }
      const operationDue=!this.operationUsed&&this.hp<=this.maxHp*.75||this.phase===2&&this.operationUsed&&!this.phase2OperationUsed&&this.hp<=this.maxHp*.30;
      if(psychic&&operationDue&&!this.followup&&this.windup<=0&&this.recovery<=0&&this.release<=0&&!(this.superLock>0)&&!(player.weaponMode==='psiSuper'&&player.attack>0)){this.beginOperation();return;}
      if(psychic&&this.rearCounterPending&&!this.followup&&this.windup<=0&&this.recovery<=0&&this.release<=0&&!(this.psiStagger>0)){this.rearCounterPending=false;this.rearCounterLock=6;this.psiGuardPending=false;this.psiChecks=0;this.move=8;this.target={x:player.x+9,y:player.y+23};this.dir=this.target.x<this.x?-1:1;this.windup=this.windupMax=1.05;this.speech='뒤에도 수술 부위는 있지.';this.speechT=2;message('후방 연타 반격 / 양옆 절개 — 점프 또는 K',1.7);audio.tone(290,.1,'triangle',.03,120);return;}
      if(this.windup>0){this.windup-=dt;if(this.approach){const a=this.approach;this.x=lerp(a.from,a.to,clamp((this.windupMax-this.windup-.3)/.4,0,1));}if(this.windup<=0){this.approach=null;this.act();this.recovery=this.move===3?1.55:this.move===4?1.9:this.move===5?2.05:this.move===6?1.15:this.move===7?1.4:this.move===8?1.55:[1.2,1.45,1.35][this.move%3];if(this.move===2||this.move===7){const muzzle=this.x+20+this.dir*(this.move===7?26:58),speed=this.move===7?200:(this.phase===2?120:105);this.recovery+=clamp(Math.abs((this.target?.x??muzzle)-muzzle)/speed-.4,0,1.25);}this.t=this.recovery+.55-(this.phase===2?.15:0);}return;}
      if(this.counterReady&&!(this.recovery>0)&&!this.protocol){
        this.counterReady=false;this.surgicalCounters=(this.surgicalCounters||0)+1;this.move=psychic&&this.surgicalCounters%2===1?7:2;this.target={x:player.x+9,y:player.y+23};this.dir=this.target.x<this.x?-1:1;
        if(this.move===7)this.preparePincer();this.windup=this.windupMax=this.move===7?1.05:.7;message(this.move===7?'PINCER / 점프 회피 · 정면 K로 봉쇄 해제':'RESECTION // 후퇴 후 견제 — 발사 방향 고정',1.7);audio.tone(390,.1,'triangle',.025);return;
      }
      if(this.pressure>=42&&this.retreatCooldown<=0&&this.anchorTime<=0&&!(this.recovery>0)&&this.release<=0){
        const direction=this.x+this.w/2>player.x+9?1:-1,to=clamp(this.x+direction*64,45,395);
        this.pressure=0;this.retreatCooldown=4.5;
        if(Math.abs(to-this.x)>=24){this.retreat={from:this.x,to,warn:.38,age:0};message('SUTURE STEP // 봉합 후퇴 — 다음 반격 대비',.8);audio.tone(480,.1,'triangle',.025,240);return;}
      }
      this.t-=dt;
      if(this.recovery<=0&&this.release<=0&&this.t>.35){const distance=player.x-this.x,range=Math.abs(distance);this.x=clamp(this.x+(range>170?Math.sign(distance)*85:range<76?-Math.sign(distance||-1)*28:0)*dt*(this.anchorTime>0?0:1),45,395);}
      if(this.t<=0){
        const range=Math.abs(player.x-this.x);let choice=range<92?0:range>175?2:1;
        if(choice===this.lastPattern&&this.patternRepeat>=1)choice=choice===1?2:1;
        const pursuit=range>140&&this.lastPattern===2&&this.anchorTime<=0;if(pursuit)choice=0;
        if(psychic&&choice===1&&((this.loomCasts=(this.loomCasts||0)+1)%3===0))choice=4;
        if(psychic&&choice===2&&((this.lanceCasts=(this.lanceCasts||0)+1)%2===0))choice=3;
        if(psychic){this.patternCount=(this.patternCount||0)+1;if(this.patternCount%5===2)choice=5;else if(this.patternCount%5===3)choice=7;else if(this.patternCount%5===4)choice=6;}
        this.counterCast=!!psychic&&choice===1&&((this.coreCasts=(this.coreCasts||0)+1)%2===1);
        this.patternRepeat=choice===this.lastPattern?(this.patternRepeat||0)+1:0;this.lastPattern=choice;this.move=choice;
        this.target={x:choice===4?clamp(player.x+9,57,423):player.x+9,y:player.y+23};this.windup=this.phase===2?.8:1;this.windupMax=this.windup;this.dir=this.target.x<this.x?-1:1;
        if(choice===7){this.preparePincer();this.windup=this.windupMax=1.05;}
        this.approach=pursuit?{from:this.x,to:clamp(this.x+this.dir*Math.min(120,Math.max(0,range-62)),45,395)}:null;if(pursuit)this.windup=this.windupMax=1.1;
        if(choice>=5)this.approach=null;
        message(this.counterCast?'CORE / 마취 코어 낙하 — 표식 밖으로 회피':pursuit&&choice===0?'PURSUIT / 추진 절개 — 경로 고정, 점프 또는 패링':['SUTURE / 저위 절개 — 점프 또는 정면 K 패링','LOOM / 봉합 낙하 — 표식 밖으로','NEEDLE / 주사기 산개 — 방향 고정','LANCE / 관통 주사 — 점프 또는 정면 K','CROSS STITCH / 양옆 다음 중앙 — 위치 이동','DISSECTION / 상단 후 하단 — 서 있다가 점프 또는 K','STERILE FIELD / 고정 침 — 표식 밖으로 이동','PINCER / 점프 회피 · 정면 K로 봉쇄 해제'][choice],this.counterCast?2:1.7);audio.tone(340,.12,'triangle',.04);
      }
    }
    act(){this.release=.38;const p=this.phase===2;
        const target=this.target||{x:player.x+9,y:player.y+23};
        if(this.move===8){for(const dir of [-1,1])hazards.push({kind:'needle',owner:'b',heavyLance:true,rearSweep:true,x:this.x+20+dir*26,y:FLOOR-14,vx:dir*190,vy:0,r:5,delay:.12,life:.75,dmg:14});}
        else if(this.move===7){hazards.push({kind:'pillar',owner:'b',sterileField:true,pincerField:true,x:this.pincerX,y:FLOOR,delay:.12,life:2.3,maxLife:2.3,dmg:16});hazards.push({kind:'needle',owner:'b',heavyLance:true,pincerShot:true,x:this.x+20+this.dir*26,y:FLOOR-14,vx:this.dir*200,vy:0,r:6,delay:.42,life:2.5,dmg:16});}
        else if(this.move===5){const x=this.x+20+this.dir*26;for(const [y,delay] of [[FLOOR-51,.12],[FLOOR-14,.85]])hazards.push({kind:'needle',owner:'b',heavyLance:true,dissection:true,x,y,vx:this.dir*200,vy:0,r:5,delay,life:2.5,dmg:15});}
        else if(this.move===6){hazards.push({kind:'pillar',owner:'b',sterileField:true,x:clamp(target.x,15,465),y:FLOOR,delay:.12,life:2.3,maxLife:2.3,dmg:16});}
        else if(this.move===3){hazards.push({kind:'needle',owner:'b',heavyLance:true,x:this.x+20+this.dir*58,y:FLOOR-14,vx:this.dir*220,vy:0,r:6,delay:.12,life:2.5,dmg:18});}
        else if(this.move===4){const x=clamp(target.x,57,423);for(const i of [-1,1])hazards.push({kind:'syringe',owner:'b',crossStitch:true,x:x+i*42,y:38,vy:190,r:5,life:1.4,dmg:12,delay:.1});hazards.push({kind:'syringe',owner:'b',crossStitch:true,x,y:38,vy:190,r:5,life:1.4,dmg:12,delay:.65});}
        else if(this.move%3===1&&this.counterCast&&!this.protocol){hazards.push({kind:'syringe',owner:'b',heavyCore:true,x:clamp(target.x,15,465),y:42,vy:145,r:8,life:1.6,dmg:14,delay:.16});}
        else if(this.move%3===1){for(let i=-1;i<=1;i++)hazards.push({kind:'syringe',owner:'b',x:clamp(target.x+i*42,15,465),y:38,vy:190,r:5,life:1.4,dmg:12,delay:.12+Math.abs(i)*.08});}
        else if(this.move%3===2){const ox=this.x+20+this.dir*58,oy=this.y+30,aim=Math.atan2(target.y-oy,target.x-ox);for(let i=-1;i<=1;i++){const a=aim+i*.42;hazards.push({kind:'needle',owner:'b',x:ox,y:oy,vx:Math.cos(a)*(p?120:105),vy:Math.sin(a)*(p?120:105),r:4,delay:.15,life:3.5,dmg:10});}}
        else {slashes.push({kind:'scalpel',parryable:true,owner:'b',x:this.dir<0?this.x-82:this.x+25,y:FLOOR-23,w:97,h:20,life:.18,delay:.12,dmg:16,dir:this.dir});if(psychic&&p&&!this.protocol)this.followup={time:.95,x:null};}
    }
    draw(){drawBoss(this);}
  }

  function spriteEffect(kind,x,y,dir=1,life=.2,effectScale=1,follow=false){
    const effect={sprite:kind,x,y,dir,life,max:life,effectScale,follow,vx:0,vy:0};particles.push(effect);return effect;
  }
  function burst(x,y,c,n=10,s=80){for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-s,s),vy:rnd(-s,s),life:rnd(.18,.7),max:1,c,size:Math.random()<.7?2:1});}
  function impact(x,y,power){particles.push({x,y,vx:0,vy:0,life:.16,max:.16,c:PALE,size:0,impact:power>=22?22:13});}
  function confirmHit(s,target){
    if(player.hp<=0||target.dead)return;
    if(s.kind==='dive'&&player.weaponMode==='dive'&&player.hp>0){player.diveUsed=true;player.vy=-140;player.onGround=false;player.stepRemaining=0;player.attack=Math.min(player.attack,.12);player.linkWindow=.3;player.recoverDrive();}
    if(['kick','cleave','riser','hook'].includes(s.kind))player.linkWindow=.24;if(s.kind==='riser'){player.finishWindow=.3;if(player.duelMode&&target.d?.type==='surgeon')target.breakAnchor();}if(s.kind==='hook'&&target.d?.type==='surgeon')target.anchor();
    if(s.kind==='triple'&&s.segment===2&&target.hp>0){player.finishWindow=.32;message(player.duelMode?(player.superMeter>=100?'CONFIRM // R: OVERDRIVE':'LINK // Q 상승 · E 걸기'):'CONFIRM // R: 압착 단두각',.65);}
    if(s.kind==='kick'&&s.combo===3&&target.d?.type==='surgeon'&&target.windup<=0&&target.tele<=0&&!target.protocol&&!(target.release>0)&&!(target.recovery>0))target.x=clamp(target.x+s.dir*24,30,405);
  }
  function confirmRecoil(h,target){
    if(!player.duelMode||!h.recoil||h.castId!==player.attackSerial||player.weaponMode!=='recoil'||player.attack<=0||player.stun>0||player.hp<=0||target.hp<=0||target.dead)return;
    player.linkWindow=Math.max(player.linkWindow,.22);player.recoverDrive();player.driveLock=0;
  }
  function warnLine(x,d=.5){hazards.push({kind:'warn',owner:'x',x:x-1,y:15,w:2,h:FLOOR-15,life:d});}
  function message(text,life=1){messages.push({text,life,max:life});}

  function operationSegments(op){
    const gaps=op.nodes.filter(n=>n.hp<=0).map(n=>[Math.max(8,n.x-25),Math.min(472,n.x+n.w+25)]).sort((a,b)=>a[0]-b[0]);
    let edge=8;const segments=[];for(const [left,right] of gaps){if(left>edge)segments.push([edge,left]);edge=Math.max(edge,right);}if(edge<472)segments.push([edge,472]);return segments;
  }
  function hitOperationNode(s,box){
    const op=boss?.operation;if(!op||s.superHit)return false;
    const node=op.nodes.find(n=>n.hp>0&&!s.hitTargets?.has(n)&&(s.radius?slashHit(s,n):hit(box,n)));if(!node)return false;
    if(s.hitTargets)s.hitTargets.add(node);const damage=Math.min(node.hp,s.dmg);node.hp-=damage;player.sp=Math.min(100,player.sp+2);
    contactFeedback(node,s.dmg,damage);if(['psiJab','psiShock','psiCounter'].includes(s.kind))player.linkWindow=.24;
    if(node.hp<=0){message('RELAY DOWN / 파괴 위치가 안전지대',1);audio.tone(110,.12,'triangle',.04,35);if(op.nodes.every(n=>n.hp<=0))boss.endOperation(true);}
    return true;
  }
  function updateCombat(dt){
    if(state==='combat'&&!boss.dead&&player.hp>0){battleSeconds+=dt;chainTimer=Math.max(0,chainTimer-dt);if(!chainTimer)chain=0;}
    if(!boss?.dead&&player.hp>0)player.update(dt);if(state==='combat')boss.update(dt);
    for(const s of slashes){
      if(s.attached&&(player.weaponMode!=='dive'||player.stun>0||player.hp<=0||player.dash>0||s.castId!==player.attackSerial)){s.life=0;continue;}
      if(s.followCenter&&s.delay>0){s.x=player.x+9-s.radius;s.y=player.y+24-s.radius;}
      if(s.followStartup&&(s.delay>0||s.attached&&!s.done)){s.x=s.dir>0?player.x+s.origin:player.x-s.w;s.y=player.y+(s.offsetY??-5);}
      if(s.follow&&s.delay>0){s.x=s.dir>0?player.x+14:player.x-s.w;s.y=player.y-8;}
      if(s.target&&(s.target.hp<=0||player.hp<=0)){s.life=0;continue;}
      if(s.delay>0){s.delay-=dt;if(s.delay<=0&&s.seraphImpact){const x=s.dir>0?s.x+85:s.x+s.w-85;spriteEffect('seraphImpact',x,FLOOR-7,s.dir,.35,.65);audio.noise(.07,.026);audio.tone(130,.09,'triangle',.03,60);}if(s.delay<=0&&player.duelMode&&s.owner==='p'){if(psychic)psychic.release(s);if(s.kind==='kick'||s.kind==='hook')spriteEffect('sweep',s.dir>0?s.x:s.x+s.w,s.y+32,s.dir,.14,s.kind==='hook'?.8:[.42,.58,.88][(s.combo||1)-1]);if(s.superHit&&!psychic)spriteEffect('superburst',s.target.x+21,player.y+24,s.dir,.24,s.dmg>=50?1.1:.8);}continue;}
      s.life-=dt;if(s.done)continue;
      const box={x:s.x,y:s.y,w:s.w,h:s.h},multi=!!s.radius||s.kind==='psiFinalWave';if(multi&&!s.hitTargets)s.hitTargets=new Set();
      if(s.owner==='p'){
        if(multi){while(hitOperationNode(s,box)){} }else if(hitOperationNode(s,box))s.done=true;
        if(!s.done&&boss&&!boss.dead&&!s.hitTargets?.has(boss)&&slashHit(s,boss)&&boss.inv<=0){
          if(psychic&&player.duelMode)psychic.hit(s,boss);else{if(s.superStarter&&player.hp>0)player.confirmSuper(boss);boss.hurt(s.dmg,s.interrupt);confirmHit(s,boss);}
          if(multi)s.hitTargets.add(boss);else s.done=true;
        }
        if(!s.done&&room&&state==='explore')for(const drone of room.drones){if(drone.hp>0&&!s.hitTargets?.has(drone)&&slashHit(s,drone)){
          if(psychic&&player.duelMode)psychic.hit(s,drone);else{if(s.superStarter&&player.hp>0)player.confirmSuper(drone);drone.hp-=Math.round(s.dmg*(1+upgrade*.08+augments[0]*.12));confirmHit(s,drone);contactFeedback(drone,s.dmg,Math.round(s.dmg*(1+upgrade*.08+augments[0]*.12)));}
          if(multi)s.hitTargets.add(drone);else{s.done=true;break;}
        }}
      }else if(s.owner==='b'&&hit(box,player.hurtbox())){if(!player.tryParry(s)){if(player.duelMode&&player.dash>0)player.recoverDrive();player.damage(s.dmg,s.dir);}s.done=true;}
    }
    slashes=slashes.filter(s=>s.life>0);
    for(const h of hazards){if(h.delay>0&&h.source?.hp<=0){h.life=0;continue;}if(h.delay>0){if(h.followWeapon){h.x=player.x+9+h.dir*20;h.y=player.y+(h.followOffsetY??30);}h.delay-=dt;if(h.delay<=0&&h.recoil){player.stepRemaining=20;player.stepDir=-h.dir;player.stepSpeed=180;}if(h.delay<=0&&h.source){h.source.release=.18;spriteEffect('boost',h.x,h.y,-Math.sign(h.vx),.15,.35);audio.tone(330,.04,'triangle',.02,150);}if(h.delay<=0&&h.heavyLance){audio.noise(.045,.025);audio.tone(155,.1,'triangle',.035,95);}
      if(h.delay<=0&&h.seraphBeam){audio.noise(h.seraphFinal?.16:.09,h.seraphFinal?.045:.028);audio.tone(h.seraphFinal?38:90,h.seraphFinal?.28:.14,'triangle',.045,h.seraphFinal?20:40);if(h.seraphFinal){shake=Math.max(shake,2.8);hitstop=Math.max(hitstop,.055);invertFlash=Math.max(invertFlash,.045);const origin=h.dir>0?h.x:h.x+h.w;spriteEffect('seraphImpact',origin+h.dir*32,FLOOR-8,h.dir,.48,1.1);}}
      if(h.delay<=0&&player.duelMode&&h.owner==='p'){
        if(h.kind==='psiShard'&&psychic)psychic.projectileRelease(h);
        if(h.kind==='rail'){spriteEffect('boost',h.x,h.y,-Math.sign(h.vx),.15,.45);audio.tone(340,.06,'triangle',.025,180);}
        if(h.kind==='pillar'){spriteEffect('hit',h.x,FLOOR-8,player.face,.24,.85);audio.tone(95,.09,'triangle',.03,60);}
      }
      if(h.delay<=0&&h.sterileField){spriteEffect('hit',h.x,FLOOR-8,1,.18,.55);audio.tone(95,.12,'triangle',.03,45);}
      if(h.delay<=0&&h.dissection)audio.tone(h.y<FLOOR-30?220:140,.08,'triangle',.025,70);
      continue;}h.life-=dt;h.x+=(h.vx||0)*dt;h.y+=(h.vy||0)*dt;if(h.kind==='ember')h.vy+=250*dt;if(h.kind==='drone'){h.vy+=(player.y-h.y)*dt*2;h.vx+=(player.x-h.x)*dt*.3;}
      if(h.sterileField)h.passGrace=Math.max(0,(h.passGrace||0)-dt);
      const pillarHeight=62*Math.min(1,Math.max(.15,((h.maxLife||.45)-h.life)/.06),h.life/.09);
      let box=h.kind==='pillar'?{x:h.x-9,y:FLOOR-pillarHeight,w:18,h:pillarHeight}:h.kind==='beam'?{x:h.x,y:h.y,w:h.w,h:h.h}:{x:h.x-(h.r||4),y:h.y-(h.r||4),w:(h.r||4)*2,h:(h.r||4)*2};
      if(h.kind!=='warn'&&!h.done){if(h.owner==='b'&&hit(box,player.hurtbox())){
        const parried=player.duelMode&&h.kind==='needle'&&player.tryParry({kind:'scalpel',projectile:true,parryable:true,owner:'b',pincer:!!h.pincerShot,dir:h.vx>0?1:-1});
        if(!parried){
          const fieldDodge=h.sterileField&&player.dash>0&&player.inv>0;
          if(fieldDodge)h.passGrace=.12;
          if(player.dash>0&&(!h.sterileField||fieldDodge&&!h.evadeRewarded)){if(fieldDodge)h.evadeRewarded=true;player.recoverDrive();player.sp=Math.min(100,player.sp+7);message('PERFECT EVADE // 신경 가속',.65);audio.tone(620,.1,'sine',.025);}
          if(!h.sterileField||!h.passGrace)player.damage(h.dmg,h.x<player.x?1:-1);
        }
        if(!h.sterileField)h.done=true;
      }if(h.owner==='p'&&h.kind==='psiShard'&&hitOperationNode(h,box))h.done=true;if(h.owner==='p'&&!h.done&&boss&&hit(box,boss)&&boss.inv<=0){const anchors=h.kind==='pillar'&&boss.d.type==='surgeon'&&!boss.dead&&player.hp>0;const accepted=!boss.dead&&player.hp>0;if(h.kind==='psiShard'&&psychic)psychic.hit(h,boss);else boss.hurt(h.dmg);if(accepted)confirmRecoil(h,boss);if(anchors)boss.anchor();h.done=true;}if(h.owner==='p'&&!h.done&&state==='explore'&&room)for(const d of room.drones)if(d.hp>0&&hit(box,d)){if(h.kind==='psiShard'&&psychic)psychic.hit(h,d);else{d.hp-=Math.round(h.dmg*(1+upgrade*.08+augments[0]*.12));confirmRecoil(h,d);contactFeedback(d,h.dmg,Math.round(h.dmg*(1+upgrade*.08+augments[0]*.12)));}h.done=true;break;}}
    }
    hazards=hazards.filter(h=>h.life>0&&!h.done&&h.x>-50&&h.x<W+50&&h.y<H+50);
    particles.forEach(p=>{p.life-=dt;if(p.cancelWithAttack&&(p.castId!==player.attackSerial||player.stun>0||player.hp<=0||player.attack<=0)){p.life=0;return;}if(p.trackPlayer){p.x=player.x+9;p.y=player.y+22;}if(p.sprite){if(p.target){if(p.target.hp<=0||p.requiresCompression&&!(p.target.psiCompression>0)){p.life=0;return;}p.x=p.target.x+p.target.w/2;p.y=p.target.y+p.target.h*.55-psychicLift(p.target);}if(p.follow){p.x=player.x+9;p.y=player.y+player.h-10;}return;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;p.vx*=.97;});particles=particles.filter(p=>p.life>0);
    messages.forEach(m=>m.life-=dt);messages=messages.filter(m=>m.life>0);
    damageNumbers.forEach(n=>{n.life-=dt;n.y-=20*dt;});damageNumbers=damageNumbers.filter(n=>n.life>0);
    echoes.forEach(e=>e.life-=dt);echoes=echoes.filter(e=>e.life>0).slice(-15);
    if(deathTimer>0){deathTimer-=dt;if(deathTimer<=0){if(player.hp<=0)state='gameover';else finishBoss();}}
  }

  function finishBoss(){if(state==='ending')return;bossIndex=0;checkpointStage='boss';hazards=[];slashes=[];particles=[];state='ending';save();}
  function startBoss(i=0){i=0;const carriedMeter=state==='explore'&&i===0?player.superMeter:0;bossIndex=i;player.reset();player.superMeter=carriedMeter;player.maxHp=player.hp=100+upgrade*5+augments[2]*20;chain=chainTimer=bestChain=battleSeconds=0;boss=new Boss(BOSSES[i]);hazards=[];slashes=[];particles=[];messages=[];damageNumbers=[];echoes=[];deathTimer=0;hitstop=shake=flash=invertFlash=0;paused=false;checkpointStage='boss';save();state='intro';time=0;}
  function startExplore(){boss=null;player.reset();player.maxHp=player.hp=100+upgrade*5+augments[2]*20;hazards=[];slashes=[];particles=[];messages=[];damageNumbers=[];echoes=[];deathTimer=0;hitstop=shake=flash=invertFlash=0;paused=false;state='explore';checkpointStage='explore';room={section:0,read:false,drones:[],seconds:0};enterSection();save();}
  function enterSection(){player.x=25;room.seconds=0;room.read=false;hazards=[];slashes=[];room.drones=room.section===1?[{x:210,y:173,w:20,h:20,hp:38+bossIndex*3,t:2},{x:355,y:160,w:20,h:20,hp:38+bossIndex*3,t:3}]:[];message(['접속 회랑 // F: 기록 단말 조사','방어망 // 드론을 해체하고 전진','재기동 설비 // F: 교전 준비'][room.section],2.5);}
  function updateExplore(dt){
    room.seconds+=dt;updateCombat(dt);if(player.hp<=0)return;
    for(const d of room.drones){if(d.hp<=0)continue;if(d.superLock>0){d.superLock=Math.max(0,d.superLock-dt);continue;}if(player.duelMode){d.aiming=Math.max(0,(d.aiming||0)-dt);d.release=Math.max(0,(d.release||0)-dt);}d.y=168+Math.sin(time*2+d.x)*11;d.t-=dt;if(d.t<=0){const ox=player.duelMode?d.x+10+(player.x<d.x?-24:24):d.x,oy=player.duelMode?d.y+10:d.y,a=Math.atan2(player.y+24-oy,player.x+9-ox);if(player.duelMode){d.aiming=.75;d.face=Math.cos(a)<0?-1:1;}hazards.push({source:player.duelMode?d:undefined,kind:'needle',owner:'b',x:ox,y:oy,r:3,vx:Math.cos(a)*85,vy:Math.sin(a)*85,life:5,delay:.75,dmg:8});d.t=3.1;}}
    if(room.section===0&&Math.abs(player.x-209)<40&&pressed.has('f')&&!room.read){room.read=true;if(!recoveredRecords.has(bossIndex)){recoveredRecords.add(bossIndex);archiveCount++;save();}dialogue=[['ARCHIVE // '+String(bossIndex+1).padStart(2,'0'),RECORDS[bossIndex]],['ZERO','기록 보존. 명령과 사실이 일치하지 않는다.']];dialogueStep=0;audio.tone(450,.1,'sine',.03);}
    if(room.section<2&&player.x>440){if(room.drones.some(d=>d.hp>0)){player.x=438;message('보안 잠금 // 활성 드론을 제거하세요',1);}else{room.section++;enterSection();}}
    if(room.section===2&&player.x>380&&pressed.has('f'))startBoss();
  }

  function drawBackground(zone=0){
    EdenPresentation.background(ctx,Math.min(6,zone),time);
    // Deterministic pixel weather: never creates collision objects or hides warnings.
    ctx.save();ctx.globalAlpha=.24;ctx.fillStyle=['#a8c5d4','#81b5d1','#d8ba7a','#ff633a','#b2a0ef','#80d8c4','#ef6176'][zone%7];
    for(let i=0;i<32;i++){const x=(i*79+time*(zone===1?34:5))%480,y=(i*47+time*(zone===3?-17:14)+5400)%220;ctx.fillRect(Math.floor(x),Math.floor(y),1,zone===1?6:2);}
    for(let i=0;i<7;i++)ctx.fillRect(i*73,221,12+Math.floor(Math.sin(time*2+i)*5),1);
    ctx.restore();
  }

  function drawBoss(b){const lift=psychicLift(b);ctx.save();ctx.translate(b.recoil||0,-lift);if(b.contactFlash>0)ctx.filter='brightness(1.65)';EdenPresentation.boss(ctx,b,time);ctx.restore();
    if(b.speechT>0&&!b.dead){const x=clamp(b.x+b.w/2,80,400),y=b.y-11-lift;ctx.save();ctx.globalAlpha=clamp(b.speechT*3,0,1);ctx.fillStyle='rgba(5,8,13,.82)';ctx.fillRect(x-76,y-9,152,12);ctx.fillStyle='#e1c1c5';ctx.font='6px sans-serif';ctx.textAlign='center';ctx.fillText('SURGEON / '+b.speech,x,y,148);ctx.restore();}
  }

  function drawHazards(){
    const P=EdenPresentation;
    if(state==='combat'&&boss?.followup?.x!==null&&boss?.followup?.x!==undefined){const x=boss.followup.x;ctx.save();ctx.globalAlpha=.22;ctx.fillStyle=RED;ctx.fillRect(x-7,38,14,FLOOR-38);ctx.globalAlpha=1;P.line(ctx,x-8,FLOOR,x+8,FLOOR,RED,2);ctx.restore();}
    if(state==='combat'&&boss?.operation){
      const op=boss.operation;
      if(op.time<1.25){ctx.save();ctx.globalAlpha=.22;ctx.fillStyle=RED;for(const [left,right] of operationSegments(op))ctx.fillRect(left,FLOOR-23,right-left,23);ctx.restore();}
      for(const node of op.nodes){ctx.save();ctx.globalAlpha=node.hp>0?1:.3;P.drawOrdnance(ctx,{kind:'pillar',x:node.x+node.w/2,y:FLOOR,delay:1,life:.45});ctx.restore();
        if(node.hp>0)bar(node.x-2,node.y-9,node.w+4,4,node.hp,node.maxHp,RED);else P.line(ctx,node.x-24,FLOOR-2,node.x+node.w+24,FLOOR-2,'#86f4ef',2);
      }
    }
    if(state==='combat'&&boss?.d.type==='surgeon'&&(!psychic||boss.phase===1)&&boss.windup>0&&!boss.operation){
      const b=boss,target=b.target||{x:player.x+9,y:player.y+23};
      ctx.save();ctx.globalAlpha=.22;ctx.fillStyle=RED;
      if(b.move===0)ctx.fillRect(b.dir<0?b.x-82:b.x+25,FLOOR-23,97,20);
      if(b.move===1&&!b.counterCast)for(let i=-1;i<=1;i++)ctx.fillRect(clamp(target.x+i*42,15,465)-6,38,12,FLOOR-38);
      if(b.move===1&&b.counterCast)ctx.fillRect(clamp(target.x,15,465)-8,38,16,FLOOR-38);
      if(b.move===4){for(const i of [-1,1])ctx.fillRect(clamp(target.x+i*42,15,465)-6,38,12,FLOOR-38);ctx.globalAlpha=.10;ctx.fillRect(clamp(target.x,15,465)-6,38,12,FLOOR-38);}
      if(b.move===6)ctx.fillRect(clamp(target.x,15,465)-9,FLOOR-62,18,62);
      if(b.move===7)ctx.fillRect(b.pincerX-9,FLOOR-62,18,62);
      ctx.globalAlpha=1;
      if(b.move===0)P.line(ctx,b.dir<0?b.x-82:b.x+25,FLOOR-4,b.dir<0?b.x+15:b.x+122,FLOOR-4,RED,2);
      if(b.move===3){const muzzle=b.x+20+b.dir*58;P.line(ctx,muzzle,FLOOR-14,b.dir<0?10:470,FLOOR-14,RED,2);}
      if(b.move===5){const muzzle=b.x+20+b.dir*26,end=b.dir<0?10:470;P.line(ctx,muzzle,FLOOR-51,end,FLOOR-51,RED,2);P.line(ctx,muzzle,FLOOR-14,end,FLOOR-14,'#ffc67a',1);}
      if(b.move===6){const x=clamp(target.x,15,465);P.line(ctx,x-10,FLOOR,x+10,FLOOR,RED,2);}
      if(b.move===7){const muzzle=b.x+20+b.dir*26;P.line(ctx,b.pincerX-10,FLOOR,b.pincerX+10,FLOOR,RED,2);P.line(ctx,muzzle,FLOOR-14,b.dir<0?10:470,FLOOR-14,'#ffc67a',2);}
      if(b.move===8)P.line(ctx,Math.max(8,b.x-140),FLOOR-14,Math.min(472,b.x+b.w+140),FLOOR-14,RED,2);
      if(b.move===1&&b.counterCast){const x=clamp(target.x,15,465);P.line(ctx,x-10,FLOOR,x+10,FLOOR,RED,2);}
      if(b.move===4){for(const i of [-1,1]){const x=clamp(target.x+i*42,15,465);P.line(ctx,x-8,FLOOR,x+8,FLOOR,RED,2);}const x=clamp(target.x,15,465);P.line(ctx,x-8,FLOOR,x+8,FLOOR,'#ffc67a',2);}
      if(b.move===1&&!b.counterCast)for(let i=-1;i<=1;i++){const x=clamp(target.x+i*42,15,465);P.line(ctx,x-8,FLOOR,x+8,FLOOR,RED,2);P.line(ctx,x-5,45,x,51,PALE);P.line(ctx,x,51,x+5,45,PALE);}
      if(b.move===2){const ox=b.x+20+b.dir*58,oy=b.y+30,aim=Math.atan2(target.y-oy,target.x-ox);for(let i=-1;i<=1;i++){const a=aim+i*.42;for(let j=1;j<=12;j++)P.rect(ctx,ox+Math.cos(a)*j*12,oy+Math.sin(a)*j*12,2,2,RED);}}
      P.rect(ctx,b.x-3,b.y-9,48,3,'#161b25');P.rect(ctx,b.x-3,b.y-9,48*(1-b.windup/(b.windupMax||1)),3,'#ffc67a');ctx.restore();
    }
    if(psychic&&state==='combat'&&boss?.phase===2&&boss.tele<=0&&boss.windup>0){
      const b=boss,dir=b.dir,origin=b.x+21,move=b.seraphMove;ctx.save();ctx.fillStyle=RED;ctx.globalAlpha=.20;
      if(move==='cleave')ctx.fillRect(dir>0?origin:origin-120,FLOOR-27,120,24);
      if(move==='descent')ctx.fillRect(b.seraphTarget.x-44,FLOOR-27,88,24);
      if(move==='halo'||move==='final')ctx.fillRect(dir>0?origin:8,FLOOR-(move==='final'?34:27),dir>0?472-origin:origin-8,move==='final'?34:20);
      ctx.globalAlpha=.65;
      if(move==='feathers'){const left=dir>0?origin:8,right=dir>0?472:origin;P.line(ctx,left,FLOOR-76,right,FLOOR-76,RED,1);P.line(ctx,left,FLOOR-14,right,FLOOR-14,RED,1);}
      if(move==='descent')P.line(ctx,b.seraphTarget.x-44,FLOOR-3,b.seraphTarget.x+44,FLOOR-3,RED,2);
      P.rect(ctx,b.x-3,b.y-9,48,3,'#161b25');P.rect(ctx,b.x-3,b.y-9,48*(1-b.windup/b.windupMax),3,b.seraphLocked?'#ffc67a':'#97a5b7');ctx.restore();
    }
    if(psychic&&player.ultimateT>0){const x=player.face>0?player.x+12:player.x-230;ctx.save();ctx.globalAlpha=.13;ctx.fillStyle=RED;ctx.fillRect(x,player.y-12,230,72);ctx.restore();}
    for(const h of hazards){
      if(h.delay>0){
        if(h.seraphFeather||h.seraphBeam)continue;
        if(h.kind==='psiShard'){if(h.delay<.38){ctx.save();ctx.globalAlpha=.55;P.drawOrdnance(ctx,{...h,x:player.x+9-h.dir*(10+(h.shardIndex%3)*8),y:player.y-2-(h.shardIndex%3)*10});ctx.restore();}continue;}
        if(player.duelMode&&['pillar','syringe','needle','rail'].includes(h.kind)){ctx.save();ctx.globalAlpha=.4+.15*Math.sin(time*18);P.drawOrdnance(ctx,{...h,y:h.kind==='pillar'?FLOOR:h.y});ctx.restore();continue;}
        ctx.globalAlpha=.3+Math.sin(time*25)*.12;ctx.fillStyle=RED;
        if(h.kind==='pillar')ctx.fillRect(h.x-9,FLOOR-62,18,62);
        else if(h.kind==='beam')ctx.fillRect(h.x,h.y,h.w,h.h);
        else if(h.kind==='syringe')ctx.fillRect(h.x-7,70,14,FLOOR-70);
        else if(h.kind==='needle'){const a=Math.atan2(h.vy,h.vx);ctx.globalAlpha=.7;for(let i=1;i<=8;i++)P.rect(ctx,h.x+Math.cos(a)*i*10,h.y+Math.sin(a)*i*10,2,1,RED);P.ring(ctx,h.x,h.y,8,PALE);}
        else if(h.kind==='rail'){ctx.globalAlpha=.8;P.line(ctx,h.x,h.y,h.x-Math.sign(h.vx)*28,h.y,'#86f4ef',2);}
        else P.ring(ctx,h.x,h.y,11,RED);
        ctx.globalAlpha=1;continue;
      }
      if(player.duelMode&&P.drawOrdnance(ctx,h))continue;
      if(h.kind==='warn'){P.line(ctx,h.x,h.y,h.x,FLOOR,RED);continue;}
      if(h.kind==='pillar'){
        const color=h.owner==='p'?'#86f4ef':RED,extension=Math.min(1,h.life*8);
        P.rect(ctx,h.x-12,FLOOR-3,24,3,color);
        for(let i=-1;i<=1;i++){const height=(56-Math.abs(i)*12)*extension,x=h.x+i*5;P.rect(ctx,x-2,FLOOR-height,4,height,'#6e7f92');P.line(ctx,x,FLOOR-6,x,FLOOR-height,color);P.line(ctx,x-2,FLOOR-height,x,FLOOR-height-5,PALE);}
        for(let i=0;i<4;i++)P.rect(ctx,h.x-17+i*11,FLOOR-5-(i%2)*7,3,2,color);
      }else if(h.kind==='beam'){
        P.rect(ctx,h.x-3,h.y,h.w+6,h.h,'#730d28');P.rect(ctx,h.x,h.y,h.w,h.h,RED);P.rect(ctx,h.x+h.w*.35,h.y,h.w*.3,h.h,PALE);
      }else if(h.kind==='syringe'){
        P.plate(ctx,h.x-4,h.y-14,9,18);P.rect(ctx,h.x-2,h.y-10,4,10,RED);P.line(ctx,h.x,h.y+3,h.x,h.y+15,PALE);
      }else if(h.kind==='needle'){
        const a=Math.atan2(h.vy,h.vx),dx=Math.cos(a),dy=Math.sin(a);P.line(ctx,h.x-dx*10,h.y-dy*10,h.x+dx*5,h.y+dy*5,'#a5adbb',4);P.line(ctx,h.x-dx*8,h.y-dy*8,h.x,h.y,RED,2);P.line(ctx,h.x+dx*5,h.y+dy*5,h.x+dx*12,h.y+dy*12,PALE);
      }else if(h.kind==='rail'){
        const dir=Math.sign(h.vx);P.line(ctx,h.x-dir*46,h.y,h.x,h.y,'#245c72',7);P.line(ctx,h.x-dir*34,h.y,h.x+dir*8,h.y,'#86f4ef',3);P.line(ctx,h.x-dir*20,h.y,h.x+dir*9,h.y,PALE);for(let i=0;i<3;i++)P.rect(ctx,h.x-dir*(12+i*11),h.y-6+(i%2)*11,4,1,'#86f4ef');
      }else if(h.kind==='drone'){
        P.plate(ctx,h.x-7,h.y-5,14,10);P.rect(ctx,h.x-3,h.y-1,6,2,RED);P.line(ctx,h.x-11,h.y,h.x-7,h.y,'#aeb5c4',2);
      }else if(h.kind==='ember'){
        for(let i=0;i<4;i++)P.rect(ctx,h.x-2+Math.sin(time*20+i)*3,h.y-2-i*3,4,4,i?RED:PALE);
      }else{
        const a=Math.atan2(h.vy||0,h.vx||1),dx=Math.cos(a)*9,dy=Math.sin(a)*9;
        P.line(ctx,h.x-dx,h.y-dy,h.x+dx,h.y+dy,h.owner==='p'?PALE:RED,3);
        P.line(ctx,h.x-dx*1.7,h.y-dy*1.7,h.x-dx,h.y-dy,'#73213a');
      }
    }
  }
  function drawSlashes(){
    const P=EdenPresentation;
    for(const s of slashes){if(s.delay>0||s.owner==='p'||s.kind==='scalpel'||s.kind==='operationWave')continue;ctx.save();ctx.globalAlpha=clamp(s.life*7,0,1);
      const color=s.interrupt?'#86f4ef':RED,x=s.x,y=s.y,w=s.w,h=s.h,dir=s.dir||1;
      if(s.kind==='kick'){
        const a=dir>0?x:x+w,b=dir>0?x+w:x,level=s.combo||1;
        const y1=y+(level===2?h*.85:h*.2),y2=y+(level===2?h*.1:h*.65);
        P.line(ctx,a,y1,b,y2,'#70162c',level===3?6:4);P.line(ctx,a+dir*5,y1,b,y2,RED,level===3?3:2);P.line(ctx,a+dir*12,y1,b,y2,PALE);
        if(level===3)for(let i=0;i<3;i++){P.line(ctx,b-dir*(8+i*12),y2-4-i*3,b-dir*(18+i*12),y2-8-i*3,RED);P.line(ctx,a+dir*(15+i*10),y1+8+i*3,a+dir*(29+i*10),y1+12+i*3,'#a82b43');}
      }else if(s.kind==='guillotine'){
        const a=dir>0?x:x+w,b=dir>0?x+w:x;
        P.line(ctx,a,y+4,b,y+h-8,'#70162c',6);P.line(ctx,a+dir*10,y+6,b,y+h-8,RED,3);P.line(ctx,a+dir*14,y+6,b,y+h-8,PALE);
        for(let i=0;i<5;i++){const xx=b-dir*(8+i*10);P.rect(ctx,xx,y+h-4-(i%2)*5,4,2,i%2?RED:PALE);}
      }else if(s.kind==='scalpel'){
        P.line(ctx,x,y+h/2,x+w,y+h/2,'#7b1831',8);P.line(ctx,x,y+h/2,x+w,y+h/2,RED,3);P.line(ctx,x+8,y+h/2-2,x+w-8,y+h/2-2,PALE);
      }else{
        const a=dir>0?x:x+w,b=dir>0?x+w:x,tip=y+(s.kind==='triple'?(s.segment%2?h*.15:h*.8):h*.65);
        P.line(ctx,a,y+h*.1,b,tip,color,s.kind==='cleave'?5:3);P.line(ctx,a+dir*8,y+h*.1,b,tip,PALE,2);
        P.line(ctx,b,tip,b-dir*w*.32,y+h*.9,color,2);
        for(let i=0;i<4;i++)P.line(ctx,b-dir*(i*9),tip+i*3,b-dir*(i*9+8),tip+i*3,color);
        if(s.tier===2)P.line(ctx,a,y+h*.8,b,tip,'#86f4ef',2);
      }
      ctx.restore();
    }
  }
  function drawDamageNumbers(){for(const n of damageNumbers){ctx.globalAlpha=n.life;ctx.fillStyle=n.strong?'#ffe0a1':PALE;ctx.font=(n.strong?'10':'8')+'px monospace';ctx.fillText(n.text,n.x,n.y);}ctx.globalAlpha=1;}
  function drawParticles(){for(const p of particles){
    if(p.sprite){EdenPresentation.drawCombatVFX(ctx,p);continue;}
    if(p.impact){const radius=p.impact*(1.2-p.life/.32);ctx.globalAlpha=clamp(p.life*10,0,1);for(let i=0;i<8;i++){const a=i*Math.PI/4;EdenPresentation.line(ctx,p.x+Math.cos(a)*3,p.y+Math.sin(a)*3,p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius,i%2?RED:PALE,i%2?1:2);}EdenPresentation.rect(ctx,p.x-2,p.y-2,5,5,PALE);}
    else{ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}
  }ctx.globalAlpha=1;}

  function bar(x,y,w,h,val,max,color){ctx.fillStyle='#060708';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#7f8586';ctx.strokeRect(x-.5,y-.5,w+1,h+1);ctx.fillStyle=color;ctx.fillRect(x+1,y+1,(w-2)*clamp(val/max,0,1),h-2);}
  function wrapped(text,x,y,width,lineHeight=13){let line='';for(const ch of text){if(ctx.measureText(line+ch).width>width){ctx.fillText(line,x,y);line=ch;y+=lineHeight;}else line+=ch;}ctx.fillText(line,x,y);return y;}
  function communications(){if(!dialogue)return;ctx.fillStyle='rgba(4,8,14,.97)';ctx.fillRect(25,167,430,85);ctx.strokeStyle='#657180';ctx.strokeRect(25.5,167.5,429,84);ctx.fillStyle=RED;ctx.fillRect(25,167,3,85);const [speaker,text]=dialogue[dialogueStep];ctx.fillStyle='#b5bfce';ctx.font='8px monospace';ctx.fillText(speaker,39,182);ctx.font='10px sans-serif';ctx.fillStyle=PALE;wrapped(text,39,201,402);ctx.font='7px monospace';ctx.fillStyle='#8c929f';ctx.fillText('ENTER / F — 다음 전송',39,241);}
  function drawExplore(){
    ctx.save();cameraKick();drawBackground(bossIndex);const P=EdenPresentation;
    if(room.section===0){P.plate(ctx,213,181,19,44);P.plate(ctx,204,167,36,23);P.rect(ctx,208,171,27,14,'#141b24');P.rect(ctx,210,174,21,1,RED);ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText(room.read?'ARCHIVED':'[F] 기록',202,159);}
    if(room.section===2){P.plate(ctx,405,132,50,94);P.line(ctx,430,140,430,218,RED,2);ctx.fillStyle=PALE;ctx.font='8px monospace';ctx.fillText('[F] 교전 준비',376,125);}
    for(const d of room.drones){if(player.duelMode&&P.drawSentry(ctx,d,player.x))continue;if(d.hp<=0){P.plate(ctx,d.x,217,22,7);continue;}ctx.save();ctx.translate(d.recoil||0,0);if(d.contactFlash>0)ctx.filter='brightness(1.6)';P.plate(ctx,d.x-4,d.y,28,17);P.rect(ctx,d.x,d.y+5,19,4,'#0b1019');P.rect(ctx,d.x+4,d.y+6,9,2,RED);for(let s of[-1,1]){P.line(ctx,d.x+10,d.y+7,d.x+10+s*22,d.y+4,'#768496',2);P.rect(ctx,d.x+7+s*22,d.y+6,6,2,RED);}if(d.t<.5){ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('!',d.x+7,d.y-6);}ctx.restore();}
    drawHazards();player.draw();drawSlashes();drawParticles();drawDamageNumbers();ctx.restore();if(psychic&&player.ultimateT>0)EdenPresentation.superCutin(ctx,player);drawHUD();
    ctx.fillStyle='#c2c7cf';ctx.font='8px sans-serif';ctx.fillText(BOSSES[bossIndex].zone+' / '+['기록 회랑','보안 격실','최종 접속'][room.section],player.duelMode?270:170,17,player.duelMode?200:310);
    ctx.fillStyle='#9ba6b4';ctx.font='6px monospace';ctx.fillText(player.duelMode?(psychic?'J 적중 → Q/W/E / Shift 회피 / F 접속':'J 적중 → Q 상승 / Shift 추진 / F 접속'):'J2 전진 · J3 밀기   J/K → Q → R   F 접속',204,264);
    drawMessages();if(paused)overlay('PAUSED','ESC — 계속 / M — 음소거');
  }
  function drawMessages(){for(const m of messages.slice(-1)){ctx.globalAlpha=clamp(m.life*3,0,1);ctx.fillStyle='#0a0d14';ctx.fillRect(40,61,400,23);ctx.fillStyle=PALE;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(m.text,W/2,76,390);ctx.globalAlpha=1;ctx.textAlign='left';}}
  function drawOverride(){
    if(player.weaponMode!=='crown'||player.attack<.54)return;
    ctx.fillStyle=RED;ctx.font='7px monospace';ctx.fillText(player.duelMode?'SCISSOR / LEG LOCK':'GUILLOTINE / LEG LOCK',clamp(player.x-20,10,345),player.y-16);
  }
  function statusHUD(){
    const P=EdenPresentation;
    ctx.fillStyle='rgba(5,8,13,.9)';ctx.fillRect(11,5,153,38);P.line(ctx,12,5,164,5,'#5e6878');P.line(ctx,12,42,164,42,'#303c4e');
    P.portrait(ctx,15,10);ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText('ZERO // 00',47,14);
    ctx.fillStyle='#94a2b8';ctx.font='6px monospace';ctx.fillText('CORE +'+upgrade,125,14);
    bar(47,19,107,6,player.hp,player.maxHp,RED);bar(47,30,84,4,player.sp,100,'#93a7c4');
    ctx.fillStyle='#a4b1c6';ctx.font='5px monospace';ctx.fillText(Math.ceil(player.hp)+' HP',134,35);
    if(boss&&!(psychic&&boss.phase===2&&boss.d.type==='surgeon'&&boss.tele>1.1)){
      ctx.fillStyle='rgba(5,8,13,.87)';ctx.fillRect(272,5,192,36);ctx.textAlign='right';ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText(psychic&&boss.phase===2?'SERAPH / THE FALSE DIVINITY':boss.d.id+' / '+boss.d.ko,458,14);
      bar(279,19,179,6,boss.hp,psychic&&boss.phase===2?boss.maxHp*.5:boss.maxHp,RED);ctx.fillStyle=boss.windup>0?RED:'#a9b4c4';ctx.font='6px monospace';ctx.fillText('PHASE '+boss.phase+' / '+(boss.operation?'OPERATION / 장치 파괴':boss.psiGuardWarn>0?'BRACE / 방어 준비':boss.psiGuard>0?'GUARD / 측면으로 이동':boss.windup>0?(boss.d.type==='surgeon'?(boss.breakLock>0?'CAST / 신경 잠금':(psychic?(boss.phase===2?(boss.seraphLocked?'CAST / 방향 고정':'CAST / 방향 추적'):'CAST / 공격 준비'):'CAST / 강화 Shift 절단')):'공격 준비'):psychic&&boss.phase===2&&(boss.release>0||boss.seraphDive||boss.seraphMove==='feathers'&&boss.recovery>.75)?'ATTACK / 공격 중':boss.recovery>0?'EXPOSED / 피해 +25%':'ACTIVE'),458,35);ctx.textAlign='left';
    }
    ['Q','W','E','R'].forEach((k,i)=>{
      const x=17+i*43,y=237,drive=i===0&&player.duelMode&&player.reverseDrive>0,ready=player.duelMode&&psychic?psychic.ready(i):player.duelMode?(i===3?player.superMeter>=100:player.cool[i]<=0&&player.sp>=[14,16,12][i]):(player.cool[i]<=0||(i===0&&player.linkWindow>0)||drive)&&player.sp>=[drive?12:24,30,24,55][i];
      ctx.fillStyle='rgba(7,11,18,.94)';ctx.fillRect(x,y,39,24);ctx.strokeStyle=ready?(i===3&&player.finishWindow>0?'#86f4ef':'#a4a7b1'):'#3d4553';ctx.strokeRect(x+.5,y+.5,38,23);
      const icon=ready?(i===0||i===3?RED:'#86f4ef'):'#5c6676';
      if(i===0)for(let j=0;j<3;j++)P.line(ctx,x+3+j*3,y+15,x+7+j*3,y+6,icon);
      if(i===1){P.line(ctx,x+3,y+11,x+12,y+11,icon,2);P.line(ctx,x+8,y+7,x+12,y+11,PALE);}
      if(i===2)for(let j=0;j<3;j++)P.rect(ctx,x+3+j*4,y+8-(j%2)*3,2,9+(j%2)*3,icon);
      if(i===3){P.line(ctx,x+4,y+5,x+4,y+13,icon,2);P.line(ctx,x+4,y+13,x+12,y+16,icon,2);P.line(ctx,x+7,y+5,x+7,y+11,PALE);}
      ctx.fillStyle=ready?PALE:'#7b8492';ctx.font='7px monospace';ctx.fillText(k,x+18,y+9);ctx.font='5px monospace';ctx.fillText(player.duelMode?(psychic?psychic.labels[i]:['RISE','RECOIL','HOOK','OVERDRIVE'][i]):['LAHAT','RAIL','PILE','GUIL'][i],x+14,y+16);
      ctx.fillStyle=ready?RED:'#444d5b';ctx.fillRect(x+3,y+20,33*(player.cool[i]>0?1-player.cool[i]/(player.duelMode&&psychic?psychic.cooldowns[i]:(player.duelMode?[.65,.9,.8,1]:[3.5,5,3,11])[i]):1),1);
      if(player.cool[i]>0&&!drive){ctx.fillStyle=PALE;ctx.font='6px monospace';ctx.fillText(player.cool[i].toFixed(1),x+21,y+10);}
    });
    ctx.fillStyle='#a9b7c9';ctx.font='7px sans-serif';ctx.fillText(player.duelMode?(psychic?'Shift 회피 / K 패링 → K 반격':'Shift 추진 / 뒤+Shift 회피 / K 패링'):'J/K → Q   Q 적중 → R   K 0.65초 / 절단',204,252);
  }
  function campaignTitle(){
    if(!EdenPresentation.titleBackground?.(ctx)){drawBackground(0);ctx.fillStyle=PALE;ctx.font='38px Georgia';ctx.fillText('EDEN',315,100);}
    ctx.fillStyle='rgba(4,6,10,.84)';ctx.fillRect(305,154,153,77);ctx.strokeStyle='rgba(164,145,151,.55)';ctx.strokeRect(305.5,154.5,152,76);ctx.fillStyle=RED;ctx.fillRect(306,155,2,75);
    const compact=canvas.clientWidth>0&&canvas.clientWidth<600,old=load(),items=old?[(old.complete?'엔딩 기록':'계속하기'),'새 작전']:['기동 / 새 작전'];items.forEach((s,i)=>{const y=176+i*23;if(i===menu){ctx.fillStyle='rgba(170,17,44,.28)';ctx.fillRect(312,y-(compact?15:12),138,compact?20:17);}ctx.fillStyle=i===menu?'#fff3ed':'#a4a8b2';ctx.font=(compact?'15':'11')+'px sans-serif';ctx.fillText((menu===i?'▸ ':'  ')+s,317,y,138);});
    ctx.fillStyle='#c3c6cc';ctx.font=(compact?'10':'7')+'px sans-serif';ctx.fillText(compact?'↓ 선택 / 시작 버튼':'↑ ↓ 선택  /  ENTER 접속  /  M 음소거',313,222,138);
  }
  function recordScreen(){
    drawBackground(Math.min(bossIndex,6));ctx.fillStyle='rgba(3,5,9,.89)';ctx.fillRect(0,0,W,H);
    const s=STORY[0];ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('TRANSMISSION / '+String(bossIndex+1).padStart(2,'0'),29,38);
    ctx.fillStyle=PALE;ctx.font='25px Georgia';ctx.fillText(s[0],28,74);ctx.font='10px sans-serif';wrapped(s[1],30,104,416);wrapped(s[2],30,125,416);
    for(let i=0;i<BOSSES.length;i++){const x=34+i*62;ctx.fillStyle=i<bossIndex?RED:i===bossIndex?PALE:'#354050';ctx.fillRect(x,168,38,2);ctx.font='6px monospace';ctx.fillText(BOSSES[i].id,x,183);ctx.fillText(i<bossIndex?'CLEARED':i===bossIndex?'TARGET':'LOCKED',x,196);}
    ctx.fillStyle='#9ba6b6';ctx.font='8px sans-serif';ctx.fillText('코어 강화 +'+upgrade+'  /  회수 기록 '+archiveCount+'  /  ENTER — 구역 진입',30,233);
  }
  function drawHUD(){statusHUD();
    if(player.duelMode){bar(280,46,170,4,player.superMeter,100,player.superMeter>=100?'#eee8df':RED);ctx.fillStyle=PALE;ctx.font='6px monospace';ctx.fillText((psychic?'R / ZERO POINT ':'R / OVERDRIVE ')+Math.floor(player.superMeter)+'%',280,43);ctx.fillStyle=player.reverseDrive||psychic&&boss?.psiCompression>0?'#86f4ef':'#a9b4c4';ctx.font='6px sans-serif';ctx.fillText(player.reverseDrive?'REVERSE DRIVE / Shift 강화 추진':(psychic?'Q 충격 · W 파편 난무 · E 근접 폭발':'Q 적중 → 공중 J / W 적중 → Shift 재추진'),22,53);}

    if(boss?.operation&&!boss.dead){ctx.fillStyle='#10151d';ctx.fillRect(126,43,228,15);ctx.fillStyle='#ffc67a';ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillText('수술 장치 '+boss.operation.nodes.filter(n=>n.hp>0).length+'개 / '+boss.operation.time.toFixed(1)+'초 — 파괴 또는 점프',240,53);ctx.textAlign='left';}
    if(boss?.d.type==='surgeon'&&(boss.retreat||boss.anchorTime>0)&&!boss.dead){ctx.fillStyle='#86f4ef';ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillText(boss.anchorTime>0?(boss.recovery>0&&boss.release<=0&&boss.windup<=0&&!boss.protocol&&!(boss.breakLock>0)?'Q / 관절 파괴 기회':'HEEL HOOK / 봉합 이동 고정'):'SUTURE STEP / 추격 · E로 이동 고정',240,53);ctx.textAlign='left';}
    if(boss?.d.type==='surgeon'&&boss.protocol&&!boss.dead){
      const p=boss.protocol;ctx.fillStyle='#10151d';ctx.fillRect(134,43,212,15);
      ctx.fillStyle=p.wave===2?'#86f4ef':'#ffc67a';ctx.font='7px sans-serif';ctx.textAlign='center';
      ctx.fillText(p.wave<2?'신경 봉합 '+(p.wave+1)+'/2 — 표식 밖으로 이동':'최종 절개 — 점프 · 회피 · 정면 K',240,53);ctx.textAlign='left';
    }

    if(player.comboT>0&&player.combo>0){ctx.fillStyle='#0b111b';ctx.fillRect(176,7,80,28);ctx.fillStyle=PALE;ctx.font='6px monospace';ctx.fillText(['J1 / CHECK','J2 / STEP','J3 / PUSH'][player.combo-1],181,16);for(let i=0;i<3;i++){ctx.fillStyle=i<player.combo?(i===2?'#86f4ef':RED):'#3a4351';ctx.fillRect(181+i*23,21,19,3);}ctx.fillStyle='#8c9bad';ctx.fillRect(181,29,65*clamp(player.comboT/.85,0,1),1);}
  }

  function combatCinema(){
    if(chain>1&&!boss.dead){ctx.textAlign='right';ctx.fillStyle=chain>=10?'#7de6ed':PALE;ctx.font='20px monospace';ctx.fillText(String(chain).padStart(2,'0'),458,105);ctx.font='6px monospace';ctx.fillText(chain>=10?'NEURAL SYNC':'HIT CHAIN',458,116);ctx.fillRect(413,122,45*chainTimer/2.4,2);ctx.textAlign='left';}
    if(!boss.dead)return;
    const t=boss.deathAge,open=clamp(t*3,0,1);ctx.fillStyle='rgba(3,5,9,.94)';ctx.fillRect(0,0,W,30*open);ctx.fillRect(0,H-37*open,W,37*open);
    ctx.strokeStyle=RED;ctx.strokeRect(boss.x-8-t*16,boss.y-8-t*8,boss.w+16+t*32,boss.h+16+t*16);
    if(t>.35){ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='18px monospace';ctx.fillText('COMMAND SEVERED',240,25);ctx.fillStyle='#aab8c9';ctx.font='8px monospace';ctx.fillText('BEST CHAIN '+bestChain+'   /   '+battleSeconds.toFixed(1)+' SEC   /   CORE RECOVERED',240,254);ctx.textAlign='left';}
  }

  function renderCombat(){
    ctx.save();cameraKick();const changing=psychic&&boss.phase===2&&boss.tele>0&&!boss.dead;
    if(changing){const elapsed=7-boss.tele,focus=clamp(boss.x+21,130,350),zoom=elapsed<1.2?1.12:elapsed<5.7?1.12-.25*clamp((elapsed-1.2)/4.5,0,1):.87+.13*clamp((elapsed-5.7)/1.3,0,1);ctx.translate(focus,160);ctx.scale(zoom,zoom);ctx.translate(-focus,-160);}
    else if(psychic&&boss.phase===2&&boss.seraphMove==='final'&&!boss.dead&&(boss.windup>0&&boss.windup<.5||boss.release>0)){
      const punch=boss.windup>0?1-boss.windup/.5:boss.release/.4,z=1+.11*clamp(punch,0,1),focus=clamp(boss.x+21,130,350);ctx.translate(focus,155);ctx.scale(z,z);ctx.translate(-focus,-155);
    }
    else if(player.ultimateT>0&&!boss.dead){const z=1+(psychic?.06:.09)*Math.sin(Math.PI*(1-player.ultimateT/(player.ultimateDuration||.82))),focus=clamp((player.x+boss.x)/2,180,300);ctx.translate(focus,170);ctx.scale(z,z);ctx.translate(-focus,-170);}
    drawBackground(bossIndex);if(changing){ctx.fillStyle='rgba(3,5,10,.26)';ctx.fillRect(0,0,W,H);}else if(player.ultimateT>0&&!boss.dead){ctx.fillStyle=psychic?'rgba(3,5,10,.18)':'rgba(3,5,10,.5)';ctx.fillRect(0,0,W,H);}
    for(const e of echoes){ctx.globalAlpha=e.life*2;EdenPresentation.drawZero(ctx,{...player,x:e.x,y:e.y,face:e.face,onGround:e.onGround,inv:0,stun:0,charging:false,parryFlash:0,attack:0,dash:.01,vx:e.face*132},time);}ctx.globalAlpha=1;
    drawHazards();
    if(psychic&&boss.phase===2&&!boss.dead&&(boss.seraphDive||boss.seraphMove==='final'&&boss.windup>0&&boss.windup<.5)){ctx.save();ctx.globalAlpha=.16;for(const i of [1,2])EdenPresentation.boss(ctx,{...boss,x:boss.x-boss.dir*i*5,y:boss.y+i*2},time-i*.07);ctx.restore();}
    boss.draw();player.draw();drawSlashes();drawParticles();drawDamageNumbers();ctx.globalAlpha=1;ctx.restore();
    if(psychic&&player.ultimateT>0&&!boss.dead&&!changing)EdenPresentation.superCutin(ctx,player);drawHUD();drawMessages();drawOverride();
    if(changing&&EdenPresentation.seraphStatus&&EdenPresentation.seraphStatus!=='ready'){ctx.save();ctx.fillStyle='rgba(5,7,12,.88)';ctx.fillRect(60,100,360,28);ctx.fillStyle=PALE;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(EdenPresentation.seraphStatus==='failed'?'SERAPH 이미지 로딩 실패 — 새로고침해 주세요':'SERAPH 이미지 불러오는 중…',240,118);ctx.restore();}
    else if(changing&&boss.tele<1.5){ctx.save();ctx.globalAlpha=Math.min(1,(1.5-boss.tele)*2,boss.tele*2);ctx.fillStyle='rgba(5,7,12,.82)';ctx.fillRect(0,86,480,45);ctx.fillStyle=PALE;ctx.textAlign='center';ctx.font='18px Georgia';ctx.fillText('SERAPH',240,105);ctx.font='8px monospace';ctx.fillStyle=RED;ctx.fillText('THE FALSE DIVINITY',240,119);ctx.restore();}
    else if(boss.tele>0&&!changing){ctx.fillStyle='rgba(5,7,12,.8)';ctx.fillRect(0,95,480,32);ctx.fillStyle=RED;ctx.font='13px monospace';ctx.textAlign='center';ctx.fillText('PHASE II / 신경 제한 해제',240,115);ctx.textAlign='left';}
    if(paused)overlay('PAUSED','ESC — 계속 / M — 음소거');
  }
  function overlay(title,sub){ctx.fillStyle='rgba(3,4,5,.82)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='22px Georgia';ctx.fillText(title,W/2,120);ctx.fillStyle='#8b9092';ctx.font='8px monospace';ctx.fillText(sub,W/2,140);ctx.textAlign='left';}
  function titleScreen(){campaignTitle();}
  function storyScreen(){recordScreen();}
  function introScreen(){
    drawBackground(bossIndex);boss.draw();player.draw();
    ctx.fillStyle='rgba(3,5,9,.86)';ctx.fillRect(0,0,290,H);
    ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('BOSS '+String(bossIndex+1).padStart(2,'0')+' // '+boss.d.zone,22,39);
    ctx.fillStyle=PALE;ctx.font='30px Georgia';ctx.fillText(boss.d.id,21,79);ctx.font='11px sans-serif';ctx.fillText(boss.d.ko,23,101);
    ctx.fillStyle='#b6becb';ctx.font='10px sans-serif';boss.d.intro.split('\n').forEach((l,i)=>wrapped(l,23,135+i*17,248));
    ctx.fillStyle='#8592a8';ctx.font='9px sans-serif';wrapped(TACTICS[bossIndex],23,184,248,14);
    ctx.fillStyle=PALE;ctx.font='8px monospace';ctx.fillText('ENTER — 교전 개시',23,238);
  }
  function endingScreen(){drawBackground(0);ctx.fillStyle='rgba(2,3,4,.72)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='30px Georgia';ctx.fillText('SURGEON // CLEARED',W/2,75);ctx.fillStyle=RED;ctx.fillRect(145,88,190,1);ctx.fillStyle='#b5b7b6';ctx.font='10px sans-serif';ctx.fillText('수술 성당의 집도의가 쓰러졌다.',W/2,124);ctx.fillText('첫 구간 완료 — 다음 스테이지는 없습니다.',W/2,144);ctx.fillStyle='#666';ctx.font='7px monospace';ctx.fillText('ENTER — 타이틀로 / 기록 유지',W/2,216);ctx.textAlign='left';}

  function update(dt){
    if(pressed.has('m'))audio.muted=!audio.muted;
    if(pressed.has('escape')&&(state==='combat'||state==='explore')){paused=!paused;player.charging=false;player.charge=0;player.buffer=null;player.pendingJump=false;}
    if(paused)return;
    audio.tick(dt,Math.min(6,bossIndex),state==='combat',boss?.phase||1);
    if(dialogue){if(pressed.has('enter')||pressed.has('f')){dialogueStep++;if(dialogueStep>=dialogue.length)dialogue=null;}return;}
    time+=dt;shake=Math.max(0,shake-dt*28);flash=Math.max(0,flash-dt);invertFlash=Math.max(0,invertFlash-dt);
    settleFeedback(dt);
    // Capture before hitstop returns: one deliberate input, never an auto-repeat chain.
    if((state==='combat'||state==='explore')&&player.hp>0&&player.stun<=0&&!boss?.dead){
      if(pressed.has(' ')||pressed.has('space')||pressed.has('arrowup'))player.pendingJump=true;
      for(const key of ['j','k','q','w','e','r','shift'])if(pressed.has(key)&&(!player.charging||key==='shift'||player.parryFollow>0||psychic&&key==='k'&&player.parryWindow>0))player.buffer={key,ttl:.22,counterIntent:!!(psychic&&key==='k'&&player.charging&&player.parryWindow>0),parry:key==='k'&&state==='combat'&&bossIndex===0&&boss?.d.type==='surgeon'&&player.attack<=0&&player.dash<=0&&player.stun<=0&&player.inv<=0&&player.onGround&&!player.charging};
    }
    if(hitstop>=dt){hitstop-=dt;return;}
    if(hitstop>0){dt-=hitstop;hitstop=0;}
    if(state==='title'){const max=load()?1:0;if(pressed.has('arrowup')||pressed.has('w'))menu=Math.max(0,menu-1);if(pressed.has('arrowdown')||pressed.has('s'))menu=Math.min(max,menu+1);if(pressed.has('enter')){const old=load();if(old&&menu===0){bossIndex=0;upgrade=Number(old.upgrade)||0;augments=[0,1,2].map(i=>clamp(Math.floor(Number(old.augments?.[i])||0),0,6));archiveCount=Number(old.archives)||0;defeatCount=Number(old.defeats)||0;recoveredRecords=new Set(Array.isArray(old.records)?old.records:[]);if(old.complete)state='ending';else if(old.stage==='boss')startBoss();else startExplore();}else{clearSave();bossIndex=0;augments=[0,0,0];upgrade=archiveCount=defeatCount=0;recoveredRecords=new Set();checkpointStage='explore';state='interlude';}}}
    else if(state==='interlude'&&pressed.has('enter')){startExplore();dialogue=COMMS[bossIndex];dialogueStep=0;}
    else if(state==='intro'){boss.anim+=dt;if(pressed.has('enter')){state='combat';boss.inv=.8;message('ENGAGE // 명령을 넘어선다',1.2);}}
    else if(state==='combat')updateCombat(dt);
    else if(state==='explore')updateExplore(dt);
    else if(state==='gameover'&&pressed.has('enter')){if(checkpointStage==='boss')startBoss();else startExplore();}
    else if(state==='ending'&&pressed.has('enter')){menu=0;state='title';}
  }
  function render(){ctx.save();if(state==='title')titleScreen();else if(state==='interlude')storyScreen();else if(state==='intro')introScreen();else if(state==='combat'){renderCombat();combatCinema();}else if(state==='explore')drawExplore();else if(state==='gameover'){if(boss)renderCombat();else drawExplore();overlay('SYSTEM FAILURE','ENTER — 체크포인트 재기동');}else if(state==='ending')endingScreen();communications();ctx.restore();if(invertFlash){ctx.save();ctx.globalCompositeOperation='difference';ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.restore();}if(flash){ctx.fillStyle=`rgba(255,255,255,${flash*2})`;ctx.fillRect(0,0,W,H);}ctx.fillStyle='rgba(255,255,255,.018)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);}

  function controlHints(){
    for(const [key,label] of Object.entries(player.duelMode?(psychic?{k:'패링 K',shift:'회피 이동 Shift',q:'염동 충격 Q',w:'염동 난무 W',e:'염동 폭발 E',r:'초염동 폭쇄 R'}:{k:'패링 K',shift:'추진 / 회피 Shift',q:'상승 Q',w:'반동 사격 W',e:'뒤꿈치 걸기 E',r:'궁극기 R'}):{k:'차징 K (길게)',shift:'회피',q:'기술 Q',w:'기술 W',e:'기술 E',r:'기술 R'})){
      const button=document.querySelector('[data-key="'+key+'"]');if(button&&button.textContent!==label)button.textContent=label;
    }

    const label=paused?'계속하기':dialogue?'대사 다음':({title:'시작 / 이어하기',interlude:'구역 진입',intro:'전투 시작',gameover:'재도전',ending:'타이틀로'})[state]||'진행';
    if(nextButton.textContent!==label)nextButton.textContent=label;
    const text=paused?'일시정지 중 — 계속하기를 누르세요.':dialogue?'통신 중 — 대사 다음을 누르면 이동할 수 있습니다.':state==='explore'||state==='combat'?'A/D 또는 ←/→ 이동 · 아래 버튼을 길게 눌러도 이동합니다.':'시작·진행 버튼 또는 Enter를 눌러주세요.';
    if(controlStatus.textContent!==text)controlStatus.textContent=text;
  }

  const psychic=globalThis.EdenPsychic?.install({Fighter,Boss,player,pressed,fx:spriteEffect,sound:audio,message,
    clearHostile(){hazards=hazards.filter(h=>h.owner!=='b');slashes=slashes.filter(s=>s.owner!=='b');},
    get boss(){return boss;},
    slash:s=>slashes.push(s),projectile:h=>hazards.push(h),invert:t=>{invertFlash=Math.max(invertFlash,t);},cancel(){slashes=slashes.filter(s=>s.owner!=='p'||s.delay<=0&&!s.attached);hazards=hazards.filter(h=>h.owner!=='p'||h.delay<=0);echoes=[];},
    stop(t,s){hitstop=Math.max(hitstop,t);shake=Math.max(shake,s);},
    damage(target,n,interrupt){if(target.d)target.hurt(n,interrupt);else{const damage=Math.round(n*(1+upgrade*.08+augments[0]*.12));target.hp-=damage;contactFeedback(target,n,damage);}}
  });
  let last=performance.now();function loop(now){const dt=Math.max(0,Math.min(.033,(now-last)/1000));last=now;update(dt);render();controlHints();pressed.clear();requestAnimationFrame(loop);}
  const boot=document.querySelector('#boot'),controls=document.querySelectorAll('[data-key]');
  if(EdenPresentation.ready){
    controls.forEach(button=>button.disabled=true);
    EdenPresentation.ready.then(loaded=>{
      if(!loaded){boot.textContent='이미지를 불러오지 못했습니다. 새로고침해 주세요.';controlStatus.textContent='이미지 로딩 실패';return;}
      releaseInputs();controls.forEach(button=>button.disabled=false);last=performance.now();render();controlHints();boot.classList.add('ready');requestAnimationFrame(loop);
    });
  }else{requestAnimationFrame(loop);boot.classList.add('ready');}
})();
