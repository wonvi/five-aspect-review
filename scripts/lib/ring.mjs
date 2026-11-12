// 五维环：开拓 → 做大 → 落地 → 立规矩 → 家底 → 开拓。
// 相邻 = 顺推；隔位 = 制约。移植自平台的五维环。

export const KEYS = ["expand", "grow", "earn", "govern", "foundation"];

const NAMES = {
  expand: "开拓",
  grow: "做大",
  earn: "落地",
  govern: "立规矩",
  foundation: "家底",
};

const QUESTIONS = {
  expand: "你在开拓什么新方向？",
  grow: "你在把什么做大？",
  earn: "什么已经落地、稳定产出了？",
  govern: "你靠什么规矩把事管住？",
  foundation: "你的家底够不够撑？",
};

export function name(key) {
  return NAMES[key];
}

export function question(key) {
  return QUESTIONS[key];
}

function at(key, offset) {
  const i = KEYS.indexOf(key);
  return KEYS[(i + offset + KEYS.length) % KEYS.length];
}

export function prev(key) {
  return at(key, -1);
}

export function skipUpstream(key) {
  return at(key, -2);
}

export function skipDownstream(key) {
  return at(key, 2);
}

export function validKey(key) {
  return typeof key === "string" && KEYS.includes(key);
}
