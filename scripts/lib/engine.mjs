// 派生内核：抽取结果 → 固定派生字段，移植自平台的派生内核。
// 纯函数，不读写文件、不发网络请求。

import { validate } from "./extraction.mjs";
import { fillLine, guardLine, hao, nextLine, zhu } from "./library.mjs";
import { KEYS, name, prev, skipDownstream, skipUpstream } from "./ring.mjs";

const CRITICAL_SCORES = [3, 4, 6, 8];
const MEDICAL_REPLY = "这个要问医生，我只能帮你安排时间和精力";
const MATERIAL_NOTICE = "材料里涉及身体状况、检查和用药的部分我没看，这个要问医生";
const DISCLAIMER = "这只是安排建议，不是医疗意见";
const MISSING = Symbol("missing");
const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function derive(raw) {
  if (isMap(raw) && raw.medical_in_dialogue === true) {
    return { type: "medical_stop", reply: MEDICAL_REPLY };
  }
  const result = validate(raw);
  if (!result.ok) return { type: "error", issues: result.issues };
  return { type: "ok", diagnosis: buildOutput(result.input) };
}
function buildOutput(input) {
  const missing = missingKeys(input.dimensions);
  const status = calcStatus(input.dimensions, missing);
  const base = {
    scenario: input.scenario,
    summary: input.summary,
    cautions: input.cautions,
    follow_up: input.follow_up,
    outer: input.outer,
    medical_in_dialogue: input.medical_in_dialogue,
    material_medical_skipped: input.material_medical_skipped,
    energy_topic: input.energy_topic,
    summary_notice: input.material_medical_skipped ? MATERIAL_NOTICE : null,
    disclaimer: input.energy_topic ? DISCLAIMER : null,
    dimensions: input.dimensions,
    status,
    missing,
    problems: status === "insufficient" ? [] : input.problems,
  };

  if (status === "insufficient") return { ...base, ...unrankedFields([]) };

  const critical = calcCritical(input.critical_candidates, input.by_key);
  if (flatSpread(input.dimensions)) return { ...base, ...unrankedFields(critical) };

  const strongest = pickStrongest(input.dimensions, input.by_key);
  const weakest = pickWeakest(input.dimensions, strongest, input.by_key);
  const stance = calcStance(status, input.outer, input.dimensions);
  const levers = calcLevers(weakest, strongest, input.by_key);
  const pressing = calcPressing(strongest, input.by_key);
  const addenda = calcAddenda(weakest, strongest, stance, pressing);
  const focusPair = calcFocus(strongest, input.by_key);
  const { improvement, riskResponse, priorities } = calcTexts(
    weakest, strongest, levers, addenda, stance, input.by_key,
  );

  return {
    ...base,
    strongest,
    weakest,
    stance,
    levers,
    addenda,
    risk_signals: { pressing, critical },
    focus_pair: focusPair,
    priorities,
    risk_response: riskResponse,
    improvement,
  };
}
// 分差 ≤ 1 时并列规则选出的强弱没有证据，整组派生字段留空；
// 带方向的变化信号（critical）不依赖强弱，照常保留。
function unrankedFields(critical) {
  return {
    strongest: null,
    weakest: null,
    stance: null,
    levers: null,
    addenda: { zhu: null, hao: null },
    risk_signals: { pressing: null, critical },
    focus_pair: null,
    priorities: null,
    risk_response: null,
    improvement: null,
  };
}
function flatSpread(dims) {
  const scores = scored(dims).map((d) => d.score);
  return Math.max(...scores) - Math.min(...scores) <= 1;
}
function missingKeys(dims) {
  return dims.filter((d) => d.score === null).map((d) => d.key).sort((a, b) => rix(a) - rix(b));
}
function calcStatus(dims, missing) {
  if (missing.length >= 2) return "insufficient";
  return dims.some(extremeScore) ? "imbalanced" : "balanced";
}
function extremeScore(d) {
  return Number.isInteger(d.score) && (d.score >= 8 || d.score <= 3);
}
function pickStrongest(dims, byKey) {
  return breakTies(bestGroup(scored(dims), "max"), "strongest", null, byKey);
}
function pickWeakest(dims, strongest, byKey) {
  const candidates = scored(dims).filter((d) => d.key !== strongest);
  return breakTies(bestGroup(candidates, "min"), "weakest", strongest, byKey);
}
function scored(dims) {
  return dims.filter((d) => d.score !== null);
}
function bestGroup(dims, mode) {
  const scores = dims.map((d) => d.score);
  const best = mode === "max" ? Math.max(...scores) : Math.min(...scores);
  return dims.filter((d) => d.score === best);
}
function breakTies(cands, which, strongest, byKey) {
  if (cands.length === 1) return cands[0].key;
  const material = cands.filter((c) => c.source === "material");
  const bySrc = material.length === 0 ? cands : material;
  if (bySrc.length === 1) return bySrc[0].key;

  const tied = skipTie(bySrc, which, strongest, byKey);
  if (tied.length === 1) return tied[0].key;
  return [...tied].sort((a, b) => rix(a.key) - rix(b.key))[0].key;
}

