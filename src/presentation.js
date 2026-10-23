/* Original layered pixel artwork and synthesis. No downloaded production assets. */
window.EdenPresentation = (() => {
  const C = { ink:'#080b10', edge:'#181f29', steel:'#555f6e', light:'#afbac5', white:'#ece8df', red:'#f02146', blood:'#730d28', blue:'#637e8b' };
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
    if(p.inv>0&&Math.floor(p.inv*24)%3===0)c.globalAlpha=.55;
    const running=Math.min(1,Math.abs(p.vx)/90), stride=Math.sin(t*18)*7*running;
    const airborne=!p.onGround, attack=p.attack>0, kick=attack&&p.attackKind===2;
    const bob=airborne?0:Math.round(Math.abs(Math.sin(t*9))*running);
    const hip=[0,23+bob], backKnee=[-6-stride*.6,34], frontKnee=kick?[20,25]:[4+stride*.6,34];
    const backFoot=[-5+stride,44],frontFoot=kick?[35,20]:[6-stride,44];
    cloth(c,-8,15,9,23,t*11,'#20232e');cloth(c,-12,14,5,21,t*11+.8,'#45424b');
    limb(c,hip,backKnee,5);limb(c,backKnee,backFoot,4);plate(c,backFoot[0]-3,backFoot[1]-1,10,3);
    limb(c,hip,frontKnee,6);limb(c,frontKnee,frontFoot,4);plate(c,frontFoot[0]-2,frontFoot[1]-2,12,4,C.light);
    line(c,frontKnee[0]+2,frontKnee[1],frontFoot[0]+2,frontFoot[1]-3,C.red,2);
    poly(c,[[-7,10+bob],[4,9+bob],[8,21+bob],[-6,26+bob],[-10,17+bob]],C.ink);
    plate(c,-7,11+bob,13,10,'#303945');plate(c,-9,10,6,6);line(c,-5,15,4,20,C.red,2);
    for(let i=0;i<3;i++)plate(c,-7+i*4,23,4,3,C.steel);
    limb(c,[-7,13],[-12,21],4);limb(c,[-12,21],[-10,27],3);
    const hand=attack?[17,-1]:[12,24];limb(c,[5,12],[11,17],4);limb(c,[11,17],hand,3);
    const bladeEnd=attack?[37,27]:[23,43];line(c,...hand,...bladeEnd,C.blood,5);line(c,...hand,...bladeEnd,C.red,3);line(c,hand[0]+1,hand[1],bladeEnd[0]+1,bladeEnd[1],C.white);
    poly(c,[[-5,2],[4,1],[7,5],[4,10],[-3,9]],'#c7b6b4');
    poly(c,[[-7,2],[-4,-2],[1,-3],[5,0],[8,2],[5,3],[5,7],[2,4],[0,7],[-2,3],[-7,6],[-5,2]],'#24272f');
    line(c,-5,0,0,-2,C.steel);rect(c,4,5,3,1,C.red);rect(c,-5,9,11,3,C.ink);rect(c,-5,10,4,1,C.red);
    if(p.dash>0){for(let i=0;i<5;i++)line(c,-15-i*4,15+i*5,-30-i*7,15+i*5,i%2?C.red:C.steel);}
    c.restore();
  }
  function boss(c,b,t){
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
  return {zero,boss,background,Soundtrack,rect,line,ring,plate};
})();
