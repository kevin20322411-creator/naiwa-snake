(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),mini=$('minimap').getContext('2d');
  const game=new ArenaGame(),frog=new Image(),portrait=new Image(),egg=new Image();
  frog.src='assets/frog-wave.png';portrait.src='assets/frog.png';egg.src='assets/milkegg.png';
  const load=(k,v)=>{try{return localStorage.getItem(k)??v;}catch{return v;}},save=(k,v)=>{try{localStorage.setItem(k,String(v));}catch{}};
  const storedLevel=Number(load('naiwa-level','0'));
  let selectedMode=load('naiwa-play-mode','endless')==='levels'?'levels':'endless',selectedLevel=Number.isInteger(storedLevel)&&storedLevel>=0&&storedLevel<ARENA_LEVELS.length?storedLevel:0,completedLevels=[];
  try{const stored=JSON.parse(load('naiwa-cleared-levels','[]'));if(Array.isArray(stored))completedLevels=[...new Set(stored.filter(i=>Number.isInteger(i)&&i>=0&&i<ARENA_LEVELS.length))].sort((a,b)=>a-b);}catch{}
  function isLevelUnlocked(index){if(!Number.isInteger(index)||index<0||index>=ARENA_LEVELS.length)return false;for(let i=0;i<index;i++)if(!completedLevels.includes(i))return false;return true;}
  function firstIncompleteLevel(){const index=ARENA_LEVELS.findIndex((_,i)=>!completedLevels.includes(i));return index<0?ARENA_LEVELS.length-1:index;}
  function ensureUnlockedSelection(){if(!isLevelUnlocked(selectedLevel)){selectedLevel=firstIncompleteLevel();save('naiwa-level',selectedLevel);}}
  function pickLevel(index){if(!isLevelUnlocked(index))return false;selectedLevel=index;save('naiwa-level',selectedLevel);return true;}
  ensureUnlockedSelection();
  game.reset({mode:selectedMode,levelIndex:selectedLevel});
  const mobile=document.body.dataset.mode==='mobile'||(document.body.dataset.mode==='auto'&&(matchMedia('(pointer:coarse)').matches||innerWidth<760));
  document.body.classList.add(mobile?'mobile-mode':'desktop-mode');$(mobile?'mobile-link':'desktop-link').classList.add('active');
  let best=Number(load('naiwa-arena-best',0))||0,musicOn=load('naiwa-arena-music','on')==='on',voiceOn=load('naiwa-arena-voice','on')==='on';
  const music=new Audio('assets/bgm.wav');music.loop=true;music.volume=.55;music.preload='auto';music.hidden=true;document.body.appendChild(music);
  const deathAudio=new Audio('assets/laugh.mp3');deathAudio.preload='auto';deathAudio.volume=.8;deathAudio.hidden=true;document.body.appendChild(deathAudio);
  const EAT_VOICE_INTERVAL=3000;let nextEatVoiceAt=0,deathBuffer=null,deathSource=null,deathLaughRound=-1,deathLaughPlays=0,deathLaughPlaying=false,deathLoadState='loading';
  let deathReactionActive=false,deathReactionTimer=0,deathReactionDuration=3.474;
  let audioContext=null,voiceBuffers=[],lastVoice=-1,voiceNodes=[],voiceManifest=[],voiceData=[],voiceLoadState='loading',voiceFailures=0;
  let decodePromise=null,audioActivated=false,audioIssue='',lastAudioError='',musicAllowed=false,previewTimer=0,voicePlays=0,musicConfirmed=false,audioTicket=0;
  function audioFailure(label,error){lastAudioError=label+': '+(error?.name||error?.message||'unknown');audioIssue=label;audioButtons();}
  const deathDataPromise=fetch('assets/laugh.mp3').then(async response=>{if(!response.ok)throw Error('笑声加载失败');const data=await response.arrayBuffer();deathLoadState='downloaded';return data;}).catch(()=>{deathLoadState='fallback';return null;});
  const voiceDataPromise=(async()=>{
    try{
      const response=await fetch('assets/eat-voices.json');if(!response.ok)throw Error('语音清单加载失败');voiceManifest=await response.json();
      const results=await Promise.allSettled(voiceManifest.map(async item=>{const response=await fetch(item.src);if(!response.ok)throw Error('语音加载失败');return response.arrayBuffer();}));
      voiceData=results.map(r=>r.status==='fulfilled'?r.value:null);voiceFailures=results.filter(r=>r.status==='rejected').length;voiceLoadState=voiceData.some(Boolean)?'downloaded':'failed';
    }catch(error){voiceLoadState='failed';audioFailure('语音加载失败，刷新后重试',error);}audioButtons();
  })();
  function ensureAudioContext(){
    if(audioContext&&audioContext.state!=='closed')return audioContext;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    try{audioContext=new AC();voiceBuffers=[];deathBuffer=null;decodePromise=null;audioContext.addEventListener('statechange',audioButtons);return audioContext;}
    catch(error){audioFailure('请点击试听重试',error);return null;}
  }
  function prepareVoices(){
    if(decodePromise)return decodePromise;const context=audioContext;
    decodePromise=(async()=>{
      await voiceDataPromise;
      if(!context){voiceLoadState=voiceManifest.length?'fallback':'failed';deathLoadState='fallback';audioButtons();return;}
      voiceLoadState='decoding';audioButtons();
      const results=await Promise.allSettled(voiceData.map(data=>data?context.decodeAudioData(data.slice(0)):Promise.reject(Error('download'))));
      voiceBuffers=results.filter(r=>r.status==='fulfilled').map(r=>r.value);voiceFailures=results.filter(r=>r.status==='rejected').length;
      voiceLoadState=voiceBuffers.length?'ready':voiceManifest.length?'fallback':'failed';audioButtons();
      const deathData=await deathDataPromise;
      try{if(!deathData)throw Error('download');deathBuffer=await context.decodeAudioData(deathData.slice(0));deathLoadState='ready';}catch{deathLoadState='fallback';}
    })();return decodePromise;
  }
  // Creation and resume must happen synchronously in the click, before any download awaits.
  function unlockAudio(preview=false){
    clearTimeout(previewTimer);const ticket=++audioTicket;audioActivated=true;audioIssue='';musicAllowed=musicOn;
    const context=ensureAudioContext();let resumed=Promise.resolve();
    if(context){
      if(context.state!=='running')resumed=context.resume().catch(error=>audioFailure('声音待开启，请点试听',error));
      const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate);source.connect(context.destination);source.start();
    }
    if(musicOn)music.play().then(()=>{musicConfirmed=true;if(!musicAllowed)music.pause();audioButtons();}).catch(error=>audioFailure('音乐待开启，请点试听',error));
    const prepared=prepareVoices();
    if(preview){stopDeathLaugh();Promise.all([resumed,prepared]).then(()=>{if(ticket===audioTicket&&voiceOn)sayEat(true);});}
    audioButtons();
    if(preview)previewTimer=setTimeout(()=>{if(game.status!=='playing')stopAudio();},3000);
  }
  function stopVoices(){for(const item of voiceNodes){try{item.source?item.source.stop():item.audio.pause();}catch{}}voiceNodes=[];}
  function finishDeathReaction(){clearTimeout(deathReactionTimer);deathReactionActive=false;$('death-emoji')?.pause?.();}
  function startDeathReaction(duration){
    finishDeathReaction();deathReactionDuration=duration;deathReactionActive=true;
    const video=$('death-emoji'),id=round,ticket=audioTicket;$('hero-frog').hidden=true;video.hidden=false;video.muted=true;
    try{video.currentTime=3;}catch{}
    return Promise.resolve(video.play?.()).catch(()=>{if(id===round&&ticket===audioTicket){video.hidden=true;$('hero-frog').hidden=false;}});
  }
  function stopDeathLaugh(){finishDeathReaction();deathLaughPlaying=false;const item=deathSource;deathSource=null;try{item?.source.stop();}catch{}deathAudio.pause();deathAudio.currentTime=0;}
  function stopAudio(){clearTimeout(previewTimer);audioTicket++;musicAllowed=false;music.pause();stopVoices();stopDeathLaugh();}
  function playDeathLaugh(){
    if(deathLaughRound===round||game.status!=='dead')return;
    deathLaughRound=round;const id=round,ticket=audioTicket;
    const current=()=>id===round&&ticket===audioTicket&&game.status==='dead';
    const duration=()=>deathBuffer?.duration||(Number.isFinite(deathAudio.duration)&&deathAudio.duration>0?deathAudio.duration:3.474);
    if(!voiceOn){startDeathReaction(duration()).then(()=>{if(current())deathReactionTimer=setTimeout(finishDeathReaction,deathReactionDuration*1000);});return;}
    const play=()=>{
      if(!current()||!voiceOn)return;
      startDeathReaction(duration()).then(()=>{
        if(!current()||!voiceOn)return;
        if(deathBuffer&&audioContext?.state==='running'){
          const source=audioContext.createBufferSource(),gain=audioContext.createGain();source.buffer=deathBuffer;gain.gain.value=.8;source.connect(gain);gain.connect(audioContext.destination);
          const item={source,gain};deathSource=item;source.onended=()=>{if(deathSource===item){deathSource=null;deathLaughPlaying=false;finishDeathReaction();}source.disconnect();gain.disconnect();};source.start();deathLaughPlaying=true;deathLaughPlays++;
        }else{
          deathAudio.currentTime=0;deathLaughPlaying=true;
          deathAudio.play().then(()=>{if(current()&&voiceOn)deathLaughPlays++;else if(!deathLaughPlaying)deathAudio.pause();}).catch(error=>{if(current()){deathLaughPlaying=false;audioFailure('笑声待开启，请点试听',error);deathReactionTimer=setTimeout(finishDeathReaction,deathReactionDuration*1000);}});
        }
      });
    };
    if(decodePromise&&['loading','downloaded'].includes(deathLoadState))decodePromise.then(play);else play();
  }
  deathAudio.addEventListener('ended',()=>{deathLaughPlaying=false;finishDeathReaction();});
  function pickVoice(count){let n=Math.floor(Math.random()*count);if(n===lastVoice&&count>1)n=(n+1)%count;lastVoice=n;return n;}
  function playFallback(){
    if(!voiceManifest.length){audioFailure('语音还在加载，请稍后点试听');return;}
    const ticket=audioTicket;nextEatVoiceAt=performance.now()+EAT_VOICE_INTERVAL;
    const audio=new Audio(voiceManifest[pickVoice(voiceManifest.length)].src);audio.volume=.65;const item={audio};voiceNodes.push(item);
    audio.onended=()=>{voiceNodes=voiceNodes.filter(v=>v!==item);};audio.play().then(()=>{if(ticket===audioTicket&&voiceOn&&voiceNodes.includes(item)){voicePlays++;audioButtons();}else audio.pause();}).catch(error=>{voiceNodes=voiceNodes.filter(v=>v!==item);audioFailure('语音待开启，请点试听',error);});
  }
  function sayEat(force=false){
    if(!voiceOn)return;
    if(!force&&(performance.now()<nextEatVoiceAt||voiceNodes.length||deathLaughPlaying))return;
    if(force)stopVoices();
    if(!voiceBuffers.length){if(voiceLoadState==='fallback'||voiceLoadState==='failed')playFallback();return;}
    if(audioContext?.state!=='running'){audioFailure('语音待开启，请点试听');return;}
    try{
      const source=audioContext.createBufferSource(),gain=audioContext.createGain();source.buffer=voiceBuffers[pickVoice(voiceBuffers.length)];gain.gain.value=.65;source.connect(gain);gain.connect(audioContext.destination);
      const item={source,gain};voiceNodes.push(item);source.onended=()=>{voiceNodes=voiceNodes.filter(v=>v!==item);source.disconnect();gain.disconnect();};source.start();nextEatVoiceAt=performance.now()+EAT_VOICE_INTERVAL;voicePlays++;audioButtons();
    }catch(error){audioFailure('语音播放失败，请点试听',error);playFallback();}
  }
  music.addEventListener('error',()=>audioFailure('音乐加载失败，刷新后重试',music.error));
  const pad=n=>String(n).padStart(3,'0'),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let view={w:0,h:0,zoom:1},camera={x:1300,y:1300},lastFrame=performance.now(),lastHud=0,round=0,deathAt=0,deathHandledRound=-1,deathTimer=0,toastTimer=0,frame=0,particles=[],shieldBursts=[];
  let keys=new Set(),pointer=null,mouseBoost=false,joyId=null,joyAngle=null,boostId=null;
  function audioButtons(){
    $('music').setAttribute('aria-pressed',String(musicOn));$('music').setAttribute('aria-label',musicOn?'关闭背景音乐':'开启背景音乐');$('music').textContent=musicOn?'♫ 音乐':'♫ 静音';
    $('sound').setAttribute('aria-pressed',String(voiceOn));$('sound').setAttribute('aria-label',voiceOn?'关闭奶蛙音效':'开启奶蛙音效');$('sound').textContent=voiceOn?'语音 开':'语音 关';
    const needsTap=audioActivated&&voiceOn&&audioContext&&['suspended','interrupted'].includes(audioContext.state);
    $('audio-test').textContent=audioIssue||needsTap?'🔊 开启':'🔊 试听';
    $('audio-test').setAttribute('aria-label',audioIssue||needsTap?'重新开启并试听声音':'试听音乐和奶蛙语音');
    $('audio-status').textContent=audioIssue||(needsTap?'声音待开启，请点顶部试听':!musicOn&&!voiceOn?'声音已关闭，点试听开启':voiceLoadState==='loading'||voiceLoadState==='decoding'?'奶蛙语音加载中…':voiceLoadState==='downloaded'?'语音已准备，点击开始播放':audioActivated?'声音已开启 · 可点顶部试听':'点击开始开启声音 · 顶部可试听');
  }
  function hud(){
    const state=game.snapshot(),levelMode=game.playMode==='levels',timed=!!state.timeLimit;
    $('scoreboard').hidden=levelMode;$('level-controls').hidden=!levelMode;
    $('score').textContent=pad(game.score);$('length').textContent=game.player.body.length;$('best').textContent=pad(best);
    $('pause').disabled=!['playing','paused'].includes(game.status);$('pause').textContent=game.status==='paused'?'继续':'暂停';$('pause').setAttribute('aria-label',game.status==='paused'?'继续游戏':'暂停游戏');
    $('level-pause').disabled=$('pause').disabled;$('level-pause').textContent=$('pause').textContent;$('level-pause').setAttribute('aria-label',game.status==='paused'?'继续游戏':'暂停游戏');
    $('mission-label').textContent=levelMode?(timed?'限时关卡':'关卡目标'):'无尽任务';$('mission-text').textContent=levelMode?'第 '+(game.levelIndex+1)+' / '+ARENA_LEVELS.length+' 关 · '+state.levelName:'第 '+(game.mission+1)+' 档 · '+state.taskName;
    $('goal-list').innerHTML=state.objectives.map(g=>'<div class="objective '+(g.done?'done':'')+'"><span>'+(g.done?'✓ ':'')+g.label+'</span><strong>'+g.value+'/'+g.target+(g.key==='time'?'s':'')+'</strong></div>').join('');
    $('mission-reward').hidden=levelMode;$('mission-reward').textContent=levelMode?'':'奖励 '+state.taskReward;
    $('mission-progress').style.width=(state.objectives.reduce((n,g)=>n+g.value/g.target,0)/state.objectives.length*100)+'%';$('energy').style.width=game.energy+'%';
    $('defeated').textContent='已击败 '+game.defeated+' 只电脑蛙';
    const clock=timed?Math.ceil(state.timeRemaining):Math.floor(game.time);$('time').textContent=(timed?'⏳ ':'')+String(Math.floor(clock/60)).padStart(2,'0')+':'+String(clock%60).padStart(2,'0');$('time').classList.toggle('urgent',timed&&clock<=15);
    const buffs=[];if(game.magnet>0)buffs.push('🧲 磁铁 '+Math.ceil(game.magnet)+'s');if(game.shield>0)buffs.push('🛡️ 护盾 '+Math.ceil(game.shield)+'s');else if(game.protected>0)buffs.push('🛡️ 保护 '+Math.ceil(game.protected)+'s');
    $('buffs').innerHTML=buffs.map(b=>'<span>'+b+'</span>').join('');
    $('status-text').textContent=({ready:'选好模式，准备开饭。',playing:levelMode?(timed?'倒计时内完成左上全部目标':'完成左上全部目标即可通关'):'任务越难，奖励越大！',paused:'奶蛙正在等你回来',dead:game.collision?.reason==='timeout'?'时间到！再挑战一次？':'挤成一团了，再来一局？',won:'通关！全部目标已完成。'})[game.status];
    const p=game.player;$('boundary').hidden=game.status!=='playing'||Math.min(p.x,p.y,game.size-p.x,game.size-p.y)>160;
    $('zone-label').textContent=(ARENA_ZONES.find(z=>Math.hypot(z.x-p.x,z.y-p.y)<z.r)?.name)??'开饭广场';
  }
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),1700);}
  function overlay(type){
    $('overlay').dataset.state=type;
    if(type!=='dead'){$('death-emoji').hidden=true;$('hero-frog').hidden=false;}
    const levelMode=game.playMode==='levels',last=game.levelIndex===ARENA_LEVELS.length-1;
    const timeout=game.collision?.reason==='timeout';
    const c=type==='paused'?['休息一下，奶蛋不会跑','先喘口气','准备好了，就继续带队抢蛋。','继续开饭']:type==='won'?['目标完成 / 第 '+(game.levelIndex+1)+' 关',last?(completedLevels.length===ARENA_LEVELS.length?'全部 '+ARENA_LEVELS.length+' 关挑战完成！':'最终关通关！'):'通关！'+game.level.name,last?'本关目标全部完成。':'本关目标全部完成，已解锁第 '+(game.levelIndex+2)+' 关。',last?'再挑战本关':'下一关']:type==='dead'?[timeout?'时间到，挑战失败！ / 第 '+(game.levelIndex+1)+' 关':game.collision?.reason==='wall'?'撞到边界啦！':game.collision?.reason==='rival-head'?'头对头相撞啦！':game.collision?.reason==='rival-body'?'撞到电脑身体啦！':'撞到自己啦！','你现在是奶家的敌人了','加速只提速，别用头撞电脑身体；护盾能挡一次碰撞。',levelMode?'重试本关':'再吃一局']:['360° 自由移动 / 大地图','今天怎么开饭？','选一种玩法，带着奶蛙队抢蛋。',selectedMode==='levels'?'挑战第 '+(selectedLevel+1)+' 关':'开始无尽开饭'];
    $('overlay-kicker').textContent=c[0];$('overlay-title').textContent=c[1];$('overlay-text').textContent=c[2];$('start').textContent=c[3];
    $('mode-setup').hidden=type!=='ready';$('start-features').hidden=type!=='ready'||selectedMode==='levels';$('result').hidden=!['dead','won'].includes(type);$('result').innerHTML=levelMode?'<div class="result-metrics">'+game.goalProgress(game.level.goals).map(g=>'<span>'+g.label+' '+g.value+'/'+g.target+'</span>').join('')+'</div>':'<strong>'+game.score+'</strong> 分 · '+game.player.body.length+' 只奶蛙<br>吃了 '+game.eaten+' 颗蛋 · 击败 '+game.defeated+' 只电脑蛙';
    $('result-actions').hidden=type==='ready';$('replay-level').hidden=type!=='won'||last;
    if(type==='ready')setupModes();
    $('overlay-hint').innerHTML=type==='paused'?'按空格或点击继续':mobile?'拖动左下摇杆转向 · 右下按住加速<br>引导电脑的头撞你的身体，击败掉金蛋':'移动鼠标 360° 转向 · 按住鼠标 / Shift 加速<br>引导电脑的头撞你的身体，击败掉金蛋';
    $('overlay').classList.remove('hidden');
  }
  function goalText(goals){const labels={eaten:'吃蛋',special:'特殊蛋',defeated:'击败',score:'分数',foodScore:'吃蛋',time:'存活',zones:'探索',flavorKinds:'口味'};return Object.entries(goals).map(([k,n])=>labels[k]+' '+n+(k==='time'?' 秒':k==='foodScore'?' 分':k==='defeated'?' 只':k==='zones'?' 区':k==='flavorKinds'?' 种':'')).join(' · ');}
  function setupModes(){
    $('mode-endless').setAttribute('aria-pressed',String(selectedMode==='endless'));$('mode-levels').setAttribute('aria-pressed',String(selectedMode==='levels'));
    $('level-list').hidden=selectedMode!=='levels';$('level-progress').hidden=selectedMode!=='levels';$('level-chapters').hidden=selectedMode!=='levels';$('start-features').hidden=selectedMode==='levels';
    const chapter=Math.floor(selectedLevel/8),chapterCount=Math.ceil(ARENA_LEVELS.length/8);
    $('level-chapters').innerHTML=Array.from({length:chapterCount},(_,i)=>'<button data-chapter="'+i+'" aria-label="第 '+(i+1)+' 章，第 '+(i*8+1)+' 至 '+Math.min((i+1)*8,ARENA_LEVELS.length)+' 关'+(isLevelUnlocked(i*8)?'':'，未解锁')+'" aria-pressed="'+(i===chapter)+'"'+(isLevelUnlocked(i*8)?'':' disabled')+'>'+(i*8+1)+'–'+Math.min((i+1)*8,ARENA_LEVELS.length)+'</button>').join('');
    $('level-chapters').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{if(!pickLevel(Number(button.dataset.chapter)*8))return;game.reset({mode:selectedMode,levelIndex:selectedLevel});setupModes();hud();}));
    $('level-progress').textContent='已通关 '+completedLevels.length+' / '+ARENA_LEVELS.length+' · 按顺序解锁，向下滑查看';
    $('level-list').innerHTML=ARENA_LEVELS.slice(chapter*8,(chapter+1)*8).map((level,offset)=>{const i=chapter*8+offset,unlocked=isLevelUnlocked(i);return '<button data-level="'+i+'" aria-pressed="'+(i===selectedLevel)+'"'+(unlocked?'':' disabled aria-label="第 '+(i+1)+' 关 '+level.name+'，完成前面全部关卡后解锁"')+'><span>'+(unlocked?(completedLevels.includes(i)?'✓ ':''):'🔒 ')+(i+1)+'. '+level.name+'</span><small>'+(level.timeLimit?level.timeLimit+'秒内':'不限时')+(unlocked?'':' · 未解锁')+'<br>'+goalText(level.goals).replace(/ /g,'').replace(/^吃蛋/,'')+'</small></button>';}).join('');
    $('level-list').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{if(!pickLevel(Number(button.dataset.level)))return;game.reset({mode:selectedMode,levelIndex:selectedLevel});setupModes();hud();}));
    const level=ARENA_LEVELS[selectedLevel],tips=[];if(level.goals.foodScore)tips.push('吃蛋目标只计算食物分');if(level.goals.flavorKinds)tips.push('普通蛋、辣蛋、糖果蛋、磁铁、护盾、金蛋各算一种');
    $('overlay').classList.toggle('compact-goals',selectedMode==='levels'&&Object.keys(level.goals).length>=3);
    $('mode-details').innerHTML=selectedMode==='levels'?'<strong>'+(level.timeLimit?level.timeLimit+' 秒内 · ':'')+goalText(level.goals)+'</strong><span>'+level.subtitle+'<br>'+(tips.join('<br>')||'全部目标完成即可通关')+'</span>':'<strong>10只电脑蛙，得分越高对手越长</strong><span>各区分布，重生时按本局得分成长<br>吃蛋 → 围堵 → 收金蛋 → 完成奖励任务</span>';
    $('start').textContent=selectedMode==='levels'?'挑战第 '+(selectedLevel+1)+' 关':'开始无尽开饭';
  }
  function showMenu(){clearTimeout(deathTimer);clearTimeout(toastTimer);$('toast').classList.remove('visible');clearInput();stopAudio();ensureUnlockedSelection();game.reset({mode:selectedMode,levelIndex:selectedLevel});overlay('ready');hud();}
  function selectMode(mode){selectedMode=mode;save('naiwa-play-mode',mode);showMenu();}
  function clearInput(){keys.clear();pointer=null;mouseBoost=false;joyId=null;joyAngle=null;boostId=null;game.setBoost(false);$('boost').classList.remove('active');$('stick-knob').style.transform='translate(0,0)';}
  function begin(){
    if(selectedMode==='levels'&&!isLevelUnlocked(selectedLevel)){showMenu();return;}
    clearTimeout(deathTimer);round++;deathAt=0;particles=[];shieldBursts=[];nextEatVoiceAt=0;clearInput();game.reset({mode:selectedMode,levelIndex:selectedLevel});game.start();camera={x:1300,y:1300};lastFrame=performance.now();stopAudio();unlockAudio();
    $('overlay').classList.add('hidden');$('toast').classList.remove('visible');canvas.focus({preventScroll:true});hud();
  }
  function pause(){if(game.status!=='playing')return;game.pause();clearInput();stopAudio();overlay('paused');hud();}
  function resume(){if(game.status!=='paused')return;game.resume();clearInput();lastFrame=performance.now();unlockAudio();$('overlay').classList.add('hidden');canvas.focus({preventScroll:true});hud();}
  function togglePause(){if(game.status==='playing')pause();else if(game.status==='paused')resume();}
  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);view={w:r.width,h:r.height,zoom:mobile?1.08:1.22};}
  function screen(p){return{x:(p.x-camera.x)*view.zoom+view.w/2,y:(p.y-camera.y)*view.zoom+view.h/2};}
  function updateInput(){
    if(game.status!=='playing')return;let dx=0,dy=0;
    if(keys.has('ArrowLeft')||keys.has('a'))dx--;if(keys.has('ArrowRight')||keys.has('d'))dx++;if(keys.has('ArrowUp')||keys.has('w'))dy--;if(keys.has('ArrowDown')||keys.has('s'))dy++;
    if(dx||dy)game.aim(Math.atan2(dy,dx));else if(joyAngle!==null)game.aim(joyAngle);else if(pointer&&!mobile){const p=screen(game.player),dx=pointer.x-p.x,dy=pointer.y-p.y;if(Math.hypot(dx,dy)>15)game.aim(Math.atan2(dy,dx));}
    game.setBoost(keys.has('Shift')||mouseBoost||boostId!==null);$('boost').classList.toggle('active',game.boost);
  }
  function events(items,now){
    for(const e of items){
      if(e.type==='eat'){
        sayEat();particles.push({x:e.x,y:e.y,text:'+'+e.score,time:now});
        if(e.kind==='magnet')toast('🧲 磁铁来了！自动吸蛋 8 秒');else if(e.kind==='shield')toast('🛡️ 护盾来了！挡一次碰撞');else if(e.kind==='pepper')toast('🌶️ 红温蛙加入队伍 +30');else if(e.kind==='candy')toast('🍬 夜光蛙加入队伍 +30');else if(e.kind==='star')toast('⭐ 金蛋 +50 / 增加 3 只奶蛙');
      }else if(e.type==='mission')toast('任务完成！ '+e.reward);else if(e.type==='shield-used'){shieldBursts.push({x:e.x??game.player.x,y:e.y??game.player.y,time:now});toast('🛡️ 护盾碎了！下次碰撞会失败');}else if(e.type==='rival'){const levelMode=game.playMode==='levels';toast('击败 '+e.name+'！ '+(levelMode?'金蛋掉落':'+60 / 金蛋掉落'));particles.push({x:e.x,y:e.y,text:levelMode?'击败':'击败 +60',time:now});}else if(e.type==='rival-contact')toast(e.energyLow?'能量不足，松开加速恢复':'引导电脑的头撞你的身体，才能击败！');
      else if(e.type==='win'){clearInput();stopAudio();if(!completedLevels.includes(game.levelIndex)){completedLevels.push(game.levelIndex);completedLevels.sort((a,b)=>a-b);save('naiwa-cleared-levels',JSON.stringify(completedLevels));}overlay('won');hud();}
      else if(e.type==='dead'&&deathHandledRound!==round){deathHandledRound=round;deathAt=now;clearInput();stopAudio();overlay('dead');hud();playDeathLaugh();}
    }
    if(game.playMode==='endless'&&game.score>best){best=game.score;save('naiwa-arena-best',best);}
  }
  function drawSnake(s,now,isPlayer){
    if(!s.alive)return;const color=isPlayer?'#8aa33b':s.color;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=isPlayer?23:20;ctx.strokeStyle=color+'99';ctx.beginPath();s.body.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    for(let i=s.body.length-1;i>=0;i--){const p=s.body[i];if(Math.abs(p.x-camera.x)>view.w/view.zoom/2+70||Math.abs(p.y-camera.y)>view.h/view.zoom/2+70)continue;
      const squash=isPlayer&&deathAt?Math.min(1,Math.max(0,(now-deathAt-i*27)/180)):0;ctx.save();ctx.translate(p.x,p.y+9*squash);ctx.scale(1+squash*.35,1-squash*.6);
      ctx.fillStyle='#36502a20';ctx.beginPath();ctx.ellipse(0,17,17,7,0,0,Math.PI*2);ctx.fill();
      if(p.variant==='glow'){ctx.shadowColor='#a75fee';ctx.shadowBlur=18;}if(p.variant==='hot')ctx.filter='sepia(.35) saturate(2) hue-rotate(325deg)';
      const image=i===0?portrait:frog,size=i===0?57:44,width=size*(image.naturalWidth/(image.naturalHeight||1));
      if(image.complete&&image.naturalWidth){if(Math.cos(s.angle)<0)ctx.scale(-1,1);const bob=reduced?0:Math.sin(now/100-i*.5)*1.4;ctx.drawImage(image,-width/2,-size/2-5+bob,width,size);}ctx.restore();
    }
    if(!deathAt||!isPlayer){
      ctx.save();ctx.translate(s.x,s.y);ctx.strokeStyle=isPlayer?'#344c25':color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-3,31,0,Math.PI*2);ctx.stroke();
      if(isPlayer&&game.sprinting&&game.status==='playing'){ctx.strokeStyle='#ef8b29';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-3,35,0,Math.PI*2);ctx.stroke();}
      if(!isPlayer&&s.protected>0){ctx.strokeStyle='#ffffffbb';ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,-3,36,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      if(isPlayer&&(game.shield>0||game.protected>0)){ctx.strokeStyle='#3c9fb6aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-3,38+Math.sin(now/130)*2,0,Math.PI*2);ctx.stroke();}
      ctx.rotate(s.angle);ctx.fillStyle=isPlayer?'#344c25':color;ctx.beginPath();ctx.moveTo(41,0);ctx.lineTo(32,-5);ctx.lineTo(32,5);ctx.closePath();ctx.fill();ctx.restore();
      ctx.fillStyle=isPlayer?'#334929':color;ctx.font='bold 11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(isPlayer?(game.sprinting&&game.status==='playing'?'你 · 加速中':'你'):s.name+(s.protected>0?' · 重生保护':' · 电脑'),s.x,s.y-42);
    }
  }
  function drawShieldShatter(now){
    shieldBursts=shieldBursts.filter(b=>now-b.time<650);
    for(const b of shieldBursts){const t=Math.max(0,(now-b.time)/650),travel=reduced?0:t*70;ctx.save();ctx.translate(b.x,b.y);ctx.globalAlpha=(1-t)*.9;
      ctx.strokeStyle='#61bfd5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,38+t*25,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<10;i++){const a=i*Math.PI/5;ctx.save();ctx.translate(Math.cos(a)*(36+travel),Math.sin(a)*(36+travel)+t*t*25);ctx.rotate(a+(reduced?0:t*3));ctx.fillStyle=i%2?'#92e6f5':'#47a9c7';ctx.strokeStyle='#dffbff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-5,-8);ctx.lineTo(8,-3);ctx.lineTo(3,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}ctx.restore();
    }
  }
  function drawBoost(now){
    if(!game.sprinting||game.status!=='playing')return;
    const p=game.player,pulse=reduced?.5:(Math.sin(now/55)+1)/2;
    ctx.save();ctx.strokeStyle='#ff9d3677';ctx.lineWidth=35;ctx.lineCap='round';ctx.beginPath();
    p.trail.slice(0,45).forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));ctx.stroke();
    const tail=p.body[p.body.length-1],previous=p.body[Math.max(0,p.body.length-2)];
    ctx.save();ctx.translate(tail.x,tail.y);ctx.rotate(Math.atan2(previous.y-tail.y,previous.x-tail.x));
    for(const [size,color] of [[1,'#f58b28bb'],[.68,'#ffc53bee'],[.38,'#fff49bf2']]){
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-23,-17*size);ctx.lineTo(-42,-8*size);ctx.lineTo(-48-(55+pulse*25)*size,0);ctx.lineTo(-42,8*size);ctx.lineTo(-23,17*size);ctx.closePath();ctx.fill();
    }
    ctx.restore();ctx.translate(p.x,p.y);ctx.rotate(p.angle);
    ctx.lineWidth=3;ctx.strokeStyle='#fff4a0cc';
    for(let i=0;i<4;i++){const sign=i%2?1:-1,phase=reduced?.5:(now/450+i*.23)%1,x=-25-phase*135,y=sign*(24+phase*20);ctx.globalAlpha=1-phase;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-22,y);ctx.stroke();}
    if(!reduced)for(let i=0;i<6;i++){const phase=(now/580+i/6)%1;ctx.globalAlpha=1-phase;ctx.fillStyle=i%2?'#ff9a29':'#fff398';ctx.beginPath();ctx.arc(-40-phase*135,(i%2?1:-1)*(14+phase*(22+i*3)),2.6-phase,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function minimap(){
    const n=112,scale=n/game.size;mini.clearRect(0,0,n,n);mini.fillStyle='#e7efc8';mini.fillRect(0,0,n,n);for(const z of ARENA_ZONES){mini.fillStyle=z.color;mini.beginPath();mini.arc(z.x*scale,z.y*scale,z.r*scale,0,Math.PI*2);mini.fill();}
    mini.strokeStyle='#5d793799';mini.lineWidth=1;mini.strokeRect((camera.x-view.w/view.zoom/2)*scale,(camera.y-view.h/view.zoom/2)*scale,view.w/view.zoom*scale,view.h/view.zoom*scale);
    for(const r of game.rivals)if(r.alive){mini.fillStyle=r.color;mini.beginPath();mini.arc(r.x*scale,r.y*scale,2.7,0,Math.PI*2);mini.fill();}
    const p=game.player;mini.fillStyle='#23361b';mini.beginPath();mini.arc(p.x*scale,p.y*scale,3.5,0,Math.PI*2);mini.fill();mini.fillStyle='#f7ed38';mini.beginPath();mini.arc(p.x*scale,p.y*scale,1.6,0,Math.PI*2);mini.fill();
  }
  function render(now){
    const dt=Math.min(.07,Math.max(0,(now-lastFrame)/1000));lastFrame=now;updateInput();events(game.update(dt),now);
    const p=game.player,halfW=view.w/view.zoom/2,halfH=view.h/view.zoom/2;
    const aimX=Math.max(halfW,Math.min(game.size-halfW,p.x+Math.cos(p.angle)*28)),aimY=Math.max(halfH,Math.min(game.size-halfH,p.y+Math.sin(p.angle)*28));
    const smooth=reduced?1:1-Math.exp(-9*dt);camera.x+=(aimX-camera.x)*smooth;camera.y+=(aimY-camera.y)*smooth;
    ctx.clearRect(0,0,view.w,view.h);ctx.fillStyle='#afc867';ctx.fillRect(0,0,view.w,view.h);ctx.save();ctx.translate(view.w/2,view.h/2);ctx.scale(view.zoom,view.zoom);ctx.translate(-camera.x,-camera.y);
    ctx.fillStyle='#ddfa79';ctx.fillRect(0,0,game.size,game.size);
    for(const z of ARENA_ZONES){ctx.fillStyle=z.color+'95';ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6b814726';ctx.lineWidth=2;ctx.setLineDash([8,14]);ctx.stroke();ctx.setLineDash([]);ctx.font='bold 27px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#465d3426';ctx.fillText(z.name,z.x,z.y);}
    const left=Math.max(0,camera.x-halfW),right=Math.min(game.size,camera.x+halfW),top=Math.max(0,camera.y-halfH),bottom=Math.min(game.size,camera.y+halfH);
    ctx.beginPath();ctx.lineWidth=1;ctx.strokeStyle='#78913715';for(let x=Math.floor(left/45)*45;x<right;x+=45){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}for(let y=Math.floor(top/45)*45;y<bottom;y+=45){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
    ctx.strokeStyle='#4d653a';ctx.lineWidth=14;ctx.strokeRect(7,7,game.size-14,game.size-14);ctx.strokeStyle='#e19d4f88';ctx.lineWidth=3;ctx.setLineDash([12,10]);ctx.strokeRect(36,36,game.size-72,game.size-72);ctx.setLineDash([]);
    for(const f of game.foods){if(f.x<left-35||f.x>right+35||f.y<top-35||f.y>bottom+35)continue;
      ctx.save();ctx.translate(f.x,f.y);const pulse=reduced?1:1+Math.sin(now/250+f.phase)*.05;ctx.scale(pulse,pulse);ctx.fillStyle=({pepper:'#f49b7155',candy:'#b89af366',star:'#fff07099',magnet:'#6ebae855',shield:'#86cfef55'})[f.kind]??'#ffffdb88';ctx.beginPath();ctx.arc(0,0,f.kind==='egg'?16:21,0,Math.PI*2);ctx.fill();
      if(['egg','pepper','candy','star'].includes(f.kind)&&egg.complete&&egg.naturalWidth){const h=f.kind==='star'?31:27,w=h*egg.naturalWidth/egg.naturalHeight;ctx.drawImage(egg,-w/2,-h/2,w,h);if(f.kind!=='egg'){ctx.font='15px "Segoe UI Emoji",sans-serif';ctx.textAlign='center';ctx.fillText({pepper:'🌶️',candy:'🍬',star:'⭐'}[f.kind],11,17);}}
      else{ctx.font='27px "Segoe UI Emoji","Apple Color Emoji",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(({magnet:'🧲',shield:'🛡️'})[f.kind]??'🥚',0,1);}ctx.restore();
    }
    if(game.magnet>0){ctx.strokeStyle='#45a3c445';ctx.lineWidth=2;ctx.setLineDash([5,10]);ctx.beginPath();ctx.arc(p.x,p.y,175,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    drawShieldShatter(now);drawBoost(now);game.rivals.forEach(r=>drawSnake(r,now,false));drawSnake(p,now,true);
    particles=particles.filter(a=>now-a.time<800);for(const a of particles){const t=(now-a.time)/800;ctx.globalAlpha=1-t;ctx.fillStyle='#52662b';ctx.font='bold 17px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(a.text,a.x,a.y-22-t*30);}ctx.globalAlpha=1;ctx.restore();
    if(deathAt&&now-deathAt<280){ctx.fillStyle='#ed684426';ctx.fillRect(0,0,view.w,view.h);}
    if(now-lastHud>100){hud();minimap();lastHud=now;}frame++;requestAnimationFrame(render);
  }
  function startAction(){if(game.status==='paused'){resume();return;}if(game.status==='won'&&game.levelIndex<ARENA_LEVELS.length-1&&!pickLevel(game.levelIndex+1)){showMenu();return;}begin();}
  $('start').addEventListener('click',startAction);$('pause').addEventListener('click',togglePause);$('level-pause').addEventListener('click',togglePause);$('menu').addEventListener('click',showMenu);$('level-menu').addEventListener('click',showMenu);$('choose-mode').addEventListener('click',showMenu);$('mode-endless').addEventListener('click',()=>selectMode('endless'));$('mode-levels').addEventListener('click',()=>selectMode('levels'));$('replay-level').addEventListener('click',begin);
  $('music').addEventListener('click',()=>{musicOn=!musicOn;save('naiwa-arena-music',musicOn?'on':'off');if(musicOn)unlockAudio(game.status!=='playing');else{musicAllowed=false;music.pause();}audioButtons();});
  $('sound').addEventListener('click',()=>{voiceOn=!voiceOn;save('naiwa-arena-voice',voiceOn?'on':'off');if(!voiceOn){audioTicket++;stopVoices();stopDeathLaugh();}else unlockAudio(true);audioButtons();});
  $('audio-test').addEventListener('click',()=>{musicOn=voiceOn=true;save('naiwa-arena-music','on');save('naiwa-arena-voice','on');unlockAudio(true);toast('试听：背景音乐 + 奶蛙语音');});
  if(document.documentElement.requestFullscreen){$('fullscreen').hidden=false;$('fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});});}
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Shift'].includes(k)){e.preventDefault();keys.add(k);}else if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePause();}else if(e.key==='Enter'&&!e.repeat){if(e.target?.tagName==='BUTTON'||e.target?.tagName==='A')return;e.preventDefault();if(['paused','ready','dead','won'].includes(game.status))startAction();}});
  document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  canvas.addEventListener('pointermove',e=>{if(mobile||e.pointerType==='touch')return;const r=canvas.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top};});
  canvas.addEventListener('pointerleave',()=>{pointer=null;});canvas.addEventListener('pointerdown',e=>{if(mobile||e.pointerType==='touch'||game.status!=='playing')return;e.preventDefault();mouseBoost=true;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointerup',()=>{mouseBoost=false;});canvas.addEventListener('pointercancel',()=>{mouseBoost=false;});canvas.addEventListener('lostpointercapture',()=>{mouseBoost=false;});
  function moveStick(e){if(joyId!==e.pointerId)return;const r=$('joystick').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,d=Math.hypot(dx,dy),max=r.width*.32;
    const ratio=d>max?max/d:1;$('stick-knob').style.transform='translate('+dx*ratio+'px,'+dy*ratio+'px)';if(d>8)joyAngle=Math.atan2(dy,dx);
  }
  function releaseStick(e){if(joyId!==e.pointerId)return;joyId=null;joyAngle=null;$('stick-knob').style.transform='translate(0,0)';}
  $('joystick').addEventListener('pointerdown',e=>{if(game.status!=='playing'||joyId!==null)return;e.preventDefault();joyId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);moveStick(e);});
  $('joystick').addEventListener('pointermove',moveStick);['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('joystick').addEventListener(type,releaseStick));
  $('boost').addEventListener('pointerdown',e=>{if(game.status!=='playing'||boostId!==null)return;e.preventDefault();boostId=e.pointerId;$('boost').setPointerCapture(e.pointerId);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('boost').addEventListener(type,e=>{if(boostId===e.pointerId){boostId=null;game.setBoost(false);$('boost').classList.remove('active');}}));
  function suspendAudio(){if(game.status==='playing')pause();else stopAudio();}
  window.addEventListener('blur',suspendAudio);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendAudio();});
  new ResizeObserver(resize).observe(canvas);resize();audioButtons();overlay('ready');hud();minimap();requestAnimationFrame(render);
  window.naiwaGame={start:begin,pause,resume,getState:()=>({...game.snapshot(),mode:mobile?'mobile':'desktop',completedLevels:[...completedLevels],levelCount:ARENA_LEVELS.length,unlockedLevels:ARENA_LEVELS.map((_,i)=>i).filter(isLevelUnlocked),best,musicOn,musicPlaying:!music.paused,musicConfirmed,musicTime:music.currentTime,musicReadyState:music.readyState,voiceOn,voiceVariants:voiceBuffers.length,voicePlays,eatVoiceIntervalMs:EAT_VOICE_INTERVAL,deathLaughReady:!!deathBuffer,deathLaughPlaying,deathLaughPlays,deathReactionActive,deathReactionDuration,voiceLoadState,voiceFailures,audioState:audioContext?.state??'not-activated',lastAudioError,camera:{...camera},viewport:{...view}})};
  if(document.modelContext?.registerTool){const register=t=>{try{document.modelContext.registerTool(t);}catch{}};
    register({name:'get_game_state',description:'读取奶蛙大地图当前得分、状态、奶蛙队伍、任务、道具和声音设置。',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true},execute:async()=>({content:[{type:'text',text:JSON.stringify(window.naiwaGame.getState())}]})});
    register({name:'start_game',description:'准备或结束状态开始当前模式的一局奶蛙游戏，通关后进入下一关。',inputSchema:{type:'object',properties:{}},execute:async()=>{if(['ready','dead','won'].includes(game.status))startAction();return{content:[{type:'text',text:JSON.stringify(window.naiwaGame.getState())}]};}});
    register({name:'pause_game',description:'暂停奶蛙游戏和音乐。',inputSchema:{type:'object',properties:{}},execute:async()=>{pause();return{content:[{type:'text',text:JSON.stringify(window.naiwaGame.getState())}]};}});
  }
})();
