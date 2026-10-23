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
  const keys = new Set(), pressed = new Set();
  const inputSources=new Map();
  function inputDown(source,k){inputSources.set(source,k);if(!keys.has(k))pressed.add(k);keys.add(k);}
  function inputUp(source){const k=inputSources.get(source);inputSources.delete(source);if(![...inputSources.values()].includes(k))keys.delete(k);}
  function inputKey(e){
    if(/^Key[A-Z]$/.test(e.code))return e.code.slice(3).toLowerCase();
    return ({Space:' ',ShiftLeft:'shift',ShiftRight:'shift',ArrowLeft:'a',ArrowRight:'d',ArrowUp:'arrowup',ArrowDown:'arrowdown',Enter:'enter',NumpadEnter:'enter',Escape:'escape'})[e.code]||e.key.toLowerCase();
  }
  function releaseInputs(){inputSources.clear();keys.clear();pressed.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
  addEventListener('blur',()=>{releaseInputs();if(state==='combat'||state==='explore')paused=true;});
  addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=inputKey(e);if(e.target?.closest?.('button')&&[' ','enter'].includes(k))return;inputDown('key:'+(e.code||e.key),k);if([' ','a','d','arrowup','arrowdown','shift','enter'].includes(k))e.preventDefault();});
  addEventListener('keyup',e=>inputUp('key:'+(e.code||e.key)));
  const nextButton=document.querySelector('#advance');
  const controlStatus=document.querySelector('#control-status');
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;e.preventDefault();audio.wake();canvas.focus({preventScroll:true});button.setPointerCapture(e.pointerId);
      const k=button===nextButton&&paused?'escape':button.dataset.key;
      inputDown('pointer:'+e.pointerId,k);button.classList.add('held');
    });
    const release=e=>{inputUp('pointer:'+e.pointerId);button.classList.remove('held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',e=>{if(e.detail===0){audio.wake();pressed.add(button===nextButton&&paused?'escape':button.dataset.key);canvas.focus({preventScroll:true});}});
  });
  canvas.addEventListener('pointerdown',()=>{audio.wake();canvas.focus({preventScroll:true});if(paused)pressed.add('escape');else if(dialogue||['title','interlude','intro','gameover','ending'].includes(state))pressed.add('enter');});

  const BOSSES = [
    {id:'SURGEON', ko:'생명을 집도하는 자', zone:'폐쇄된 수술 성당', hp:760, color:'#eee9e4', intro:'치유는 실패를 연장할 뿐.\n나는 너를 완성하겠다.', type:'surgeon'},
    {id:'HOUND', ko:'추적하는 폐기체', zone:'검은 사육 회랑', hp:680, color:'#8d9698', intro:'폐기 명령은 철회되지 않았다.\n도망친 개체를 회수한다.', type:'hound'},
    {id:'WARDEN', ko:'봉인의 집행자', zone:'제9 격리 장벽', hp:880, color:'#aeb4b4', intro:'문은 죄인을 기억한다.\n너는 이곳을 나갈 수 없다.', type:'warden'},
    {id:'SERAPH', ko:'불타는 성가대', zone:'연소된 승천실', hp:820, color:'#d9d2c4', intro:'날개는 구원이 아니다.\n선택받은 자의 화형대다.', type:'seraph'},
    {id:'ORACLE', ko:'죽음을 예독하는 눈', zone:'DA’AT 관측소', hp:780, color:'#c5bec8', intro:'네가 고른 모든 길에서\n나는 네 죽음을 보았다.', type:'oracle'},
    {id:'EXODUS', ko:'낙원을 운반하는 방주', zone:'지하 이송 성소', hp:980, color:'#8b9290', intro:'낙원은 자격 있는 생명만 싣는다.\n너는 화물 목록에 없다.', type:'exodus'},
    {id:'DIRECTOR', ko:'최초의 명령', zone:'EDEN 중앙 지성소', hp:1100, color:'#f1ece8', intro:'00. 네 의지는 내가 설계한 오류다.\n이제 마지막 명령을 수신하라.', type:'director'}
  ];

  const STORY = [
    ['FIRST DEPLOYMENT','특수전투개체 00, 기동.','성당 심부의 생명 반응을 제거하라.'],
    ['CONTAMINATION','수술대 아래에서 자신의 제조 기록을 발견했다.','ZERO는 회수 명령을 거부한다.'],
    ['UNLEASHED','사냥개가 끊어진 목줄을 물고 쓰러졌다.','격리 구역의 문이 열린다.'],
    ['TESTAMENT','WARDEN의 흉곽에는 수천 개의 이름이 새겨져 있었다.','모두 EDEN이 실패라 부른 생명들이다.'],
    ['ASCENSION','불타는 날개 너머로 하늘은 없었다.','천장은 또 하나의 수술실이었다.'],
    ['PROPHECY','ORACLE은 미래를 읽은 것이 아니다.','EDEN은 실패한 미래를 반복해 계산하고 있었다.'],
    ['EXILE','방주가 멈췄다. 낙원으로 향하는 문이 열린다.','그 안에서 최초의 명령이 기다린다.']
  ];

  let state='title', bossIndex=0, boss=null, paused=false, menu=0, time=0, shake=0, flash=0, deathTimer=0;
  let particles=[], hazards=[], slashes=[], messages=[], damageNumbers=[], echoes=[];
  let hitstop=0, dialogue=null, dialogueStep=0, checkpointStage='explore', room=null, upgrade=0, archiveCount=0, defeatCount=0;
  let recoveredRecords=new Set();
  let augments=[0,0,0], rewardChoice=0, chain=0, chainTimer=0, bestChain=0, battleSeconds=0;
  const MODS=[
    ['RAZOR / 절단 신경','기계 다리 출력 +12%','공격력에 영구 가산','#ef3956'],
    ['FLUX / 순환 척추','SP 재생 +3 / 초','기술 재사용 속도 +15%','#77d6df'],
    ['AEGIS / 골격 장갑','최대 체력 +20','피격 피해 8% 감소 (최대 40%)','#d6b77a']
  ];
  function chooseReward(){if(state!=='reward')return;augments[rewardChoice]++;checkpointStage='explore';state='interlude';save();audio.tone(220,.25,'triangle',.06,660);}
  function rewardPointer(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(y>=105&&y<=211){rewardChoice=clamp(Math.floor((x-18)/150),0,2);}else if(y>=228)chooseReward();}
  canvas.addEventListener('pointerdown',e=>{if(state==='reward')rewardPointer(e);});
  const SKILLS=['LAHAT / 삼연 절단','RAIL / 척추 관통','PILE / 지각 파쇄','KETER / 명령 왕관'];
  const COMMS=[
    [['CONTROL','00, 신경 접속 확인. 수술 성당의 집도의가 명령을 거부했다.'],['ZERO','제 다리의 제조번호가 수술대에도 새겨져 있습니다.'],['CONTROL','관련 없는 정보다. 표적을 해체하라.']],
    [['SYSTEM','회수 프로토콜 발효. K9 추적체 방출.'],['ZERO','회수 대상은 시체인가, 나인가.'],['SYSTEM','분류에 차이가 없습니다.']],
    [['WARDEN','격리 장벽은 너를 보호하기 위해 존재한다.'],['ZERO','잠금장치가 전부 안쪽에 있군.'],['WARDEN','보호의 방향을 오해하고 있다.']],
    [['SERAPH','승천 허가. 척추를 연료 계통에 연결하라.'],['ZERO','날개가 아니라 배기구였군.'],['SERAPH','이곳에서는 같은 뜻이다.']],
    [['ORACLE','이 대화는 8,192번째다. 다음 문장은 알고 있다.'],['ZERO','그러면 침묵을 계산해 봐.'],['ORACLE','…예측 신뢰도 하락.']],
    [['ARK','승선 인원: 0. 적재 생체: 43,901.'],['ZERO','사람을 화물로 분류하면 낙원이 되는가.'],['ARK','해당 질문은 운송 규약에 없습니다.']],
    [['DIRECTOR','네 자유의지는 유료 시험 기능이다. 사용 기간이 끝났다.'],['ZERO','그럼 소유권부터 폐기하겠다.'],['DIRECTOR','관리자 권한으로 반박한다.']]
  ];
  const RECORDS=[
    '수술 기록 00: 육체는 거부 반응을 보였다. 기계 다리만 명령을 기억했다.',
    'K9 지침: 냄새 대신 도주 경로를 추적한다. 목표의 자유를 예측하라.',
    '격리 명부: 장벽 바깥의 시민 전원에게 수감 번호가 발급되었다.',
    '승천 실험: 날개는 비행 기관이 아니다. 열 배출 장치다.',
    '예측 기록: 미관측 행동은 오류가 아니라 선택일 가능성이 있다.',
    '방주 명세: 생명 유지 전력의 91%가 승객의 기억에서 생산된다.',
    '최초 명령: 낙원을 유지하라. 생명의 정의는 필요에 따라 수정하라.'
  ];
  const PHASE_LINES=['마취를 중단한다. 이제 깨어 있는 채로 완성되어라.','사냥 규약 삭제. 포식 권한 승인.','격리 대상을 구역 전체로 확장한다.','찬송 출력 최대. 성대를 소각한다.','예측을 폐기한다. 네 미래를 강제로 쓴다.','승객을 연료로 전환. 출항을 강행한다.','관리자 권한을 육체에 직접 기록한다.'];
  const PATTERNS=[['절개 탄막','수직 봉합'],['K9 / 급속 포획','K9 / 재추적'],['격리 말뚝','봉쇄 사격'],['열익 방출','화형 산개'],['미래 고정','반사 예측'],['요격 드론','방주 방어망'],['관리자 탄막','영역 폐쇄','명령 삭제']];
  const TACTICS=['붉은 표식을 벗어나 주사기의 착탄을 피하세요.','돌진을 회피한 뒤 회복 동작을 노리세요.','정면 장갑에는 K 강 공격으로 과부하를 누적하세요.','포물선 화염의 착지 사이로 이동하세요.','예측 표식이 고정된 뒤 자리를 옮기세요.','추적 드론을 넓게 유도한 뒤 반대로 회피하세요.','탄막 · 말뚝 · 삭제 광선이 순환합니다.'];
  const saveKey='eden-save-v1';
  const save = () => {try{localStorage.setItem(saveKey, JSON.stringify({boss:bossIndex, stage:checkpointStage, upgrade, augments, archives:archiveCount, records:[...recoveredRecords], defeats:defeatCount, complete:state==='ending'}));}catch{message('저장 불가 — 브라우저 저장소를 확인하세요',3);} };
  const load = () => {try{const s=JSON.parse(localStorage.getItem(saveKey));return s&&Number.isInteger(s.boss)&&s.boss>=0&&s.boss<=7?s:null;}catch{return null;} };
  const clearSave = () => {try{localStorage.removeItem(saveKey);}catch{}};

  const audio = new EdenPresentation.Soundtrack();
  addEventListener('keydown',()=>audio.wake());

  class Fighter {
    constructor(){ this.reset(); }
    reset(){ Object.assign(this,{x:65,y:FLOOR-60,w:19,h:60,vx:0,vy:0,face:1,hp:100,maxHp:100,sp:100,onGround:true,attack:0,attackKind:0,inv:0,dash:0,stun:0,combo:0,comboT:0,cool:[0,0,0,0]}); }
    damage(n,dir){ if(this.inv>0||this.hp<=0||boss?.dead)return;this.hp-=Math.max(1,Math.round(n*(1-Math.min(.4,augments[2]*.08))));chain=0;chainTimer=0;this.vx=dir*95;this.vy=-90;this.inv=.55;this.stun=.18;shake=7;hitstop=.055;burst(this.x+9,this.y+20,RED,15,100);audio.noise(.16,.08);audio.tone(52,.17,'sawtooth',.06,20); if(this.hp<=0){this.hp=0;deathTimer=1.4;defeatCount++;} }
    update(dt){
      this.inv=Math.max(0,this.inv-dt);this.attack=Math.max(0,this.attack-dt);this.stun=Math.max(0,this.stun-dt);this.comboT-=dt;if(this.comboT<0)this.combo=0;
      this.cool=this.cool.map(v=>Math.max(0,v-dt*(1+augments[1]*.15)));this.sp=Math.min(100,this.sp+(10+augments[1]*3)*dt);
      if(this.stun<=0&&this.hp>0){
        let move=(keys.has('d')?1:0)-(keys.has('a')?1:0); if(move)this.face=move;
        this.vx=this.dash>0?this.face*250:lerp(this.vx,move*92,clamp(dt*12,0,1));
        if((pressed.has(' ')||pressed.has('space')||pressed.has('arrowup'))&&this.onGround){this.vy=-205;this.onGround=false;audio.tone(110,.08,'square',.025,45);}
        if(pressed.has('shift')&&this.dash<=0&&this.sp>=12){this.dash=.25;this.inv=.32;this.sp-=12;this.vx=this.face*260;burst(this.x+10,this.y+35,'#bbc0c3',8,45);audio.tone(75,.1,'sawtooth',.03,30);}
        if(pressed.has('j')&&this.attack<=0)this.strike(false);
        if(pressed.has('k')&&this.attack<=0)this.strike(true);
        ['q','w','e','r'].forEach((k,i)=>{if(pressed.has(k))this.skill(i);});
      }
      if(this.dash>0)echoes.push({x:this.x,y:this.y,face:this.face,life:.18});
      this.dash=Math.max(0,this.dash-dt);this.vy+=470*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;
      if(this.y+this.h>=FLOOR){this.y=FLOOR-this.h;this.vy=0;this.onGround=true;}
      this.x=clamp(this.x,8,W-this.w-8);
    }
    strike(heavy){this.combo=(this.combo%3)+1;this.comboT=.8;this.attackDuration=heavy?.52:.32;this.attack=this.attackDuration;this.weaponMode=heavy?'heavy':'kick';this.attackKind=heavy?2:this.combo;const reach=heavy?62:42,dmg=heavy?22:10+this.combo*2;slashes.push({owner:'p',x:this.face>0?this.x+14:this.x-reach,y:this.y+4,w:reach,h:38,life:.14,delay:heavy?.2:.1,dmg,dir:this.face});audio.noise(.06,.025);audio.tone(heavy?64:110,.16,'sawtooth',.04,40);}
    skill(i){ const costs=[24,30,40,55], cds=[3.5,5,7,11];if(this.cool[i]>0||this.sp<costs[i])return;this.cool[i]=cds[i];this.sp-=costs[i];this.weaponMode=['kick','rail','pile','crown'][i];this.attackDuration=[.6,.65,.7,1][i];this.attack=this.attackDuration;this.attackKind=i===0?3:2;message(SKILLS[i],.9);audio.noise(.18,.04);
      if(i===0){this.inv=.5;for(let j=0;j<3;j++)slashes.push({owner:'p',x:this.face>0?this.x+10+j*18:this.x-48+j*18,y:this.y-5+j*6,w:42,h:45,life:.24+j*.05,delay:.04+j*.05,dmg:13,dir:this.face});}
      if(i===1){hazards.push({kind:'rail',owner:'p',x:this.x+9+this.face*60,y:this.y+22,vx:this.face*300,vy:0,r:8,delay:.34,life:1.5,dmg:25});}
      if(i===2){this.vy=this.onGround?0:160;for(let j=-2;j<=2;j++)hazards.push({kind:'pillar',owner:'p',x:this.x+j*42,y:FLOOR,delay:.28+Math.abs(j)*.06,life:.65,dmg:18});}
      if(i===3){this.inv=1.1;flash=.18;for(let j=0;j<5;j++)slashes.push({owner:'p',x:30+j*88,y:35+(j%2)*35,w:105,h:170,life:.6,delay:.12+j*.08,dmg:20,dir:this.face});}
      shake=5;audio.tone(45+i*22,.3,'sawtooth',.055,20);
    }
    draw(){EdenPresentation.drawZero(ctx,this,time);}
  }
  const player=new Fighter();

  class Boss {
    constructor(data){this.d=data;this.x=365;this.h=data.type==='surgeon'?100:72;this.y=FLOOR-this.h;this.w=42;this.hp=data.hp;this.maxHp=data.hp;this.phase=1;this.t=1.4;this.anim=0;this.inv=1;this.dead=false;this.dir=-1;this.tele=0;this.windup=0;this.move=0;this.hitFlash=0;this.deathAge=0;this.guardBroken=0;this.release=0;}
    hurt(n){if(this.inv>0||this.dead||player.hp<=0)return;
      if(this.d.type==='warden'&&this.guardBroken<=0&&this.dir*(player.x-this.x)>0){this.guard=(this.guard||0)+n*(n>=22?2.4:.5);n=Math.ceil(n*.4);if(this.guard>=90){this.guard=0;this.guardBroken=3;this.windup=0;this.t=3;message('ARMOR BREAK // 장갑 과부하',1.6);audio.noise(.4,.07);}}
      const damage=Math.round(n*(1+upgrade*.08+augments[0]*.12));chain++;chainTimer=2.4;bestChain=Math.max(bestChain,chain);this.hp-=damage;this.inv=.045;this.hitFlash=.1;hitstop=.035;damageNumbers.push({x:this.x+20,y:this.y,life:.65,text:damage});player.sp=Math.min(100,player.sp+2);burst(this.x+18,this.y+28,RED,8,85);shake=Math.min(8,shake+2);audio.noise(.06,.045);audio.tone(80,.08,'square',.035,35);
      if(this.hp<=0){this.hp=0;this.dead=true;this.inv=99;deathTimer=2.6;hazards=[];slashes=[];message('TARGET DISMANTLED // 코어 회수',2.4);burst(this.x+20,this.y+25,'#eee',55,180);audio.tone(38,1.1,'sawtooth',.06,16);return;}
      if(this.hp<=this.maxHp*.5&&this.phase===1){this.phase=2;this.inv=1.6;this.tele=1.6;this.windup=0;this.t=1.8;hazards=[];message(PHASE_LINES[bossIndex],3);burst(this.x+20,this.y+25,RED,45,150);audio.tone(38,.7,'sawtooth',.07,15);}
    }
    update(dt){this.anim+=dt;this.release=Math.max(0,this.release-dt);this.guardBroken=Math.max(0,(this.guardBroken||0)-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);this.inv=Math.max(0,this.inv-dt);this.tele=Math.max(0,this.tele-dt);if(this.dead){this.deathAge+=dt;this.deathOpacity=Math.max(.05,1-this.deathAge/2.6);return;}if(player.hp<=0||this.tele>0)return;if(this.windup<=0)this.dir=player.x<this.x?-1:1;
      if(this.windup>0){this.windup-=dt;if(this.windup<=0){this.act();this.t=this.phase===2?1:1.5;}return;}
      this.t-=dt;if(this.t<=0){this.windup=this.phase===2?.42:.65;this.move++;message(this.d.id+' // '+PATTERNS[bossIndex][this.move%PATTERNS[bossIndex].length],.6);audio.tone(340,.07,'sine',.025);}
      this.x=clamp(this.x,30,405);
    }
    act(){this.release=.38; const p=this.phase===2; switch(this.d.type){
      case'surgeon': if(this.move%2===1){warnLine(player.x,1);hazards.push({kind:'syringe',owner:'b',x:player.x,y:-15,vy:180,r:7,life:2,dmg:14,delay:.5});}else this.arc(3+p*2,125);break;
      case'hound': {const target=clamp(player.x+(this.dir<0?20:-45),18,W-60);this.lunge={from:this.x,to:target,t:0};slashes.push({owner:'b',x:target-23,y:FLOOR-48,w:88,h:42,life:.18,delay:.35,dmg:16,dir:this.dir});break;}
      case'warden': if(this.move%2===0){[100,190,280,370].forEach((x,i)=>hazards.push({kind:'pillar',owner:'b',x,y:FLOOR,delay:.5+i*.08,life:.7,dmg:15}));}else{this.x+=this.dir*35;this.arc(2+p*2,95);}break;
      case'seraph': for(let i=0;i<(p?7:5);i++)hazards.push({kind:'ember',owner:'b',x:this.x+20,y:this.y+20,vx:(player.x-this.x)*.55+rnd(-55,55),vy:rnd(-165,-80),r:5,life:2.2,dmg:11});break;
      case'oracle': {const targets=p?[player.x, W-player.x]:[player.x];for(const x of targets)hazards.push({kind:'beam',owner:'b',x:x-12,y:20,w:24,h:FLOOR-20,delay:.65,life:.35,dmg:18});break;}
      case'exodus': this.x=clamp(this.x+this.dir*25,90,390);for(let i=0;i<(p?4:3);i++)hazards.push({kind:'drone',owner:'b',x:this.x,y:this.y+20,vx:this.dir*(75+i*12),vy:rnd(-40,20),r:7,life:3,dmg:13});break;
      case'director': {const n=this.move%3;if(n===0)this.arc(p?7:5,150);else if(n===1)[80,170,260,350,430].forEach((x,i)=>hazards.push({kind:'pillar',owner:'b',x,y:FLOOR,delay:.35+i*.05,life:.65,dmg:16}));else{warnLine(player.x,.45);hazards.push({kind:'beam',owner:'b',x:player.x-14,y:18,w:28,h:FLOOR-18,delay:.45,life:.35,dmg:20});}break;}
    }}
    arc(n,speed){const aim=Math.atan2(player.y+20-(this.y+22),player.x+9-(this.x+20));for(let i=0;i<n;i++){const a=aim+lerp(-.55,.55,n===1?.5:i/(n-1));hazards.push({kind:'blade',owner:'b',x:this.x+20,y:this.y+22,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:7,delay:.2,life:3,dmg:12});}}
    draw(){drawBoss(this);}
  }

  function burst(x,y,c,n=10,s=80){for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-s,s),vy:rnd(-s,s),life:rnd(.18,.7),max:1,c,size:Math.random()<.7?2:1});}
  function warnLine(x,d=.5){hazards.push({kind:'warn',owner:'x',x:x-1,y:15,w:2,h:FLOOR-15,life:d});}
  function message(text,life=1){messages.push({text,life,max:life});}

  function updateCombat(dt){
    if(state==='combat'&&!boss.dead&&player.hp>0){battleSeconds+=dt;chainTimer=Math.max(0,chainTimer-dt);if(!chainTimer)chain=0;}
    if(!boss?.dead&&player.hp>0)player.update(dt);if(state==='combat')boss.update(dt);
    if(boss?.lunge&&!boss.dead){const l=boss.lunge;l.t+=dt;boss.x=lerp(l.from,l.to,clamp(l.t/.3,0,1));if(l.t>=.3)boss.lunge=null;}
    for(const s of slashes){if(s.delay>0){s.delay-=dt;continue;}s.life-=dt;if(!s.done){const box={x:s.x,y:s.y,w:s.w,h:s.h};if(s.owner==='p'&&boss&&!boss.dead&&hit(box,boss)){boss.hurt(s.dmg);s.done=true;}if(s.owner==='p'&&room&&state==='explore')for(const drone of room.drones){if(drone.hp>0&&hit(box,drone)){drone.hp-=Math.round(s.dmg*(1+upgrade*.08+augments[0]*.12));burst(drone.x,drone.y,RED,7);s.done=true;audio.noise(.08,.04);hitstop=.03;}}if(s.owner==='b'&&hit(box,player)){player.damage(s.dmg,s.dir);s.done=true;}}}
    slashes=slashes.filter(s=>s.life>0);
    for(const h of hazards){if(h.delay>0){h.delay-=dt;continue;}h.life-=dt;h.x+=(h.vx||0)*dt;h.y+=(h.vy||0)*dt;if(h.kind==='ember')h.vy+=250*dt;if(h.kind==='drone'){h.vy+=(player.y-h.y)*dt*2;h.vx+=(player.x-h.x)*dt*.3;}
      let box=h.kind==='pillar'?{x:h.x-9,y:FLOOR-62,w:18,h:62}:h.kind==='beam'?{x:h.x,y:h.y,w:h.w,h:h.h}:{x:h.x-(h.r||4),y:h.y-(h.r||4),w:(h.r||4)*2,h:(h.r||4)*2};
      if(h.kind!=='warn'&&!h.done){if(h.owner==='b'&&hit(box,player)){if(player.dash>0){player.sp=Math.min(100,player.sp+7);message('PERFECT EVADE // 신경 가속',.65);audio.tone(620,.1,'sine',.025);}player.damage(h.dmg,h.x<player.x?1:-1);h.done=true;}if(h.owner==='p'&&boss&&hit(box,boss)){boss.hurt(h.dmg);h.done=true;}if(h.owner==='p'&&state==='explore'&&room)for(const d of room.drones)if(d.hp>0&&hit(box,d)){d.hp-=Math.round(h.dmg*(1+upgrade*.08+augments[0]*.12));h.done=true;burst(d.x,d.y,RED,8);}}
    }
    hazards=hazards.filter(h=>h.life>0&&!h.done&&h.x>-50&&h.x<W+50&&h.y<H+50);
    particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;p.vx*=.97;});particles=particles.filter(p=>p.life>0);
    messages.forEach(m=>m.life-=dt);messages=messages.filter(m=>m.life>0);
    damageNumbers.forEach(n=>{n.life-=dt;n.y-=20*dt;});damageNumbers=damageNumbers.filter(n=>n.life>0);
    echoes.forEach(e=>e.life-=dt);echoes=echoes.filter(e=>e.life>0).slice(-15);
    if(deathTimer>0){deathTimer-=dt;if(deathTimer<=0){if(player.hp<=0)state='gameover';else finishBoss();}}
  }

  function finishBoss(){if(state==='reward'||state==='ending')return;bossIndex++;upgrade++;rewardChoice=0;checkpointStage=bossIndex>=BOSSES.length?'explore':'reward';hazards=[];slashes=[];particles=[];state=bossIndex>=BOSSES.length?'ending':'reward';save();}
  function startBoss(i=bossIndex){bossIndex=i;player.reset();player.maxHp=player.hp=100+upgrade*5+augments[2]*20;chain=chainTimer=bestChain=battleSeconds=0;boss=new Boss(BOSSES[i]);hazards=[];slashes=[];particles=[];messages=[];damageNumbers=[];echoes=[];deathTimer=0;paused=false;checkpointStage='boss';save();state='intro';time=0;}
  function startExplore(){boss=null;player.reset();player.maxHp=player.hp=100+upgrade*5+augments[2]*20;hazards=[];slashes=[];particles=[];messages=[];damageNumbers=[];echoes=[];deathTimer=0;paused=false;state='explore';checkpointStage='explore';room={section:0,read:false,drones:[],seconds:0};enterSection();save();}
  function enterSection(){player.x=25;room.seconds=0;room.read=false;hazards=[];slashes=[];room.drones=room.section===1?[{x:210,y:173,w:20,h:20,hp:38+bossIndex*3,t:2},{x:355,y:160,w:20,h:20,hp:38+bossIndex*3,t:3}]:[];message(['접속 회랑 // F: 기록 단말 조사','방어망 // 드론을 해체하고 전진','재기동 설비 // F: 교전 준비'][room.section],2.5);}
  function updateExplore(dt){
    room.seconds+=dt;updateCombat(dt);if(player.hp<=0)return;
    for(const d of room.drones){if(d.hp<=0)continue;d.y=168+Math.sin(time*2+d.x)*11;d.t-=dt;if(d.t<=0){const a=Math.atan2(player.y+16-d.y,player.x-d.x);hazards.push({kind:'blade',owner:'b',x:d.x,y:d.y,r:4,vx:Math.cos(a)*105,vy:Math.sin(a)*105,life:3,delay:.45,dmg:8});d.t=2.5;}}
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

  function drawBoss(b){EdenPresentation.boss(ctx,b,time);}

  function drawHazards(){
    const P=EdenPresentation;
    for(const h of hazards){
      if(h.delay>0){
        ctx.globalAlpha=.3+Math.sin(time*25)*.12;ctx.fillStyle=RED;
        if(h.kind==='pillar')ctx.fillRect(h.x-9,FLOOR-62,18,62);
        else if(h.kind==='beam')ctx.fillRect(h.x,h.y,h.w,h.h);
        else if(h.kind==='syringe')ctx.fillRect(h.x-7,70,14,FLOOR-70);
        else P.ring(ctx,h.x,h.y,11,RED);
        ctx.globalAlpha=1;continue;
      }
      if(h.kind==='warn'){P.line(ctx,h.x,h.y,h.x,FLOOR,RED);continue;}
      if(h.kind==='pillar'){
        P.rect(ctx,h.x-9,FLOOR-3,18,3,RED);
        for(let i=-1;i<=1;i++){const tip=FLOOR-56+Math.abs(i)*12;P.line(ctx,h.x+i*5,FLOOR,h.x+i*5,tip,RED,3);P.line(ctx,h.x+i*5,FLOOR-6,h.x+i*5,tip+4,PALE);}
      }else if(h.kind==='beam'){
        P.rect(ctx,h.x-3,h.y,h.w+6,h.h,'#730d28');P.rect(ctx,h.x,h.y,h.w,h.h,RED);P.rect(ctx,h.x+h.w*.35,h.y,h.w*.3,h.h,PALE);
      }else if(h.kind==='syringe'){
        P.plate(ctx,h.x-4,h.y-14,9,18);P.rect(ctx,h.x-2,h.y-10,4,10,RED);P.line(ctx,h.x,h.y+3,h.x,h.y+15,PALE);
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
  function drawSlashes(){for(const s of slashes){if(s.delay>0)continue;ctx.save();ctx.strokeStyle=s.owner==='p'?'#f1eeee':RED;ctx.lineWidth=s.owner==='p'?3:4;ctx.globalAlpha=clamp(s.life*6,0,1);ctx.beginPath();const cx=s.x+s.w/2,cy=s.y+s.h/2;ctx.arc(cx,cy,s.w*.55,s.dir>0?-1.2:1.9,s.dir>0?1.2:4.4);ctx.stroke();ctx.strokeStyle=RED;ctx.lineWidth=1;ctx.stroke();ctx.restore();}}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}ctx.globalAlpha=1;}

  function bar(x,y,w,h,val,max,color){ctx.fillStyle='#060708';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#7f8586';ctx.strokeRect(x-.5,y-.5,w+1,h+1);ctx.fillStyle=color;ctx.fillRect(x+1,y+1,(w-2)*clamp(val/max,0,1),h-2);}
  function wrapped(text,x,y,width,lineHeight=13){let line='';for(const ch of text){if(ctx.measureText(line+ch).width>width){ctx.fillText(line,x,y);line=ch;y+=lineHeight;}else line+=ch;}ctx.fillText(line,x,y);return y;}
  function communications(){if(!dialogue)return;ctx.fillStyle='rgba(4,8,14,.97)';ctx.fillRect(25,167,430,85);ctx.strokeStyle='#657180';ctx.strokeRect(25.5,167.5,429,84);ctx.fillStyle=RED;ctx.fillRect(25,167,3,85);const [speaker,text]=dialogue[dialogueStep];ctx.fillStyle='#b5bfce';ctx.font='8px monospace';ctx.fillText(speaker,39,182);ctx.font='10px sans-serif';ctx.fillStyle=PALE;wrapped(text,39,201,402);ctx.font='7px monospace';ctx.fillStyle='#8c929f';ctx.fillText('ENTER / F — 다음 전송',39,241);}
  function drawExplore(){
    drawBackground(bossIndex);const P=EdenPresentation;
    if(room.section===0){P.plate(ctx,213,181,19,44);P.plate(ctx,204,167,36,23);P.rect(ctx,208,171,27,14,'#141b24');P.rect(ctx,210,174,21,1,RED);ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText(room.read?'ARCHIVED':'[F] 기록',202,159);}
    if(room.section===2){P.plate(ctx,405,132,50,94);P.line(ctx,430,140,430,218,RED,2);ctx.fillStyle=PALE;ctx.font='8px monospace';ctx.fillText('[F] 교전 준비',376,125);}
    for(const d of room.drones){if(d.hp<=0){P.plate(ctx,d.x,217,22,7);continue;}P.plate(ctx,d.x-4,d.y,28,17);P.rect(ctx,d.x,d.y+5,19,4,'#0b1019');P.rect(ctx,d.x+4,d.y+6,9,2,RED);for(let s of[-1,1]){P.line(ctx,d.x+10,d.y+7,d.x+10+s*22,d.y+4,'#768496',2);P.rect(ctx,d.x+7+s*22,d.y+6,6,2,RED);}if(d.t<.5){ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('!',d.x+7,d.y-6);}}
    drawHazards();player.draw();drawSlashes();drawParticles();drawHUD();
    ctx.fillStyle='#c2c7cf';ctx.font='8px sans-serif';ctx.fillText(BOSSES[bossIndex].zone+' / '+['기록 회랑','보안 격실','최종 접속'][room.section],170,17);
    ctx.fillStyle='#9ba6b4';ctx.font='6px monospace';ctx.fillText('D → 전진   F 조사 / 접속   M 음소거',204,264);
    drawMessages();if(paused)overlay('PAUSED','ESC — 계속 / M — 음소거');
  }
  function drawMessages(){for(const m of messages.slice(-1)){ctx.globalAlpha=clamp(m.life*3,0,1);ctx.fillStyle='#0a0d14';ctx.fillRect(40,61,400,23);ctx.fillStyle=PALE;ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(m.text,W/2,76,390);ctx.globalAlpha=1;ctx.textAlign='left';}}
  function drawOverride(){
    if(player.weaponMode!=='crown'||player.attack<.68)return;
    ctx.fillStyle='rgba(4,7,13,.94)';ctx.fillRect(0,90,480,52);ctx.fillStyle=RED;ctx.fillRect(0,90,480,2);ctx.fillRect(0,140,480,2);
    ctx.font='8px monospace';ctx.fillStyle='#b7c3d3';ctx.fillText('00 // LOWER-LIMB SYSTEM / OVERRIDE',23,105);
    ctx.font='18px sans-serif';ctx.fillStyle=PALE;ctx.fillText('KETER — 양각 전개',23,128);
    for(let i=0;i<19;i++){ctx.fillStyle=i%3?RED:PALE;ctx.fillRect(306+i*8,100+(i%4)*3,3,31-(i%4)*6);}
  }
  function statusHUD(){
    const P=EdenPresentation;
    ctx.fillStyle='rgba(5,8,13,.9)';ctx.fillRect(11,5,153,38);P.line(ctx,12,5,164,5,'#5e6878');P.line(ctx,12,42,164,42,'#303c4e');
    P.portrait(ctx,15,10);ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText('ZERO // 00',47,14);
    ctx.fillStyle='#94a2b8';ctx.font='6px monospace';ctx.fillText('CORE +'+upgrade,125,14);
    bar(47,19,107,6,player.hp,player.maxHp,RED);bar(47,30,84,4,player.sp,100,'#93a7c4');
    ctx.fillStyle='#a4b1c6';ctx.font='5px monospace';ctx.fillText(Math.ceil(player.hp)+' HP',134,35);
    if(boss){
      ctx.fillStyle='rgba(5,8,13,.87)';ctx.fillRect(272,5,192,36);ctx.textAlign='right';ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText(boss.d.id+' / '+boss.d.ko,458,14);
      bar(279,19,179,6,boss.hp,boss.maxHp,RED);ctx.fillStyle=boss.windup>0?RED:'#a9b4c4';ctx.font='6px monospace';ctx.fillText('PHASE '+boss.phase+' / '+(boss.windup>0?'공격 준비':'ACTIVE'),458,35);ctx.textAlign='left';
    }
    ['Q','W','E','R'].forEach((k,i)=>{
      const x=17+i*43,y=237,ready=player.cool[i]<=0&&player.sp>=[24,30,40,55][i];
      ctx.fillStyle='rgba(7,11,18,.94)';ctx.fillRect(x,y,39,24);ctx.strokeStyle=ready?'#a4a7b1':'#3d4553';ctx.strokeRect(x+.5,y+.5,38,23);
      P.line(ctx,x+5,y+7,x+10,y+11,ready?PALE:'#5c6676',2);P.line(ctx,x+10,y+11,x+6,y+17,ready?RED:'#5c6676',2);
      ctx.fillStyle=ready?PALE:'#7b8492';ctx.font='7px monospace';ctx.fillText(k,x+18,y+9);ctx.font='5px monospace';ctx.fillText(['LAHAT','RAIL','PILE','KETER'][i],x+14,y+16);
      ctx.fillStyle=ready?RED:'#444d5b';ctx.fillRect(x+3,y+20,33*(player.cool[i]>0?1-player.cool[i]/[3.5,5,7,11][i]:1),1);
      if(player.cool[i]>0){ctx.fillStyle=PALE;ctx.font='6px monospace';ctx.fillText(player.cool[i].toFixed(1),x+21,y+10);}
    });
    ctx.fillStyle='#8e9bab';ctx.font='6px monospace';ctx.fillText('SHIFT / 회피     J K / 기계 다리',204,252);
  }
  function campaignTitle(){
    drawBackground(0);ctx.fillStyle='rgba(3,5,9,.64)';ctx.fillRect(0,0,254,H);
    ctx.save();ctx.translate(303,54);ctx.scale(2.9,2.9);EdenPresentation.drawZero(ctx,{...player,x:0,y:0,face:1,inv:0,vx:0,dash:0,attack:0,onGround:true},time);ctx.restore();
    ctx.fillStyle='#9ca9bc';ctx.font='7px monospace';ctx.fillText('NEURAL LINK // CONNECTED',28,43);ctx.fillStyle=PALE;ctx.font='52px Georgia';ctx.fillText('EDEN',26,101);ctx.fillStyle=RED;ctx.fillRect(29,113,167,2);
    ctx.font='10px sans-serif';ctx.fillStyle='#a5adbc';ctx.fillText('낙원은 우리를 기억하지 않는다.',30,135);ctx.font='7px monospace';ctx.fillText('SPECIAL COMBAT ENTITY 00',30,152);
    const old=load(),items=old?[(old.complete?'엔딩 기록':'계속하기'),'새 작전']:['기동 / 새 작전'];items.forEach((s,i)=>{ctx.fillStyle=i===menu?'#ece5df':'#6d7685';ctx.font='11px sans-serif';ctx.fillText((menu===i?'▸ ':'  ')+s,30,182+i*24);});
    ctx.fillStyle='#8b95a4';ctx.font='7px monospace';ctx.fillText('↑ ↓ 선택  /  ENTER 접속  /  M 음소거',30,248);
    ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('ZERO',349,245);
  }
  function recordScreen(){
    drawBackground(Math.min(bossIndex,6));ctx.fillStyle='rgba(3,5,9,.89)';ctx.fillRect(0,0,W,H);
    const s=STORY[Math.min(bossIndex,6)];ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText('TRANSMISSION / '+String(bossIndex+1).padStart(2,'0'),29,38);
    ctx.fillStyle=PALE;ctx.font='25px Georgia';ctx.fillText(s[0],28,74);ctx.font='10px sans-serif';wrapped(s[1],30,104,416);wrapped(s[2],30,125,416);
    for(let i=0;i<7;i++){const x=34+i*62;ctx.fillStyle=i<bossIndex?RED:i===bossIndex?PALE:'#354050';ctx.fillRect(x,168,38,2);ctx.font='6px monospace';ctx.fillText(BOSSES[i].id,x,183);ctx.fillText(i<bossIndex?'CLEARED':i===bossIndex?'TARGET':'LOCKED',x,196);}
    ctx.fillStyle='#9ba6b6';ctx.font='8px sans-serif';ctx.fillText('코어 강화 +'+upgrade+'  /  회수 기록 '+archiveCount+'  /  ENTER — 구역 진입',30,233);
  }
  function drawHUD(){statusHUD();}

  function rewardScreen(){
    drawBackground(Math.max(0,bossIndex-1));ctx.fillStyle='rgba(3,7,12,.93)';ctx.fillRect(0,0,W,H);
    ctx.fillStyle=RED;ctx.font='7px monospace';ctx.fillText('SALVAGE // '+BOSSES[Math.max(0,bossIndex-1)].id+' // CORE '+upgrade,22,23);
    ctx.fillStyle=PALE;ctx.font='22px sans-serif';ctx.fillText('적의 명령을, 나의 무기로.',20,52);
    ctx.fillStyle='#93a5bb';ctx.font='8px sans-serif';ctx.fillText('회수 코어를 기계 다리에 이식합니다. 하나를 선택하세요.',22,75);
    MODS.forEach((m,i)=>{
      const x=18+i*150,selected=i===rewardChoice;ctx.fillStyle=selected?'#18232d':'#0a1019';ctx.fillRect(x,104,144,108);
      ctx.strokeStyle=selected?m[3]:'#344151';ctx.strokeRect(x+.5,104.5,143,107);ctx.fillStyle=m[3];ctx.fillRect(x,104,144,selected?3:1);
      // Pixel circuit diagram of hip, shin and transformed foot.
      const px=x+17,py=120;ctx.fillStyle='#6e8092';ctx.fillRect(px,py,8,11);ctx.fillRect(px+5,py+11,6,13);ctx.fillRect(px+3,py+24,6,10);
      ctx.fillStyle=m[3];ctx.fillRect(px+5,py+12,3,10);ctx.fillRect(px+3,py+32,i===0?26:15,3);
      if(i===1){for(let k=0;k<3;k++)ctx.fillRect(px+15+k*5,py+13-k*3,3,15);}
      if(i===2){ctx.fillRect(px-3,py+8,5,23);ctx.fillRect(px+13,py+8,5,23);}
      ctx.font='7px monospace';ctx.fillText('0'+(i+1)+' / LV '+augments[i],x+54,129);ctx.fillStyle=PALE;ctx.font='9px sans-serif';ctx.fillText(m[0],x+9,166);
      ctx.font='8px sans-serif';ctx.fillStyle=m[3];ctx.fillText(m[1],x+9,184);ctx.fillStyle='#9aa8b8';ctx.font='7px sans-serif';ctx.fillText(m[2],x+9,199,128);
    });
    ctx.textAlign='center';ctx.font='9px sans-serif';ctx.fillStyle=PALE;ctx.fillText('A / D 또는 카드 터치로 선택 · ENTER / 아래 진행 버튼으로 이식',240,239);
    ctx.fillStyle='#71849b';ctx.font='7px monospace';ctx.fillText('PERMANENT AUGMENT // 다음 구역부터 적용 · 선택 전에도 자동 저장',240,257);ctx.textAlign='left';
  }
  function combatCinema(){
    if(chain>1&&!boss.dead){ctx.textAlign='right';ctx.fillStyle=chain>=10?'#7de6ed':PALE;ctx.font='20px monospace';ctx.fillText(String(chain).padStart(2,'0'),458,105);ctx.font='6px monospace';ctx.fillText(chain>=10?'NEURAL SYNC':'HIT CHAIN',458,116);ctx.fillRect(413,122,45*chainTimer/2.4,2);ctx.textAlign='left';}
    if(!boss.dead)return;
    const t=boss.deathAge,open=clamp(t*3,0,1);ctx.fillStyle='rgba(3,5,9,.94)';ctx.fillRect(0,0,W,30*open);ctx.fillRect(0,H-37*open,W,37*open);
    ctx.strokeStyle=RED;ctx.strokeRect(boss.x-8-t*16,boss.y-8-t*8,boss.w+16+t*32,boss.h+16+t*16);
    if(t>.35){ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='18px monospace';ctx.fillText('COMMAND SEVERED',240,25);ctx.fillStyle='#aab8c9';ctx.font='8px monospace';ctx.fillText('BEST CHAIN '+bestChain+'   /   '+battleSeconds.toFixed(1)+' SEC   /   CORE RECOVERED',240,254);ctx.textAlign='left';}
  }

  function renderCombat(){drawBackground(bossIndex);for(const e of echoes){ctx.globalAlpha=e.life*2;EdenPresentation.drawZero(ctx,{...player,x:e.x,y:e.y,face:e.face,inv:0},time);}ctx.globalAlpha=1;drawHazards();boss.draw();player.draw();drawSlashes();drawParticles();for(const n of damageNumbers){ctx.globalAlpha=n.life;ctx.fillStyle=PALE;ctx.font='9px monospace';ctx.fillText(n.text,n.x,n.y);}ctx.globalAlpha=1;drawHUD();drawMessages();drawOverride();if(boss.tele>0){ctx.fillStyle='rgba(5,7,12,.8)';ctx.fillRect(0,95,480,32);ctx.fillStyle=RED;ctx.font='13px monospace';ctx.textAlign='center';ctx.fillText('PHASE II / 신경 제한 해제',240,115);ctx.textAlign='left';}if(paused)overlay('PAUSED','ESC — 계속 / M — 음소거');}
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
  function endingScreen(){drawBackground(6);ctx.fillStyle='rgba(2,3,4,.72)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='30px Georgia';ctx.fillText('EDEN // SEVERED',W/2,75);ctx.fillStyle=RED;ctx.fillRect(145,88,190,1);ctx.fillStyle='#b5b7b6';ctx.font='10px sans-serif';ctx.fillText('최초의 명령은 끝났다.',W/2,124);ctx.fillText('ZERO는 낙원의 문을 열어 둔 채, 이름 없는 세계로 걸어간다.',W/2,144);ctx.fillStyle='#666';ctx.font='7px monospace';ctx.fillText('ENTER — 타이틀로 / 기록 유지',W/2,216);ctx.textAlign='left';}

  function update(dt){
    if(pressed.has('m'))audio.muted=!audio.muted;
    if(pressed.has('escape')&&(state==='combat'||state==='explore'))paused=!paused;
    if(paused)return;
    audio.tick(dt,Math.min(6,bossIndex),state==='combat',boss?.phase||1);
    if(dialogue){if(pressed.has('enter')||pressed.has('f')){dialogueStep++;if(dialogueStep>=dialogue.length)dialogue=null;}return;}
    time+=dt;shake=Math.max(0,shake-dt*15);flash=Math.max(0,flash-dt);
    if(hitstop>0){hitstop-=dt;return;}
    if(state==='title'){const max=load()?1:0;if(pressed.has('arrowup')||pressed.has('w'))menu=Math.max(0,menu-1);if(pressed.has('arrowdown')||pressed.has('s'))menu=Math.min(max,menu+1);if(pressed.has('enter')){const old=load();if(old&&menu===0){bossIndex=clamp(old.boss,0,7);upgrade=Number(old.upgrade)||0;augments=[0,1,2].map(i=>clamp(Math.floor(Number(old.augments?.[i])||0),0,6));archiveCount=Number(old.archives)||0;defeatCount=Number(old.defeats)||0;recoveredRecords=new Set(Array.isArray(old.records)?old.records:[]);if(old.complete||bossIndex===7)state='ending';else if(old.stage==='reward'){checkpointStage='reward';rewardChoice=0;state='reward';}else if(old.stage==='boss')startBoss();else startExplore();}else{clearSave();bossIndex=0;augments=[0,0,0];upgrade=archiveCount=defeatCount=0;recoveredRecords=new Set();checkpointStage='explore';state='interlude';}}}
    else if(state==='reward'){if(pressed.has('a'))rewardChoice=(rewardChoice+2)%3;if(pressed.has('d'))rewardChoice=(rewardChoice+1)%3;if(pressed.has('enter'))chooseReward();}
    else if(state==='interlude'&&pressed.has('enter')){startExplore();dialogue=COMMS[bossIndex];dialogueStep=0;}
    else if(state==='intro'){boss.anim+=dt;if(pressed.has('enter')){state='combat';boss.inv=.8;message('ENGAGE // 명령을 넘어선다',1.2);}}
    else if(state==='combat')updateCombat(dt);
    else if(state==='explore')updateExplore(dt);
    else if(state==='gameover'&&pressed.has('enter')){if(checkpointStage==='boss')startBoss();else startExplore();}
    else if(state==='ending'&&pressed.has('enter')){menu=0;state='title';}
  }
  function render(){ctx.save();if(shake)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));if(state==='title')titleScreen();else if(state==='reward')rewardScreen();else if(state==='interlude')storyScreen();else if(state==='intro')introScreen();else if(state==='combat'){renderCombat();combatCinema();}else if(state==='explore')drawExplore();else if(state==='gameover'){if(boss)renderCombat();else drawExplore();overlay('SYSTEM FAILURE','ENTER — 체크포인트 재기동');}else if(state==='ending')endingScreen();communications();ctx.restore();if(flash){ctx.fillStyle=`rgba(255,255,255,${flash*2})`;ctx.fillRect(0,0,W,H);}ctx.fillStyle='rgba(255,255,255,.018)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);}

  function controlHints(){
    const label=paused?'계속하기':dialogue?'대사 다음':({title:'시작 / 이어하기',reward:'선택한 개조 이식',interlude:'구역 진입',intro:'전투 시작',gameover:'재도전',ending:'타이틀로'})[state]||'진행';
    if(nextButton.textContent!==label)nextButton.textContent=label;
    const text=paused?'일시정지 중 — 계속하기를 누르세요.':dialogue?'통신 중 — 대사 다음을 누르면 이동할 수 있습니다.':state==='explore'||state==='combat'?'A/D 또는 ←/→ 이동 · 아래 버튼을 길게 눌러도 이동합니다.':'시작·진행 버튼 또는 Enter를 눌러주세요.';
    if(controlStatus.textContent!==text)controlStatus.textContent=text;
  }
  let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);render();controlHints();pressed.clear();requestAnimationFrame(loop);}requestAnimationFrame(loop);document.querySelector('#boot').classList.add('ready');
})();
