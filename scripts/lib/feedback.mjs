// 报告末尾的匿名反馈链接：只带技能版本与结论代码，不带用户材料。
// 结论代码的白名单与反馈页 WanviWeb.FiveAspectFeedbackConclusion 保持一致。

import { validKey } from "./ring.mjs";
import { VERSION } from "./version.mjs";

export const FEEDBACK_BASE_URL = "https://wonvi.fun/f/five-aspect";

// 与反馈页的 @balance_statuses 一致。
const BALANCE_STATUSES = ["imbalanced", "balanced"];

export function conclusionCode(result) {
  if (result.type === "medical_stop") return "medical";
  if (result.type !== "ok") {
    throw new Error(`不支持的派生结果类型：${result.type}`);
  }

  const diagnosis = result.diagnosis;
  if (diagnosis.status === "insufficient") return "insufficient";
  if (!BALANCE_STATUSES.includes(diagnosis.status)) {
    throw new Error(`未知结论状态：${diagnosis.status}`);
  }

  const { strongest, weakest } = diagnosis;

  // 分差 ≤ 1：平台不点名强弱，只带裸状态值。
  if (strongest === null && weakest === null) return diagnosis.status;

  if (!validKey(strongest) || !validKey(weakest) || strongest === weakest) {
    throw new Error(`最强/最弱维非法：${strongest} / ${weakest}`);
  }

  return `${diagnosis.status}.${strongest}.${weakest}`;
}

export function feedbackLine(result) {
  return (
    `觉得准不准？点这里打个分：${FEEDBACK_BASE_URL}` +
    `?v=${VERSION}&r=${conclusionCode(result)}`
  );
}
