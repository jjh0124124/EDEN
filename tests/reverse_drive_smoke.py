"""Real keyboard defensive conversion plus full generated sprite/VFX sequence review."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
source=(Path(__file__).resolve().parents[1]/'src/game.js').read_text().replace('})();','''window.driveTest={get player(){return player},get boss(){return boss},
setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;player.x=boss.x-45;player.face=1;boss.move=0;boss.dir=-1;boss.act();},};})();''')
source=source.replace('update(dt);render();','if(!window.freezeDrive)update(dt);render();')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1050});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
    page.evaluate('driveTest.setup()');page.wait_for_timeout(60);page.keyboard.down('k')
    page.wait_for_function('driveTest.player.reverseDrive===1')
    page.keyboard.press('q',delay=20);page.keyboard.up('k')
    page.wait_for_function('driveTest.player.weaponMode==="drive" && driveTest.boss.hp<=driveTest.boss.maxHp-30')
    page.wait_for_timeout(25)
    page.evaluate('window.freezeDrive=true')
    assert page.evaluate('driveTest.player.reverseDrive')==0
    assert page.evaluate('driveTest.player.hp')==100
    page.screenshot(path='/tmp/eden-reverse-drive-game.png')
    page.evaluate('window.freezeDrive=false')
    page.wait_for_function('driveTest.boss.hp<driveTest.boss.maxHp')
    page.wait_for_function('driveTest.player.attack<=0')
    for facing in [1,-1]:
        count=page.evaluate('''facing=>{
          document.querySelector('#review')?.remove();const c=document.createElement('canvas');c.id='review';c.width=1120;c.height=400;c.style.cssText='width:1120px;height:400px;aspect-ratio:auto;max-width:none';document.body.prepend(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;const hashes=[];
          const times=[.01,.07,.12,.20,.30,.38,.45,.51];
          for(let i=0;i<8;i++){
            const x=(i%4)*280,y=Math.floor(i/4)*200;ctx.fillStyle='#14202c';ctx.fillRect(x,y,280,200);ctx.fillStyle='#d9e3e9';ctx.font='12px monospace';ctx.fillText('DRIVE / '+i,x+10,y+20);ctx.fillRect(x,y+179,280,1);
            ctx.save();ctx.translate(x+140,y+178);ctx.scale(2.5,2.5);EdenPresentation.drawZero(ctx,{duelMode:true,x:-9,y:-48,h:48,face:facing,hp:100,stun:0,dash:0,inv:0,weaponMode:'drive',attackDuration:.52,attack:.52-times[i]},0);ctx.restore();
            let h=0;for(const v of ctx.getImageData(x,y+24,280,150).data)h=(h*31+v)|0;hashes.push(h);
          }return new Set(hashes).size;
        }''',facing)
        assert count==8,count
        page.locator('#review').screenshot(path=f'/tmp/eden-drive-frames-{facing}.png')
    page.evaluate('''()=>{
      const c=document.querySelector('#review');c.width=1120;c.height=400;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(let row=0;row<2;row++)for(let f=0;f<4;f++){
        const x=f*280,y=row*200;ctx.fillStyle='#14202c';ctx.fillRect(x,y,280,200);ctx.fillStyle='#d9e3e9';ctx.font='12px monospace';ctx.fillText((row?'IMPACT':'THRUST')+' / '+f,x+10,y+20);
        ctx.save();ctx.translate(x+140,y+105);ctx.scale(2.5,2.5);EdenPresentation.drawCombatVFX(ctx,{sprite:row?'hit':'boost',x:0,y:0,dir:1,max:1,life:1-(f+.2)/4,effectScale:1});ctx.restore();
      }
    }''')
    page.locator('#review').screenshot(path='/tmp/eden-generated-vfx-frames.png')
    assert not errors,errors
    print('PASS: K parry → powered Q with real input; 8 unique drive frames both facings; 8 generated VFX frames; no JS errors')
    browser.close()
