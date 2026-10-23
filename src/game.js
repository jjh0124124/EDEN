(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, FLOOR = 226;
  const RED = '#e30b32', PALE = '#d9d6d2', DARK = '#080a0c';

  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const rnd = (a,b) => a+Math.random()*(b-a);
  const hit = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const keys = new Set(), pressed = new Set();
  addEventListener('keydown', e => { const k=e.key.toLowerCase(); if(!keys.has(k)) pressed.add(k); keys.add(k); if([' ','arrowup','arrowdown'].includes(k))e.preventDefault(); });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

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
  let particles=[], hazards=[], slashes=[], messages=[];
  const saveKey='eden-save-v1';
  const save = () => localStorage.setItem(saveKey, JSON.stringify({boss:bossIndex, complete:state==='ending'}));
  const load = () => { try{return JSON.parse(localStorage.getItem(saveKey))||null;}catch{return null;} };
  const clearSave = () => localStorage.removeItem(saveKey);

  const audio = { ctx:null,
    wake(){ if(!this.ctx) this.ctx=new (window.AudioContext||window.webkitAudioContext)(); if(this.ctx.state==='suspended')this.ctx.resume(); },
    tone(freq=80,dur=.08,type='sawtooth',vol=.035,drop=0){ if(!this.ctx)return; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,this.ctx.currentTime); if(drop)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq-drop),this.ctx.currentTime+dur); g.gain.setValueAtTime(vol,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+dur);o.connect(g).connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+dur); }
  };
  addEventListener('keydown',()=>audio.wake(),{once:true});

  class Fighter {
    constructor(){ this.reset(); }
    reset(){ Object.assign(this,{x:65,y:FLOOR-46,w:19,h:46,vx:0,vy:0,face:1,hp:100,maxHp:100,sp:100,onGround:true,attack:0,attackKind:0,inv:0,dash:0,stun:0,combo:0,comboT:0,cool:[0,0,0,0]}); }
    damage(n,dir){ if(this.inv>0)return;this.hp-=n;this.vx=dir*95;this.vy=-90;this.inv=.55;this.stun=.18;shake=7;burst(this.x+9,this.y+20,RED,15,100);audio.tone(52,.17,'sawtooth',.06,20); if(this.hp<=0){this.hp=0;deathTimer=1.4;} }
    update(dt){
      this.inv=Math.max(0,this.inv-dt);this.attack=Math.max(0,this.attack-dt);this.stun=Math.max(0,this.stun-dt);this.comboT-=dt;if(this.comboT<0)this.combo=0;
      this.cool=this.cool.map(v=>Math.max(0,v-dt));this.sp=Math.min(100,this.sp+10*dt);
      if(this.stun<=0){
        let move=(keys.has('d')?1:0)-(keys.has('a')?1:0); if(move)this.face=move;
        const speed=this.dash>0?250:92;this.vx=lerp(this.vx,move*speed,clamp(dt*12,0,1));
        if((pressed.has(' ')||pressed.has('space'))&&this.onGround){this.vy=-205;this.onGround=false;audio.tone(110,.08,'square',.025,45);}
        if(pressed.has('shift')&&this.dash<=0&&this.sp>=12){this.dash=.25;this.inv=.32;this.sp-=12;this.vx=this.face*260;burst(this.x+10,this.y+35,'#bbc0c3',8,45);audio.tone(75,.1,'sawtooth',.03,30);}
        if(pressed.has('j')&&this.attack<=0)this.strike(false);
        if(pressed.has('k')&&this.attack<=0)this.strike(true);
        ['q','w','e','r'].forEach((k,i)=>{if(pressed.has(k))this.skill(i);});
      }
      this.dash=Math.max(0,this.dash-dt);this.vy+=470*dt;this.x+=this.vx*dt;this.y+=this.vy*dt;
      if(this.y+this.h>=FLOOR){this.y=FLOOR-this.h;this.vy=0;this.onGround=true;}
      this.x=clamp(this.x,8,W-this.w-8);
    }
    strike(heavy){ this.combo=(this.combo%3)+1;this.comboT=.55;this.attack=heavy?.42:.23;this.attackKind=heavy?2:this.combo; const reach=heavy?51:35, dmg=heavy?22:10+this.combo*2;slashes.push({owner:'p',x:this.face>0?this.x+14:this.x-reach,y:this.y+4,w:reach,h:38,life:.13,delay:heavy?.14:.06,dmg,dir:this.face});audio.tone(heavy?90:145,.1,'sawtooth',.04,heavy?55:75); }
    skill(i){ const costs=[24,30,40,55], cds=[3.5,5,7,11];if(this.cool[i]>0||this.sp<costs[i])return;this.cool[i]=cds[i];this.sp-=costs[i];
      if(i===0){this.inv=.5;for(let j=0;j<3;j++)slashes.push({owner:'p',x:this.face>0?this.x+10+j*18:this.x-48+j*18,y:this.y-5+j*6,w:42,h:45,life:.24+j*.05,delay:.04+j*.05,dmg:13,dir:this.face});}
      if(i===1){hazards.push({kind:'blade',owner:'p',x:this.x+8,y:this.y+17,vx:this.face*245,vy:0,r:8,life:1.5,dmg:25});}
      if(i===2){this.vy=-140;for(let j=-2;j<=2;j++)hazards.push({kind:'pillar',owner:'p',x:this.x+j*42,y:FLOOR,delay:.16+Math.abs(j)*.06,life:.65,dmg:18});}
      if(i===3){this.inv=1.1;flash=.18;for(let j=0;j<5;j++)slashes.push({owner:'p',x:30+j*88,y:35+(j%2)*35,w:105,h:170,life:.6,delay:.12+j*.08,dmg:20,dir:this.face});}
      shake=5;audio.tone(45+i*22,.3,'sawtooth',.055,20);
    }
    draw(){
      ctx.save();ctx.translate(Math.round(this.x+this.w/2),Math.round(this.y));ctx.scale(this.face,1);if(this.inv>0&&Math.floor(this.inv*18)%2===0)ctx.globalAlpha=.38;
      const run=Math.sin(time*18)*Math.min(3,Math.abs(this.vx)/35), atk=this.attack>0?7:0;
      ctx.fillStyle='#171b20';ctx.fillRect(-7,7,14,19);ctx.fillStyle='#313840';ctx.fillRect(-8,11,4,14);ctx.fillStyle='#ddd';ctx.fillRect(-4,2,9,7);ctx.fillStyle='#101216';ctx.fillRect(-3,4,8,7);ctx.fillStyle=RED;ctx.fillRect(3,6,2,2);
      ctx.fillStyle='#aeb5b7';ctx.fillRect(-7,25+run,5,13);ctx.fillRect(2,25-run,5,13);ctx.fillStyle='#343b42';ctx.fillRect(-9,35+run,7,9);ctx.fillRect(2,35-run,8,9);ctx.fillStyle=RED;ctx.fillRect(-8,29+run,2,9);ctx.fillRect(6,29-run,2,9);
      ctx.fillStyle='#242a30';ctx.fillRect(-12,10,5,18);ctx.fillStyle='#c5c9c9';ctx.fillRect(7,11-atk,12+atk,3);ctx.fillStyle=RED;ctx.fillRect(15,10-atk,8+atk,2);ctx.fillStyle='#090a0c';ctx.fillRect(-6,18,13,3);
      ctx.restore();
    }
  }
  const player=new Fighter();

  class Boss {
    constructor(data){this.d=data;this.x=365;this.y=FLOOR-72;this.w=42;this.h=72;this.hp=data.hp;this.maxHp=data.hp;this.phase=1;this.t=1.6;this.anim=0;this.inv=1;this.dead=false;this.dir=-1;this.tele=0;}
    hurt(n){if(this.inv>0||this.dead)return;this.hp-=n;this.inv=.06;burst(this.x+18,this.y+28,RED,8,85);shake=Math.min(8,shake+2);audio.tone(80,.08,'square',.035,35);if(this.hp<=this.maxHp*.5&&this.phase===1){this.phase=2;this.inv=1.2;this.tele=1.2;message('PHASE II // LIMITER RELEASED',1.5);burst(this.x+20,this.y+25,RED,45,150);audio.tone(38,.7,'sawtooth',.07,15);}if(this.hp<=0){this.hp=0;this.dead=true;this.inv=99;deathTimer=2.6;burst(this.x+20,this.y+25,'#eee',55,180);}}
    update(dt){this.anim+=dt;this.inv=Math.max(0,this.inv-dt);this.tele=Math.max(0,this.tele-dt);if(this.dead)return;this.dir=player.x<this.x?-1:1;this.t-=dt;if(this.t<=0){this.act();this.t=Math.max(.52,(this.phase===2?.82:1.1)+rnd(-.16,.22));}}
    act(){ const p=this.phase===2; switch(this.d.type){
      case'surgeon': if(Math.random()<.5){warnLine(player.x,1);hazards.push({kind:'syringe',owner:'b',x:player.x,y:-15,vy:180,r:7,life:2,dmg:14,delay:.5});}else this.arc(3+p*2,125);break;
      case'hound': this.x=clamp(player.x+(Math.random()<.5?-75:75),18,W-60);slashes.push({owner:'b',x:this.x-45,y:FLOOR-48,w:95,h:42,life:.18,delay:.34,dmg:16,dir:this.dir});break;
      case'warden': if(Math.random()<.5){[100,190,280,370].forEach((x,i)=>hazards.push({kind:'pillar',owner:'b',x,y:FLOOR,delay:.5+i*.08,life:.7,dmg:15}));}else{this.x+=this.dir*35;this.arc(2+p*2,95);}break;
      case'seraph': for(let i=0;i<(p?7:5);i++)hazards.push({kind:'ember',owner:'b',x:this.x+20,y:this.y+20,vx:(player.x-this.x)*.55+rnd(-55,55),vy:rnd(-165,-80),r:5,life:2.2,dmg:11});break;
      case'oracle': warnLine(player.x,.6);setTimeout(()=>hazards.push({kind:'beam',owner:'b',x:player.x-12,y:20,w:24,h:FLOOR-20,life:.35,dmg:18}),420);if(p)warnLine(W-player.x,.65);break;
      case'exodus': this.x=clamp(this.x+this.dir*45,90,390);for(let i=0;i<(p?4:3);i++)hazards.push({kind:'drone',owner:'b',x:this.x,y:this.y+20,vx:this.dir*(-90-i*18),vy:rnd(-40,20),r:7,life:3,dmg:13});break;
      case'director': {const n=Math.floor(this.anim*2)%3;if(n===0)this.arc(p?7:5,150);else if(n===1)[80,170,260,350,430].forEach((x,i)=>hazards.push({kind:'pillar',owner:'b',x,y:FLOOR,delay:.35+i*.05,life:.65,dmg:16}));else{warnLine(player.x,.45);hazards.push({kind:'beam',owner:'b',x:player.x-14,y:18,w:28,h:FLOOR-18,delay:.45,life:.35,dmg:20});}break;}
    }}
    arc(n,speed){for(let i=0;i<n;i++){const a=lerp(-2.75,-.38,n===1?.5:i/(n-1));hazards.push({kind:'blade',owner:'b',x:this.x+20,y:this.y+22,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:7,life:3,dmg:12});}}
    draw(){drawBoss(this);}
  }

  function burst(x,y,c,n=10,s=80){for(let i=0;i<n;i++)particles.push({x,y,vx:rnd(-s,s),vy:rnd(-s,s),life:rnd(.18,.7),max:1,c,size:Math.random()<.7?2:1});}
  function warnLine(x,d=.5){hazards.push({kind:'warn',owner:'x',x:x-1,y:15,w:2,h:FLOOR-15,life:d});}
  function message(text,life=1){messages.push({text,life,max:life});}

  function updateCombat(dt){
    player.update(dt);boss.update(dt);
    for(const s of slashes){s.life-=dt;s.delay-=dt;if(s.delay<=0&&!s.done){const box={x:s.x,y:s.y,w:s.w,h:s.h};if(s.owner==='p'&&hit(box,boss)){boss.hurt(s.dmg);s.done=true;}if(s.owner==='b'&&hit(box,player)){player.damage(s.dmg,s.dir);s.done=true;}}}
    slashes=slashes.filter(s=>s.life>0);
    for(const h of hazards){h.life-=dt;if(h.delay!==undefined){h.delay-=dt;if(h.delay>0)continue;}h.x+=(h.vx||0)*dt;h.y+=(h.vy||0)*dt;if(h.kind==='ember')h.vy+=250*dt;if(h.kind==='drone'){h.vy+=(player.y-h.y)*dt*2;h.vx+=(player.x-h.x)*dt*.3;}
      let box=h.kind==='pillar'?{x:h.x-9,y:FLOOR-62,w:18,h:62}:h.kind==='beam'?{x:h.x,y:h.y,w:h.w,h:h.h}:{x:h.x-(h.r||4),y:h.y-(h.r||4),w:(h.r||4)*2,h:(h.r||4)*2};
      if(h.kind!=='warn'&&!h.done){if(h.owner==='b'&&hit(box,player)){player.damage(h.dmg,h.x<player.x?1:-1);h.done=true;}if(h.owner==='p'&&hit(box,boss)){boss.hurt(h.dmg);h.done=true;}}
    }
    hazards=hazards.filter(h=>h.life>0&&!h.done&&h.x>-50&&h.x<W+50&&h.y<H+50);
    particles.forEach(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;p.vx*=.97;});particles=particles.filter(p=>p.life>0);
    messages.forEach(m=>m.life-=dt);messages=messages.filter(m=>m.life>0);
    if(deathTimer>0){deathTimer-=dt;if(deathTimer<=0){if(player.hp<=0)state='gameover';else finishBoss();}}
  }

  function finishBoss(){bossIndex++;save();hazards=[];slashes=[];particles=[];if(bossIndex>=BOSSES.length){state='ending';clearSave();}else{state='interlude';}}
  function startBoss(i=bossIndex){bossIndex=i;player.reset();boss=new Boss(BOSSES[i]);hazards=[];slashes=[];particles=[];deathTimer=0;state='intro';time=0;}

  function drawBackground(zone=0){
    ctx.fillStyle='#07090b';ctx.fillRect(0,0,W,H);const par=Math.floor(time*4)%32;
    ctx.fillStyle='#101418';for(let x=-par;x<W;x+=32){ctx.fillRect(x,32,2,194);ctx.fillRect(x+18,64,1,162);}ctx.fillStyle='#171b1e';
    for(let x=18;x<W;x+=76){ctx.fillRect(x,44,46,5);ctx.fillRect(x+5,49,36,96);ctx.fillStyle='#090b0d';ctx.fillRect(x+10,58,26,87);ctx.fillStyle='#171b1e';ctx.fillRect(x+2,42,42,3);}
    ctx.strokeStyle='#3a0a12';ctx.lineWidth=2;for(let x=12;x<W;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+20,55,x-18,95,x+4,150);ctx.stroke();}
    ctx.fillStyle='#202529';ctx.fillRect(0,FLOOR,W,H-FLOOR);ctx.fillStyle='#050607';ctx.fillRect(0,FLOOR+5,W,3);ctx.fillStyle='#741020';for(let x=(zone*17)%35;x<W;x+=35)ctx.fillRect(x,FLOOR+1,18,1);
    ctx.fillStyle='#15191c';ctx.fillRect(0,FLOOR-4,W,4);ctx.fillStyle='#42484a';for(let x=0;x<W;x+=20)ctx.fillRect(x,FLOOR-3,11,1);
    if(zone===0||zone===6){ctx.strokeStyle='#5d6570';ctx.lineWidth=1;ctx.beginPath();ctx.arc(W/2,75,43,Math.PI,0);ctx.stroke();ctx.beginPath();ctx.arc(W/2,75,30,Math.PI,0);ctx.stroke();}
  }

  function drawBoss(b){
    const x=Math.round(b.x+b.w/2),y=Math.round(b.y), pulse=Math.sin(b.anim*4), phase=b.phase===2;
    ctx.save();ctx.translate(x,y);ctx.scale(b.dir,1);if(b.inv<.1&&Math.floor(b.anim*30)%2===0)ctx.globalAlpha=.7;
    ctx.fillStyle='#090b0c';ctx.fillRect(-20,66,42,5);ctx.fillStyle=b.d.color;
    if(b.d.type==='hound'){
      ctx.fillStyle='#343b3e';ctx.fillRect(-22,30,42,19);ctx.fillRect(-15,19,23,13);ctx.fillStyle='#bfc3c1';ctx.fillRect(8,23,22,10);ctx.fillStyle=RED;ctx.fillRect(24,25,3,3);for(let i=-17;i<18;i+=12){ctx.fillStyle='#6f7778';ctx.fillRect(i,46+(i%2),5,22);ctx.fillStyle=RED;ctx.fillRect(i+1,58,2,10);}ctx.fillStyle='#9da3a3';ctx.fillRect(-27,33,8,4);
    } else if(b.d.type==='warden'||b.d.type==='exodus'){
      ctx.fillStyle='#343a3c';ctx.fillRect(-24,19,48,43);ctx.fillStyle='#9ca2a1';ctx.fillRect(-16,7,32,19);ctx.fillStyle='#111416';ctx.fillRect(-11,11,22,10);ctx.fillStyle=RED;ctx.fillRect(-8,15,16,2);ctx.fillStyle='#606769';for(let i=-28;i<=22;i+=10)ctx.fillRect(i,27,6,33);ctx.fillStyle='#151719';ctx.fillRect(-20,38,40,4);if(b.d.type==='exodus'){ctx.strokeStyle=RED;ctx.strokeRect(-27,16,54,49);ctx.fillRect(-31,26,4,25);}
    } else if(b.d.type==='seraph'){
      ctx.fillStyle='#ddd7cf';ctx.fillRect(-10,20,20,42);ctx.fillStyle='#f0ece6';ctx.fillRect(-7,7,14,16);ctx.fillStyle=RED;ctx.fillRect(4,12,3,3);for(let s of[-1,1])for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#7d8587':'#d0cbc4';ctx.fillRect(s*(12+i*10)-(s<0?8:0),18+i*5,8,35-i*5);}ctx.strokeStyle=RED;ctx.beginPath();ctx.arc(0,7,14+pulse*2,0,Math.PI*2);ctx.stroke();
    } else if(b.d.type==='oracle'){
      ctx.fillStyle='#d4ced5';ctx.fillRect(-16,20,32,47);ctx.fillStyle='#25282d';ctx.fillRect(-12,5,24,22);ctx.fillStyle=RED;ctx.fillRect(-7,13,14,3);for(let i=0;i<5;i++){ctx.strokeStyle=i%2?RED:'#858a8e';ctx.beginPath();ctx.arc(0,17,19+i*5,Math.PI*1.1,Math.PI*1.9);ctx.stroke();}
    } else {
      ctx.fillStyle=b.d.color;ctx.beginPath();ctx.moveTo(-13,18);ctx.lineTo(13,18);ctx.lineTo(25,68);ctx.lineTo(-24,68);ctx.fill();ctx.fillStyle='#b3b6b6';ctx.fillRect(-9,4,18,18);ctx.fillStyle='#121518';ctx.fillRect(-7,8,14,9);ctx.fillStyle=RED;ctx.fillRect(3,11,3,3);
      for(let s of[-1,1]){ctx.fillStyle='#4b5255';ctx.fillRect(s*18-(s<0?5:0),21,5,34);ctx.fillStyle=RED;ctx.fillRect(s*24-(s<0?4:0),9,4,44);ctx.fillStyle='#c6c8c6';ctx.fillRect(s*28-(s<0?6:0),15,6,30);}ctx.strokeStyle=RED;ctx.beginPath();ctx.arc(0,3,17+pulse,0,Math.PI*2);ctx.stroke();
    }
    if(phase){ctx.strokeStyle=RED;ctx.globalAlpha=.55;ctx.strokeRect(-31,-2,62,73);ctx.globalAlpha=1;}ctx.restore();
  }

  function drawHazards(){for(const h of hazards){if(h.delay>0){ctx.fillStyle='rgba(227,11,50,.2)';if(h.kind==='pillar')ctx.fillRect(h.x-8,FLOOR-60,16,60);continue;}ctx.save();if(h.kind==='warn'){ctx.fillStyle=`rgba(227,11,50,${.2+Math.sin(time*40)*.15})`;ctx.fillRect(h.x,h.y,h.w,h.h);}else if(h.kind==='pillar'){ctx.fillStyle=RED;ctx.fillRect(h.x-3,FLOOR-58,6,58);ctx.fillStyle='#fff';ctx.fillRect(h.x-1,FLOOR-52,2,39);}else if(h.kind==='beam'){ctx.fillStyle='#fff';ctx.fillRect(h.x,h.y,h.w,h.h);ctx.fillStyle=RED;ctx.fillRect(h.x-5,h.y,h.w+10,h.h);ctx.globalCompositeOperation='screen';}else{ctx.translate(h.x,h.y);ctx.rotate(time*9);ctx.fillStyle=h.owner==='p'?'#e8e8e5':RED;ctx.fillRect(-9,-2,18,4);ctx.fillStyle='#565d61';ctx.fillRect(-3,-6,6,12);}ctx.restore();}}
  function drawSlashes(){for(const s of slashes){if(s.delay>0)continue;ctx.save();ctx.strokeStyle=s.owner==='p'?'#f1eeee':RED;ctx.lineWidth=s.owner==='p'?3:4;ctx.globalAlpha=clamp(s.life*6,0,1);ctx.beginPath();const cx=s.x+s.w/2,cy=s.y+s.h/2;ctx.arc(cx,cy,s.w*.55,s.dir>0?-1.2:1.9,s.dir>0?1.2:4.4);ctx.stroke();ctx.strokeStyle=RED;ctx.lineWidth=1;ctx.stroke();ctx.restore();}}
  function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}ctx.globalAlpha=1;}

  function bar(x,y,w,h,val,max,color){ctx.fillStyle='#060708';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#7f8586';ctx.strokeRect(x-.5,y-.5,w+1,h+1);ctx.fillStyle=color;ctx.fillRect(x+1,y+1,(w-2)*clamp(val/max,0,1),h-2);}
  function drawHUD(){bar(20,16,133,7,player.hp,player.maxHp,RED);bar(20,28,104,5,player.sp,100,'#c9d0d2');ctx.fillStyle=PALE;ctx.font='7px monospace';ctx.fillText('ZERO // 00',20,11);ctx.textAlign='right';ctx.fillText(`${boss.d.id} // ${boss.d.ko}`,460,11);bar(276,16,184,7,boss.hp,boss.maxHp,RED);ctx.textAlign='left';['Q','W','E','R'].forEach((k,i)=>{const x=20+i*24;ctx.strokeStyle='#687075';ctx.strokeRect(x,39,18,15);ctx.fillStyle=player.cool[i]>0?'#4c5052':PALE;ctx.fillText(k,x+6,49);if(player.cool[i]>0){ctx.fillStyle='#111';ctx.fillRect(x+1,40,16,13*player.cool[i]/[3.5,5,7,11][i]);}});}

  function renderCombat(){drawBackground(bossIndex);drawHazards();boss.draw();player.draw();drawSlashes();drawParticles();drawHUD();for(const m of messages){ctx.globalAlpha=clamp(m.life*3,0,1);ctx.fillStyle=PALE;ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(m.text,W/2,73);ctx.globalAlpha=1;ctx.textAlign='left';}if(paused)overlay('PAUSED','ESC — 계속');}
  function overlay(title,sub){ctx.fillStyle='rgba(3,4,5,.82)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='22px Georgia';ctx.fillText(title,W/2,120);ctx.fillStyle='#8b9092';ctx.font='8px monospace';ctx.fillText(sub,W/2,140);ctx.textAlign='left';}
  function titleScreen(){drawBackground(0);ctx.fillStyle='rgba(2,3,4,.55)';ctx.fillRect(0,0,W,H);ctx.fillStyle=PALE;ctx.font='52px Georgia';ctx.fillText('EDEN',28,91);ctx.fillStyle=RED;ctx.fillRect(30,101,174,2);ctx.fillStyle='#8c9294';ctx.font='8px monospace';ctx.fillText('SPECIAL COMBAT ENTITY // 00',31,117);const has=!!load();const items=has?['계속','새 게임']:['기동'];items.forEach((v,i)=>{ctx.fillStyle=i===menu?PALE:'#666b6d';ctx.font=i===menu?'12px sans-serif':'10px sans-serif';ctx.fillText((i===menu?'› ':'  ')+v,34,177+i*24);});ctx.font='7px monospace';ctx.fillStyle='#4d5254';ctx.fillText('ENTER — SELECT',34,246);}
  function storyScreen(){drawBackground(bossIndex);ctx.fillStyle='rgba(3,4,5,.8)';ctx.fillRect(0,0,W,H);const s=STORY[Math.min(bossIndex,STORY.length-1)];ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText(`RECORD ${String(bossIndex+1).padStart(2,'0')}`,38,62);ctx.fillStyle=PALE;ctx.font='25px Georgia';ctx.fillText(s[0],38,91);ctx.fillStyle='#a4a7a7';ctx.font='10px sans-serif';ctx.fillText(s[1],39,127);ctx.fillText(s[2],39,146);ctx.fillStyle='#626768';ctx.font='7px monospace';ctx.fillText('ENTER — 다음 작전',39,214);}
  function introScreen(){drawBackground(bossIndex);boss.draw();player.draw();ctx.fillStyle='rgba(3,4,5,.52)';ctx.fillRect(0,0,W,H);ctx.fillStyle=RED;ctx.font='8px monospace';ctx.fillText(`BOSS ${String(bossIndex+1).padStart(2,'0')} // ${boss.d.zone}`,28,55);ctx.fillStyle=PALE;ctx.font='31px Georgia';ctx.fillText(boss.d.id,28,88);ctx.font='11px sans-serif';ctx.fillText(boss.d.ko,30,107);ctx.fillStyle='#929798';ctx.font='9px sans-serif';boss.d.intro.split('\n').forEach((l,i)=>ctx.fillText(l,30,146+i*16));ctx.fillStyle='#666b6d';ctx.font='7px monospace';ctx.fillText('ENTER — 교전 개시',30,213);}
  function endingScreen(){drawBackground(6);ctx.fillStyle='rgba(2,3,4,.72)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle=PALE;ctx.font='30px Georgia';ctx.fillText('EDEN // SEVERED',W/2,75);ctx.fillStyle=RED;ctx.fillRect(145,88,190,1);ctx.fillStyle='#b5b7b6';ctx.font='10px sans-serif';ctx.fillText('최초의 명령은 끝났다.',W/2,124);ctx.fillText('ZERO는 낙원의 문을 열어 둔 채, 이름 없는 세계로 걸어간다.',W/2,144);ctx.fillStyle='#666';ctx.font='7px monospace';ctx.fillText('ENTER — 기록 초기화 / TITLE',W/2,216);ctx.textAlign='left';}

  function update(dt){time+=dt;shake=Math.max(0,shake-dt*15);flash=Math.max(0,flash-dt);if(pressed.has('escape')&&state==='combat')paused=!paused;if(paused)return;
    if(state==='title'){const max=load()?1:0;if(pressed.has('arrowup')||pressed.has('w'))menu=Math.max(0,menu-1);if(pressed.has('arrowdown')||pressed.has('s'))menu=Math.min(max,menu+1);if(pressed.has('enter')){const old=load();if(old&&menu===0){bossIndex=clamp(old.boss||0,0,6);startBoss();}else{clearSave();bossIndex=0;state='interlude';}}}
    else if(state==='interlude'&&pressed.has('enter'))startBoss();
    else if(state==='intro'&&pressed.has('enter')){state='combat';boss.inv=.8;message('ENGAGE',.8);}
    else if(state==='combat')updateCombat(dt);
    else if(state==='gameover'&&pressed.has('enter'))startBoss();
    else if(state==='ending'&&pressed.has('enter')){clearSave();bossIndex=0;menu=0;state='title';}
  }
  function render(){ctx.save();if(shake)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));if(state==='title')titleScreen();else if(state==='interlude')storyScreen();else if(state==='intro')introScreen();else if(state==='combat')renderCombat();else if(state==='gameover'){renderCombat();overlay('SYSTEM FAILURE','ENTER — 체크포인트 재기동');}else if(state==='ending')endingScreen();ctx.restore();if(flash){ctx.fillStyle=`rgba(255,255,255,${flash*2})`;ctx.fillRect(0,0,W,H);}ctx.fillStyle='rgba(255,255,255,.025)';for(let y=0;y<H;y+=3)ctx.fillRect(0,y,W,1);}

  let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);render();pressed.clear();requestAnimationFrame(loop);}requestAnimationFrame(loop);document.querySelector('#boot').classList.add('ready');
})();
