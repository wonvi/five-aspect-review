// 公开回归测试：只依赖本仓库的 scripts/，Node 18+，零依赖。
// 运行：node --test tests
// 样例来自 Wonvi 源码仓库，那边每次改动都在 Node 18 上跑同一批样例，
// 并与平台的另一份实现逐字对照；这里随发布同步一份，方便任何人自行核对。

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import { FEEDBACK_BASE_URL } from "../scripts/lib/feedback.mjs";
import { VERSION } from "../scripts/lib/version.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = path.join(root, "scripts/diagnose.mjs");
const fixturesDir = path.join(root, "tests/fixtures");

const cases = readdirSync(fixturesDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => ({ file, fixture: JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8")) }));

function run(input) {
  const dir = mkdtempSync(path.join(tmpdir(), "five-aspect-"));
  const file = path.join(dir, "input.json");
  writeFileSync(file, JSON.stringify(input));
  try {
    return spawnSync(process.execPath, [cli, file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const { file, fixture } of cases) {
  if (fixture.invalid) {
    test(`${file}：坏输入非 0 退出并给出原因`, () => {
      const r = run(fixture.input);
      assert.notEqual(r.status, 0);
      assert.equal(r.stdout, "");
      for (const needle of fixture.stderr_includes) assert.ok(r.stderr.includes(needle), r.stderr);
    });
    continue;
  }

  test(`${file}：报告与期望逐字一致`, () => {
    const r = run(fixture.input);
    assert.equal(r.status, 0, r.stderr);

    const marker = r.stdout.lastIndexOf("\n\n");
    const body = marker > 0 ? r.stdout.slice(0, marker) : r.stdout;
    assert.equal(body, fixture.expected);

    if (fixture.feedback_r) {
      assert.equal(
        r.stdout.slice(marker + 2),
        `觉得准不准？点这里打个分：${FEEDBACK_BASE_URL}?v=${VERSION}&r=${fixture.feedback_r}\n`,
      );
    }
  });
}
