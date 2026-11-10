"""Exercise the shipped psychic skills with real Chromium keyboard input."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();', '''window.skillTest={
 get p(){return player},get b(){return boss},get state(){return state},get hazards(){return hazards},get slashes(){return slashes},get particles(){return particles},
 setup(px=200,bx=260){releaseInputs();dialogue=null;startBoss(0);state='combat';player.x=px;player.face=1;boss.x=bx;boss.inv=0;boss.t=999;boss.retreatCooldown=100;},
 parrySetup(){this.setup(195,240);boss.dir=-1;boss.move=0;boss.act();},
};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.skillTexts=new Set();const text=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...a){if(typeof t==='string')skillTexts.add(t);return text.call(this,t,...a)}''')
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 for key,damage,mode in [('q',24,'psiShock'),('w',58,'psiBarrage'),('e',32,'psiBlast')]:
  page.evaluate('skillTest.setup()');page.keyboard.press(key)
  page.wait_for_function('(mode)=>skillTest.p.weaponMode===mode',arg=mode)
  page.wait_for_function('(d)=>skillTest.b.maxHp-skillTest.b.hp===d',arg=damage,timeout=6000)
  assert page.evaluate("skillTest.p.cool['qwe'.indexOf("+repr(key)+")] > 0")
  page.wait_for_timeout(80)
  if key=='e': page.locator('#game').screenshot(path='/tmp/eden31-e-live.png')
 # The first-phase scalpel uses eight aligned poses, including the actual low cut.
 frames=page.evaluate('''()=>{const ctx=document.createElement('canvas').getContext('2d'),draw=ctx.drawImage.bind(ctx),seen=new Set();let old=0;ctx.drawImage=(im,...a)=>{if(im.src?.includes('surgeon-scalpel-v37'))seen.add(a[0]+','+a[1]);if(im.src?.includes('surgeon-low-cut'))old++;return draw(im,...a)};const b={...skillTest.b,phase:1,dead:false,move:0,psiStagger:0,hitFlash:0,psiGuard:0,psiGuardWarn:0,windupMax:1};for(const [windup,release,recovery] of [[.95,0,0],[.65,0,0],[.45,0,0],[.15,0,0],[0,.38,1],[0,.23,1],[0,.08,1],[0,0,1]])EdenPresentation.boss(ctx,{...b,windup,release,recovery},0);EdenPresentation.boss(ctx,{...b,move:3,windup:0,release:.2,recovery:1},0);return [seen.size,old]}''');assert frames==[8,0],frames
 page.evaluate('skillTest.setup(195,240);Object.assign(skillTest.b,{dir:-1,move:0,windup:.9,windupMax:.9,release:0,recovery:0})');page.wait_for_function('skillTest.b.windup>0 && skillTest.b.windup<.5');page.locator('#game').screenshot(path='/tmp/eden37-scalpel-ready.png')
 page.wait_for_function('skillTest.b.release>0 && skillTest.b.release<.27');page.locator('#game').screenshot(path='/tmp/eden37-scalpel-swing.png')
 # A genuine boss incision creates a parry opportunity. Both K presses are browser input.
 page.evaluate('skillTest.parrySetup()');page.wait_for_function("skillTest.slashes.some(s=>s.kind==='scalpel' && s.delay<=.04)");page.keyboard.press('k');page.wait_for_function('skillTest.p.parryFollow>0');assert page.evaluate('skillTest.b.psiStagger>0 && skillTest.b.recovery>0');page.keyboard.press('k');page.wait_for_function('skillTest.p.weaponMode==="psiCounter"');page.wait_for_function('skillTest.b.hp<skillTest.b.maxHp');assert page.evaluate('skillTest.b.maxHp-skillTest.b.hp')==55
 # Capture all cinematic phases and verify the real multi-hit contacts.
 page.evaluate('skillTest.setup(145,255);skillTest.p.superMeter=100');page.keyboard.press('r');page.wait_for_function('skillTest.p.ultimateT>2.2');page.locator('#game').screenshot(path='/tmp/eden37-r-cutin.png')
 page.wait_for_function("skillTest.particles.some(p=>p.sprite==='psiCrushField') && skillTest.p.ultimateT<1.9");assert not page.evaluate('skillTest.hazards.some(h=>h.superShot)');page.locator('#game').screenshot(path='/tmp/eden37-r-pressure.png')
 page.wait_for_function("skillTest.slashes.some(s=>s.kind==='psiCrushFinal' && s.delay<=0)",timeout=6000);page.locator('#game').screenshot(path='/tmp/eden37-r-final.png')
 page.wait_for_function('skillTest.p.ultimateT<=0',timeout=4000);assert page.evaluate('skillTest.b.maxHp-skillTest.b.hp')==156
 page.evaluate('skillTest.p.superMeter=100;skillTest.p.sp=100;skillTest.b.inv=0');page.keyboard.press('r');page.wait_for_function('skillTest.p.ultimateT>1.7');assert page.evaluate('skillTest.p.ultimateDuration')==2
 # Measure during the shortened cinematic, including the barrage and finisher.
 perf=page.evaluate('''()=>new Promise(resolve=>{let count=0,start,particles=0,hazards=0;function frame(t){if(!start)start=t;count++;particles=Math.max(particles,skillTest.particles.length);hazards=Math.max(hazards,skillTest.hazards.length);if(t-start>=1350)resolve({fps:count*1000/(t-start),particles,hazards});else requestAnimationFrame(frame)}requestAnimationFrame(frame)})''')
 assert perf['fps']>20 and perf['particles']<30 and perf['hazards']<20,perf
 page.keyboard.press('Shift');page.wait_for_function('skillTest.p.ultimateT===0 && skillTest.p.dash>0');page.wait_for_timeout(500);assert page.evaluate("skillTest.hazards.every(h=>h.owner!=='p'||h.delay<=0)")
 assert not page.evaluate('skillTexts.has("LINK")')
 # Repeated real-key casts/cancellations and a forced JS GC catch unbounded effect state.
 cdp=page.context.new_cdp_session(page);cdp.send('HeapProfiler.collectGarbage');heap_before=cdp.send('Runtime.getHeapUsage')['usedSize']
 page.evaluate('skillTest.setup(80,350);skillTest.p.superCinematicPlayed=true')
 for _ in range(16):
  page.evaluate('skillTest.p.superMeter=100;skillTest.p.sp=100;skillTest.p.driveLock=0;skillTest.p.dash=0;skillTest.p.attack=0')
  page.keyboard.press('r');page.wait_for_function('skillTest.p.ultimateT>0');page.keyboard.press('Shift');page.wait_for_function('skillTest.p.ultimateT===0')
 page.wait_for_timeout(1000);assert page.evaluate("skillTest.hazards.filter(h=>h.owner==='p').length") == 0;assert page.evaluate('skillTest.particles.length')<10
 cdp.send('HeapProfiler.collectGarbage');heap_after=cdp.send('Runtime.getHeapUsage')['usedSize'];assert heap_after-heap_before<3_000_000,(heap_before,heap_after)
 assert not errors,errors
 print('PASS: Q/W/E cooldowns and damage, live K→K, first/repeat R, Shift cancel, 16 repeated casts and no LINK/JS errors; cinematic headless rAF %.1f fps, peak %d effects/%d projectiles, retained JS heap change %.2f MB'%(perf['fps'],perf['particles'],perf['hazards'],(heap_after-heap_before)/1_000_000))
 browser.close()
