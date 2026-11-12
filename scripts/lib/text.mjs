// 与 Elixir String.trim/1 一致的 Unicode 空白裁剪。
// 不裁 U+FEFF、U+200B；裁 U+0085、U+00A0、U+3000 等 Unicode White_Space。
const WS = "\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000";
const LEADING = new RegExp(`^[${WS}]+`, "u");
const TRAILING = new RegExp(`[${WS}]+$`, "u");

export function trim(value) {
  return value.replace(LEADING, "").replace(TRAILING, "");
}