// 隔位下游分更低优先；缺失不参与本步。
// 只在最强候选 ≥ 8 时启用；分数不高时没有「压」的证据，直接走环序。
function skipTie(cands, which, strongest, byKey) {
  if (which === "strongest") {
    if (cands[0].score < 8) return cands;

    const present = [];
    for (const c of cands) {
      const s = scoreOf(byKey, skipDownstream(c.key));
      if (Number.isInteger(s)) present.push([c, s]);
    }
    if (present.length === 0) return cands;
    const min = Math.min(...present.map(([, s]) => s));
    return present.filter(([, s]) => s === min).map(([c]) => c);
  }

  const strongestScore = scoreOf(byKey, strongest);
  if (!Number.isInteger(strongestScore) || strongestScore < 8) return cands;

  const pressed = skipDownstream(strongest);
  const preferred = cands.filter((c) => c.key === pressed);
  return preferred.length === 0 ? cands : preferred;
}
function scoreOf(byKey, key) {
  const dim = byKey[key];
  return isMap(dim) && Number.isInteger(dim.score) ? dim.score : MISSING;
}
function rix(key) {
  return KEYS.indexOf(key);
}
function calcStance(status, outer, dims) {
  if (status !== "imbalanced") return null;
  if (outer === "up") return anyWeak(dims) ? "fill" : "restrain";
  if (outer === "down") return anyWeak(dims) ? "shrink" : "relocate";
  return null;
}
function anyWeak(dims) {
  return dims.some((d) => Number.isInteger(d.score) && d.score <= 3);
}
function calcLevers(weakest, strongest, byKey) {
  return {
    fill: scoreOf(byKey, prev(weakest)) === MISSING ? "bi" : "sheng",
    guard: scoreOf(byKey, skipUpstream(strongest)) === MISSING ? "xie" : "ke",
  };
}
function calcAddenda(weakest, strongest, stance, pressing) {
  return {
    zhu: stance === "shrink" ? null : zhu(weakest),
    hao: pressing === null ? null : hao(strongest),
  };
}
// 「正在压」要有证据：最强 ≥ 8 且隔位下游有分且 ≤ 5。
function calcPressing(strongest, byKey) {
  const down = skipDownstream(strongest);
  const score = scoreOf(byKey, strongest);
  const downScore = scoreOf(byKey, down);

  return Number.isInteger(score) && score >= 8 &&
      Number.isInteger(downScore) && downScore <= 5
    ? { from: strongest, to: down }
    : null;
}
function calcCritical(candidates, byKey) {
  return [...new Set(candidates.filter((key) => {
    const dim = byKey[key];
    return isMap(dim) && CRITICAL_SCORES.includes(dim.score);
  }))].sort((a, b) => rix(a) - rix(b));
}
function calcFocus(strongest, byKey) {
  const down = skipDownstream(strongest);
  const a = scoreOf(byKey, strongest);
  const b = scoreOf(byKey, down);
  return Number.isInteger(a) && Number.isInteger(b) && a - b >= 5
    ? { a: strongest, b: down, gap: a - b }
    : null;
}
function calcTexts(weakest, strongest, levers, addenda, stance, byKey) {
  const fillMain = fillLine(weakest, levers.fill);
  const guardMain = guardLine(strongest, levers.guard);
  let improvement = addenda.zhu === null ? fillMain : `${fillMain} 外部：${addenda.zhu}`;
  let riskResponse = addenda.hao === null ? guardMain : `${guardMain} 同时：${addenda.hao}`;

  // 措辞轻重只看这一侧自己的分数；整体状态只决定一句话诊断的开头。
  // 姿态「缩」仍给【风险应对】加「留意：」，与分数规则取或，且只加一次。
  const weakScore = scoreOf(byKey, weakest);
  const strongScore = scoreOf(byKey, strongest);
  if (!(Number.isInteger(weakScore) && weakScore <= 3)) improvement = `留意：${improvement}`;
  if (stance === "shrink" || !(Number.isInteger(strongScore) && strongScore >= 8)) {
    riskResponse = `留意：${riskResponse}`;
  }

  return {
    improvement,
    riskResponse,
    priorities: {
      fill: improvement,
      guard: riskResponse,
      next: nextPri(strongest, levers.guard, stance),
    },
  };
}
function nextPri(strongest, guard, stance) {
  if (guard === "xie") return null;
  if (stance === "fill") return `补上之后往哪抓：${nextLine(strongest)}`;
  if (stance === "relocate") {
    return `强项能挪去哪：${name(strongest)}是长处，找一个更用得上它的地方`;
  }
  return nextLine(strongest);
}
