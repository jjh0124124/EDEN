/* Original layered pixel artwork and synthesis. No downloaded production assets. */
window.EdenPresentation = (() => {
  const C = { ink:'#080b10', edge:'#181f29', steel:'#555f6e', light:'#afbac5', white:'#ece8df', red:'#f02146', blood:'#730d28', blue:'#637e8b' };
  const art={};
  for(const [key,path] of Object.entries({zeroDrive:'characters/zero/zero-drive.png',combatVFX:'effects/neural-impact.png',surgeonLow:'characters/bosses/surgeon-low-cut.png',zeroDuel:'characters/zero/zero-duel.png',surgeonDuel:'characters/bosses/surgeon-duel.png',zero:'characters/zero/zero-generated.png',surgeon:'characters/bosses/surgeon-generated.png',cathedral:'environments/surgical-cathedral.png'})){
    const image=new Image();image.onload=()=>{art[key]=image;};image.src='assets/'+path;
  }
  // Source rectangles and pelvis anchors are explicit: generated sheets do not
  // have a reliable uniform grid. Never use concept-sheet fragments as sprites.
  const zeroFrames=[
    [[74,2,214,275,200],[407,2,218,275,542],[743,2,233,275,886],[1112,2,210,275,1238]],
    [[22,287,302,262,200],[369,299,291,249,530],[726,290,320,261,887],[1095,287,283,259,1245]],
    [[23,546,252,283,192],[302,550,430,279,468],[704,549,414,280,843],[1125,546,205,283,1240]],
    [[28,831,246,280,192],[324,835,348,276,467],[680,832,456,279,807],[1118,827,218,284,1240]]
  ];
  const duelFrames=[
    [[30,10,320,325,236],[390,10,355,325,586],[765,10,425,325,941],[1190,10,340,325,1374]],
    [[30,345,325,328,252],[385,345,360,328,588],[765,345,420,328,942],[1190,345,340,328,1374]],
    [[25,678,340,320,231],[380,678,405,320,573],[785,678,405,320,970],[1190,678,340,320,1374]]
  ];
  const surgeonDuelFrames=[
    [5,60,350,440,160],[375,10,400,490,565],[730,65,540,435,1004],[1215,65,320,435,1370],
    [5,530,350,470,160],[375,500,380,500,545],[715,545,540,455,1000],[1215,535,320,465,1370]
  ];
  const driveFrames=[
    [15,35,365,450,235],[395,35,355,450,600],[750,35,405,450,1040],[1175,30,360,455,1380],
    [0,540,465,445,205],[470,530,310,455,660],[785,535,385,450,1040],[1190,535,330,450,1370]
  ];
  const effectFrames={
    boost:[[165,160,200,210,292],[430,160,310,210,670],[760,160,390,210,1080],[1160,160,376,210,1475]],
    hit:[[100,590,260,300,190],[400,590,365,300,520],[785,590,365,300,925],[1180,590,355,300,1350]]
  };
  function drawCombatVFX(c,p){
    if(!art.combatVFX)return;
    const kind=p.sprite==='boost'?'boost':'hit',progress=Math.max(0,Math.min(.999,1-p.life/p.max));
    const frame=Math.floor(progress*4),scale=(kind==='boost'?.13:.12)*(p.effectScale||1);
    c.save();c.globalAlpha=1;c.translate(Math.round(p.x),Math.round(p.y));c.scale(p.dir||1,1);
    sprite(c,art.combatVFX,effectFrames[kind][frame],scale,kind==='boost'?274:738);c.restore();
  }
  function sprite(c,image,frame,scale,baseline,clip){
    const [x,y,w,h,anchor]=frame;
    c.save();c.translate(-(anchor-x)*scale,-(baseline-y)*scale);c.scale(scale,scale);
    if(clip){c.beginPath();clip.forEach(([a,b],i)=>i?c.lineTo(a,b):c.moveTo(a,b));c.closePath();c.clip();}
    c.drawImage(image,x,y,w,h,0,0,w,h);c.restore();
  }
  const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const poly=(c,pts,color)=>{c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
  function line(c,x,y,X,Y,color,w=1){
    // Rasterized strokes keep articulated machinery pixel sharp even when rotated.
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(X-x),Math.abs(Y-y))));
    for(let i=0;i<=n;i++)rect(c,x+(X-x)*i/n-w/2,y+(Y-y)*i/n-w/2,w,w,color);
  }
  function ring(c,x,y,r,color,start=0,end=Math.PI*2){for(let a=start;a<end;a+=.06)rect(c,x+Math.cos(a)*r,y+Math.sin(a)*r,1,1,color);}
  function joint(c,x,y,r=3){ring(c,x,y,r,C.ink);ring(c,x,y,r-1,C.light);rect(c,x-1,y-1,2,2,C.red);}
  function limb(c,a,b,width=6){line(c,...a,...b,C.ink,width+3);line(c,...a,...b,C.steel,width);line(c,a[0]-1,a[1],b[0]-1,b[1],C.light,1);joint(c,...b);}
  function plate(c,x,y,w,h,color=C.steel){poly(c,[[x+2,y],[x+w,y],[x+w-2,y+h],[x,y+h-2]],C.ink);poly(c,[[x+3,y+1],[x+w-1,y+1],[x+w-3,y+h-2],[x+1,y+h-3]],color);line(c,x+3,y+1,x+w-2,y+1,C.light);rect(c,x+3,y+3,1,1,C.white);}
  function cloth(c,x,y,w,h,t,color=C.steel){const drift=Math.sin(t)*3;poly(c,[[x,y],[x+w,y],[x+w+drift+4,y+h-4],[x+w/2+drift,y+h],[x+drift-5,y+h-7]],color);for(let i=2;i<w;i+=4)line(c,x+i,y+3,x+i+drift,y+h-5,i%3?C.edge:C.light);}
  function zero(c,p,t){
    c.save();c.translate(Math.round(p.x+9),Math.round(p.y));c.scale(p.face,1);
    if(p.stun>0){c.translate(-Math.sin(p.stun/.18*Math.PI)*4,2);c.rotate(-.12*Math.sin(p.stun/.18*Math.PI));}
    if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha=.55;
    const running=Math.min(1,Math.abs(p.vx)/90), stride=Math.sin(t*18)*7*running;
    const airborne=!p.onGround, attack=p.attack>0;
    const progress=attack?1-p.attack/(p.attackDuration||.4):0;
    const extension=attack?Math.sin(Math.PI*Math.max(0,Math.min(1,(progress-.18)/.68))):0;
    const mode=p.weaponMode||'kick', heavy=mode==='heavy', rail=mode==='rail', pile=mode==='pile', crown=mode==='crown';
    const bob=airborne?0:Math.round(Math.abs(Math.sin(t*9))*running);
    const hip=[-extension*4,23+bob], backKnee=[-6-stride*.6,34], frontKnee=attack?[5+extension*15,34-extension*(pile?-3:13)]:[4+stride*.6,34];
    const backFoot=[-5+stride,44],frontFoot=attack?[6+extension*(heavy?36:29),44-extension*(pile?0:p.attackKind===3?42:24)]:[6-stride,44];
    if(airborne&&!attack){const tuck=Math.max(0,1-Math.abs(p.vy||0)/260);frontKnee[0]+=6*tuck;frontKnee[1]-=5*tuck;frontFoot[0]-=8*tuck;frontFoot[1]-=10*tuck;backFoot[0]-=5*tuck;backFoot[1]-=4*tuck;}
    cloth(c,-8,15,9,23,t*11,'#20232e');cloth(c,-12,14,5,21,t*11+.8,'#45424b');
    limb(c,hip,backKnee,5);limb(c,backKnee,backFoot,4);plate(c,backFoot[0]-3,backFoot[1]-1,10,3);
    limb(c,hip,frontKnee,6);limb(c,frontKnee,frontFoot,4);plate(c,frontFoot[0]-2,frontFoot[1]-2,12,4,C.light);
    line(c,frontKnee[0]+2,frontKnee[1],frontFoot[0]+2,frontFoot[1]-3,C.red,2);
    // Weapon deploys from shin and heel; both hands stay empty.
    const deploy=attack?Math.min(1,progress*6)*(1-Math.max(0,(progress-.8)*5)):0;
    if(deploy>0){
      const foot=frontFoot, knee=frontKnee;
      for(let s of[-1,1]){
        line(c,knee[0]+s*deploy*5,knee[1],foot[0]+s*deploy*5,foot[1],C.light,2);
        line(c,knee[0],knee[1],knee[0]+s*deploy*5,knee[1]-2,C.steel);
      }
      if(rail){
        for(let s of[-1,1]){line(c,foot[0]-6,foot[1]+s*4,foot[0]+24*deploy,foot[1]+s*4,C.steel,3);line(c,foot[0],foot[1]+s*3,foot[0]+24*deploy,foot[1]+s*3,C.red);}
        ring(c,foot[0]+24*deploy,foot[1],3+progress*3,C.white);
      }else if(pile){line(c,foot[0],foot[1]-10,foot[0],foot[1]+deploy*9,C.light,4);poly(c,[[foot[0]-3,foot[1]+4],[foot[0]+3,foot[1]+4],[foot[0],foot[1]+13*deploy]],C.red);
      }else{
        const length=(heavy?31:crown?36:20)*deploy;
        poly(c,[[foot[0]-3,foot[1]-4],[foot[0]+length,foot[1]-12],[foot[0]+length*.6,foot[1]+2],[foot[0],foot[1]+4]],C.ink);
        poly(c,[[foot[0],foot[1]-3],[foot[0]+length-2,foot[1]-10],[foot[0]+length*.6-1,foot[1]],[foot[0],foot[1]+2]],C.light);
        line(c,foot[0],foot[1]-3,foot[0]+length-2,foot[1]-10,C.red,2);
      }
      if(extension>.5)for(let i=0;i<4;i++)line(c,-8-i*4,32+i*3,-16-i*5,32+i*3,i%2?C.red:C.steel);
    }
    if(p.dash>0){line(c,-4,37,-20,42,C.red,3);line(c,5,40,-10,44,C.white,2);}
    poly(c,[[-7,10+bob],[4,9+bob],[8,21+bob],[-6,26+bob],[-10,17+bob]],C.ink);
    plate(c,-7,11+bob,13,10,'#303945');plate(c,-9,10,6,6);line(c,-5,15,4,20,C.red,2);
    for(let i=0;i<3;i++)plate(c,-7+i*4,23,4,3,C.steel);
    limb(c,[-7,13],[-12,21],4);limb(c,[-12,21],[-10,27],3);
    const hand=attack?[-3,17]:[9,24];limb(c,[5,12],[attack?9:11,attack?10:17],4);limb(c,[attack?9:11,attack?10:17],hand,3);joint(c,...hand,2);
    poly(c,[[-5,2],[4,1],[7,5],[4,10],[-3,9]],'#c7b6b4');
    poly(c,[[-7,2],[-4,-2],[1,-3],[5,0],[8,2],[5,3],[5,7],[2,4],[0,7],[-2,3],[-7,6],[-5,2]],'#24272f');
    line(c,-5,0,0,-2,C.steel);rect(c,4,5,3,1,C.red);rect(c,-5,9,11,3,C.ink);rect(c,-5,10,4,1,C.red);
    if(p.dash>0){for(let i=0;i<5;i++)line(c,-15-i*4,15+i*5,-30-i*7,15+i*5,i%2?C.red:C.steel);}
    c.restore();
  }
  function boss(c,b,t){
    if(b.d.type==='surgeon'&&art.surgeonLow&&!b.dead&&b.move%3===0&&b.release>0&&b.hitFlash<=0){
      c.save();c.translate(Math.round(b.x+b.w/2),Math.round(b.y+b.h));c.scale(-b.dir,1);
      sprite(c,art.surgeonLow,[0,0,1254,1254,833],.125,1063);c.restore();return;
    }
    if(b.d.type==='surgeon'&&art.surgeonDuel&&!b.dead){
      const row=b.move%3===0?0:4,index=b.hitFlash>0||b.retreat?.age>0||b.recovery>0&&b.release<=0?row+3:b.windup>0||b.retreat?row+1:b.release>0?row+2:row;
      const frame=surgeonDuelFrames[index];let clip=null;
      if(index===2||index===6)clip=[[0,0],[465,0],[465,270],[540,340],[540,455],[130,455],[130,200],[0,140]];
      if(index===3||index===7)clip=[[0,0],[320,0],[320,465],[55,465],[55,310],[0,260]];
      c.save();c.translate(Math.round(b.x+b.w/2),Math.round(b.y+b.h));c.scale(-b.dir,1);
      sprite(c,art.surgeonDuel,frame,.22,index<4?496:995,clip);c.restore();return;
    }
    if(b.d.type==='surgeon'&&art.surgeon){
      const frames=[[13,22,442,679,205],[509,22,521,679,745],[1042,52,703,649,1467],[1781,107,378,594,1980]];
      const index=b.dead||b.hitFlash>0?3:b.windup>0||b.tele>0?1:b.release>0?2:0;
      c.save();c.translate(Math.round(b.x+b.w/2),Math.round(b.y+b.h));c.scale(-b.dir,1);
      if(b.dead)c.globalAlpha=Math.max(.05,1-(b.deathAge||0)/2.6);
      sprite(c,art.surgeon,frames[index],.155,695);
      if(b.phase===2){ring(c,0,-94,21,C.red);for(let i=0;i<7;i++)rect(c,Math.sin(i*3+t)*40,-((t*22+i*13)%100),1,3,C.red);}
      c.restore();return;
    }
    c.save();c.translate(Math.round(b.x+b.w/2),Math.round(b.y));
    const a=b.anim, wind=b.windup>0, pulse=Math.sin(a*4), spread=b.phase===2?1.25:1;
    if(b.dead){c.globalAlpha=Math.max(.1,b.deathOpacity??.6);c.translate(0,Math.min(14,(b.deathAge||0)*10));}
    if(b.hitFlash>0)c.globalAlpha=.65;
    const type=b.d.type;
    if(type==='hound'){
      c.scale(-b.dir,1);
      for(let s of[-1,1]){limb(c,[-16,38],[-25+s*5+Math.sin(a*13)*4,53],6);limb(c,[-25+s*5,53],[-35+s*10,70],4);limb(c,[18,37],[25+s*6,51],6);limb(c,[25+s*6,51],[32+s*6,70],4);}
      poly(c,[[-30,35],[-18,24],[13,22],[31,33],[19,48],[-19,46]],C.ink);
      for(let i=0;i<7;i++)plate(c,-24+i*7,26+Math.abs(i-3)*2,10,14,i%2?C.steel:C.edge);
      poly(c,[[20,24],[36,20],[49,31],[46,41],[26,40]],C.steel);line(c,27,35,47,36,C.ink,4);
      for(let i=0;i<6;i++)poly(c,[[28+i*3,34],[30+i*3,34],[29+i*3,39]],C.white);
      rect(c,35,27,9,2,C.red);line(c,-28,35,-40,17,C.steel,4);line(c,-40,17,-46,23,C.red,2);
      for(let i=0;i<4;i++)poly(c,[[-21+i*10,26],[-24+i*10,14],[-16+i*10,24]],C.light);
    }else if(type==='warden'||type==='exodus'){
      const wide=type==='exodus';
      for(let s of[-1,1]){limb(c,[s*12,44],[s*18,58],10);limb(c,[s*18,58],[s*23,70],8);plate(c,s*23-7,68,17,5);}
      plate(c,-23,18,46,34,C.edge);for(let j=0;j<4;j++)for(let i=0;i<4;i++)plate(c,-21+i*11,20+j*7,10,6,j%2?C.steel:C.edge);
      plate(c,-10,4,20,17,C.light);rect(c,-6,9,13,7,C.ink);rect(c,-5,11,10,2,C.red);
      for(let s of[-1,1]){limb(c,[s*20,23],[s*31,37],8);limb(c,[s*31,37],[s*35,53],6);}
      if(wide){for(let s of[-1,1])for(let i=0;i<3;i++){plate(c,s*(26+i*10)-5,8+i*4,10,27);rect(c,s*(26+i*10)-3,10+i*4,5,12,C.blood);line(c,s*(26+i*10),37+i*4,s*(26+i*10),45+i*4,C.red,2);}ring(c,0,33,12,C.red);}
      else{plate(c,-46,24,20,48,C.edge);for(let i=0;i<6;i++)line(c,-43,28+i*6,-30,28+i*6,C.light);line(c,36,25,36,71,C.light,3);plate(c,24,20,27,14,C.steel);rect(c,-42,29,2,35,C.red);}
    }else{
      const surgeon=type==='surgeon',oracle=type==='oracle',director=type==='director';
      cloth(c,-13,19,26,49,a*2,C.white);cloth(c,-19,28,10,39,a*2+.5,'#8c8b94');cloth(c,9,28,11,38,a*2+1,'#b2b0b5');
      for(let i=0;i<11;i++){let y=31+i*3;rect(c,-4+Math.sin(i*5)*9,y,2+(i%3),2,C.blood);}line(c,0,24,0,63,C.red,2);
      plate(c,-11,14,22,15,C.edge);for(let s of[-1,1]){const hand=[s*(wind?32:24),wind?18:42+pulse*2];limb(c,[s*13,21],[s*20,30],5);limb(c,[s*20,30],hand,4);for(let f=0;f<3;f++)line(c,hand[0]+f-1,hand[1],hand[0]+f-2,hand[1]+7,C.light);}
      poly(c,[[-6,3],[5,3],[7,9],[2,16],[-5,12]],'#d4c9c6');cloth(c,-8,0,16,27,a,'#a3a0aa');poly(c,[[-4,3],[5,4],[4,12],[0,16],[-4,11]],'#d9c7c9');rect(c,-2,8,6,1,C.red);
      ring(c,0,-2,18,C.steel);ring(c,0,-2,20,C.red);for(let i=0;i<8;i++){const q=i*Math.PI/4+a*.3;line(c,Math.cos(q)*18,Math.sin(q)*18-2,Math.cos(q)*23,Math.sin(q)*23-2,C.light);}
      if(surgeon){for(let s of[-1,1])for(let i=0;i<3;i++){const x=s*(25+i*10)*spread,y=-12+i*20+Math.sin(a*2+i)*3;line(c,s*9,22,x,y,C.steel,2);plate(c,x-4,y,9,22,C.light);rect(c,x-2,y+4,4,13,C.blood);rect(c,x-1,y+7,2,9,C.red);line(c,x,y+22,x,y+34,C.light);line(c,x-6,y+1,x+6,y+1,C.light,2);}}
      if(type==='seraph'){for(let s of[-1,1])for(let i=0;i<6;i++){const x=s*(25+i*7)*spread,y=5+i*4+Math.sin(a*2)*4;line(c,s*12,23,x,y,C.light,3);poly(c,[[x,y],[x+s*5,y-12],[x+s*8,y+25-i*2],[x,y+19]],i%2?C.light:C.steel);line(c,x,y+4,x+s*6,y+24-i*2,C.red);}}
      if(oracle){for(let i=0;i<3;i++){ring(c,0,22,31+i*7,i%2?C.red:C.steel,a*(i%2?1:-1),a*(i%2?1:-1)+4.7);}for(let i=0;i<4;i++){const q=i*Math.PI/2+a;const x=Math.cos(q)*43,y=22+Math.sin(q)*30;plate(c,x-4,y-3,9,7);rect(c,x-2,y,4,1,C.red);}}
      if(director){for(let s of[-1,1])for(let i=0;i<4;i++){const x=s*(24+i*9),y=-15+i*9;plate(c,x-5,y,10,28,C.edge);for(let j=0;j<4;j++)rect(c,x-3,y+4+j*5,5,1,j===2?C.red:C.light);line(c,x,y+28,s*9,48,C.blood);}ring(c,0,22,47,C.steel,0,Math.PI);}
    }
    if(b.phase===2){for(let i=0;i<12;i++){const x=Math.sin(i*5+a)*42,y=70-((a*30+i*11)%90);rect(c,x,y,1,3,i%3?C.red:C.white);}}
    c.restore();
  }
  const caches=new Map();
  function background(c,zone,t){
    if(!caches.has(zone)){
      const tile=document.createElement('canvas');tile.width=480;tile.height=270;const g=tile.getContext('2d');
      rect(g,0,0,480,270,'#080c13');
      // Distant city: authored repeatable geometry, no random shimmer per frame.
      for(let i=0;i<24;i++){const x=i*23-10,h=35+(i*47%91);rect(g,x,170-h,17,h,'#101823');for(let y=175-h;y<163;y+=7)for(let k=0;k<3;k++)if((i+k+y)%4)rect(g,x+2+k*5,y,2,1,'#303a48');}
      for(let x=20;x<480;x+=88){
        poly(g,[[x,214],[x,61],[x+32,27],[x+64,61],[x+64,214],[x+58,214],[x+58,64],[x+32,39],[x+6,64],[x+6,214]],'#252e3b');
        line(g,x+4,61,x+32,31,C.steel);line(g,x+32,31,x+60,61,C.steel);
        for(let y=69;y<210;y+=13){plate(g,x-3,y,11,10,'#27303a');plate(g,x+59,y,11,10,'#27303a');}
        for(let k=0;k<3;k++)line(g,x+27+k*5,46,x+27+k*5,119,'#252d39');
      }
      for(let x=0;x<480;x+=12){rect(g,x,0,8,14,C.edge);rect(g,x+1,4,6,1,C.steel);}
      for(let i=0;i<13;i++){let x=i*39+5;for(let y=12;y<112+(i*17%65);y++)rect(g,x+Math.sin(y*.025+i)*8,y,2,1,i%3?'#24202b':'#44202d');joint(g,x+Math.sin((112+i*17%65)*.025+i)*8,112+i*17%65,2);}
      if(zone===0){for(let x of[38,137,314,421]){plate(g,x-12,130,25,80,C.edge);rect(g,x-9,137,18,58,'#25313c');rect(g,x-7,140,2,52,'#626676');poly(g,[[x-3,149],[x+3,149],[x+5,184],[x-5,184]],'#7c7482');rect(g,x-2,143,5,6,'#9a9199');for(let y=140;y<195;y+=8)rect(g,x+4,y,1,4,C.blood);plate(g,x-15,198,31,10);}}
      if(zone===1){for(let x=10;x<480;x+=45){plate(g,x,143,34,67,C.edge);for(let i=0;i<6;i++)line(g,x+3+i*5,149,x+3+i*5,204,C.steel);rect(g,x+5,145,24,2,C.blood);}}
      if(zone===2){plate(g,194,91,92,122,C.edge);for(let x=202;x<279;x+=10)plate(g,x,100,9,105);line(g,238,96,238,210,C.red,2);}
      if(zone===3){for(let x=34;x<480;x+=70){plate(g,x,117,24,95,C.edge);for(let y=128;y<202;y+=9)rect(g,x+4,y,16,3,C.blood);}}
      if(zone===4||zone===6){for(let x=10;x<480;x+=70){plate(g,x,114,58,39);rect(g,x+3,118,52,30,C.ink);for(let y=122;y<145;y+=5)rect(g,x+7,y,23+((x+y)%21),1,C.blue);}}
      if(zone===5){for(let x=10;x<480;x+=55){plate(g,x,141,45,70,C.edge);for(let i=0;i<3;i++)plate(g,x+4+i*12,148,10,48);rect(g,x+7,156,29,2,C.blood);}}
      for(let x=0;x<480;x+=32){plate(g,x,212,31,14,C.edge);rect(g,x+3,215,19,1,C.light);rect(g,x+23,218,5,3,C.red);}
      rect(g,0,226,480,44,'#101620');for(let x=0;x<480;x+=30){line(g,x,229,x-24,270,'#41404b');line(g,x+1,229,x-23,270,'#080c13');}for(let y=232;y<270;y+=9)line(g,0,y,480,y,'#222b35');
      for(let i=0;i<70;i++)rect(g,(i*137)%480,228+(i*17)%40,2+(i%4),1,i%4?'#34313b':C.blood);
      caches.set(zone,tile);
    }
    c.drawImage(caches.get(zone),0,0);
    if(art.cathedral&&(zone===0||zone===6)){
      c.drawImage(art.cathedral,0,7,480,270);
      c.fillStyle='rgba(5,8,15,.12)';c.fillRect(0,0,480,211);
      if(zone===6){c.fillStyle='rgba(74,0,20,.2)';c.fillRect(0,0,480,270);}
    }
    ring(c,240,108,46,zone===4?C.blue:'#4c2639');ring(c,240,108,39,'#353d49');
    for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.08;rect(c,240+Math.cos(a)*43,108+Math.sin(a)*43,2,2,C.red);}
    c.font='6px monospace';c.fillStyle='#646c7b';c.fillText(['EDEN / BIO-SYNTHESIS','QUARANTINE / K9','LOCKDOWN / 09','THERMAL / ASCENT','DA’AT / PREDICTION','ARK / FREIGHT','ROOT / ADMIN'][zone],17,88);
    for(let i=0;i<22;i++){let x=(i*43+t*(2+i%3))%480,y=90+(i*29+t*(1+i%2))%120;rect(c,x,y,1,1,i%4?'#414050':'#be2543');}
    rect(c,0,226,480,1,C.light);
  }
  class Soundtrack {
    constructor(){this.ctx=null;this.muted=false;this.beat=0;this.clock=0;}
    wake(){try{if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume();}catch{}}
    tone(freq=80,dur=.08,type='sawtooth',vol=.035,drop=0){if(!this.ctx||this.muted)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(freq,this.ctx.currentTime);if(drop)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq-drop),this.ctx.currentTime+dur);f.type='lowpass';f.frequency.value=1400;g.gain.setValueAtTime(vol,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,this.ctx.currentTime+dur);o.connect(f).connect(g).connect(this.ctx.destination);o.start();o.stop(this.ctx.currentTime+dur);}
    noise(duration=.12,volume=.04){if(!this.ctx||this.muted)return;const n=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*duration),this.ctx.sampleRate),data=n.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length)**3;const s=this.ctx.createBufferSource(),g=this.ctx.createGain(),f=this.ctx.createBiquadFilter();s.buffer=n;f.type='highpass';f.frequency.value=800;g.gain.value=volume;s.connect(f).connect(g).connect(this.ctx.destination);s.start();}
    tick(dt,zone,active,phase){if(!this.ctx||this.muted)return;this.clock-=dt;if(this.clock>0)return;this.clock=active?(phase===2?.22:.3):.65;const roots=[43.65,36.71,32.7,49,38.89,29.14,41.2],root=roots[zone]||roots[0],b=this.beat++;
      if(active){this.tone(root*[1,1,1.5,1,1,1.125,1,2][b%8],.23,'triangle',.035);if(b%2===0)this.tone(92,.13,'sine',.055,64);if(b%4===2)this.noise(.13,.028);if(b%2||phase===2)this.noise(.025,.012);}
      if(b%8===0){this.tone(root*2,1.8,'sine',.022);this.tone(root*3.01,1.9,'triangle',.01);}
    }
  }
  const zeroStates=['idle','run','jump','dash','light1','light2','light3','heavy','rail','pile','crown','hit'];
  const atlas=new Image();let atlasReady=false;
  atlas.onload=()=>{atlasReady=atlas.naturalWidth===2048&&atlas.naturalHeight===2304;};
  atlas.src='assets/characters/zero/zero-atlas.png';
  // First-operation pose selection uses contact times, not a global animation clock.
  function duelPose(p){
    if(!p.duelMode||p.hp<=0||p.stun>0)return null;
    if(p.dash>0)return {row:0,frame:1};
    if(p.charging)return {row:p.parryWindow>0?0:2,frame:p.parryWindow>0?1:0};
    if(p.attack>0&&['kick','heavy','triple','crown','pile','drive'].includes(p.weaponMode)){
      const elapsed=(p.attackDuration||.4)-p.attack;
      let row=p.weaponMode==='kick'?Math.max(0,Math.min(2,(p.attackKind||1)-1)):2;
      let contact=p.weaponMode==='kick'?(p.attackKind===3?.11:.06):p.weaponMode==='crown'?.18:p.weaponMode==='pile'?.28:.12;
      let recovery=contact+.12;
      if(p.weaponMode==='triple'){row=elapsed<.14?0:elapsed<.25?1:2;contact=[.08,.18,.30][row];recovery=[.14,.25,.44][row];}
      return {row,frame:elapsed<contact*.45?0:elapsed<contact?1:elapsed<recovery?2:3};
    }
    if(p.attack>0)return null;
    if(!p.onGround)return {row:0,frame:p.vy<0?1:3};
    if(Math.abs(p.vx||0)<=12)return {row:0,frame:0};
    return null;
  }
  function drawZero(c,p,t){
    if(art.zeroDuel&&p.hp>0&&p.stun<=0&&p.dash<=0&&p.onGround&&(p.parryFlash>0||p.charging&&p.parryWindow>0)){
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+(p.h||48)));c.scale(p.face,1);
      sprite(c,art.zeroDuel,duelFrames[0][1],.17,330);c.restore();return;
    }
    if(p.duelMode&&art.zeroDrive&&p.weaponMode==='drive'&&p.attack>0&&p.stun<=0&&p.hp>0&&p.dash<=0){
      const elapsed=(p.attackDuration||.52)-p.attack,starts=[0,.05,.10,.14,.28,.34,.42,.49];
      let frame=0;for(let i=1;i<starts.length;i++)if(elapsed>=starts[i])frame=i;
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+(p.h||48)));c.scale(p.face,1);
      if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha*=.55;
      sprite(c,art.zeroDrive,driveFrames[frame],.13,frame<4?474:970,frame===4?[[0,0],[465,0],[465,220],[390,220],[390,445],[0,445]]:null);c.restore();return;
    }
    const pose=duelPose(p);
    if(pose&&art.zeroDuel){
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+(p.h||48)));c.scale(p.face,1);
      if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha*=.55;
      sprite(c,art.zeroDuel,duelFrames[pose.row][pose.frame],.17,[330,667,991][pose.row]);c.restore();return;
    }
    const elapsed=(p.attackDuration||.4)-(p.attack||0),sweep=p.weaponMode==='kick'&&p.attackKind===3||p.weaponMode==='triple'&&elapsed>=.25;
    if(!sweep&&art.zeroDuel&&p.stun<=0&&p.hp>0&&(p.charging||p.attack>0&&['kick','heavy','triple','crown'].includes(p.weaponMode))){
      const elapsed=(p.attackDuration||.4)-(p.attack||0),progress=elapsed/(p.attackDuration||.4);
      let row=p.weaponMode==='kick'?Math.min(2,(p.attackKind||1)-1):2;
      let frame=p.charging?0:progress<.12?0:progress<.25?1:progress<.65?2:3;
      if(p.weaponMode==='triple'){row=elapsed<.14?0:elapsed<.25?1:2;const start=[0,.14,.25][row],contact=[.08,.18,.30][row];frame=elapsed<contact?1:elapsed<contact+.13?2:3;}
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+(p.h||48)));c.scale(p.face,1);
      if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha*=.55;
      sprite(c,art.zeroDuel,duelFrames[row][frame],.17,[330,667,991][row]);c.restore();return;
    }
    if(p.h===48&&!art.zero){c.save();c.translate(p.x+9,p.y+48);c.scale(.8,.8);drawZero(c,{...p,x:-9,y:-60,h:60},t);c.restore();return;}
    if(art.zero){
      let row=0,frame=Math.floor(t*5)%4;
      if(p.stun>0||p.hp<=0){row=2;frame=3;}
      else if(p.charging){row=2;frame=0;}
      else if(p.attack>0){row=p.weaponMode==='rail'?3:2;const progress=Math.max(0,Math.min(.999,1-p.attack/(p.attackDuration||.4)));frame=p.weaponMode==='rail'?(progress<.25?0:progress<.52?1:progress<.78?2:3):(progress<.12?0:progress<.25?1:progress<.65?2:3);if(sweep&&p.weaponMode==='triple')frame=elapsed<.3?1:elapsed<.43?2:3;}
      else if(p.dash>0||Math.abs(p.vx)>12){row=1;frame=p.duelMode?Math.floor(p.stridePhase||0)%4:Math.floor(t*11)%4;}
      else if(!p.onGround){row=1;frame=p.vy<0?1:3;}
      const data=zeroFrames[row][frame];
      let clip=null;
      if(row===2&&frame===1)clip=[[0,0],[430,0],[430,70],[385,90],[385,279],[0,279]];
      if(row===2&&frame===2)clip=[[30,0],[414,0],[414,280],[0,280],[0,110],[30,100]];
      if(row===3&&frame===2)clip=[[0,0],[456,0],[456,120],[430,150],[430,279],[0,279]];
      if(row===3&&frame===3)clip=[[25,0],[218,0],[218,284],[0,284],[0,180],[25,160]];
      c.save();c.translate(Math.round(p.x+9),Math.round(p.y+(p.h||60)));c.scale(p.face,1);
      if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha*=.55;
      if(p.stun>0)c.rotate(-.1*p.stun/.18);
      sprite(c,art.zero,data,p.h===48?.20:.24,[273,545,823,1105][row],clip);
      c.restore();return;
    }
    if(!atlasReady){zero(c,p,t);return;}
    let name='idle',frame=Math.floor(t*9)%8;
    if(p.stun>0){name='hit';frame=Math.min(7,Math.floor((1-p.stun/.18)*8));}
    else if(p.attack>0){name=['heavy','rail','pile','crown'].includes(p.weaponMode)?p.weaponMode:'light'+(p.attackKind||1);frame=Math.min(7,Math.max(0,Math.floor((1-p.attack/(p.attackDuration||.4))*8)));}
    else if(p.dash>0){name='dash';frame=Math.min(7,Math.floor((1-p.dash/.25)*8));}
    else if(!p.onGround){name='jump';frame=Math.min(7,Math.max(0,Math.floor((p.vy+205)/60)));}
    else if(Math.abs(p.vx)>12){name='run';frame=Math.floor(t*17)%8;}
    c.save();c.translate(Math.round(p.x+9),Math.round(p.y));c.scale(p.face,1);if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha*=.55;
    c.drawImage(atlas,frame*256,zeroStates.indexOf(name)*192,256,192,-33,-20,128,96);c.restore();
  }
  function portrait(c,x,y){if(art.zero)c.drawImage(art.zero,175,3,90,88,x,y,26,26);else{rect(c,x,y,26,26,C.edge);rect(c,x+9,y+8,8,2,C.red);}}
  return {zero,drawZero,duelPose,drawCombatVFX,zeroStates,boss,background,Soundtrack,rect,line,ring,plate,portrait,get assetStatus(){return {zero:!!art.zero,surgeon:!!art.surgeon,cathedral:!!art.cathedral,zeroDuel:!!art.zeroDuel,surgeonDuel:!!art.surgeonDuel,surgeonLow:!!art.surgeonLow,zeroDrive:!!art.zeroDrive,combatVFX:!!art.combatVFX};}};
})();
