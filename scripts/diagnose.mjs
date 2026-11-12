#!/usr/bin/env node
// 五面盘点入口：读 JSON 文件路径或标准输入，打印渲染文字。
// 用法：node scripts/diagnose.mjs input.json
//       node scripts/diagnose.mjs -   （或省略参数，读标准输入）

import { readFileSync } from "node:fs";
import { derive } from "./lib/engine.mjs";
import { parseExtractionJson } from "./lib/json.mjs";
import { text } from "./lib/render.mjs";

const NODE_MAJOR = Number(process.versions.node.split(".")[0]);

if (NODE_MAJOR < 18) {
  console.error(`需要 Node 18 或更高版本，当前 ${process.versions.node}。怎么办：升级 Node 后重跑`);
  process.exit(1);
}

let raw;

try {
  const inputPath = process.argv[2];
  raw = inputPath && inputPath !== "-" ? readFileSync(inputPath, "utf8") : readFileSync(0, "utf8");
} catch (error) {
  console.error(`读不到输入：${error.message}`);
  process.exit(1);
}

let input;
try {
  input = parseExtractionJson(raw);
} catch (error) {
  console.error(`JSON 解析失败：${error.message}`);
  process.exit(1);
}

const result = derive(input);

if (result.type === "error") {
  for (const [path, message] of result.issues) console.error(`${path}: ${message}`);
  process.exit(1);
}

process.stdout.write(`${text(result)}\n`);
