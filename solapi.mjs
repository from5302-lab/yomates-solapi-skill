#!/usr/bin/env node
// Solapi CLI for Yomates — 솔라피 문자(SMS·LMS) 연결, 잔액·발신번호 확인, 시험 발송, Firebase 비밀값 넣기.
// 설치할 것 없음: Node.js 18 이상만 있으면 된다(외부 패키지 0개).
//
// API 키와 시크릿은 내 컴퓨터의 ~/.yomates-solapi/config.json 에만 저장한다(내 계정만 읽기 권한).
// 값은 화면에 절대 출력하지 않는다. 클립보드에서 바로 읽어 저장하고, 읽은 뒤 클립보드를 비운다.
//
//   node solapi.mjs key --from-clipboard        API Key 저장
//   node solapi.mjs secret --from-clipboard     API Secret 저장
//   node solapi.mjs status                      연결 확인 · 잔액 · 쓸 수 있는 발신번호
//   node solapi.mjs senders                     발신번호 목록
//   node solapi.mjs send --to 01012345678 [--from 발신번호] "내용"          미리보기만(실제 발송 안 함)
//   node solapi.mjs send --to 01012345678 [--from 발신번호] "내용" --yes    실제 발송(돈이 듦)
//   node solapi.mjs history [YYYY-MM-DD]        그날 보낸 문자(한국 시각)
//   node solapi.mjs firebase-secrets --project <아이디> [--names SOLAPI_KEY,SOLAPI_SECRET]
//        Firebase Secret Manager 에 키·시크릿을 넣는다(값은 표준입력으로만 넘김). Blaze 요금제가 필요하다.
//   node solapi.mjs logout                      이 컴퓨터에서 키 지우기
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

const API = "https://api.solapi.com";
const DIR = join(homedir(), ".yomates-solapi");
const FILE = join(DIR, "config.json");
const KST = 9 * 3600000;

const load = () => { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; } };
function save(c) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(c, null, 2));
  try { chmodSync(DIR, 0o700); chmodSync(FILE, 0o600); } catch {}
}
function clipboard() {
  const os = platform();
  const cmd = os === "darwin" ? "pbpaste" : os === "win32" ? 'powershell -NoProfile -Command "Get-Clipboard"' : "xclip -selection clipboard -o 2>/dev/null || wl-paste";
  const v = execSync(cmd, { encoding: "utf8" }).trim();
  try {
    if (os === "darwin") execSync("pbcopy < /dev/null");
    else if (os === "win32") execSync('powershell -NoProfile -Command "Set-Clipboard -Value $null"');
  } catch {}
  return v;
}
const out = (o) => console.log(JSON.stringify(o, null, 2));
const digits = (s) => String(s || "").replace(/\D/g, "");
const mask = (n) => { const d = digits(n); return d.length > 7 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : d; };

