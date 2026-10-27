"""Review complete frame sequences through the shipped renderer, on both facings."""
import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1040})
    errors=[]
    page.on('pageerror',lambda e:errors.append(e.stack))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    page.wait_for_function('EdenPresentation.assetStatus.zeroDuel && EdenPresentation.assetStatus.surgeonDuel && EdenPresentation.assetStatus.surgeonLow')
    for face in [1,-1]:
        unique=page.evaluate('''face=>{
          let c=document.querySelector('#review');if(c)c.remove();c=document.createElement('canvas');c.id='review';c.width=960;c.height=480;document.body.prepend(c);
          const ctx=c.getContext('2d'),hashes=[];ctx.imageSmoothingEnabled=false;
          for(let row=0;row<3;row++)for(let f=0;f<4;f++){
            const x=f*240,y=row*160;ctx.fillStyle='#14202c';ctx.fillRect(x,y,240,160);ctx.fillStyle='#e0e6eb';ctx.font='12px monospace';ctx.fillText(['J1','J2','R'][row]+' / '+f,x+8,y+16);ctx.fillStyle='#617182';ctx.fillRect(x,y+141,240,1);
            ctx.save();ctx.translate(x+110,y+140);ctx.scale(2,2);
            EdenPresentation.drawZero(ctx,{x:-9,y:-48,h:48,face,hp:100,stun:0,inv:0,attack:1-[.05,.19,.4,.82][f],attackDuration:1,attackKind:row+1,weaponMode:row===2?'crown':'kick'},0);ctx.restore();
            const data=ctx.getImageData(x,y+20,240,120).data;let hash=0;for(const v of data)hash=(hash*31+v)|0;hashes.push(hash);
          }return new Set(hashes).size;
        }''',face)
        assert unique==12,unique
        page.locator('#review').screenshot(path=f'/tmp/eden-duel-zero-{face}.png')
    page.evaluate('''()=>{
      const c=document.querySelector('#review');c.width=1440;c.height=480;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
      for(let row=0;row<2;row++)for(let f=0;f<4;f++){
        const x=f*360,y=row*240;ctx.fillStyle='#14202c';ctx.fillRect(x,y,360,240);ctx.fillStyle='#e0e6eb';ctx.font='12px monospace';ctx.fillText(['SUTURE','NEEDLE'][row]+' / '+f,x+8,y+16);ctx.fillStyle='#617182';ctx.fillRect(x,y+220,360,1);
        ctx.save();ctx.translate(x+180,y+220);ctx.scale(1.5,1.5);
        EdenPresentation.boss(ctx,{d:{type:'surgeon'},x:-21,y:-100,w:42,h:100,dir:-1,move:row===0?0:2,hitFlash:0,dead:false,recovery:f===3?1:0,windup:f===1?1:0,release:f===2?.2:0,phase:1},0);ctx.restore();
      }
    }''')
    page.locator('#review').screenshot(path='/tmp/eden-duel-surgeon.png')
    assert not errors,errors
    print('PASS: generated assets loaded, 12 distinct complete-body poses in both directions, 8 boss state frames rendered; no JS errors')
    browser.close()
