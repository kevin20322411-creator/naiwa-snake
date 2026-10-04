'use strict';

// Regression checks against the actual engine; no engine methods are mocked.
const assert = require('node:assert/strict');
const { ArenaGame, LEVELS, ZONES, FOOD } = require('../arena-engine.js');
const FRAME = 1 / 60;
const incremental32 = process.argv.includes('--incremental-32');
const audit32 = process.argv.includes('--audit-32');
let passed = 0, failed = 0;

function random(seed = 4104) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function place(s, x = 1300, y = 1300, angle = 0, length = 5) {
  Object.assign(s, { x, y, angle, target: angle, travel: 0, alive: true, respawn: 0 });
  s.body = Array.from({ length }, (_, i) => ({ x: x - Math.cos(angle) * i * 29, y: y - Math.sin(angle) * i * 29, variant: 'normal' }));
  s.trail = s.body.map((p, i) => ({ ...p, d: -i * 29 }));
  return s;
}
function fixture(levelIndex) {
  const g = new ArenaGame(random());
  if (levelIndex !== undefined) g.reset({ mode: 'levels', levelIndex });
  g.start();
  g.rivals = []; g.foods = []; g.foodTarget = 0; g.protected = 0; g.shield = 0;
  place(g.player);
  return g;
}
const rival = (x = 2100, y = 2100) => Object.assign(place({}, x, y, Math.PI, 8), { name: 'test-rival', speed: 0, protected: 0 });
function trappedRival(g, segment = 3) {
  const { x, y } = g.player.body[segment];
  return place(rival(x, y), x, y, Math.PI / 2, 8);
}
const egg = (g, kind = 'egg') => ({ id: g.serial++, x: g.player.x + 2, y: g.player.y, kind });
const eventsOf = (g, type) => g.events.filter(e => e.type === type);
const progress = (g, key) => g.goalProgress(g.task.goals, true).find(p => p.key === key).value;
const KINDS = Object.keys(FOOD);
const state = g => JSON.stringify({ ...g, events: undefined }, (_, value) => value instanceof Set ? [...value] : value);
function setGoal(g, key, value) {
  if (key === 'zones') g.taskZones = new Set(ZONES.slice(0, value).map(z => z.name));
  else if (key === 'flavorKinds') { g.tastedKinds = new Set(KINDS.slice(0, value)); g.flavorKinds = value; }
  else g[key] = value;
}
function setGoals(g, goals) { for (const [key, value] of Object.entries(goals)) setGoal(g, key, value); }
function test(name, fn, includedInIncremental = false, includedInAudit = false) {
  if (incremental32 && !includedInIncremental) return;
  if (audit32 && !includedInAudit) return;
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function completeTask(g) {
  const mission = g.mission, goals = { ...g.task.goals };
  for (const key of ['eaten', 'special', 'defeated', 'zones', 'score']) {
    if (!(key in goals)) continue;
    let attempts = 0;
    while (g.mission === mission && progress(g, key) < goals[key]) {
      assert.ok(++attempts < 1000, 'Task must be completable');
      if (key === 'defeated') g.defeat(rival(), 'dash');
      else if (key === 'zones') {
        const z = ZONES.find(zone => !g.taskZones.has(zone.name)); place(g.player, z.x, z.y); g.advanceProgress();
      } else g.eat(egg(g, key === 'special' ? 'candy' : 'egg'));
    }
  }
  assert.equal(g.mission, mission + 1);
}

const expectedLevels = [
  { foodScore:300, special:3 }, { foodScore:600, defeated:2 },
  { foodScore:1000, defeated:3 }, { foodScore:1600, defeated:5 },
  { foodScore:2200, special:12, defeated:6 }, { foodScore:2800, defeated:7 },
  { foodScore:3400, special:24, defeated:8 }, { foodScore:4000, defeated:10 },
  ...LEVELS.slice(8).map(level => ({...level.goals})),
];
const expectedLimits = [undefined,undefined,90,70,90,85,80,75,...LEVELS.slice(8).map(level => level.timeLimit)];
const timedIndices = expectedLevels.map((_, index) => index).filter(index => expectedLimits[index]);
const combatIndices = expectedLevels.map((_, index) => index).filter(index => 'defeated' in expectedLevels[index]);
const foodIndices = expectedLevels.map((_, index) => index).filter(index => 'foodScore' in expectedLevels[index]);
assert.equal(LEVELS.length, 32, '本次检查必须使用完整32关配置');
for (let index = 0; index < expectedLevels.length; index++) test('第' + (index + 1) + '关：每个目标差一点不胜利，刚好满足只通关一次且不额外加分', () => {
  if (index < 8) assert.deepEqual(LEVELS[index].goals, expectedLevels[index]);
  assert.ok(LEVELS[index].reward === undefined || LEVELS[index].reward === 0, '关卡不得包含额外加分');
  assert.equal(LEVELS[index].timeLimit, expectedLimits[index]);
  if (index >= 4 && index < 8) assert.equal(LEVELS[index].rivals, 3);
  for (const [key, target] of Object.entries(expectedLevels[index])) {
    const g = fixture(index);
    setGoals(g, expectedLevels[index]);
    if (!('time' in expectedLevels[index])) g.time = expectedLimits[index] ? expectedLimits[index] - 0.001 : 200;
    setGoal(g, key, target - 1);
    g.advanceProgress();
    assert.equal(g.status, 'playing', key + ' 尚未满足');
    assert.equal(eventsOf(g, 'win').length, 0);
    assert.equal(g.snapshot().timeRemaining, expectedLimits[index] ? expectedLimits[index] - g.time : null);
    assert.equal(g.snapshot().objectives.find(goal => goal.key === key).value, target - 1);
    setGoal(g, key, target);
    const score = g.score;
    g.advanceProgress(); g.advanceProgress();
    assert.equal(g.status, 'won');
    assert.equal(g.score, score);
    if ('foodScore' in expectedLevels[index]) assert.equal(g.foodScore, expectedLevels[index].foodScore);
    assert.ok(g.snapshot().objectives.every(goal => goal.done));
    assert.equal(eventsOf(g, 'win').length, 1);
    assert.equal(eventsOf(g, 'win')[0].levelIndex, index);
  }
}, index >= 24);

test('32关真实 update：最后食物或击败满足实际目标时只加基础分；胜利食物清理且不补', () => {
  for (const index of foodIndices) {
    const g = fixture(index);
    setGoals(g, expectedLevels[index]);
    const hasSpecial = 'special' in expectedLevels[index];
    const foodPoints = hasSpecial ? 30 : 10;
    g.foodScore -= foodPoints; g.score = g.foodScore;
    if (hasSpecial) g.special--;
    if (expectedLimits[index]) g.time = expectedLimits[index] - 0.002;
    const final = egg(g, hasSpecial ? 'candy' : 'egg');
    const untouched = { ...egg(g), id: g.serial++ };
    g.foods = [final, untouched]; g.foodTarget = 100;
    const score = g.score;
    const events = g.update(0.001);
    assert.equal(g.status, 'won');
    assert.equal(events.filter(e => e.type === 'eat').length, 1);
    assert.equal(events.filter(e => e.type === 'win').length, 1);
    assert.equal(g.score, score + foodPoints);
    assert.equal(g.foodScore, expectedLevels[index].foodScore);
    assert.deepEqual(g.foods.map(f => f.id), [untouched.id]);
    if (expectedLimits[index]) assert.ok(g.time < expectedLimits[index]);
  }
  for (const index of combatIndices) {
    const combat = fixture(index); setGoals(combat, expectedLevels[index]); combat.defeated--;
    if (expectedLimits[index]) combat.time = expectedLimits[index] - 0.002;
    combat.rivals = [trappedRival(combat)]; combat.setBoost(true);
    const events = combat.update(0.001);
    assert.equal(combat.status, 'won'); assert.equal(combat.defeated, expectedLevels[index].defeated);
    assert.equal(combat.score, 60);
    assert.equal(combat.foodScore, expectedLevels[index].foodScore ?? 0);
    assert.equal(events.filter(e => e.type === 'rival').length, 1);
    assert.equal(events.filter(e => e.type === 'win').length, 1);
  }
});

test('通关只发一次且 update 冻结世界；暂停不耗倒计时、恢复只推进当次时间', () => {
  for (let index = 0; index < expectedLevels.length; index++) {
    const g = fixture(index);
    setGoals(g, expectedLevels[index]); Object.assign(g, { magnet:8, shield:9, energy:70 });
    g.foods = [egg(g)]; g.rivals = [rival()]; g.setBoost(true);
    g.advanceProgress();
    assert.equal(g.boost, false); assert.equal(g.sprinting, false);
    const before = state(g);
    g.eat(g.foods[0]); g.defeat(g.rivals[0], 'dash'); g.hit('wall'); g.advanceProgress();
    assert.equal(eventsOf(g, 'win').length, 1);
    for (let frame = 0; frame < 4; frame++) assert.deepEqual(g.update(0.25), []);
    assert.equal(state(g), before);
  }
  for (const index of timedIndices) {
    const g = fixture(index); g.time = 12.34; g.magnet = 8;
    g.pause(); const before = state(g), remaining = g.snapshot().timeRemaining;
    for (let frame = 0; frame < 4; frame++) assert.deepEqual(g.update(0.25), []);
    assert.equal(state(g), before); assert.equal(g.snapshot().timeRemaining, remaining);
    g.resume(); g.update(0.1);
    assert.ok(Math.abs(g.time - 12.44) < 1e-9);
    assert.ok(Math.abs(g.snapshot().timeRemaining - (remaining - 0.1)) < 1e-9);
  }
});

test('死亡同帧优先；全部限时关截止时已达标或未达标都只发一次timeout且冻结', () => {
  for (const reason of ['wall', 'self']) {
    const g = fixture(0); g.foodScore = 290; g.special = 3;
    if (reason !== 'self') place(g.player, 2579, 1300, 0);
    else {
      const coords = [[1300,1300],[1300,1271],[1271,1271],[1242,1271],[1242,1300],[1300,1300],[1300,1329]];
      g.player.body = coords.slice(0, 6).map(([x,y]) => ({ x,y,variant:'normal' }));
      g.player.trail = coords.map(([x,y],i) => ({ x,y,d:-i*29 }));
    }
    g.foods = [egg(g)]; const score = g.score, eaten = g.eaten;
    const events = g.update(FRAME);
    assert.equal(g.status, 'dead');
    assert.equal(events.filter(e => e.type === 'dead').length, 1);
    assert.equal(events.filter(e => e.type === 'win' || e.type === 'mission' || e.type === 'eat').length, 0);
    assert.equal(g.score, score); assert.equal(g.eaten, eaten);
    assert.equal(g.foods.length, 1);
  }
  for (const index of timedIndices) for (const completed of [false,true]) for (const path of ['update','progress']) {
    const g = fixture(index); setGoals(g, expectedLevels[index]);
    if (!completed) { const [key,target] = Object.entries(expectedLevels[index])[0]; setGoal(g,key,target-1); }
    g.time = expectedLimits[index] - (path === 'update' ? 0.001 : 0);
    g.magnet = 8; g.shield = 9; g.protected = 3; g.setBoost(true);
    g.foods = [egg(g)]; const foodScore = g.foodScore, score = g.score, head = {...g.player};
    if (path === 'update') g.update(0.001); else g.advanceProgress();
    assert.equal(g.status, 'dead'); assert.equal(g.collision.reason, 'timeout');
    assert.equal(g.time, expectedLimits[index]); assert.equal(g.snapshot().timeRemaining, 0);
    assert.deepEqual(eventsOf(g,'dead').map(e => e.reason), ['timeout']);
    assert.equal(eventsOf(g,'win').length, 0); assert.equal(eventsOf(g,'eat').length, 0);
    assert.equal(g.foodScore, foodScore); assert.equal(g.score, score); assert.equal(g.foods.length, 1);
    assert.equal(g.player.x, head.x); assert.equal(g.player.y, head.y);
    assert.equal(g.shield, 9); assert.equal(g.magnet, 8); assert.equal(g.boost, false); assert.equal(g.sprinting, false);
    const before = state(g); g.timeOut(); g.advanceProgress();
    assert.equal(eventsOf(g,'dead').length, 1); assert.deepEqual(g.update(0.25), []); assert.equal(state(g), before);
  }
});

test('foodScore只累计吃食，击败及任务奖励不抵扣目标；通关不额外加分且普通蛋不算特殊', () => {
  const g = fixture();
  g.eat(egg(g)); assert.equal(g.special, 0);
  for (const kind of ['pepper', 'candy', 'magnet', 'shield', 'star']) g.eat(egg(g, kind));
  assert.equal(g.eaten, 6); assert.equal(g.special, 5); assert.equal(g.score, 160); assert.equal(g.foodScore, 160);
  const r = rival(); r.protected = 1;
  g.defeat(r, 'dash'); assert.equal(g.defeated, 0);
  r.protected = 0; g.defeat(r, 'dash'); g.defeat(r, 'dash');
  assert.equal(g.defeated, 1); assert.equal(g.score, 220);
  assert.equal(g.foodScore, 160);
  assert.equal(eventsOf(g, 'rival').length, 1);
  g.eat(egg(g)); g.eat(egg(g));
  assert.equal(g.foodScore, 180); assert.equal(g.score, 280); assert.equal(g.mission, 1);
  for (const index of foodIndices) {
    const level = fixture(index); setGoals(level, expectedLevels[index]);
    level.foodScore--; level.score = 10000;
    level.advanceProgress(); assert.equal(level.status, 'playing');
    level.defeat(rival(), 'dash');
    assert.equal(level.foodScore, expectedLevels[index].foodScore - 1); assert.equal(level.status, 'playing');
    const score = level.score;
    level.eat(egg(level));
    assert.equal(level.status, 'won'); assert.equal(level.foodScore, expectedLevels[index].foodScore + 9);
    assert.equal(level.score, score + 10);
    assert.equal(level.snapshot().foodScore, level.foodScore);
  }
});

test('实际eat按六种口味去重、重复吃不增种类、重开清零；口味关保底六种分布四区', () => {
  const g = fixture();
  for (let index = 0; index < KINDS.length; index++) {
    for (let repeat = 0; repeat < 2; repeat++) {
      g.eat(egg(g, KINDS[index]));
      assert.equal(g.flavorKinds, index + 1);
      assert.equal(g.tastedKinds.size, index + 1);
      assert.deepEqual([...g.tastedKinds], KINDS.slice(0,index+1));
    }
  }
  const flavorIndex = LEVELS.findIndex(level => level.goals.flavorKinds === 6);
  for (const options of [{mode:'levels',levelIndex:flavorIndex},{mode:'endless'}]) {
    g.reset(options); assert.equal(g.flavorKinds,0); assert.equal(g.tastedKinds.size,0);
    g.start(); g.eat(egg(g)); assert.equal(g.flavorKinds,1);
  }
  const guaranteed = new ArenaGame(random()); guaranteed.reset({mode:'levels',levelIndex:flavorIndex});
  const foods = guaranteed.foods.slice(-KINDS.length);
  assert.deepEqual(foods.map(food => food.kind), KINDS);
  const zones = new Set(foods.map(food => ZONES.find(z => Math.hypot(food.x-z.x,food.y-z.y)<z.r)?.name));
  assert.equal(zones.has(undefined),false); assert.equal(zones.size,4);
});

test('口味与区域、存活时间与区域共同满足才通关；实际eat和update跨过最后门槛', () => {
  for (const index of LEVELS.map((_,i)=>i).filter(i=>LEVELS[i].goals.flavorKinds && LEVELS[i].goals.zones && (!audit32 || i===31))) {
    const goals = LEVELS[index].goals;
    for (const missing of ['flavorKinds','zones']) {
      const g = fixture(index);
      if (goals.foodScore) g.foodScore = goals.foodScore;
      if (goals.defeated) g.defeated = goals.defeated;
      for (const kind of KINDS.slice(0,goals.flavorKinds-(missing==='flavorKinds'?1:0))) g.eat(egg(g,kind));
      const count = goals.zones-(missing==='zones'?1:0);
      for (const zone of ZONES.slice(0,count)) { place(g.player,zone.x,zone.y); g.update(0.001); }
      assert.equal(g.status,'playing'); assert.equal(eventsOf(g,'win').length,0);
      if (missing==='flavorKinds') {
        g.eat(egg(g,KINDS[0])); assert.equal(g.status,'playing');
        g.foods = [egg(g,KINDS[goals.flavorKinds-1])];
      } else { const zone=ZONES[goals.zones-1]; place(g.player,zone.x,zone.y); }
      const events = g.update(0.001);
      assert.equal(g.status,'won'); assert.equal(events.filter(e=>e.type==='win').length,1);
      assert.equal(g.flavorKinds,goals.flavorKinds); assert.equal(g.taskZones.size,goals.zones);
    }
  }
  for (const index of LEVELS.map((_,i)=>i).filter(i=>!audit32 && LEVELS[i].goals.time && LEVELS[i].goals.zones)) {
    const goals = LEVELS[index].goals;
    for (const missing of ['time','zones']) {
      const g=fixture(index); if(goals.foodScore)g.foodScore=goals.foodScore;
      g.time = missing==='time' ? goals.time-0.1 : goals.time;
      for(const zone of ZONES.slice(0,goals.zones-(missing==='zones'?1:0))){place(g.player,zone.x,zone.y);g.update(0.001);}
      assert.equal(g.status,'playing');
      if(missing==='zones'){const zone=ZONES[goals.zones-1];place(g.player,zone.x,zone.y);}
      const events=g.update(missing==='time'?0.1:0.001);
      assert.equal(g.status,'won');assert.equal(events.filter(e=>e.type==='win').length,1);
    }
  }
},false,true);

test('六种任务只统计激活后的增量，旧吃蛋、特殊蛋、击败、分数和区域不抵扣', () => {
  for (let index = 0; index < 6; index++) {
    const g = fixture();
    Object.assign(g, { eaten:100, special:50, defeated:20, score:5000, mission:index });
    g.taskZones = new Set(ZONES.map(z => z.name));
    g.startTask();
    assert.deepEqual(g.taskBase, { eaten:100, special:50, defeated:20, score:5000 });
    assert.equal(g.taskZones.size, 0);
    assert.ok(g.goalProgress(g.task.goals, true).every(p => p.value === 0 && !p.done));
    g.eat(egg(g));
    assert.equal(g.mission, index);
    assert.equal(eventsOf(g, 'mission').length, 0);
    if ('eaten' in g.task.goals) assert.equal(progress(g, 'eaten'), 1);
    if ('special' in g.task.goals) assert.equal(progress(g, 'special'), 0);
    if ('defeated' in g.task.goals) assert.equal(progress(g, 'defeated'), 0);
    if ('score' in g.task.goals) assert.equal(progress(g, 'score'), 10);
  }
});

test('真实吃蛋和击败完成六档；首轮40/80/140/220/320/450，第二轮每档+500且目标递增', () => {
  const g = fixture(), rewards = [40,80,140,220,320,450];
  const goals = [
    {eaten:8}, {eaten:12}, {defeated:1}, {special:3,zones:2}, {eaten:24,defeated:2}, {score:700,defeated:3},
    {eaten:12}, {eaten:16}, {defeated:2}, {special:7,zones:2}, {eaten:28,defeated:3}, {score:900,defeated:4},
  ];
  for (let index = 0; index < 12; index++) {
    assert.deepEqual(g.task.goals, goals[index]);
    assert.equal(g.task.score, rewards[index % 6] + (index >= 6 ? 500 : 0));
    g.events = []; completeTask(g);
    const awarded = eventsOf(g, 'mission');
    assert.equal(awarded.length, 1);
    assert.equal(awarded[0].score, rewards[index % 6] + (index >= 6 ? 500 : 0));
    assert.equal(awarded[0].number, index + 1);
    assert.equal(g.taskBase.score, g.score);
    assert.equal(g.status, 'playing');
    assert.equal(eventsOf(g, 'win').length, 0);
  }
});

test('任务奖励纳入新基线，不抵扣下一项700分目标；699不完成、700才领奖', () => {
  const g = fixture(); g.mission = 4; g.startTask();
  Object.assign(g, { eaten:24, defeated:1, score:640 });
  g.defeat(rival(), 'dash');
  assert.equal(g.mission, 5); assert.equal(g.score, 1020); assert.equal(g.taskBase.score, 1020);
  assert.equal(progress(g, 'score'), 0);
  for (let i = 0; i < 3; i++) g.defeat(rival(), 'dash');
  const base = g.taskBase.score;
  g.score = base + 699; g.advanceProgress();
  assert.equal(g.mission, 5); assert.equal(progress(g, 'score'), 699);
  g.score++; g.advanceProgress();
  assert.equal(g.mission, 6); assert.equal(g.score, base + 700 + 450);
  assert.equal(g.taskBase.score, g.score);
});

test('探索必须是2个不同区域和3枚激活后特殊蛋；重复区域和普通蛋都不代替条件', () => {
  for (const missing of ['zones', 'special']) {
    const g = fixture(); g.mission = 3; g.startTask();
    place(g.player, ZONES[0].x, ZONES[0].y);
    for (let i = 0; i < 4; i++) g.advanceProgress();
    assert.equal(g.taskZones.size, 1);
    for (let i = 0; i < 10; i++) g.eat(egg(g));
    assert.equal(progress(g, 'special'), 0);
    for (let i = 0; i < (missing === 'zones' ? 3 : 2); i++) g.eat(egg(g, 'candy'));
    if (missing === 'special') { place(g.player, ZONES[1].x, ZONES[1].y); g.advanceProgress(); }
    assert.equal(g.mission, 3);
    if (missing === 'zones') { place(g.player, ZONES[1].x, ZONES[1].y); g.advanceProgress(); }
    else g.eat(egg(g, 'pepper'));
    assert.equal(g.mission, 4); assert.equal(eventsOf(g, 'mission').length, 1);
  }
});

test('真实 update 同帧3枚食物只领当前任务一次，后2枚进入新任务增量', () => {
  const g = fixture();
  for (let i = 0; i < 7; i++) g.eat(egg(g));
  g.foods = [egg(g), egg(g), egg(g)];
  const events = g.update(FRAME);
  assert.equal(g.eaten, 10); assert.equal(g.score, 140); assert.equal(g.mission, 1);
  assert.equal(events.filter(e => e.type === 'eat').length, 3);
  assert.equal(events.filter(e => e.type === 'mission').length, 1);
  assert.equal(progress(g, 'eaten'), 2); assert.equal(g.foods.length, 0);
  assert.equal(g.update(FRAME).filter(e => e.type === 'mission').length, 0);
});

test('真实 update 同帧多次击败只领当前任务一次，重复死亡电脑不再计数', () => {
  const g = fixture(); g.mission = 2; g.startTask();
  g.rivals = [trappedRival(g, 3), trappedRival(g, 4)]; g.setBoost(true);
  const events = g.update(FRAME);
  assert.equal(g.defeated, 2); assert.equal(g.score, 260); assert.equal(g.mission, 3);
  assert.equal(events.filter(e => e.type === 'rival').length, 2);
  assert.equal(events.filter(e => e.type === 'mission').length, 1);
  assert.equal(g.rivals.every(r => !r.alive), true);
  assert.equal(progress(g, 'special'), 0);
  g.foods = [];
  assert.equal(g.update(FRAME).filter(e => e.type === 'rival' || e.type === 'mission').length, 0);
  assert.equal(g.defeated, 2);
});

test('重开全部32关及切模式清除胜利、累计、口味、任务基线、区域、能力和加速', () => {
  const g = fixture(3); setGoals(g,expectedLevels[3]); g.advanceProgress();
  for (const options of [...LEVELS.map((_,levelIndex)=>({mode:'levels',levelIndex})),{mode:'endless'},{}]) {
    Object.assign(g, { mission:7, eaten:99, special:10, defeated:8, score:5000, foodScore:2000, flavorKinds:6, tastedKinds:new Set(KINDS), time:60, energy:0, magnet:9, shield:9, boost:true, sprinting:true, collision:{reason:'timeout'}, status:'dead' });
    g.taskZones = new Set(ZONES.map(z => z.name)); g.events.push({ type:'win' });
    g.reset(options);
    assert.equal(g.status, 'ready'); assert.equal(g.eaten, 0); assert.equal(g.special, 0);
    assert.equal(g.defeated, 0); assert.equal(g.score, 0); assert.equal(g.foodScore, 0); assert.equal(g.time, 0);
    assert.equal(g.flavorKinds,0); assert.equal(g.tastedKinds.size,0);
    assert.equal(g.mission, 0); assert.equal(g.missionCount, 0); assert.equal(g.missionGoal, 8);
    assert.equal(g.energy, 100); assert.equal(g.magnet, 0); assert.equal(g.boost, false); assert.equal(g.sprinting, false);
    assert.equal(g.shield, options.mode === 'levels' && options.levelIndex > 0 ? 5 : 0);
    assert.equal(g.player.body.length, 5); assert.deepEqual(g.events, []); assert.equal(g.collision, null);
    assert.deepEqual(g.taskBase, {eaten:0,special:0,defeated:0,score:0}); assert.equal(g.taskZones.size, 0);
    assert.equal(g.playMode, options.mode === 'levels' ? 'levels' : 'endless');
    assert.equal(g.levelIndex, options.levelIndex || 0);
    assert.equal(g.snapshot().timeRemaining, options.mode === 'levels' ? (expectedLimits[options.levelIndex || 0] ?? null) : null);
    assert.deepEqual(g.update(FRAME), []);
  }
});

test('新增8关真实update通关、存活门槛及限时关超时优先，胜利/死亡均冻结', () => {
  assert.equal(LEVELS[27].timeLimit,210);
  assert.equal(LEVELS[31].goals.foodScore,10500);
  for (let index=24;index<32;index++) {
    const goals=LEVELS[index].goals, g=fixture(index);
    setGoals(g,goals);
    const trigger='foodScore' in goals?'foodScore':'time';
    if(trigger==='foodScore'){g.foodScore-=10;g.foods=[egg(g)];}
    else g.time=goals.time-0.001;
    if(g.level.timeLimit)g.time=g.level.timeLimit-0.002;
    const score=g.score, events=g.update(0.001);
    assert.equal(g.status,'won','关'+(index+1));
    assert.equal(events.filter(e=>e.type==='win').length,1);
    assert.equal(g.score,score+(trigger==='foodScore'?10:0));
    assert.ok(g.snapshot().objectives.every(goal=>goal.done));
    const before=state(g);assert.deepEqual(g.update(0.25),[]);assert.equal(state(g),before);
    if(goals.time){
      const survivor=fixture(index);setGoals(survivor,goals);survivor.time=goals.time-0.001;
      assert.equal(survivor.update(0.0004).some(e=>e.type==='win'),false);
      assert.equal(survivor.status,'playing');
      assert.equal(survivor.update(0.0007).filter(e=>e.type==='win').length,1);
      assert.equal(survivor.status,'won');
    }
    if(!LEVELS[index].timeLimit)continue;
    for(const completed of [false,true]){
      const timed=fixture(index);setGoals(timed,goals);
      if(!completed){const [key,target]=Object.entries(goals)[0];setGoal(timed,key,target-1);}
      timed.time=timed.level.timeLimit-0.001;timed.shield=8;timed.protected=4;timed.foods=[egg(timed)];
      const head={x:timed.player.x,y:timed.player.y}, score=timed.score, foodScore=timed.foodScore;
      const events=timed.update(0.001);
      assert.equal(timed.status,'dead');assert.equal(timed.collision.reason,'timeout');
      assert.equal(events.filter(e=>e.type==='dead').length,1);assert.equal(events.some(e=>e.type==='win'||e.type==='eat'),false);
      assert.equal(timed.snapshot().timeRemaining,0);assert.equal(timed.score,score);assert.equal(timed.foodScore,foodScore);
      assert.equal(timed.player.x,head.x);assert.equal(timed.player.y,head.y);assert.equal(timed.shield,8);
      const before=state(timed);assert.deepEqual(timed.update(0.25),[]);assert.equal(state(timed),before);
    }
  }
},true);

test('第32关四个目标同时满足才通关，每个最后门槛均由真实update越过且只赢一次', () => {
  const goals=LEVELS[31].goals;
  assert.equal(Object.keys(goals).length,4);
  for(const key of ['defeated','foodScore','flavorKinds','zones']){
    const g=fixture(31);setGoals(g,goals);setGoal(g,key,goals[key]-(key==='foodScore'?10:1));
    const events=g.update(0.001);assert.equal(g.status,'playing');assert.equal(events.some(e=>e.type==='win'),false);
    if(key==='defeated'){g.rivals=[trappedRival(g)];g.setBoost(true);}
    else if(key==='foodScore')g.foods=[egg(g)];
    else if(key==='flavorKinds')g.foods=[egg(g,KINDS[goals.flavorKinds-1])];
    else{const zone=ZONES[goals.zones-1];place(g.player,zone.x,zone.y);}
    const won=g.update(0.001);assert.equal(g.status,'won');assert.equal(won.filter(e=>e.type==='win').length,1);
    assert.ok(g.snapshot().objectives.every(goal=>goal.done));assert.deepEqual(g.update(0.25),[]);
  }
},true);

test('真实NPC吃掉最后未尝口味后区内补充，超出foodTarget仍补；已尝/无尽不补且reset六种覆盖四区', () => {
  for(const scenario of ['untried','tasted','endless']){
    const g=fixture(scenario==='endless'?undefined:24);
    g.foodTarget=g.level?.food??388;
    if(scenario==='tasted')g.eat(egg(g,'star'));
    const npc=rival(2100,2100);g.rivals=[npc];
    g.foods=KINDS.filter(kind=>kind!=='star').map((kind,i)=>g.makeFood(kind,100+i*40,100));
    while(g.foods.length<g.foodTarget+10)g.foods.push(g.makeFood('egg',300,2100));
    const last=g.makeFood('star',npc.x,npc.y);g.foods.push(last);
    const count=g.foods.length, tastes=g.flavorKinds, score=g.score, length=npc.body.length;
    const events=g.update(FRAME);
    assert.equal(g.status,'playing');assert.equal(npc.body.length,length+1,'真实NPC必须吃到食物');
    assert.equal(g.foods.some(food=>food.id===last.id),false);
    assert.equal(events.some(e=>e.type==='eat'||e.type==='rival'),false);
    assert.equal(g.flavorKinds,tastes);assert.equal(g.score,score);
    const stars=g.foods.filter(food=>food.kind==='star'), expected=scenario==='untried'?1:0;
    assert.equal(stars.length,expected);assert.equal(g.foods.length,count-1+expected);
    assert.ok(g.foods.length>g.foodTarget);
    if(expected){
      const zone=ZONES[KINDS.indexOf('star')%ZONES.length];
      assert.ok(Math.hypot(stars[0].x-zone.x,stars[0].y-zone.y)<zone.r);
      assert.notEqual(stars[0].id,last.id);
      g.update(FRAME);assert.equal(g.foods.filter(food=>food.kind==='star').length,1);
    }
  }
  const reset=new ArenaGame(random());reset.reset({mode:'levels',levelIndex:24});reset.start();reset.eat(egg(reset,'star'));
  reset.reset({mode:'levels',levelIndex:31});assert.equal(reset.flavorKinds,0);assert.equal(reset.tastedKinds.size,0);
  const guaranteed=reset.foods.slice(-KINDS.length);assert.deepEqual(guaranteed.map(food=>food.kind),KINDS);
  const zones=new Set(guaranteed.map(food=>ZONES.find(z=>Math.hypot(food.x-z.x,food.y-z.y)<z.r)?.name));
  assert.equal(zones.has(undefined),false);assert.equal(zones.size,4);
},true);

test('浮点截止：deadline前一秒连续60帧，名义截止帧不得吃蛋后通关', () => {
  const violations=[];
  for(const index of [3,2,27,31]){
    const g=fixture(index);setGoals(g,g.level.goals);g.foodScore-=10;g.time=g.level.timeLimit-1;
    for(let frame=0;frame<59;frame++)g.update(FRAME);
    g.foods=[egg(g)];const events=g.update(FRAME);
    if(g.status!=='dead'||g.collision?.reason!=='timeout'||events.some(e=>e.type==='eat'||e.type==='win')){
      violations.push({level:index+1,limit:g.level.timeLimit,time:g.time,status:g.status,events:events.map(e=>e.type)});
    }
  }
  assert.deepEqual(violations,[],'连续帧累计截止必须与单步/advanceProgress截止顺序一致');
},false,true);

test('同帧吃蛋后最终击败致胜只清理已吃食物，保留击败loot且不继续补食物', () => {
  const g=fixture(1);g.foodScore=590;g.score=590;g.defeated=1;g.foodTarget=g.level.food;
  const r=trappedRival(g);g.rivals=[r];const final=egg(g);g.foods=[final];g.setBoost(true);
  const serial=g.serial,events=g.update(0.001);
  assert.equal(g.status,'won');assert.deepEqual(events.map(e=>e.type),['eat','rival','win']);
  assert.equal(g.foodScore,600);assert.equal(g.score,660);assert.equal(g.defeated,2);
  assert.equal(g.foods.some(food=>food.id===final.id),false);
  assert.equal(g.foods.length,r.body.length,'胜利后只能留下本次击败掉落的食物');
  assert.equal(g.serial-serial,r.body.length,'胜利后不得生成额外补充食物');
  const before=state(g);assert.deepEqual(g.update(0.25),[]);assert.equal(state(g),before);
},false,true);

console.log('\nProgression checks'+(audit32?' (audit 32)':incremental32?' (incremental 25-32)':'')+': ' + passed + ' passed, ' + failed + ' failed.');
process.exitCode = failed ? 1 : 0;
