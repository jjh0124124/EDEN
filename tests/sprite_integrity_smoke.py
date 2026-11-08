"""Check real rendered ZERO frames for stray sprite fragments and walk-body changes."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
source=(root/'src/game.js').read_text().replace('})();','''window.spriteTest={get p(){return player},get echoes(){return echoes},setup(){releaseInputs();dialogue=null;startBoss(0);state='combat';boss.t=999;boss.inv=0;player.x=100;}};})();''')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/game.js*',lambda r:r.fulfill(body=source,content_type='application/javascript'))
 page.goto(os.environ.get('EDEN_TEST_URL','http://127.0.0.1:4176')+'/',wait_until='networkidle')
 page.wait_for_function('Object.values(EdenPresentation.assetStatus).every(Boolean)')
 result=page.evaluate('''()=>{
  const base={duelMode:true,x:-9,y:-48,w:19,h:48,hp:100,stun:0,charging:false,parryFlash:0,inv:0,dash:0,face:1,attack:0,onGround:true,vx:0,stridePhase:0,landing:0,vy:0,ultimateT:0};
  function render(opts){const c=document.createElement('canvas');c.width=500;c.height=400;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.translate(250,350);ctx.scale(4,4);EdenPresentation.drawZero(ctx,{...base,...opts},0);return ctx.getImageData(0,0,500,400).data;}
  function parts(data){const seen=new Uint8Array(200000),sizes=[];for(let i=0;i<seen.length;i++){if(seen[i]||data[i*4+3]<32)continue;let q=[i],size=0;seen[i]=1;while(q.length){let pos=q.pop(),x=pos%500,y=Math.floor(pos/500);size++;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy,j=yy*500+xx;if(xx<0||xx>=500||yy<0||yy>=400||seen[j]||data[j*4+3]<32)continue;seen[j]=1;q.push(j);}}if(size>10)sizes.push(size);}return sizes.sort((a,b)=>b-a);}
  function bounds(data){let l=500,r=0,t=400,b=0;for(let i=0;i<500*400;i++)if(data[i*4+3]>=128){const x=i%500,y=Math.floor(i/500);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return {width:r-l+1,height:b-t+1,top:t,bottom:b};}
  const rows=[['J1','psiJab',.24,0,[.01,.045,.095,.18]],['J2','psiJab',.24,1,[.01,.045,.095,.18]],['Q','psiRise',.42,0,[.02,.08,.18,.32]],['W','psiPalm',.50,0,[.03,.12,.24,.40]],['E','psiGrab',.48,0,[.03,.14,.26,.40]],['R','psiSuper',1.55,0,[.01,.5,.9,1.35]]],bad=[];
  for(const face of [-1,1]){
   const idle=bounds(render({face}));for(let frame=0;frame<8;frame++){const walk=render({face,vx:100,stridePhase:frame}),box=bounds(walk),sizes=parts(walk);if(Math.abs(box.height-idle.height)>10||Math.abs(box.top-idle.top)>10||Math.abs(box.bottom-idle.bottom)>5||box.width>idle.width+12)bad.push('walk size/anchor '+face+'/'+frame+': '+JSON.stringify(box));if(!sizes.length||sizes.length>1&&sizes[1]>sizes[0]*.005)bad.push('walk fragments '+face+'/'+frame+': '+sizes.join(','));}
   for(const hand of [0,1])for(const elapsed of [.01,.18]){const box=bounds(render({face,weaponMode:'psiJab',psiHand:hand,attackDuration:.24,attack:.24-elapsed}));if(Math.abs(box.height-idle.height)>10||Math.abs(box.top-idle.top)>10||Math.abs(box.bottom-idle.bottom)>5||box.width>idle.width+12)bad.push('J guard size/anchor '+face+'/'+hand+'/'+elapsed+': '+JSON.stringify(box));}
   for(const [name,mode,dur,hand,times] of rows)for(const t of times){const sizes=parts(render({face,weaponMode:mode,psiHand:hand,attackDuration:dur,attack:dur-t,ultimateT:name==='R'?dur-t:0,ultimateDuration:dur}));if(!sizes.length||sizes.length>1&&sizes[1]>sizes[0]*.005)bad.push(name+'/'+t+'/'+face+': '+sizes.join(','));}
  }
  return bad;
 }''')
 assert not result,result
 page.evaluate('spriteTest.setup()');page.keyboard.down('d');page.keyboard.press('Shift');page.wait_for_function('spriteTest.p.dash>0');page.wait_for_function('spriteTest.p.dash<=0');page.keyboard.press('j');page.wait_for_function('spriteTest.p.weaponMode==="psiJab"');assert page.evaluate('spriteTest.echoes.length')==0;page.keyboard.up('d')
 assert not errors,errors
 print('PASS: walk and J guard match idle size/anchor; walk and J/Q/W/E/R contain no detached fragments in either direction; dash→J clears afterimages')
 browser.close()
