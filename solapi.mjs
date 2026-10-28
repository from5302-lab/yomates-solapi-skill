#!/usr/bin/env node
// Solapi CLI for Yomates — 솔라피 문자(SMS·LMS) 연결, 잔액·발신번호 확인, 시험 발송, Firebase 비밀값 넣기.
// 설치할 것 없음: Node.js 18 이상만 있으면 된다(외부 패키지 0개).
//
// API 키와 시크릿은 맥이면 키체인, 윈도우면 내 계정만 풀 수 있는 암호화 파일, 리눅스면 내 계정만 읽는 파일에 둔다.
// 값은 화면에 절대 출력하지 않는다. 클립보드에서 한 번 읽어 바로 저장하고, 읽은 뒤 클립보드를 비운다.
//
//   node solapi.mjs key --from-clipboard        API Key 저장
//   node solapi.mjs secret --from-clipboard     API Secret 저장
//   node solapi.mjs status                      연결 확인 · 잔액 · 쓸 수 있는 발신번호
//   node solapi.mjs senders                     발신번호 목록
//   node solapi.mjs send --to 01012345678 [--from 발신번호] "내용"          미리보기만(실제 발송 안 함)
//   node solapi.mjs send --to 01012345678 [--from 발신번호] "내용" --yes    실제 발송(돈이 듦)
//   node solapi.mjs bulk --file 목록.csv [--yes]                           여러 명(CSV: 번호,내용)
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
const DIR = process.env.YOMATES_SOLAPI_DIR || join(homedir(), ".yomates-solapi");   // 시험할 때만 바꾼다
const FILE = join(DIR, "config.json");
const KST = 9 * 3600000;

const load = () => { try { return JSON.parse(readFileSync(FILE, "utf8")); } catch { return {}; } };
function save(c) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(c, null, 2));
  try { chmodSync(DIR, 0o700); chmodSync(FILE, 0o600); } catch {}
}
// ===== 비밀값 보관 (2026-10 보안 강화) =====
// 맥: 키체인(macOS Keychain) / 윈도우: 내 계정만 풀 수 있는 암호화(DPAPI) 파일 / 리눅스: 내 계정만 읽는 파일(600)
// 값은 명령 인자로 넘기지 않는다(다른 프로그램의 프로세스 목록에 보일 수 있음). 표준입력으로만 넘긴다.
const KC_SERVICE = process.env.YOMATES_KC_SERVICE || "yomates-solapi";
function vaultSet(name, value) {
  const os = platform();
  if (os === "darwin") {
    const esc = (v) => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const r = spawnSync("security", ["-i"], { input: `add-generic-password -U -a "${esc(name)}" -s "${KC_SERVICE}" -w "${esc(value)}"\n`, encoding: "utf8" });
    if (r.status !== 0) throw new Error("키체인에 저장하지 못했어요.");
    return;
  }
  if (os === "win32") {
    const r = spawnSync("powershell", ["-NoProfile", "-Command", "$v=[Console]::In.ReadToEnd(); ConvertTo-SecureString $v -AsPlainText -Force | ConvertFrom-SecureString"], { input: String(value), encoding: "utf8" });
    if (r.status !== 0) throw new Error("암호화해서 저장하지 못했어요.");
    const c = load(); save({ ...c, enc: { ...(c.enc || {}), [name]: r.stdout.trim() } });
    return;
  }
  const c = load(); save({ ...c, plain: { ...(c.plain || {}), [name]: String(value) } });
}
function vaultGet(name) {
  const os = platform();
  if (os === "darwin") {
    const r = spawnSync("security", ["find-generic-password", "-a", name, "-s", KC_SERVICE, "-w"], { encoding: "utf8" });
    return r.status === 0 ? r.stdout.replace(/\n$/, "") : "";
  }
  if (os === "win32") {
    const e = (load().enc || {})[name];
    if (!e) return "";
    const r = spawnSync("powershell", ["-NoProfile", "-Command", "$s=[Console]::In.ReadToEnd().Trim() | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))"], { input: e, encoding: "utf8" });
    return r.status === 0 ? r.stdout.replace(/\r?\n$/, "") : "";
  }
  return (load().plain || {})[name] || "";
}
function vaultDel(name) {
  if (platform() === "darwin") spawnSync("security", ["delete-generic-password", "-a", name, "-s", KC_SERVICE], { encoding: "utf8" });
}
const vaultWhere = () => (platform() === "darwin" ? "맥 키체인" : platform() === "win32" ? "윈도우 암호화(DPAPI) 파일" : "내 계정만 읽는 파일(600)");

