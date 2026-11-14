// 把派生结果渲染成纯文字，移植自平台的渲染模块。
// 只出大众用词；顺序、标点与参考实现逐字一致。

import { correctedScores } from "./aggregate.mjs";
import { KEYS, name, skipDownstream } from "./ring.mjs";

const STANCE_LINES = {
  restrain: "外面机会多、自己也冲得猛，先收一下别扩",
  fill: "外面有机会，先补短板再抓",
  relocate: "强项在这里用不出来，考虑把它挪到别处用",
  shrink: "外面不好、自己也薄，先收缩到最小可做的一件事",
};
const DIAGNOSE_FAILED = "这次没分析出来。怎么办：换个说法再说一遍，或把材料贴全";
const CORRECTION = "哪条判断不对，直接告诉我，我按你说的改。";
const UNDECIDED = "未判定";
const PENDING_PRESS = "正在压谁：待补问";
const PENDING_FOCUS = "待补问";
const NO_FOCUS = "没有特别紧张的一对";
const SEP = "—— 以上为通用分析 ——";
const wrap = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

export function text(result) {
  if (result.type === "medical_stop" && typeof result.reply === "string") return result.reply;
  if (result.type === "error") return DIAGNOSE_FAILED;
  return result.diagnosis.status === "insufficient"
    ? renderInsufficient(result.diagnosis)
    : renderFull(result.diagnosis);
}
function renderFull(d) {
  return [
    block("摘要", summaryLines(d)),
    block("注意事项", listLines(d.cautions)),
    SEP,
    block("一句话诊断", [oneLiner(d)]),
    stanceBlock(d),
    block("五维状态", dimLines(d)),
    block("可能存在的问题", listLines(d.problems)),
    block("风险信号", riskLines(d)),
    block("风险应对", [advised(d.risk_response)]),
    block("优化提升", [advised(d.improvement)]),
    block("重点关注", [focusLine(d)]),
    block("行动优先级", priorityLines(d)),
    followUpBlock(d),
    block("哪条判断不对？", [CORRECTION]),
    disclaimerLine(d),
  ].filter((part) => part !== null).join("\n");
}
function renderInsufficient(d) {
  return [
    block("摘要", summaryLines(d)),
    block("注意事项", listLines(d.cautions)),
    SEP,
    block("一句话诊断", [oneLiner(d)]),
    block("五维状态", dimLines(d)),
    block("风险信号", [UNDECIDED]),
    block("风险应对", [UNDECIDED]),
    block("优化提升", [UNDECIDED]),
    block("重点关注", [UNDECIDED]),
    block("行动优先级", [UNDECIDED]),
    followUpBlock(d),
    disclaimerLine(d),
  ].filter((part) => part !== null).join("\n");
}
function block(title, lines) {
  return `【${title}】\n${lines.filter((line) => line !== null).join("\n")}`;
}
function advised(value) {
  return value === null || value === undefined ? UNDECIDED : value;
}
function summaryLines(d) {
  const base = wrap(d.summary);
  return typeof d.summary_notice === "string" && d.summary_notice !== ""
    ? [...base, d.summary_notice]
    : base;
}
function listLines(value) {
  const list = wrap(value);
  return list.length === 0 ? ["无"] : list;
}
function oneLiner(d) {
  if (d.status === "insufficient") return `信息不足，缺${d.missing.map(name).join("、")}`;
  const kind = d.status === "imbalanced" ? "失衡" : "均衡";
  const scores = d.dimensions.map((dim) => dim.score).filter(Number.isInteger);

  if (Math.max(...scores) - Math.min(...scores) <= 1) {
    return `${kind}：${scopeLabel(scores)}${flatQualifier(d.status, scores)}，看不出相对强弱`;
  }

  const byKey = Object.fromEntries(d.dimensions.map((dim) => [dim.key, dim]));
  const strongLabel = byKey[d.strongest]?.score >= 8 ? "最强是" : "相对强的是";
  const weakLabel = byKey[d.weakest]?.score <= 3 ? "最弱是" : "相对弱的是";

  return `${kind}：${strongLabel}${name(d.strongest)}，${weakLabel}${name(d.weakest)}`;
}
function scopeLabel(scores) {
  return scores.length === 5 ? "五个方面" : "已评估的四个方面";
}
// 分差 ≤ 1 且失衡时只有两种实际情形：全在 ≥ 8 一侧，或最低 ≤ 3。
// 3 / 4 混合同属偏弱一侧（4 分是「比偏弱好、没到中性」），写「都偏弱」。
function flatQualifier(status, scores) {
  if (status === "balanced") return "差不多";
  return Math.min(...scores) >= 8 ? "都偏强" : "都偏弱";
}
function stanceBlock(d) {
  const line = STANCE_LINES[d.stance];
  return line === undefined ? null : block("总体姿态", [line]);
}
function dimLines(d) {
  const byKey = Object.fromEntries(d.dimensions.map((dim) => [dim.key, dim]));
  return KEYS.flatMap((key) => dimensionLines(name(key), byKey[key]));
}
function dimensionLines(dimName, dim) {
  if (!Number.isInteger(dim.score)) return [`${dimName} · 未打分 · ${dim.reason}`];
  return [
    `${dimName} · ${dim.score} 分 · ${sourceLabel(dim.source)} · ${dim.reason}`,
    ...indicatorLines(dim.indicators),
  ];
}
// 每条指标一行，按输入顺序；修正后分直接取聚合规则，渲染不另写判断
function indicatorLines(indicators) {
  if (!Array.isArray(indicators)) return [];
  const corrected = correctedScores(indicators);
  return indicators.map((ind, i) => {
    const head = `　　${ind.name}：${ind.value}（${sourceLabel(ind.source)}）→ ${ind.score} 分`;
    return corrected[i] === ind.score
      ? head
      : `${head}，没有第二条同方向的证据，按 ${corrected[i]} 分算`;
  });
}
function sourceLabel(source) {
  return source === "material" ? "材料" : "口述";
}
function riskLines(d) {
  const lines = [pressLine(d), criticalLine(wrap(d.risk_signals?.critical))]
    .filter((line) => line !== null);
  return lines.length === 0 ? ["无"] : lines;
}
function pressLine(d) {
  const pressing = d.risk_signals?.pressing;
  if (pressing && typeof pressing.from === "string" && typeof pressing.to === "string") {
    return `${name(pressing.from)}正在压${name(pressing.to)}`;
  }
  // 不点名强弱时不写「待补问」：没有强弱，就谈不上压谁。
  if (d.strongest === null) return null;

  // 「正在压」要求最强 ≥ 8；最强不到 8 时缺的隔位下游维补出任何分都压不动。
  const byKey = Object.fromEntries((d.dimensions ?? []).map((dim) => [dim.key, dim]));
  if (!atLeast(byKey, d.strongest, 8)) return null;
  return Number.isInteger(byKey[skipDownstream(d.strongest)]?.score) ? null : PENDING_PRESS;
}
function criticalLine(keys) {
  return keys.length === 0 ? null : `${keys.map(name).join("、")}有带方向的变化，留意`;
}
function focusLine(d) {
  const pair = d.focus_pair;
  if (pair && typeof pair.a === "string" && typeof pair.b === "string" &&
      typeof pair.gap === "number") {
    const byKey = Object.fromEntries((d.dimensions ?? []).map((dim) => [dim.key, dim]));
    return `${name(pair.a)}（${byKey[pair.a]?.score} 分）和${name(pair.b)}（${byKey[pair.b]?.score} 分）差 ${pair.gap} 分`;
  }
  if (d.strongest === null) return UNDECIDED;

  // 「最紧张的一对」要求分差 ≥5；最强 ≥6 时缺维补到 1 分就可能触发，才追问。
  const byKey = Object.fromEntries((d.dimensions ?? []).map((dim) => [dim.key, dim]));
  if (Number.isInteger(byKey[skipDownstream(d.strongest)]?.score)) return NO_FOCUS;
  return atLeast(byKey, d.strongest, 6) ? PENDING_FOCUS : NO_FOCUS;
}
function atLeast(byKey, key, min) {
  const score = byKey[key]?.score;
  return Number.isInteger(score) && score >= min;
}
function priorityLines(d) {
  if (d.priorities === null) return [UNDECIDED];
  const order = d.stance === "restrain" ? ["guard", "fill", "next"] : ["fill", "guard", "next"];
  return order.map((key) => [key, d.priorities[key]])
    .filter(([, line]) => line != null)
    .map(([key, line], i) => `${i + 1}. ${priorityLine(key, line, i, d)}`);
}
// 指向「优化提升」「风险应对」的两条只留一句引用，避免把上面两节原文再抄一遍；next 原样保留
// 动词同样只看该侧分数：最强 ≥ 8 才写「管住」，最弱 ≤ 3 才写「补」，否则降为「留意」。
function priorityLine(key, line, index, d) {
  const prefix = index === 0 ? "先" : "再";
  if (key === "fill") {
    const action = dimScore(d, d.weakest) <= 3 ? "补" : "留意";
    return `${prefix}${action}${name(d.weakest)}，做法见「优化提升」`;
  }
  if (key === "guard") {
    const action = dimScore(d, d.strongest) >= 8 ? "管住" : "留意";
    return `${prefix}${action}${name(d.strongest)}，做法见「风险应对」`;
  }
  return line;
}
function dimScore(d, key) {
  return (d.dimensions ?? []).find((dim) => dim.key === key)?.score;
}
function followUpBlock(d) {
  const list = d.follow_up;
  return Array.isArray(list) && list.length > 0 ? block("还想问你", list) : null;
}
function disclaimerLine(d) {
  return typeof d.disclaimer === "string" && d.disclaimer !== "" ? d.disclaimer : null;
}
