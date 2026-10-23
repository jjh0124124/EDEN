"""Build original ZERO animation assets from the editable articulated rig.

Requires Playwright Python and Chromium, but those are not game dependencies.
No external generation API or downloaded art is used.
"""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
out=root/'assets/characters/zero'
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page()
    page.set_content('<html><body></body></html>')
    page.add_script_tag(path=str(root/'src/presentation.js'))
    result=page.evaluate('''() => {
      const states=EdenPresentation.zeroStates;
      const sheet=document.createElement('canvas');sheet.width=2048;sheet.height=states.length*192;
      const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
      for(let row=0;row<states.length;row++)for(let frame=0;frame<8;frame++){
        const name=states[row], progress=frame/8;
        const p={x:0,y:0,face:1,hp:100,vx:0,vy:0,inv:0,dash:0,onGround:true,attack:0,attackKind:1,attackDuration:1,weaponMode:'kick'};
        let t=frame/8*Math.PI*2/2;
        if(name==='run'){p.vx=92;t=frame/8*Math.PI*2/18;}
        if(name==='jump'){p.onGround=false;p.vy=-205+frame*60;t=frame*.12;}
        if(name==='dash'){p.dash=.25*(1-progress);p.vx=250;}
        if(name.startsWith('light')){p.attack=1-progress;p.attackKind=Number(name.slice(-1));}
        if(['heavy','rail','pile','crown'].includes(name)){p.attack=1-progress;p.weaponMode=name;p.attackKind=2;}
        if(name==='hit'){p.stun=.18*(1-progress);p.inv=.2;}
        c.save();c.translate(frame*256,row*192);c.beginPath();c.rect(0,0,256,192);c.clip();c.scale(2,2);c.translate(24,20);
        EdenPresentation.zero(c,p,t);c.restore();
      }
      return {png:sheet.toDataURL('image/png').split(',')[1],states};
    }''')
    (out/'zero-atlas.png').write_bytes(base64.b64decode(result['png']))
    metadata={'generator':'tools/build_zero_atlas.py','license':'Original project artwork','status':'development',
              'size':[2048,2304],'cell':[256,192],'frames_per_state':8,'states':result['states'],
              'logical_cell':[128,96],'anchor':[33,20], 'notes':'Empty hands; weapons deploy from mechanical lower legs.'}
    (out/'zero-atlas.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    browser.close()
print('Built 96 ZERO frames in',out)
