// 策略库原文，移植自平台的策略库。
// 键名沿用内部英文键；面向用户的句子不含内部机制词。

const FILL = {
  expand: {
    sheng: "先把存量算清、留出余量，有底了才敢试",
    bi: "划出固定的试错预算 / 时间；列三个最想试但一直没试的方向，挑一个小规模试",
    zhu: "找做过类似探索的人聊三次；接一个外部合作项目当试验场",
  },
  grow: {
    sheng: "先把要推的东西做出差异，有东西可说才推得动",
    bi: "找一个最容易触达的渠道先跑通；把已有成果包装成能对外说的一句话",
    zhu: "找渠道方或有受众的人合作首发；买一次投放测试",
  },
  earn: {
    sheng: "先弄清现在用的人从哪来、为什么留下，来源稳了，留存和付费才有底",
    bi: "砍掉不产出的线，聚焦一个能形成稳定结果的闭环（项目是收入，团队是交付，个人是作品）；先把产出稳定下来再谈增长",
    zhu: "找做过同类闭环的人看一次流程；外包非核心环节",
  },
  govern: {
    sheng: "先把闭环跑顺，规则从跑顺的事里长出来，不凭空定",
    bi: "先定「谁负责什么」和「怎么同步」两条；用检查清单替代口头约定",
    zhu: "借一套现成的流程模板；找带过团队的人带一段",
  },
  foundation: {
    sheng: "先定留存和支出规则，存量是守出来的",
    bi: "算清跑道；停掉最烧钱的非核心项；补一个备份（人 / 资源 / 渠道）",
    zhu: "找外部资金、供应商或顾问补单点",
  },
};

const GUARD = {
  expand: {
    ke: "定「同时最多开几条」；新线上马前过一道检查",
    hao: "现有哪条线还没闭环？先把它跑通",
  },
  grow: {
    ke: "定投放和扩张的上限，看存量能撑几轮",
    hao: "每扩一档就补一条规则；新人配带教",
  },
  earn: {
    ke: "留出固定比例的时间和钱去试新方向，别全押在当前闭环上",
    hao: "定留存比例；盈利不等于安全",
  },
  govern: {
    ke: "用推出去的压力倒逼删规则：定期看哪些规则挡了增长",
    hao: "给例外通道；定期删规则；留一块不设规矩的试验区",
  },
  foundation: {
    ke: "用产出目标逼存量动起来：定一个必须花出去的额度",
    hao: "定一个可承受的试错额度，主动花掉去推",
  },
};

const NEXT = {
  expand: "探索出来的东西，挑一个推出去验证",
  grow: "增长的东西要开始留住、开始赚",
  earn: "跑通的东西要能复制，靠规则不靠人",
  govern: "管住之后，看存量够不够撑下一轮",
  foundation: "存量够了，该拿出一部分去试新方向",
};

export function fillLine(weakest, mode) {
  return FILL[weakest][mode];
}

export function zhu(weakest) {
  return FILL[weakest].zhu;
}

export function guardLine(strongest, mode) {
  return mode === "xie" ? nextLine(strongest) : GUARD[strongest].ke;
}

export function hao(strongest) {
  return GUARD[strongest].hao;
}

export function nextLine(strongest) {
  return NEXT[strongest];
}
