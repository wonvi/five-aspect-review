# 五面盘点（five-aspect-review）

[![test](https://github.com/wonvi/five-aspect-review/actions/workflows/test.yml/badge.svg)](https://github.com/wonvi/five-aspect-review/actions/workflows/test.yml)

本技能由 Wonvi 出品：https://wonvi.fun

盘清开拓、做大、落地、立规矩、家底五个基本面，找盲区、定先后。适合盘一件事、一个项目、团队、产品或个人近况。只给方向，不做预测，不替代专业判断。

## 安装

先下载 [Releases](../../releases) 里的 `five-aspect-review.zip`，或者克隆本仓库。电脑上需要 Node 18 或更高版本。

- **WorkBuddy**：把 zip 拖进对话框；或者解压到 `~/.workbuddy/skills/five-aspect-review/`，然后重启。
- **豆包工作**：在「技能」里选「上传技能」，选解压后的 `five-aspect-review` 文件夹。
- **DeepSeek Harness**：解压到 `~/.agents/skills/five-aspect-review/`，然后重启。

### 让 agent 自己装

如果你用的 agent 能执行命令（比如 WorkBuddy、Claude Code、Codex），可以把下面这段原样发给它：

```text
请帮我安装「五面盘点」技能：
1. 下载 https://github.com/wonvi/five-aspect-review/releases/latest/download/five-aspect-review.zip
2. 解压到你的技能目录，解压后应是 <技能目录>/five-aspect-review/SKILL.md。不知道技能目录在哪，就先问我。
3. 运行 node --version 确认 Node 是 18 或更高；不够就告诉我，不要替我升级。
4. 只解压，不要运行包里的脚本。装好后告诉我装到了哪里，以及要不要重启才能生效。
```

## 用法

装好后直接说「帮我盘一盘这件事」，再附上情况或材料。技能会先整理五个方面的依据，再用自带脚本算出结论和先后顺序。

报告里每个方面都列出了打分依据：用了哪几条证据、每条几分；只有一条证据偏到最高或最低、又没有第二条同方向的证据时，会按规则往回收一档，报告里会写明。

## 判断是怎么来的

五个方面按「开拓 → 做大 → 落地 → 立规矩 → 家底 → 开拓」排成一圈，这是本技能的基本假设：

- **挨着的两个是顺推**：前一个做好了，会带动后一个。比如开拓出的方向，接下来才谈得上做大。
- **隔一个的两个是牵制**：一个太强，会压住隔一位的那个。比如开拓铺得太猛，会压得落地跟不上。

报告里的「谁在压谁」「先补什么」就是按这个假设，从各方面的分数算出来的，不是从材料里直接读出来的。为了不说没依据的话，有两条限制：各方面分数相差不超过 1 分时，不点名谁强谁弱；只有最强的一面确实偏强（8 分以上）、被压的一面不强（5 分以下）时，才说「正在压」。觉得哪条不符合你的实际情况，直接告诉它，它会按你说的改。

报告末尾有一个打分链接，点不点都行。链接里只带技能版本和结论类别（比如「最强开拓、最弱家底」），不带你的材料和对话；打分页不用登录，不保存 IP 和账号。

## 自己验证

`tests/` 里有 38 份样例：每份是一份抽取结果和它应得的完整报告，覆盖均衡、失衡、分数差不出强弱、缺一个方面、信息不足、医疗边界、坏输入和各种打分修正。克隆本仓库后运行：

```bash
node --test tests/fixtures.test.mjs
```

脚本对每份样例算出报告，与期望逐字比对。每次推送都会在 Node 18 和 22 上自动跑一遍，结果见上方徽章。样例都是构造的，不含任何真实用户材料。`tests/` 不打进发布的 zip，装技能时用不到。

## 许可

版权所有 © 2026 Wonvi。允许个人免费安装和使用；未经书面许可不得修改后再发布、转售或收进其他产品。详见 [LICENSE.txt](LICENSE.txt)。
