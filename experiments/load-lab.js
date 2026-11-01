(async()=>{
 const requested=new URLSearchParams(location.search).get('concept');
 window.EDEN_LAB_CONCEPT=['pressure','thermal','clamp'].includes(requested)?requested:'pressure';
 try {
  const responses=await Promise.all(['src/game.js','experiments/combat-systems.js'].map(path=>fetch(path,{cache:'no-store'})));
  if(responses.some(r=>!r.ok))throw new Error('실험 파일을 읽을 수 없습니다.');
  let [game,lab]=await Promise.all(responses.map(r=>r.text()));
  game=game.replace("const saveKey='eden-save-v1'","const saveKey='eden-combat-lab-v1'")
   .replace("(i===3?player.superMeter>=100:player.cool[i]<=0&&player.sp>=[14,16,12][i])","labReady(i)")
   .replace("'Shift 추진 / 뒤+Shift 회피 / K 패링'","'Shift 이동 / K 패링 / 아래 조작 안내'")
   .replace("'REVERSE DRIVE / Shift 강화 추진'","'PARRY / 방어 성공'")
   .replace("'CAST / 강화 Shift 절단'","'CAST / 공격 준비'")
   .replace("['RISE','RECOIL','HOOK','OVERDRIVE'][i]","labLabels[i]")
   .replace("'Q 적중 → 공중 J / W 적중 → Shift 재추진'","'COMBAT LAB / 아래 조작 안내 참고'");
  const end=game.lastIndexOf('})();');if(end<0)throw new Error('실험 로더와 게임 버전이 일치하지 않습니다.');
  const script=document.createElement('script');script.textContent=game.slice(0,end)+lab+'\n'+game.slice(end);document.body.append(script);
  document.querySelector('#lab-restart').onclick=()=>{window.edenLab.restart();document.querySelector('#game').focus();};
 }catch(error){document.querySelector('#boot').textContent=error.message;}
})();