// 클립보드에서 한 번만 읽는다. 지금 클립보드 값이 모양에 안 맞으면 waitSec 동안 새로 복사되기를 기다린다.
// 읽은 뒤에는 바로 비운다. 값은 화면에 출력하지 않는다.
function readClipboardRaw() {
  const os = platform();
  const cmd = os === "darwin" ? "pbpaste" : os === "win32" ? 'powershell -NoProfile -Command "Get-Clipboard"' : "xclip -selection clipboard -o 2>/dev/null || wl-paste";
  try { return execSync(cmd, { encoding: "utf8" }).trim(); } catch { return ""; }
}
function clearClipboard() {
  const os = platform();
  try {
    if (os === "darwin") execSync("pbcopy < /dev/null");
    else if (os === "win32") execSync('powershell -NoProfile -Command "Set-Clipboard -Value $null"');
    else execSync("xclip -selection clipboard < /dev/null 2>/dev/null || wl-copy --clear");
  } catch {}
}
async function clipboardSecret(test, waitSec = 90) {
  const until = Date.now() + waitSec * 1000;
  let v = readClipboardRaw().replace(/\s+/g, "");
  while (!test(v) && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 1000));
    v = readClipboardRaw().replace(/\s+/g, "");
  }
  clearClipboard();
  if (!test(v)) throw new Error(`${waitSec}초 안에 맞는 값이 복사되지 않았어요. 복사 버튼을 누른 뒤 다시 실행해 주세요.`);
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
// 예전 판(평문 config.json)에 키가 있으면 금고로 옮기고 파일에서 지운다
function migrate() {
  const c = load();
  for (const k of ["apiKey", "apiSecret"]) if (c[k]) { vaultSet(k, c[k]); delete c[k]; save(c); }
  return load();
}
function creds() { const c = migrate(); return { ...c, apiKey: vaultGet("apiKey"), apiSecret: vaultGet("apiSecret") }; }
function ready() {
  const c = creds();
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
    const v = await clipboardSecret((x) => /^[A-Za-z0-9]{10,64}$/.test(x));
    vaultSet(cmd === "key" ? "apiKey" : "apiSecret", v);
    out({ ok: true, saved: cmd === "key" ? "API Key" : "API Secret", savedIn: vaultWhere(), next: cmd === "key" ? "secret --from-clipboard" : "status" });
  }
  else if (cmd === "status") {
    const c = creds();
    if (!c.apiKey || !c.apiSecret) { out({ connected: false, has: { key: !!c.apiKey, secret: !!c.apiSecret } }); }
    else {
      const bal = await api(c, "GET", "/cash/v1/balance");
      const senders = await activeSenders(c);
      out({ connected: true, savedIn: vaultWhere(), balance: bal.balance ?? null, point: bal.point ?? null, senders: senders.map(mask), defaultFrom: c.from ? mask(c.from) : null });
    }
  }
  else if (cmd === "senders") {
    const c = ready();
    const s = await activeSenders(c);
    // 발신번호가 하나뿐이면 기본값으로 기억한다
    if (s.length === 1 && c.from !== s[0]) save({ ...load(), from: s[0] });
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
  else if (cmd === "bulk") {
    // 여러 명에게 보내기: CSV(번호,내용) 또는 JSON [{to,text}]. --yes 없으면 미리보기만
    const c = ready();
    const file = flag(rest, "--file");
    if (!file || !existsSync(file)) throw new Error('사용법: bulk --file 목록.csv [--from 발신번호] [--yes]  (CSV 한 줄: 번호,내용)');
    const raw = readFileSync(file, "utf8").replace(/^﻿/, "");
    let rows;
    if (/\.json$/i.test(file)) rows = JSON.parse(raw).map((x) => [x.to, x.text]);
    else {
      rows = [];
      for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const cells = []; let cur = "", q = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
          else if (ch === '"') q = true; else if (ch === ",") { cells.push(cur); cur = ""; } else cur += ch;
        }
        cells.push(cur);
        rows.push([cells[0], cells.slice(1).join(",")]);
      }
      if (rows.length && !/\d{9,}/.test(digits(rows[0][0]))) rows.shift(); // 머리줄
    }
    let from = digits(flag(rest, "--from")) || c.from;
    if (!from) { const s = await activeSenders(c); if (s.length === 1) from = s[0]; }
    if (!from) throw new Error("발신번호를 정해 주세요(--from). 'senders'로 쓸 수 있는 번호를 볼 수 있어요.");
    const seen = new Set(), msgs = [], bad = [], dup = [];
    for (const [t, text] of rows) {
      const to = digits(t);
      if (!/^01\d{8,9}$/.test(to) || !String(text || "").trim()) { bad.push(mask(t) || String(t)); continue; }
      if (seen.has(to)) { dup.push(mask(to)); continue; }
      seen.add(to); msgs.push({ to, from, text: String(text).replace(/\\n/g, "\n") });
    }
    const typeOf = (t) => ([...t].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0) > 90 ? "LMS" : "SMS");
    const types = msgs.reduce((o, m) => (o[typeOf(m.text)] = (o[typeOf(m.text)] || 0) + 1, o), {});
    const h = new Date(Date.now() + KST).getUTCHours();
    const night = h >= 21 || h < 8;
    if (!rest.includes("--yes")) {
      out({ preview: true, count: msgs.length, types, skippedBad: bad, skippedDuplicate: dup, from: mask(from), sample: msgs.slice(0, 3).map((m) => ({ to: mask(m.to), text: m.text })), warning: night ? "지금은 밤 9시~아침 8시예요. 광고 문자는 보내면 안 되고, 안내 문자도 급한 게 아니면 아침에 보내요." : null, next: "같은 명령 끝에 --yes 를 붙이면 실제로 보내요(요금이 들어요)." });
    } else {
      if (!msgs.length) throw new Error("보낼 번호가 없어요.");
      const r = await api(c, "POST", "/messages/v4/send-many/detail", { messages: msgs });
      const failed = (r.failedMessageList || []).map((x) => ({ to: mask(x.to), reason: x.statusMessage || x.statusCode }));
      out({ ok: true, requested: msgs.length, failed: failed.length, failedList: failed, groupId: (r.groupInfo && r.groupInfo._id) || null, skippedBad: bad, skippedDuplicate: dup });
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
    vaultDel("apiKey"); vaultDel("apiSecret");
    if (existsSync(FILE)) rmSync(FILE);
    out({ ok: true, removed: [vaultWhere(), FILE] });
  }
  else {
    console.log(`Solapi CLI for Yomates
  key --from-clipboard | secret --from-clipboard   키 저장(처음 한 번)
  status                                           연결 · 잔액 · 발신번호
  senders                                          발신번호 목록
  send --to 번호 [--from 번호] "내용" [--yes]       --yes 없으면 미리보기
  bulk --file 목록.csv [--from 번호] [--yes]          여러 명(CSV 한 줄: 번호,내용)
  history [YYYY-MM-DD]
  firebase-secrets --project <아이디>
  logout`);
  }
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
