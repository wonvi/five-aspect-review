// 抽取结果校验与规范化，移植自平台的抽取校验。
// 只拦抽取字段的结构，不管派生；派生在 engine.mjs。

import { dimension } from "./aggregate.mjs";
import { KEYS, question, validKey } from "./ring.mjs";
import { trim } from "./text.mjs";

const SCORES = [1, 3, 4, 5, 6, 8, 10];
const OUTERS = ["up", "flat", "down"];
const SOURCES = ["material", "spoken"];
const SCENARIOS = ["project", "team", "product", "personal"];
const BOOL_FLAGS = ["medical_in_dialogue", "material_medical_skipped", "energy_topic"];
const NO_EVIDENCE = /^(材料)?(未披露|未提及|未说明|不详|无数据)/u;
const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const filled = (v) => typeof v === "string" && trim(v) !== "";

export function validate(raw) {
  if (!isMap(raw)) {
    return { ok: false, issues: [["$", "输入必须是对象。怎么办：传入抽取结果的 map"]] };
  }

  const input = fillMissingFollowUp(dropNoEvidence(raw));
  let issues = [];
  issues = enumField(issues, input.scenario, SCENARIOS, "scenario", "改成 project/team/product/personal");
  issues = strList(issues, input, "summary", 3, 5, true);
  issues = strList(issues, input, "cautions", 0, null, false);
  issues = strList(issues, input, "problems", 0, null, false);
  issues = strList(issues, input, "follow_up", 0, 2, true);
  issues = checkFollowSentences(issues, input.follow_up);
  issues = enumField(issues, input.outer, OUTERS, "outer", "改成 up/flat/down");
  issues = checkBools(issues, input);
  issues = checkDimensions(issues, input.dimensions);
  issues = checkCriticals(issues, input.critical_candidates);

  if (issues.length > 0) return { ok: false, issues: issues.reverse() };

  const dimensions = input.dimensions.map(normalizeDim);
  return {
    ok: true,
    input: {
      ...input,
      dimensions,
      by_key: Object.fromEntries(dimensions.map((d) => [d.key, d])),
      critical_candidates: input.critical_candidates ?? [],
    },
  };
}

function dropNoEvidence(raw) {
  if (!has(raw, "dimensions") || !Array.isArray(raw.dimensions)) return raw;

  const dimensions = raw.dimensions.map((dim) => {
    if (isMap(dim) && Array.isArray(dim.indicators)) {
      return { ...dim, indicators: dim.indicators.filter((ind) => !noEvidence(ind)) };
    }
    return dim;
  });
  return { ...raw, dimensions };
}

function noEvidence(ind) {
  return isMap(ind) && typeof ind.value === "string" &&
    NO_EVIDENCE.test(trim(ind.value));
}

// 缺失维按环序补追问，最多两句
function fillMissingFollowUp(raw) {
  const dims = raw.dimensions;
  const followUp = has(raw, "follow_up") ? raw.follow_up : undefined;

  if (raw.material_medical_skipped === true) return raw;
  if (!(Array.isArray(followUp) && followUp.length === 0)) return raw;
  if (!(Array.isArray(dims) && dims.length === 5 && dims.every(isMap))) return raw;

  const questions = KEYS.filter((key) => {
    const dim = dims.find((d) => d.key === key);
    return isMap(dim) && Array.isArray(dim.indicators) && dim.indicators.length === 0;
  }).slice(0, 2).map(question);

  return questions.length === 0 ? raw : { ...raw, follow_up: questions };
}

// 模型给的维度 score/source 丢弃，由指标聚合写回
function normalizeDim(d) {
  const indicators = dedupeIndicators(d.indicators);
  const [score, source] = dimension(indicators);
  return {
    key: d.key,
    score,
    source,
    reason: d.reason,
    indicators: indicators.map((ind) =>
      take(ind, ["name", "value", "score", "source"])),
  };
}

