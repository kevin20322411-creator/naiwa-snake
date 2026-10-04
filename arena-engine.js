(function(root){
  'use strict';
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
  const touchesBody=(p,body,radius)=>body.some((b,i)=>i?segmentDistance(p,body[i-1],b)<radius:distance(p,b)<radius);
  const FOOD={egg:{score:10,variant:'normal'},pepper:{score:30,variant:'hot'},candy:{score:30,variant:'glow'},magnet:{score:20,variant:'normal'},shield:{score:20,variant:'normal'},star:{score:50,variant:'glow'}};
  const ZONES=[{x:670,y:670,r:380,name:'奶蛋牧场',kind:'egg',color:'#cfe8ae'},{x:1930,y:670,r:380,name:'辣蛋坡',kind:'pepper',color:'#f5d8a1'},{x:670,y:1930,r:380,name:'糖果街',kind:'candy',color:'#ddcdf4'},{x:1930,y:1930,r:380,name:'金蛋角',kind:'star',color:'#e7d7a2'}];
  const ENDLESS_SPAWNS=[{x:430,y:430},{x:1010,y:430},{x:1590,y:430},{x:2170,y:430},{x:430,y:1300},{x:2170,y:1300},{x:430,y:2170},{x:1010,y:2170},{x:1590,y:2170},{x:2170,y:2170}];
  const LEVELS=[
    {name:'第一口奶蛋',subtitle:'收集彩色蛋和道具，尝遍不同口味',goals:{foodScore:300,special:3},rivals:2,speed:.9,food:420},
    {name:'花式开饭',subtitle:'击败电脑蛙，收集掉落的金蛋',goals:{foodScore:600,defeated:2},rivals:3,speed:1,food:400},
    {name:'抢饭小队',subtitle:'连续击败，抓紧时间收金蛋',timeLimit:90,goals:{foodScore:1000,defeated:3},rivals:3,speed:1.12,food:388},
    {name:'牧场大胃王',subtitle:'电脑蛙更快，倒计时内完成双目标',timeLimit:70,goals:{foodScore:1600,defeated:5},rivals:3,speed:1.2,food:360},
    {name:'口味巡游',subtitle:'收集特殊蛋，连续击败抢饭对手',timeLimit:90,goals:{foodScore:2200,special:12,defeated:6},rivals:3,speed:1.24,food:350},
    {name:'抢蛋冲刺',subtitle:'加速抢饭，把掉落的金蛋吃干净',timeLimit:85,goals:{foodScore:2800,defeated:7},rivals:3,speed:1.28,food:345},
    {name:'极限围堵',subtitle:'围堵和冲刺配合，吃遍特殊口味',timeLimit:80,goals:{foodScore:3400,special:24,defeated:8},rivals:3,speed:1.34,food:338},
    {name:'奶蛙王者',subtitle:'第一章的抢饭挑战，击败十只电脑蛙',timeLimit:75,goals:{foodScore:4000,defeated:10},rivals:3,speed:1.4,food:330},
    {name:'四角打卡',subtitle:'走遍四个区域，给地图留下蛙脚印',goals:{zones:4,foodScore:1800},rivals:3,speed:1.2,food:380},
    {name:'金蛋速递',subtitle:'打赢以后，也要及时收回金蛋',timeLimit:100,goals:{defeated:12,foodScore:4000},rivals:3,speed:1.4,food:360},
    {name:'奶蛙尝鲜',subtitle:'尝到四种口味，今天不只吃一种',goals:{flavorKinds:4,special:20},rivals:3,speed:1.25,food:420},
    {name:'四面来敌',subtitle:'四位对手轮流上场，抓住冲刺机会',timeLimit:115,goals:{defeated:14},rivals:4,speed:1.42,food:380},
    {name:'夜班值守',subtitle:'带着补给穿过两区，平安度过夜班',goals:{time:110,foodScore:2600,zones:2},rivals:4,speed:1.3,food:400},
    {name:'金蛋清场',subtitle:'击败对手，把胜利装进口袋',timeLimit:140,goals:{defeated:16,foodScore:4800},rivals:4,speed:1.45,food:390},
    {name:'口味收藏家',subtitle:'走遍四区，六种味道一个都不能少',goals:{flavorKinds:6,zones:4},rivals:4,speed:1.25,food:460},
    {name:'五蛙竞技',subtitle:'五位对手争饭，更考验转弯和走位',timeLimit:155,goals:{defeated:18},rivals:5,speed:1.45,food:420},
    {name:'拾金漫游',subtitle:'逛遍四区，收集一路的金蛋',goals:{foodScore:5800,zones:4},rivals:4,speed:1.3,food:480},
    {name:'黄金运输队',subtitle:'两区奔波，把战利品吃干净',timeLimit:170,goals:{defeated:18,foodScore:5600,zones:2},rivals:5,speed:1.45,food:440},
    {name:'稳稳长大',subtitle:'吃得多，还要平安把队伍留住',goals:{time:150,foodScore:4000},rivals:5,speed:1.35,food:470},
    {name:'连胜挑战',subtitle:'保持抢饭节奏，拿下二十胜',timeLimit:180,goals:{defeated:20},rivals:5,speed:1.48,food:440},
    {name:'全图品鉴',subtitle:'寻找六种口味，一边探索一边攒家底',goals:{flavorKinds:6,foodScore:6500,zones:4},rivals:5,speed:1.35,food:490},
    {name:'六蛙乱斗',subtitle:'六位对手混战，找准时机出击',timeLimit:200,goals:{defeated:22},rivals:6,speed:1.48,food:460},
    {name:'最后一班巡逻',subtitle:'活过三分钟，也要带回满满收获',goals:{time:180,defeated:12,foodScore:3800},rivals:6,speed:1.4,food:480},
    {name:'奶蛙大满贯',subtitle:'对抗、回收、探索，完成第三章的综合挑战',timeLimit:240,goals:{defeated:24,foodScore:7500,zones:2},rivals:6,speed:1.5,food:500},
    {name:'牧场回访',subtitle:'带着长队重走四区，六种口味都要尝到',goals:{zones:4,flavorKinds:6,foodScore:7200},rivals:6,speed:1.4,food:510},
    {name:'黄金回收站',subtitle:'六蛙争饭，把击败后掉落的金蛋及时收走',timeLimit:220,goals:{foodScore:8500,defeated:26},rivals:6,speed:1.52,food:510},
    {name:'长队旅行',subtitle:'活过三分半钟，带着收获绕完四区',goals:{time:210,zones:4,foodScore:7800},rivals:6,speed:1.42,food:520},
    {name:'三分半开饭',subtitle:'快节奏抢饭，也别忘了更换口味',timeLimit:210,goals:{defeated:24,foodScore:7600,flavorKinds:4},rivals:6,speed:1.52,food:520},
    {name:'六味守夜',subtitle:'守住四分钟，收集全口味并击败十八位对手',goals:{time:240,flavorKinds:6,defeated:18},rivals:6,speed:1.44,food:540},
    {name:'全图追击',subtitle:'跨过三个区域，连续抢饭并回收金蛋',timeLimit:260,goals:{defeated:30,foodScore:9800,zones:3},rivals:6,speed:1.54,food:540},
    {name:'奶蛙耐力赛',subtitle:'长队转弯要留空间，平安跑完四分半钟',goals:{time:270,foodScore:10000,zones:4},rivals:6,speed:1.45,food:560},
    {name:'奶家总冠军',subtitle:'五分钟内完成对抗、口味、收集与探索四项挑战',timeLimit:300,goals:{defeated:32,foodScore:10500,flavorKinds:6,zones:3},rivals:6,speed:1.55,food:560}
  ];
  const TASKS=[
    {name:'尝一口',goals:{eaten:8},score:40,energy:20},
    {name:'再来一盘',goals:{eaten:12},score:80,shield:6},
    {name:'抢饭初体验',goals:{defeated:1},score:140,shield:8,energy:40},
    {name:'口味探险家',goals:{special:3,zones:2},score:220,shield:10,magnet:10},
    {name:'双倍抢饭',goals:{eaten:24,defeated:2},score:320,shield:12,magnet:12},
    {name:'牧场称霸',goals:{score:700,defeated:3},score:450,shield:14,magnet:14,energy:100}
  ];
  const GOAL_LABELS={eaten:'吃蛋',special:'特殊蛋',defeated:'击败电脑蛙',score:'得分',foodScore:'吃蛋分',time:'存活',zones:'探索区域',flavorKinds:'口味种类'};
  function makeSnake(x,y,angle,length=5,curved=false){
    const body=Array.from({length},(_,i)=>({x:x-Math.cos(angle)*i*29,y:y-Math.sin(angle)*i*29,variant:'normal'}));
    if(curved){let direction=angle;for(let i=1;i<length;i++){const previous=body[i-1];body[i]={x:previous.x-Math.cos(direction)*29,y:previous.y-Math.sin(direction)*29,variant:'normal'};direction+=.23+i*.001;}}
    return {x,y,angle,target:angle,body,travel:0,trail:body.map((p,i)=>({x:p.x,y:p.y,d:-i*29})),alive:true,respawn:0};
  }
  class ArenaGame{
    constructor(random=Math.random){this.random=random;this.size=2600;this.spacing=29;this.reset();}
    reset(options={}){
      this.playMode=options.mode==='levels'?'levels':'endless';this.levelIndex=clamp(Math.floor(Number(options.levelIndex)||0),0,LEVELS.length-1);this.level=this.playMode==='levels'?LEVELS[this.levelIndex]:null;
      this.player=makeSnake(1300,1300,-Math.PI/2);this.foods=[];this.events=[];this.serial=0;
      this.status='ready';this.score=0;this.foodScore=0;this.eaten=0;this.time=0;this.energy=100;this.boost=false;this.flavorKinds=0;this.tastedKinds=new Set();
      this.magnet=0;this.shield=this.levelIndex>0&&this.level?5:0;this.protected=this.level&&this.levelIndex===0?5:3;this.collision=null;this.mission=0;this.missionCount=0;this.missionGoal=8;this.defeated=0;this.special=0;this.sprinting=false;this.contactHint=0;
      this.rivals=[makeSnake(1420,1140,Math.PI,8),makeSnake(1010,1180,.4,9),makeSnake(1610,1390,2.3,7)];
      this.rivals.push(makeSnake(760,1510,-.6,9),makeSnake(1740,860,2,8),makeSnake(1040,1820,-.8,10));
      if(this.level)this.rivals=this.rivals.slice(0,this.level.rivals);
      else this.rivals=ENDLESS_SPAWNS.map(p=>makeSnake(p.x,p.y,Math.atan2(this.size/2-p.y,this.size/2-p.x),7,true));
      this.rivals.forEach((r,i)=>{r.name=['抢饭蛙','炫饭蛙','路过蛙','追蛋蛙','大胃蛙','巡逻蛙','散步蛙','贪蛋蛙','游园蛙','夜宵蛙'][i];r.color=['#ed8355','#9b79e4','#54aab2','#e16e95','#bb9d3d','#6b8ce0','#c97cad','#73a459','#d18b30','#6986ad'][i];r.growthRatio=[.8,.9,1,1.1,.85,1.05,.95,1.15,.9,1][i];r.spawnSlot=i;r.speed=(88+(i%6)*8)*(this.level?.speed??1);r.protected=0;});
      this.foodTarget=this.level?.food??388;for(let i=0;i<this.foodTarget-8;i++)this.foods.push(this.makeFood());
      for(let i=0;i<8;i++)this.foods.push({id:this.serial++,x:1300+(i%3-1)*62,y:1210-Math.floor(i/3)*62,kind:'egg',phase:this.random()*TAU});
      if(this.level){for(let i=0;i<6;i++)this.foods.push(this.makeFood('egg',1300,1000-i*48));if(this.levelIndex>0){this.foods.push(this.makeFood('candy',1300,1050),this.makeFood('magnet',1300,850),this.makeFood('shield',1360,1050));}}
      if(this.level?.goals.flavorKinds){Object.keys(FOOD).forEach((kind,i)=>{const zone=ZONES[i%ZONES.length];this.foods.push(this.makeFood(kind,zone.x+Math.cos(i)*100,zone.y+Math.sin(i)*100));});}
      this.startTask();
    }
    start(){if(this.status==='ready')this.status='playing';}
    pause(){if(this.status==='playing'){this.status='paused';this.boost=false;this.sprinting=false;}}
    resume(){if(this.status==='paused')this.status='playing';}
    aim(angle){if(Number.isFinite(angle))this.player.target=Math.atan2(Math.sin(angle),Math.cos(angle));}
    setBoost(on){this.boost=!!on&&this.status==='playing';}
    makeFood(kind,x,y){
      let p;if(Number.isFinite(x)&&Number.isFinite(y))p={x:clamp(x,45,this.size-45),y:clamp(y,45,this.size-45)};
      else{for(let i=0;i<30;i++){p={x:45+this.random()*(this.size-90),y:45+this.random()*(this.size-90)};if(distance(p,this.player)>95&&!this.player.body.some(b=>distance(p,b)<28))break;}}
      if(!kind){const n=this.random();kind=n<.015?'star':n<.045?'shield':n<.075?'magnet':n<.11?'pepper':n<.145?'candy':'egg';const z=ZONES.find(z=>distance(z,p)<z.r);if(z&&n>.145&&z.kind!=='egg')kind=this.random()<.14?z.kind:'egg';}
      return{id:this.serial++,x:p.x,y:p.y,kind,phase:this.random()*TAU};
    }
    ensureFlavorFoods(){if(!this.level?.goals.flavorKinds)return;Object.keys(FOOD).forEach((kind,i)=>{if(this.tastedKinds.has(kind)||this.foods.some(f=>f.kind===kind))return;const zone=ZONES[i%ZONES.length];this.foods.push(this.makeFood(kind,zone.x+Math.cos(i)*100,zone.y+Math.sin(i)*100));});}
    grow(s,variant='normal',amount=1){for(let i=0;i<amount&&s.body.length<140;i++){const p=s.body[s.body.length-1];s.body.push({...p,variant});}}
    advance(s,dt,speed){
      const maxTurn=(this.boost&&s===this.player?4.3:3.6)*dt;s.angle+=clamp(angleDelta(s.angle,s.target),-maxTurn,maxTurn);
      const dist=speed*dt;s.x+=Math.cos(s.angle)*dist;s.y+=Math.sin(s.angle)*dist;s.travel+=dist;
      s.trail.unshift({x:s.x,y:s.y,d:s.travel});const oldest=s.travel-(s.body.length+2)*this.spacing;
      while(s.trail.length>2&&s.trail[s.trail.length-2].d<oldest)s.trail.pop();
      let j=0;s.body.forEach((b,i)=>{const target=s.travel-i*this.spacing;while(j<s.trail.length-2&&s.trail[j+1].d>target)j++;const a=s.trail[j],c=s.trail[Math.min(j+1,s.trail.length-1)];const t=clamp((a.d-target)/(a.d-c.d||1),0,1);b.x=a.x+(c.x-a.x)*t;b.y=a.y+(c.y-a.y)*t;});
    }
    hit(reason,obstacle){
      if(this.status==='dead'||this.status==='won')return;
      if(this.protected>0){if(reason==='wall')this.bounce();return;}
      if(this.shield>0){this.shield=0;this.events.push({type:'shield-used',reason,x:this.player.x,y:this.player.y});if(reason==='wall')this.bounce();else this.repel(obstacle);return;}
      this.status='dead';this.boost=false;this.sprinting=false;this.collision={reason,x:this.player.x,y:this.player.y};this.events.push({type:'dead',reason});
    }
    repel(obstacle){
      const p=this.player,body=Array.isArray(obstacle)?obstacle:obstacle?[obstacle]:[];let nearest=null,best=Infinity;
      body.forEach((b,i)=>{let q=b;if(i){const a=body[i-1],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);q={x:a.x+dx*t,y:a.y+dy*t};}const d=distance(p,q);if(d<best){best=d;nearest=q;}});
      if(!nearest)return;
      let dx=p.x-nearest.x,dy=p.y-nearest.y,n=Math.hypot(dx,dy);if(n<.001){dx=-Math.cos(p.angle);dy=-Math.sin(p.angle);n=1;}
      const normal=Math.atan2(dy,dx);let exit=null;
      for(const radius of [55,75,100,140,190]){for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,Math.PI]){
        const a=normal+turn,q={x:nearest.x+Math.cos(a)*radius,y:nearest.y+Math.sin(a)*radius,angle:a};
        if(q.x<25||q.y<25||q.x>this.size-25||q.y>this.size-25)continue;
        if(touchesBody(q,body,45)||touchesBody(q,p.body.slice(5),26))continue;
        if(this.rivals.some(r=>r.alive&&r.protected<=0&&touchesBody(q,r.body,45)))continue;
        exit=q;break;
      }if(exit)break;}
      if(!exit)return;
      p.x=exit.x;p.y=exit.y;p.angle=p.target=exit.angle;p.body[0].x=p.x;p.body[0].y=p.y;p.trail.unshift({x:p.x,y:p.y,d:p.travel});
    }
    bounce(){const p=this.player;p.x=clamp(p.x,25,this.size-25);p.y=clamp(p.y,25,this.size-25);p.angle=p.target=Math.atan2(this.size/2-p.y,this.size/2-p.x);p.body[0].x=p.x;p.body[0].y=p.y;}
    eat(f){
      if(this.status==='dead'||this.status==='won')return;
      const meta=FOOD[f.kind];this.score+=meta.score;this.foodScore+=meta.score;this.eaten++;if(f.kind!=='egg')this.special++;this.energy=Math.min(100,this.energy+8);
      this.tastedKinds.add(f.kind);this.flavorKinds=this.tastedKinds.size;
      this.grow(this.player,meta.variant,f.kind==='star'?3:1);if(f.kind==='magnet')this.magnet=8;if(f.kind==='shield')this.shield=12;
      this.events.push({type:'eat',kind:f.kind,x:f.x,y:f.y,score:meta.score});
      this.advanceProgress();
    }
    defeat(r,method){
      if(this.status==='dead'||this.status==='won'||!r.alive||r.protected>0)return;
      r.alive=false;r.respawn=5;this.defeated++;this.score+=60;
      this.events.push({type:'rival',method,name:r.name,x:r.x,y:r.y,score:60});
      r.body.forEach(b=>this.foods.push(this.makeFood('star',b.x+(this.random()-.5)*20,b.y+(this.random()-.5)*20)));
      this.advanceProgress();
    }
    startTask(){
      const cycle=Math.floor(this.mission/TASKS.length),base=TASKS[this.mission%TASKS.length];
      this.task={...base,goals:Object.fromEntries(Object.entries(base.goals).map(([key,value])=>[key,value+(key==='zones'?0:key==='score'?cycle*200:key==='defeated'?Math.min(cycle,3):cycle*4)])),score:base.score+cycle*500};
      this.taskBase={eaten:this.eaten,special:this.special,defeated:this.defeated,score:this.score};this.taskZones=new Set();this.missionCount=0;this.missionGoal=Object.values(this.task.goals)[0];
    }
    goalProgress(goals,incremental=false){return Object.entries(goals).map(([key,target])=>{const value=key==='zones'?this.taskZones.size:Math.floor(this[key]-(incremental?(this.taskBase[key]??0):0));return{key,label:GOAL_LABELS[key],value:Math.min(target,Math.max(0,value)),target,done:value>=target};});}
    taskReward(){const t=this.task;return '+'+t.score+' 分'+(t.energy?' / 能量 +'+t.energy:'')+(t.shield?' / 护盾 '+t.shield+'s':'')+(t.magnet?' / 磁铁 '+t.magnet+'s':'');}
    timeOut(){if(this.status!=='playing')return;this.status='dead';this.boost=false;this.sprinting=false;this.collision={reason:'timeout',x:this.player.x,y:this.player.y};this.events.push({type:'dead',reason:'timeout'});}
    advanceProgress(){
      if(this.status!=='playing')return;
      const zone=ZONES.find(z=>distance(this.player,z)<z.r);if(zone)this.taskZones.add(zone.name);
      if(this.level){if(this.level.timeLimit&&this.time>=this.level.timeLimit-1e-8){this.time=this.level.timeLimit;this.timeOut();return;}if(this.goalProgress(this.level.goals).every(g=>g.done)){this.status='won';this.boost=false;this.sprinting=false;this.events.push({type:'win',levelIndex:this.levelIndex});}return;}
      const progress=this.goalProgress(this.task.goals,true);this.missionCount=progress[0].value;
      if(progress.every(g=>g.done)){
        const t=this.task;this.score+=t.score;this.energy=clamp(this.energy+(t.energy??0),0,100);this.shield=Math.max(this.shield,t.shield??0);this.magnet=Math.max(this.magnet,t.magnet??0);this.mission++;
        this.events.push({type:'mission',number:this.mission,score:t.score,name:t.name,reward:this.taskReward()});this.startTask();
      }
    }
    respawnRival(r){
      if(!this.level){
        const anchor=ENDLESS_SPAWNS[r.spawnSlot??this.rivals.indexOf(r)]??ENDLESS_SPAWNS[0];
        const length=clamp(Math.round((7+Math.floor(this.score/120))*(r.growthRatio??1)),7,40);
        // Each rival owns one region; candidates and facing order are deterministic.
        const offsets=[[0,0],[70,0],[-70,0],[0,70],[0,-70],[70,70],[-70,70],[70,-70],[-70,-70],[140,0],[-140,0],[0,140],[0,-140]];
        for(const [dx,dy] of offsets){const x=anchor.x+dx,y=anchor.y+dy,forward=Math.atan2(this.size/2-y,this.size/2-x);
          for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI]){const s=makeSnake(x,y,forward+turn,length,length>18);
            if(s.body.some(b=>b.x<45||b.y<45||b.x>this.size-45||b.y>this.size-45))continue;
            if(distance(s,this.player)<300||s.body.some(b=>touchesBody(b,this.player.body,90)))continue;
            if(this.rivals.some(other=>other!==r&&other.alive&&(distance(s,other)<180||s.body.some(b=>touchesBody(b,other.body,45)))))continue;
            Object.assign(r,s,{protected:1.5});return;
          }
        }
        r.respawn=1;return;
      }
      const length=7;
      for(let attempt=0;attempt<50;attempt++){
        let x,y;if(this.level&&attempt<35){const angle=this.random()*TAU,radius=400+this.random()*400;x=clamp(this.player.x+Math.cos(angle)*radius,150,this.size-150);y=clamp(this.player.y+Math.sin(angle)*radius,150,this.size-150);}else{x=150+this.random()*(this.size-300);y=150+this.random()*(this.size-300);}
        const s=makeSnake(x,y,this.random()*TAU,length,!this.level&&length>18);
        if(s.body.some(b=>b.x<45||b.y<45||b.x>this.size-45||b.y>this.size-45))continue;
        if(distance(s,this.player)<300||s.body.some(b=>touchesBody(b,this.player.body,90)))continue;
        Object.assign(r,s,{protected:1.5});return;
      }
      r.respawn=1;
    }
    update(dt){
      this.events=[];if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return this.events;
      let remaining=Math.min(dt,.25);while(remaining>1e-8&&this.status==='playing'){const step=Math.min(1/60,remaining);this.step(step);remaining-=step;}return this.events;
    }
    step(dt){
      const timeLimit=this.level?.timeLimit,nextTime=this.time+dt;this.time=timeLimit&&nextTime>=timeLimit-1e-8?timeLimit:nextTime;if(timeLimit&&this.time>=timeLimit){this.timeOut();return;}
      this.magnet=Math.max(0,this.magnet-dt);this.shield=Math.max(0,this.shield-dt);this.protected=Math.max(0,this.protected-dt);this.contactHint=Math.max(0,this.contactHint-dt);
      const sprint=this.sprinting=this.boost&&this.energy>1;this.energy=clamp(this.energy+(sprint?-26:9)*dt,0,100);this.advance(this.player,dt,sprint?202:122);const p=this.player;
      if(p.x<20||p.y<20||p.x>this.size-20||p.y>this.size-20)this.hit('wall');if(this.status!=='playing')return;
      if(this.protected<=0&&p.body.slice(5).some(b=>distance(p,b)<23))this.hit('self',p.body.slice(5));if(this.status!=='playing')return;
      const removed=new Set();for(const f of this.foods){let d=distance(p,f);if(this.magnet>0&&d<175&&d>25){const move=Math.min(d-20,300*dt);f.x+=(p.x-f.x)/d*move;f.y+=(p.y-f.y)/d*move;d=distance(p,f);}if(d<29){removed.add(f.id);this.eat(f);if(this.status!=='playing')break;}}
      if(this.status!=='playing'){this.foods=this.foods.filter(f=>!removed.has(f.id));return;}
      for(const r of this.rivals){
        if(!r.alive){r.respawn-=dt;if(r.respawn<=0)this.respawnRival(r);continue;}
        r.protected=Math.max(0,(r.protected||0)-dt);
        if(r.x<80||r.y<80||r.x>this.size-80||r.y>this.size-80)r.target=Math.atan2(this.size/2-r.y,this.size/2-r.x);
        else{let food=null,d=Infinity;for(const f of this.foods){if(removed.has(f.id))continue;const n=distance(r,f);if(n<d){d=n;food=f;}}if(food)r.target=Math.atan2(food.y-r.y,food.x-r.x);}
        this.advance(r,dt,r.speed);
        if(r.protected<=0){
          // Boost changes speed only. Head collisions are resolved before body collisions.
          if(distance(p,r)<42){
            this.hit('rival-head',r);
            if(this.status!=='playing'){r.alive=false;r.respawn=5;break;}
            this.defeat(r,'head');if(this.status==='won')break;continue;
          }
          if(touchesBody(p,r.body.slice(1),34)){this.hit('rival-body',r.body.slice(1));if(this.status!=='playing')break;}
          if(touchesBody(r,p.body.slice(2),34)){this.defeat(r,'trap');if(this.status==='won')break;continue;}
        }
        for(const f of this.foods)if(!removed.has(f.id)&&distance(r,f)<25){removed.add(f.id);if(r.body.length<15)this.grow(r);}
      }
      if(this.status!=='playing'){this.foods=this.foods.filter(f=>!removed.has(f.id));return;}
      if(removed.size){this.foods=this.foods.filter(f=>!removed.has(f.id));while(this.foods.length<this.foodTarget)this.foods.push(this.makeFood());this.ensureFlavorFoods();}
      this.advanceProgress();
    }
    snapshot(){return{status:this.status,playMode:this.playMode,levelIndex:this.levelIndex,levelName:this.level?.name,timeLimit:this.level?.timeLimit,timeRemaining:this.level?.timeLimit?Math.max(0,this.level.timeLimit-this.time):null,objectives:this.goalProgress(this.level?.goals??this.task.goals,!this.level),taskName:this.task.name,taskReward:this.taskReward(),score:this.score,foodScore:this.foodScore,length:this.player.body.length,eaten:this.eaten,special:this.special,time:Math.floor(this.time),energy:Math.round(this.energy),magnet:Math.ceil(this.magnet),shield:Math.ceil(this.shield),boost:this.boost,sprinting:this.sprinting,mission:this.mission,missionProgress:this.missionCount,missionGoal:this.missionGoal,defeated:this.defeated,worldSize:this.size,head:{x:Math.round(this.player.x),y:Math.round(this.player.y),angle:this.player.angle},rivals:this.rivals.filter(r=>r.alive).length,rivalStates:this.rivals.map(r=>({name:r.name,x:Math.round(r.x),y:Math.round(r.y),alive:r.alive,protected:r.protected,respawn:r.respawn}))};}
  }
  root.ArenaGame=ArenaGame;root.ARENA_ZONES=ZONES;root.ARENA_LEVELS=LEVELS;if(typeof module!=='undefined')module.exports={ArenaGame,angleDelta,distance,segmentDistance,touchesBody,FOOD,ZONES,LEVELS,TASKS,ENDLESS_SPAWNS};
})(typeof window!=='undefined'?window:globalThis);