function auth(c) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", c.apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${c.apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}
async function api(c, method, path, body) {
  const r = await fetch(API + path, { method, headers: { Authorization: auth(c), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) {
    const msg = (j && (j.errorMessage || j.message)) || `${method} ${path} ${r.status}`;
    if (r.status === 401 || /signature|apiKey|Unauthorized/i.test(msg)) throw new Error(`API 키나 시크릿이 맞지 않아요. 'key'·'secret'을 다시 저장해 주세요. (${msg})`);
    throw new Error(msg);
  }
  return j;
}
function ready() {
  const c = load();
  if (!c.apiKey || !c.apiSecret) throw new Error("아직 연결되지 않았어요. 'key --from-clipboard'와 'secret --from-clipboard'를 먼저 해 주세요.");
  return c;
}
async function activeSenders(c) {
  // 활성 발신번호 목록. 응답 모양이 버전마다 달라 둘 다 받는다
  const j = await api(c, "GET", "/senderid/v1/numbers/active").catch(() => null);
  if (Array.isArray(j)) return j.map(String);
  const k = await api(c, "GET", "/senderid/v1/numbers?limit=100").catch(() => null);
  const list = (k && (k.senderIdList || k.list || k.data)) || {};
  const rows = Array.isArray(list) ? list : Object.values(list);
  return rows.filter((x) => !x.status || /ACTIVE/i.test(x.status)).map((x) => String(x.phoneNumber || x.senderId || x));
}
const flag = (a, n) => { const i = a.indexOf(n); return i > -1 ? a[i + 1] : null; };
const [cmd, ...rest] = process.argv.slice(2);

try {
  if (cmd === "key" || cmd === "secret") {
    if (!rest.includes("--from-clipboard")) throw new Error(`복사한 뒤 '${cmd} --from-clipboard'로 실행해 주세요. 채팅에 붙여 넣지 마세요.`);
    const v = clipboard().replace(/\s+/g, "");
    if (!/^[A-Za-z0-9]{10,64}$/.test(v)) throw new Error("클립보드 값이 키 모양이 아니에요. 솔라피 화면에서 다시 복사해 주세요.");
    save({ ...load(), [cmd === "key" ? "apiKey" : "apiSecret"]: v });
    out({ ok: true, saved: cmd === "key" ? "API Key" : "API Secret", next: cmd === "key" ? "secret --from-clipboard" : "status" });
  }
  else if (cmd === "status") {
    const c = load();
    if (!c.apiKey || !c.apiSecret) { out({ connected: false, has: { key: !!c.apiKey, secret: !!c.apiSecret } }); }
    else {
      const bal = await api(c, "GET", "/cash/v1/balance");
      const senders = await activeSenders(c);
      out({ connected: true, balance: bal.balance ?? null, point: bal.point ?? null, senders: senders.map(mask), defaultFrom: c.from ? mask(c.from) : null });
    }
  }
  else if (cmd === "senders") {
    const c = ready();
    const s = await activeSenders(c);
    // 발신번호가 하나뿐이면 기본값으로 기억한다
    if (s.length === 1 && c.from !== s[0]) save({ ...c, from: s[0] });
    out({ active: s.map(mask), count: s.length });
  }
  else if (cmd === "send") {
    const c = ready();
    const to = digits(flag(rest, "--to"));
    const text = rest.filter((x, i) => !x.startsWith("--") && !["--to", "--from"].includes(rest[i - 1]))[0];
    if (!to || !text) throw new Error('사용법: send --to 01012345678 [--from 발신번호] "내용" [--yes]');
    let from = digits(flag(rest, "--from")) || c.from;
    if (!from) { const s = await activeSenders(c); if (s.length === 1) from = s[0]; }
    if (!from) throw new Error("발신번호를 정해 주세요(--from). 'senders'로 쓸 수 있는 번호를 볼 수 있어요.");
    const bytes = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
    const type = bytes > 90 ? "LMS" : "SMS";
    if (!rest.includes("--yes")) { out({ preview: true, to: mask(to), from: mask(from), type, bytes, text, next: "같은 명령 끝에 --yes 를 붙이면 실제로 보내요(요금이 들어요)." }); }
    else {
      const r = await api(c, "POST", "/messages/v4/send", { message: { to, from, text } });
      out({ ok: true, to: mask(to), type: r.type || type, status: r.statusMessage || r.statusCode || "accepted", messageId: r.messageId || null });
    }
  }
  else if (cmd === "history") {
    const c = ready();
    const d = rest[0] && /^\d{4}-\d{2}-\d{2}$/.test(rest[0]) ? rest[0] : new Date(Date.now() + KST).toISOString().slice(0, 10);
    const [y, m, dd] = d.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, dd) - KST).toISOString(), end = new Date(Date.UTC(y, m - 1, dd + 1) - KST).toISOString();
    const q = new URLSearchParams({ dateType: "CREATED", startDate: start, endDate: end, limit: "100" });
    const j = await api(c, "GET", `/messages/v4/list?${q}`);
    const rows = Object.values(j.messageList || {}).map((x) => ({ at: x.dateCreated, to: mask(x.to), type: x.type, status: x.statusMessage || x.statusCode, text: String(x.text || "").slice(0, 30) }));
    out({ date: d, count: rows.length, rows });
  }
  else if (cmd === "firebase-secrets") {
    const c = ready();
    const project = flag(rest, "--project");
    if (!project) throw new Error("사용법: firebase-secrets --project <파이어베이스 프로젝트 아이디> [--names SOLAPI_KEY,SOLAPI_SECRET]");
    const [kName, sName] = (flag(rest, "--names") || "SOLAPI_KEY,SOLAPI_SECRET").split(",");
    for (const [name, val] of [[kName, c.apiKey], [sName, c.apiSecret]]) {
      const r = spawnSync("firebase", ["functions:secrets:set", name, "--data-file", "-", "--project", project, "--force"], { input: val, encoding: "utf8", shell: platform() === "win32" });
      if (r.status !== 0) throw new Error(`${name} 넣기 실패: ${(r.stderr || r.stdout || "").split("\n").filter(Boolean).slice(-2).join(" ")}  (Blaze 요금제와 'firebase login' 상태를 확인해 주세요)`);
    }
    out({ ok: true, project, secrets: [kName, sName], use: `함수에서 defineSecret("${kName}")·defineSecret("${sName}")로 읽어요` });
  }
  else if (cmd === "logout") {
    if (existsSync(FILE)) rmSync(FILE);
    out({ ok: true, removed: FILE });
  }
  else {
    console.log(`Solapi CLI for Yomates
  key --from-clipboard | secret --from-clipboard   키 저장(처음 한 번)
  status                                           연결 · 잔액 · 발신번호
  senders                                          발신번호 목록
  send --to 번호 [--from 번호] "내용" [--yes]       --yes 없으면 미리보기
  history [YYYY-MM-DD]
  firebase-secrets --project <아이디>
  logout`);
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
