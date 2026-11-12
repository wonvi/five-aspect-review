// 把同维指标聚成维度分与来源，移植自平台的维度聚合。
// 纯函数，不信抽取结果里模型给的维度分。

export function dimension(indicators) {
  if (indicators.length === 0) return [null, null];

  const rawScores = indicators.map((ind) => ind.score);
  const corrected = indicators.map((ind, i) =>
    protect(ind.score, ind.source, rawScores, i),
  );

  return [median(corrected), lowestSource(indicators)];
}

// 验证前：单指标越线最多落到 3/8；1/10 需同向第二指标或口述
function protect(score, source, scores, i) {
  if (score === 1) {
    return source === "spoken" || peer(scores, i, (s) => s <= 3) ? 1 : 3;
  }
  if (score === 10) {
    return source === "spoken" || peer(scores, i, (s) => s >= 8) ? 10 : 8;
  }
  return score;
}

function peer(scores, i, pred) {
  return scores.some((s, j) => j !== i && pred(s));
}

function median(scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return nearerFive(sorted[mid - 1], sorted[mid]);
}

// 偶数个取中间两档里离 5 更近者；等距取较低（4 与 6 取 4）
function nearerFive(a, b) {
  const da = Math.abs(a - 5);
  const db = Math.abs(b - 5);
  if (da < db) return a;
  if (db < da) return b;
  return Math.min(a, b);
}

// 可信度：材料 > 口述，取最低者
function lowestSource(indicators) {
  return indicators.some((ind) => ind.source === "spoken")
    ? "spoken"
    : "material";
}
