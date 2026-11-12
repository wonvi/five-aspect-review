// 与 Elixir 解码保持一致：带小数点或指数的 score 字面量不是整数。
// 不依赖 Node 21+ 的 reviver context；先对原始文本做轻量词法扫描，
// 把这类值替换成标记对象，再交给 JSON.parse。Node 18 起行为一致。
const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function skipString(text, start) {
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
      continue;
    }
    if (text[i] === '"') return i + 1;
    i += 1;
  }
  return i;
}

function skipWhitespace(text, i) {
  while (i < text.length) {
    const ch = text[i];
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") break;
    i += 1;
  }
  return i;
}

function matchNumber(text, start) {
  NUMBER.lastIndex = start;
  const match = NUMBER.exec(text);
  return match === null ? null : match[0];
}

function protectScores(text) {
  let out = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] !== '"') {
      out += text[i];
      i += 1;
      continue;
    }

    const end = skipString(text, i);
    const raw = text.slice(i, end);
    out += raw;
    i = end;

    let j = skipWhitespace(text, i);
    if (text[j] !== ":") continue;

    j = skipWhitespace(text, j + 1);
    const literal = matchNumber(text, j);
    if (literal === null || raw.slice(1, -1) !== "score" || !/[.eE]/.test(literal)) {
      continue;
    }

    out += text.slice(i, j);
    out += `{"__nonInteger":true,"literal":${JSON.stringify(literal)}}`;
    i = j + literal.length;
  }

  return out;
}

export function parseExtractionJson(text) {
  return JSON.parse(protectScores(text));
}
