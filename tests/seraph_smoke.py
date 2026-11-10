"""Focused live-browser verification of the SURGEON to SERAPH phase."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.seraphTest={
 get p(){return player},get b(){return boss},get state(){return state},get hazards(){return hazards},get slashes(){return slashes},
 first(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.x=250;boss.inv=0;boss.hp=901;boss.operationUsed=true;boss.t=999;player.x=215;player.face=1;},
 phase(move){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.phase=2;boss.tele=0;boss.inv=0;boss.hp=900;boss.x=240;boss.y=111;boss.seraphCycle=0;boss.t=999;player.x=195;player.face=1;boss.beginSeraph(move);}
};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.inversionFrames=0;window.seraphText=new Set();const fill=CanvasRenderingContext2D.prototype.fillRect;CanvasRenderingContext2D.prototype.fillRect=function(...args){if(this.globalCompositeOperation==='difference')window.inversionFrames++;if(args[0]===280&&args[1]===20&&args[3]===4&&this.fillStyle==='#e30b32')window.bossBarWidth=args[2];return fill.call(this,...args)};const text=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,...args){if(typeof value==='string'&&(value.includes('CAST / 방향')||value.includes('EXPOSED')||value.includes('ATTACK /')))window.seraphText.add(value);return text.call(this,value,...args)}''')
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('''()=>{window.seraphCamera=[];window.shellBreakFrames=0;const original=EdenPresentation.boss;EdenPresentation.boss=(ctx,b,t)=>{if(b.phase===2&&b.tele>0)window.seraphCamera.push(Math.abs(ctx.getTransform().a));return original(ctx,b,t)};const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src?.includes('seraph-shell-break-v36'))window.shellBreakFrames++;return draw.call(this,im,...args)}}''')
 page.evaluate('seraphTest.first()');page.keyboard.press('j');page.wait_for_function('seraphTest.b.phase===2 && seraphTest.b.tele>6.7');assert page.evaluate('seraphTest.b.inv')>6.7
 # SURGEON's own bar reaches zero; SERAPH's separate bar appears at full health after the reveal.
 page.wait_for_function('window.bossBarWidth===0');hp_before=page.evaluate('seraphTest.b.hp');assert hp_before==900
 page.locator('#game').screenshot(path='/tmp/seraph32-kneel.png')
 page.wait_for_function('seraphTest.b.tele<6.1');page.locator('#game').screenshot(path='/tmp/seraph36-shell.png')
 page.wait_for_function('seraphTest.b.tele<4.6');page.wait_for_function('window.shellBreakFrames>0');assert page.evaluate('seraphTest.b.hp')==hp_before;assert page.evaluate('window.bossBarWidth')==0;page.locator('#game').screenshot(path='/tmp/seraph32-core.png')
 page.wait_for_function('seraphTest.b.tele<2.4');page.locator('#game').screenshot(path='/tmp/seraph32-wings.png')
 page.wait_for_function('seraphTest.b.tele<1.0');page.locator('#game').screenshot(path='/tmp/seraph32-reveal.png')
 page.wait_for_function('seraphTest.b.tele===0');assert page.evaluate('seraphTest.b.hp')==hp_before;assert abs(page.evaluate('window.bossBarWidth')-177)<.1
 zoom=page.evaluate('window.seraphCamera');assert len(zoom)>10 and max(abs(n-2) for n in zoom)<.01,zoom
 # Actual rendering uses the complete animated body-and-wing poses at each stage.
 frames=page.evaluate('''()=>{const c=document.createElement('canvas');c.width=480;c.height=270;const ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let kind='',seen=new Set();ctx.drawImage=(im,...a)=>{if(im.src?.includes(kind))seen.add(a[0]+','+a[1]);return orig(im,...a)};kind='seraph-transform-v37';for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:7-(i+.1)*7/16},0);const transition=seen.size;kind='seraph-inbetween-v37';seen=new Set();for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:7-(i+.6)*7/16},0);const between=seen.size;kind='seraph-idle-v36';seen=new Set();for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,windup:0,release:0,recovery:0,seraphDive:null,seraphMoving:false,seraphFrameClock:i+.1},0);return [transition,between,seen.size]}''');assert frames==[16,16,16],frames
 # The transformation grows progressively and ends at the same scale as the combat sprite.
 sizes=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let size=0;ctx.drawImage=(im,...a)=>{if(/seraph-(?:(?:transform|inbetween)-v37|idle-v36)/.test(im.src||''))size=Math.abs(ctx.getTransform().a)*a[7];return orig(im,...a)};return [6.99,1,0].map(tele=>{size=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele,seraphMove:null,windup:0,release:0,recovery:0,seraphDive:null},0);return size})}''');assert 64<sizes[0]<66 and 99<sizes[1]<101 and 99<sizes[2]<101,sizes
 # The central eye stays anchored across all sixteen wing poses; twin jets pulse independently.
 motion=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx),xs=[.503,.498,.500,.501,.499,.500,.503,.501,.501,.502,.498,.503,.500,.500,.500,.504],ys=[.478,.479,.483,.480,.511,.508,.509,.505,.504,.504,.504,.500,.499,.501,.500,.502],eyeX=[],eyeY=[],jets=[];let index=0,collect=true;ctx.drawImage=(im,...a)=>{const m=ctx.getTransform();if(collect&&im.src?.includes('seraph-idle-v36')){eyeX.push(m.e+m.a*a[6]*xs[index]);eyeY.push(m.f+m.d*a[7]*ys[index])}if(im.src?.includes('seraph-thruster-v35'))jets.push(a[0]+','+a[1]);return orig(im,...a)};const b={...seraphTest.b,tele:0,y:116,seraphMove:null,windup:0,release:0,recovery:0,seraphDive:null,seraphMoving:false};for(index=0;index<16;index++)EdenPresentation.boss(ctx,{...b,seraphFrameClock:index+.1},index/11);const airborne=jets.length;collect=false;index=0;EdenPresentation.boss(ctx,{...b,y:126,seraphFrameClock:0},0);return {eyeX,eyeY,airborne,ground:jets.length-airborne,jetFrames:new Set(jets).size}}''');assert max(motion['eyeX'])-min(motion['eyeX'])<.4,motion;assert max(motion['eyeY'])-min(motion['eyeY'])<.4,motion;assert motion['airborne']==32 and motion['ground']==0 and motion['jetFrames']==8,motion
 # The discarded surgical arms appear only during the opening of the transformation.
 arms=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let n=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-parts-v32')&&a[0]===444&&a[1]===444)n++;return orig(im,...a)};function draw(tele){n=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele},2);return n}return [draw(6),draw(4.5),draw(3)]}''');assert arms==[0,2,0],arms
 # Every attack uses its own body-and-wing animation, through startup, hit and recovery.
 actions=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx),out={};let name='',seen=new Set(),rows=new Set();ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-'+name)){seen.add(a[0]+','+a[1]);rows.add(Math.round(a[1]/(im.height/4)))}return orig(im,...a)};for(const [move,file] of [['cleave','melee-v36'],['descent','melee-v36'],['feathers','ranged-v36'],['halo','ranged-v36']]){name=file;seen=new Set();rows=new Set();for(const [windup,release,recovery] of [[.85,0,0],[.15,0,0],[0,.35,1],[0,0,.5]])EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,seraphMove:move,seraphDive:null,windupMax:1,windup,release,recovery},2);out[move]=[seen.size,[...rows].sort()]}return out}''');assert actions=={'cleave':[4,[0,1]],'descent':[4,[2,3]],'feathers':[4,[0,1]],'halo':[4,[2,3]]},actions
 # Half of SERAPH's own health triggers awakening once, without healing or skipping its attack telegraph.
 page.evaluate("seraphTest.phase('cleave');Object.assign(seraphTest.b,{hp:451,windup:0,release:0,recovery:0,t:999})")
 page.keyboard.press('q');page.wait_for_function('seraphTest.b.seraphAwakened && seraphTest.b.seraphAwakenT>0');assert 0<page.evaluate('seraphTest.b.hp')<=450
 page.locator('#game').screenshot(path='/tmp/eden37-awaken.png')
 awake_frames=page.evaluate('''()=>{const ctx=document.createElement('canvas').getContext('2d'),draw=ctx.drawImage.bind(ctx),seen=new Set();ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-awakened-v37'))seen.add(a[0]+','+a[1]);return draw(im,...a)};for(let i=0;i<16;i++)EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,seraphMove:null,windup:0,release:0,recovery:0,seraphDive:null,seraphFrameClock:i+.1},0);return seen.size}''');assert awake_frames==16,awake_frames
 page.wait_for_function("seraphTest.b.seraphMove==='final' && seraphTest.b.windup>0",timeout=5000)
 # The exposed core appears only during safe recovery; the HUD distinguishes the active attack.
 counts=page.evaluate('''()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d'),orig=ctx.drawImage.bind(ctx);let n=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('seraph-vfx-v33')&&a[0]===1086&&a[1]===724)n++;return orig(im,...a)};function draw(release){n=0;EdenPresentation.boss(ctx,{...seraphTest.b,tele:0,recovery:1,release,windup:0,seraphDive:null},2);return n}return [draw(.2),draw(0)]}''');assert counts==[0,1],counts
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.recovery=1;seraphTest.b.release=.3;seraphTest.b.t=999")
 page.wait_for_function('Array.from(seraphText).some(s=>s.includes("ATTACK / 공격 중"))');page.wait_for_function('Array.from(seraphText).some(s=>s.includes("EXPOSED / 피해 +25%"))');page.locator('#game').screenshot(path='/tmp/seraph33-recovery.png')
 # The new slash art is shown during the actual expanded collision.
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.performSeraph()")
 page.wait_for_function('seraphTest.slashes.some(s=>s.seraphImpact && s.delay<=0)');page.locator('#game').screenshot(path='/tmp/seraph34-cleave.png')
 # A real airborne J connects with the wing while outside the old torso box.
 page.evaluate("seraphTest.phase('cleave');Object.assign(seraphTest.b,{windup:0,t:999});Object.assign(seraphTest.p,{x:172,y:130,vy:0,onGround:false,face:1})")
 page.keyboard.press('j');page.wait_for_function('seraphTest.b.hp<900')
 # K follows the normal live incision collision; the second K uses the existing counter input.
 page.evaluate("seraphTest.phase('cleave')");page.wait_for_function("seraphTest.slashes.some(s=>s.seraph && s.delay<=.05)");page.keyboard.press('k');page.wait_for_function('seraphTest.p.parryFollow>0');page.keyboard.press('k');page.wait_for_function('seraphTest.p.weaponMode==="psiCounter"');page.wait_for_function('seraphTest.b.hp<900');assert page.evaluate('seraphTest.p.hp')==100
 # Actual input during the low beam; the same jump response also covers the larger ultimate.
 for move in ['halo','final']:
  page.evaluate('(m)=>seraphTest.phase(m)',move);page.wait_for_function('seraphTest.b.windup>0 && seraphTest.b.windup<.16');page.keyboard.press('Space')
  page.wait_for_function('seraphTest.hazards.some(h=>h.seraphBeam && h.delay<=0)');page.locator('#game').screenshot(path='/tmp/seraph32-'+move+'.png')
  page.wait_for_function('!seraphTest.hazards.some(h=>h.seraphBeam)');assert page.evaluate('seraphTest.p.hp')==100,move
 # Both live beams can instead be parried and followed by a second K counter.
 for move in ['halo','final']:
  page.evaluate('(m)=>seraphTest.phase(m)',move);page.wait_for_function('seraphTest.hazards.some(h=>h.seraphBeam && h.delay<=.05)');page.keyboard.press('k')
  page.wait_for_function('seraphTest.p.parryFollow>0');assert page.evaluate('seraphTest.p.hp===100 && seraphTest.b.recovery>0 && !seraphTest.hazards.some(h=>h.seraphBeam)')
  page.keyboard.press('k');page.wait_for_function('seraphTest.b.hp<900')
 assert page.evaluate('inversionFrames')>0
 # Move through the boss while it tracks, then cross back during the locked warning.
 page.evaluate("seraphTest.phase('final')");page.keyboard.down('d')
 page.wait_for_function('seraphTest.p.x+9>seraphTest.b.x+21 && seraphTest.b.dir===1 && !seraphTest.b.seraphLocked');page.keyboard.up('d')
 page.wait_for_function('seraphTest.b.seraphLocked');page.wait_for_function('Array.from(seraphText).some(s=>s.includes("CAST / 방향 고정"))');assert page.evaluate('Array.from(seraphText).some(s=>s.includes("CAST / 방향 추적"))')
 page.keyboard.down('a');page.wait_for_function('seraphTest.p.x+9<seraphTest.b.x+21');page.keyboard.up('a');assert page.evaluate('seraphTest.b.dir')==1
 page.wait_for_function('seraphTest.hazards.some(h=>h.seraphFinal && h.delay<=0)');page.wait_for_function('!seraphTest.hazards.some(h=>h.seraphFinal)');assert page.evaluate('seraphTest.p.hp')==100
 # Existing player damage and normal boss death end the fight.
 page.evaluate("seraphTest.phase('cleave');seraphTest.b.windup=0;seraphTest.b.t=999;seraphTest.b.hp=20")
 page.keyboard.press('q');page.wait_for_function('seraphTest.b.dead');page.wait_for_function('seraphTest.state==="ending"',timeout=8000)
 # A lethal phase-two hit still leads to a clean first-phase retry.
 page.evaluate("seraphTest.phase('cleave');seraphTest.p.hp=1;seraphTest.b.windup=0;seraphTest.b.dir=-1;seraphTest.b.performSeraph()")
 page.wait_for_function('seraphTest.state==="gameover"',timeout=5000);page.keyboard.press('Enter');page.wait_for_function('seraphTest.state==="intro"');assert page.evaluate('seraphTest.b.phase===1 && seraphTest.b.hp===seraphTest.b.maxHp && seraphTest.p.hp===100');page.keyboard.press('Enter');page.wait_for_function('seraphTest.state==="combat"')
 assert not errors,errors
 print('PASS: separate SURGEON and SERAPH health bars and stable camera; 32 transformation frames and 16 idle frames, wing hit, K parry/counter, jumpable beams, death/retry and victory; no browser errors')
 browser.close()
