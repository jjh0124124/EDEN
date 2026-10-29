"""BUILD18 actual keyboard/touch routes, super confirm/whiff/death and image VFX."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.controlsTest={get p(){return player},get b(){return boss},get state(){return state},get hazards(){return hazards},get particles(){return particles},
setup(x=330,meter=0){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;player.x=x;player.face=1;player.superMeter=meter;},
incision(){boss.move=0;boss.dir=-1;boss.act();}};})();''')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1050},has_touch=True);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 page.evaluate('controlsTest.setup()')
 for stage in [1,2,3]:
  page.keyboard.press('j');page.wait_for_function('(n)=>controlsTest.p.combo===n',arg=stage)
  if stage<3:page.wait_for_function('controlsTest.p.attack<.10')
 page.wait_for_function('controlsTest.particles.some(p=>p.sprite==="sweep")')
 page.wait_for_timeout(65);page.screenshot(path='/tmp/eden-j-sweep.png')
 page.wait_for_function('controlsTest.p.attack<=0')
 # Holding K finishes a parry stance instead of starting a charge attack.
 page.keyboard.down('k');page.wait_for_function('controlsTest.p.parryWindow>0');page.wait_for_timeout(700);page.keyboard.up('k')
 assert page.evaluate('controlsTest.p.attack===0 && !controlsTest.p.charging')
 page.evaluate('controlsTest.setup();controlsTest.incision()');page.keyboard.press('k')
 page.wait_for_function('controlsTest.p.reverseDrive===1');page.keyboard.press('Shift')
 page.wait_for_function('controlsTest.p.weaponMode==="drive" && controlsTest.p.reverseDrive===0')
 page.wait_for_function('controlsTest.b.hp<controlsTest.b.maxHp-20')
 page.evaluate('controlsTest.setup(250)');page.keyboard.down('a');page.keyboard.press('Shift');page.keyboard.up('a')
 page.wait_for_function('controlsTest.p.x<225');assert page.evaluate('controlsTest.p.face')==1
 page.evaluate('controlsTest.setup()');page.keyboard.press('q');page.wait_for_function('controlsTest.p.weaponMode==="riser" && !controlsTest.p.onGround')
 page.wait_for_function('controlsTest.b.hp<controlsTest.b.maxHp');page.screenshot(path='/tmp/eden-riser.png')
 page.evaluate('controlsTest.setup()');page.keyboard.press('Space');page.wait_for_timeout(200);page.keyboard.press('q');page.wait_for_function('controlsTest.p.weaponMode==="riser" && controlsTest.p.vy>0')
 page.wait_for_function('controlsTest.p.onGround')
 page.evaluate('controlsTest.setup(250)');page.keyboard.press('w');page.wait_for_function('controlsTest.p.x<240');page.wait_for_function('controlsTest.b.hp<controlsTest.b.maxHp')
 assert not page.evaluate('controlsTest.hazards.some(h=>h.kind==="pillar")')
 page.evaluate('controlsTest.setup()');page.keyboard.press('e');page.wait_for_function('controlsTest.b.anchorTime>0')
 assert not page.evaluate('controlsTest.hazards.some(h=>h.kind==="pillar")')
 page.evaluate('controlsTest.setup(330,100)');page.keyboard.press('r');page.wait_for_function('controlsTest.p.ultimateT>.3')
 page.wait_for_timeout(220);page.screenshot(path='/tmp/eden-overdrive-confirm.png')
 page.wait_for_function('controlsTest.p.ultimateT<=0');assert page.evaluate('controlsTest.b.maxHp-controlsTest.b.hp')>=100
 assert page.evaluate('controlsTest.p.superMeter')==0
 page.evaluate('controlsTest.setup(80,100)');page.keyboard.press('r');page.wait_for_function('controlsTest.p.attack>0');page.wait_for_function('controlsTest.p.attack<=0')
 assert page.evaluate('controlsTest.b.hp===controlsTest.b.maxHp && controlsTest.p.inv===0 && controlsTest.p.superMeter===0')
 for x,key in [(8,'a'),(453,'d')]:
  page.evaluate('(x)=>controlsTest.setup(x)',x);page.keyboard.down(key);page.keyboard.press('Shift');page.wait_for_timeout(250);page.keyboard.up(key)
  assert page.evaluate('controlsTest.p.x>=8 && controlsTest.p.x<=453')
 # Pointer controls use the same finite parry path.
 page.evaluate('controlsTest.setup()');page.locator('[data-key="k"]').tap();page.wait_for_function('controlsTest.p.parryWindow>0');page.wait_for_timeout(400)
 assert page.evaluate('!controlsTest.p.charging && controlsTest.p.attack===0')
 page.evaluate('controlsTest.setup(330,100);controlsTest.b.hp=20');page.keyboard.press('r');page.wait_for_function('controlsTest.b.dead')
 assert page.evaluate('controlsTest.p.ultimateT')==0
 page.wait_for_function('controlsTest.state==="reward"')
 page.evaluate('controlsTest.setup();controlsTest.p.damage(999,1)');page.wait_for_function('controlsTest.state==="gameover"');page.keyboard.press('Enter');page.wait_for_function('controlsTest.state==="intro"');page.keyboard.press('Enter');page.wait_for_function('controlsTest.state==="combat"')
 assert page.evaluate('controlsTest.p.hp===controlsTest.p.maxHp && controlsTest.p.superMeter===0')
 page.evaluate('''()=>{const c=document.createElement('canvas');c.id='vfx-review';c.width=1000;c.height=400;c.style.cssText='width:1000px;height:400px;aspect-ratio:auto;max-width:none';document.body.prepend(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#17212c';ctx.fillRect(0,0,1000,400);for(let row=0;row<2;row++)for(let f=0;f<4;f++){ctx.save();ctx.translate(f*250+(row?125:60),row*200+100);ctx.scale(2,2);EdenPresentation.drawCombatVFX(ctx,{sprite:row?'superburst':'sweep',x:0,y:0,dir:1,max:1,life:1-(f+.1)/4,effectScale:1});ctx.restore();}}''')
 page.locator('#vfx-review').screenshot(path='/tmp/eden-sweep-overdrive-frames.png')
 assert not errors,errors
 print('PASS: J sweep; finite K and parry→Shift; forward/back Shift; Q ground/air; W recoil; E hook; R confirm/whiff/death; walls, touch, restart; all VFX frames; no JS errors')
 b.close()
