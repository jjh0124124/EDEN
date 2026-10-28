"""First-operation animation continuity and damage-triggered boss retreat / heel-anchor interaction."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.duelTest={get player(){return player},get boss(){return boss},get hazards(){return hazards},
setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.inv=0;boss.t=999;boss.x=300;player.x=255;player.face=1;},};})();''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1280,'height':960});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/src/game.js',lambda r:r.fulfill(body=source,content_type='application/javascript'))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    page.wait_for_function('EdenPresentation.assetStatus.zeroDuel && EdenPresentation.assetStatus.surgeonDuel')
    page.evaluate('duelTest.setup()')
    # An actual R hit creates pressure; no retreat state is injected by the test.
    page.keyboard.press('r',delay=25)
    page.wait_for_function('duelTest.boss.retreat !== undefined && duelTest.boss.retreat !== null')
    page.wait_for_function('duelTest.boss.x > 345')
    assert page.evaluate('duelTest.player.hp')==100
    # A new exchange: confirmed third J can link into E during the retreat warning.
    page.evaluate('duelTest.setup()')
    for combo in [1,2,3]:
        page.keyboard.press('j',delay=25)
        page.wait_for_function('(combo)=>duelTest.player.combo===combo',arg=combo)
        if combo<3:page.wait_for_function('duelTest.player.attack<=0')
    page.wait_for_function('duelTest.boss.retreat !== undefined && duelTest.boss.retreat !== null')
    page.keyboard.press('e',delay=25)
    page.wait_for_function('duelTest.player.weaponMode==="pile"')
    page.wait_for_function('duelTest.boss.anchorTime>0')
    assert page.evaluate('duelTest.boss.retreat') is None
    page.screenshot(path='/tmp/eden-anchor-duel.png')
    # Animation poses are selected by actual contact times, including the third Q strike.
    result=page.evaluate('''()=>{
      const p={duelMode:true,hp:100,stun:0,dash:0,charging:false,onGround:true,vx:0,attackDuration:.6,weaponMode:'triple'};
      const poses=[.07,.09,.17,.19,.29,.31,.5].map(t=>EdenPresentation.duelPose({...p,attack:.6-t}));
      const air=EdenPresentation.duelPose({...p,attack:0,onGround:false,vy:-50,vx:112});
      const c=document.createElement('canvas');c.id='poses';c.width=960;c.height=480;document.body.prepend(c);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(let row=0;row<3;row++)for(let f=0;f<4;f++){
        const duration=[.24,.27,.4][row],contact=row===2?.11:.06,t=[0,contact*.7,contact+.04,duration-.01][f];
        ctx.fillStyle='#14202c';ctx.fillRect(f*240,row*160,240,160);ctx.fillStyle='#ddd';ctx.font='12px monospace';ctx.fillText('J'+(row+1)+' / '+f,f*240+10,row*160+16);
        ctx.save();ctx.translate(f*240+110,row*160+140);ctx.scale(2,2);EdenPresentation.drawZero(ctx,{...p,x:-9,y:-48,h:48,face:1,weaponMode:'kick',attackKind:row+1,attackDuration:duration,attack:duration-t},0);ctx.restore();
      }
      return {poses,air};
    }''')
    assert [(v['row'],v['frame']) for v in result['poses']]==[(0,1),(0,2),(1,1),(1,2),(2,1),(2,2),(2,3)]
    assert result['air']=={'row':0,'frame':1}
    page.locator('#poses').screenshot(path='/tmp/eden-neural-j-frames.png')
    assert not errors,errors
    print('PASS: R pressure triggers vulnerable retreat; J combo → E stops retreat; unified J/Q poses and airborne priority; no JS errors')
    browser.close()