// 规则要求同一维同名指标最多列一次；模型多列时只留第一条，
// 以免第二条被当成「同向第二条」绕过单指标修正。按去空白后的名字比较。
function dedupeIndicators(list) {
  const seen = new Set();
  return list.filter((ind) => {
    const name = trim(ind.name);
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

function take(obj, keys) {
  return Object.fromEntries(keys.filter((key) => has(obj, key)).map((key) => [key, obj[key]]));
}

function enumField(issues, value, allowed, path, tip) {
  return allowed.includes(value) ? issues : [[path, `${path} 不合法。怎么办：${tip}`], ...issues];
}

function strList(issues, raw, key, minLen, maxLen, nonempty) {
  const list = raw[key];
  if (!Array.isArray(list)) {
    return [[key, `${key} 必须是字符串数组。怎么办：改成列表`], ...issues];
  }
  if (minLen != null && list.length < minLen) {
    return [[key, `${key} 至少 ${minLen} 条。怎么办：补齐`], ...issues];
  }
  if (maxLen != null && list.length > maxLen) {
    return [[key, `${key} 最多 ${maxLen} 条。怎么办：删到上限内`], ...issues];
  }
  if (!list.every((item) => typeof item === "string")) {
    return [[key, `${key} 每项须是字符串。怎么办：改成字符串`], ...issues];
  }
  if (nonempty && list.some((item) => trim(item) === "")) {
    return [[key, `${key} 不能有空串。怎么办：删空项或补字`], ...issues];
  }
  return issues;
}

function checkBools(issues, raw) {
  for (const key of BOOL_FLAGS) {
    if (!has(raw, key)) {
      issues = [[key, `${key} 必填。怎么办：传 true 或 false`], ...issues];
    } else if (typeof raw[key] !== "boolean") {
      issues = [[key, `${key} 须是布尔。怎么办：改成 true 或 false`], ...issues];
    }
  }
  return issues;
}

function checkDimensions(issues, dims) {
  if (!Array.isArray(dims) || dims.length !== 5) {
    return [["dimensions", "dimensions 必须正好 5 项。怎么办：每个维一项"], ...issues];
  }

  const bad = dims.findIndex((d) => !isMap(d));
  if (bad >= 0) {
    return [[`dimensions[${bad}]`, "每一维必须是对象。怎么办：补 key/reason/indicators"], ...issues];
  }

  const keys = dims.map((d) => d.key);
  const expected = [...KEYS].sort();
  const actual = keys.every((k) => typeof k === "string") ? [...keys].sort() : [];
  if (actual.length !== expected.length || actual.some((k, i) => k !== expected[i])) {
    return [["dimensions", "五个 key 须各一次。怎么办：用 expand/grow/earn/govern/foundation"], ...issues];
  }
  return dims.reduce((acc, d, i) => dim(acc, d, i), issues);
}

function dim(issues, d, i) {
  const p = `dimensions[${i}]`;
  if (!filled(d.reason)) {
    issues = [[`${p}.reason`, "reason 须是非空字符串。怎么办：写一句话理由，缺失时写缺什么"], ...issues];
  }
  return inds(issues, p, d.indicators);
}

function inds(issues, p, list) {
  if (!Array.isArray(list)) {
    return [[`${p}.indicators`, "indicators 须是数组。怎么办：改成列表"], ...issues];
  }

  return list.reduce((acc, ind, j) => {
    const ip = `${p}.indicators[${j}]`;
    if (!isMap(ind)) return [[ip, "指标须是对象。怎么办：补 name/value/score/source"], ...acc];
    if (!filled(ind.name)) return [[`${ip}.name`, "name 须是非空字符串。怎么办：写指标名"], ...acc];
    if (!(typeof ind.value === "number" || filled(ind.value))) {
      return [[`${ip}.value`, "value 须是非空字符串或数字。怎么办：写上证据值；没有证据就删掉这个指标"], ...acc];
    }
    if (!SCORES.includes(ind.score)) return [[`${ip}.score`, "指标 score 须为七档。怎么办：改分"], ...acc];
    if (!SOURCES.includes(ind.source)) {
      return [[`${ip}.source`, "指标 source 须 material/spoken。怎么办：改档"], ...acc];
    }
    return acc;
  }, issues);
}

// 追问按句末标点数句子，不按条数
function checkFollowSentences(issues, list) {
  if (!Array.isArray(list)) return issues;
  const count = list.filter((s) => typeof s === "string")
    .map((s) => s.split(/[。？！?!]/u).filter((x) => trim(x) !== "").length)
    .reduce((a, b) => a + b, 0);

  return count > 2
    ? [["follow_up", "追问一共最多两句。怎么办：只留最要紧的一两句"], ...issues]
    : issues;
}

function checkCriticals(issues, list) {
  if (list == null) return issues;
  if (Array.isArray(list) && list.every(validKey)) return issues;
  const message = Array.isArray(list)
    ? "只能是五维 key。怎么办：删非法项"
    : "须是数组。怎么办：改成 key 列表或省略";
  return [["critical_candidates", message], ...issues];
}
