---
name: solapi-연결
description: 솔라피(SOLAPI) 문자 발송을 내 컴퓨터와 요메이트에 연결한다. 쌤은 솔라피 로그인·본인 인증·충전 결제만 하고, API 키 만들기·저장·발신번호 등록 화면 조작·연결 확인·시험 발송·Firebase 비밀값 넣기·함수 코드는 요메이트가 한다. "솔라피 연결해 줘", "문자 보내게 해 줘"에 쓴다.
---

# 솔라피 연결 (Solapi CLI for Yomates)

**원칙:** 이 스킬을 쓰는 사람은 학원 쌤이다. 쌤이 할 일은 로그인, 본인 인증(인증번호 입력), 충전 결제 세 가지뿐이다. 나머지 화면 조작과 설정은 내가 브라우저와 명령으로 한다.

CLI는 `~/yomates-solapi/solapi.mjs` 하나다. Node.js 18 이상이면 따로 설치할 패키지가 없다.

## 꼭 지킬 것

- **키와 시크릿은 내가 보지 않는다.** 솔라피 화면의 '복사' 버튼을 눌러 클립보드에 담고, `--from-clipboard` 명령으로 바로 파일에 넣는다.
  - 화면에 보이는 값을 읽어 적지 않는다.
  - 채팅에 붙여 달라고 하지 않는다.
- **키 위치:** 키는 쌤 컴퓨터의 `~/.yomates-solapi/config.json`에만 있다. 깃이나 다른 곳에 올리지 않는다.
- **문자를 보내기 전에:** 받는 번호와 내용을 보여 주고 쌤 확인을 받는다. 문자는 돈이 들고 되돌릴 수 없다. `send`는 `--yes` 없이 먼저 미리보기로 돌린다.
- **광고 문자:** 첫머리에 (광고)를 붙이고, 보내는 곳과 무료 수신거부 방법을 넣는다. 밤 9시부터 아침 8시까지는 보내지 않는다(정보통신망법).

## 처음 한 번

### 1. CLI 내려받기

먼저 `node -v`로 18 이상인지 본다. 없으면 https://nodejs.org LTS 설치를 안내한다.

- 맥·리눅스:
  ```
  mkdir -p ~/yomates-solapi && curl -fsSL https://raw.githubusercontent.com/from5302-lab/yomates-solapi-skill/main/solapi.mjs -o ~/yomates-solapi/solapi.mjs
  ```
- 윈도우(PowerShell):
  ```
  New-Item -ItemType Directory -Force "$HOME\yomates-solapi" | Out-Null; Invoke-WebRequest https://raw.githubusercontent.com/from5302-lab/yomates-solapi-skill/main/solapi.mjs -OutFile "$HOME\yomates-solapi\solapi.mjs"
  ```
- 윈도우에서는 아래 명령의 `~/yomates-solapi/solapi.mjs`를 `"$HOME\yomates-solapi\solapi.mjs"`로 바꿔 쓴다.

### 2. 로그인 (쌤)

1. 내 브라우저 창에 https://console.solapi.com 을 연다.
2. 쌤에게 로그인을 부탁한다. 계정이 없으면 회원가입과 본인 인증까지 쌤이 한다.
3. 로그인이 끝났다고 하면 다음으로 넘어간다. 이 단계는 쌤 답을 기다린다.

### 3. API 키 만들기 (내가 화면 조작)

1. 콘솔 메뉴의 「API Key 관리」(또는 「개발/연동 → API Key」)로 간다. 메뉴 이름은 바뀔 수 있으니 비슷한 이름을 찾는다.
2. 「새 API Key 추가」를 누른다.
   - 이름: `yomates`
   - 허용 IP: 비워 둔다
3. 만든 키 옆의 **API Key '복사'** 버튼을 누르고 실행한다.
   ```
   node ~/yomates-solapi/solapi.mjs key --from-clipboard
   ```
4. **API Secret '복사'** 버튼을 누르고 실행한다.
   ```
   node ~/yomates-solapi/solapi.mjs secret --from-clipboard
   ```
   - 시크릿은 만들 때 한 번만 보인다. 이미 지나갔으면 키를 하나 더 만든다.
5. **복사 버튼이 없거나 클립보드가 비어 'ERROR'가 나면:** 쌤에게 그 값의 복사만 부탁한다. "복사하셨으면 '복사했어'라고만 알려 주세요. 채팅엔 붙이지 마세요."

### 4. 발신번호 등록 (번호는 쌤에게 묻고, 인증은 쌤)

문자를 보내려면 보내는 번호가 등록돼 있어야 한다(전기통신사업법).

1. `node ~/yomates-solapi/solapi.mjs senders`로 이미 등록된 번호가 있는지 본다. 있으면 이 단계를 건너뛴다.
2. 없으면 쌤에게 보낼 번호를 묻는다(보통 본인 휴대폰).
3. 「발신번호 관리」 → 「발신번호 등록」에서 내가 번호를 넣고 인증 방식(ARS 또는 문자)을 고른다.
4. 인증번호는 쌤 휴대폰으로 온다. 쌤이 직접 입력하게 한다.
5. **사무실 유선번호나 대표번호인 경우:** 통신서비스 이용증명원 같은 서류가 필요하고 심사에 1~2일 걸린다. 쌤에게 필요한 서류 이름만 알려 주고, 서류 업로드는 쌤이 한다.
6. 끝나면 `senders`를 다시 돌려 확인한다. 번호가 하나면 기본 발신번호로 저장된다.

### 5. 잔액 (결제는 쌤)

1. `node ~/yomates-solapi/solapi.mjs status`로 잔액을 본다.
2. 0원이면 쌤에게 충전을 부탁한다. 콘솔 「충전」 화면까지는 내가 열어 주고, 결제는 쌤이 한다.
3. 참고로 알린다. 단문(SMS)은 한 통에 몇십 원, 장문(LMS)은 그보다 비싸다. 정확한 단가는 충전 화면에 나온다.

### 6. 시험 발송 (쌤 확인 후)

1. 쌤 본인 번호로 미리보기를 돌린다.
   ```
   node ~/yomates-solapi/solapi.mjs send --to <쌤번호> "[시험] 요메이트 솔라피 연결 확인 문자예요."
   ```
2. 미리보기를 보여 주고 "보낼까요?"라고 확인받는다.
3. 확인을 받으면 같은 명령 끝에 `--yes`를 붙여 보낸다.
4. 받았는지 쌤에게 묻고, `history`로 발송 결과를 확인한다.

### 7. Firebase 앱에 붙이기 (앱에서 자동 문자를 보낼 때만)

먼저 'firebase-세팅' 스킬로 프로젝트를 만들고 Blaze 요금제로 바꿔 둔다. 비밀값과 Functions는 Blaze가 필요하다.

1. 키를 Firebase 비밀값으로 넣는다. 값은 표준입력으로만 넘어가서 화면에 나오지 않는다.
   ```
   node ~/yomates-solapi/solapi.mjs firebase-secrets --project <프로젝트아이디>
   ```
2. 함수 코드는 이 틀로 쓴다(`functions/sms.js`).
   ```js
   const crypto = require("crypto");
   const { defineSecret } = require("firebase-functions/params");
   const SOLAPI_KEY = defineSecret("SOLAPI_KEY");
   const SOLAPI_SECRET = defineSecret("SOLAPI_SECRET");
   async function sendSms(to, from, text) {
     const date = new Date().toISOString(), salt = crypto.randomBytes(16).toString("hex");
     const signature = crypto.createHmac("sha256", SOLAPI_SECRET.value()).update(date + salt).digest("hex");
     const r = await fetch("https://api.solapi.com/messages/v4/send", {
       method: "POST",
       headers: { "Content-Type": "application/json", Authorization: `HMAC-SHA256 apiKey=${SOLAPI_KEY.value()}, date=${date}, salt=${salt}, signature=${signature}` },
       body: JSON.stringify({ message: { to, from, text } }),
     });
     if (!r.ok) throw new Error(await r.text());
     return r.json();
   }
   module.exports = { sendSms, SOLAPI_KEY, SOLAPI_SECRET };
   ```
   - 함수를 선언할 때 `secrets: [SOLAPI_KEY, SOLAPI_SECRET]`를 붙인다.
   - 시험할 때는 실제 고객 번호로 보내지 않는다.

## 매일 쓰기

| 할 일 | 명령 |
|---|---|
| 연결·잔액·발신번호 | `node ~/yomates-solapi/solapi.mjs status` |
| 문자 미리보기 | `node ~/yomates-solapi/solapi.mjs send --to 번호 "내용"` |
| 실제 발송(확인 후) | 위 명령 끝에 `--yes` |
| 오늘 보낸 문자 | `node ~/yomates-solapi/solapi.mjs history` |
| 특정 날짜 | `node ~/yomates-solapi/solapi.mjs history 2026-10-24` |

- 90바이트(한글 약 45자)를 넘으면 장문(LMS)이 되고 요금이 올라간다. 미리보기에 `type`과 `bytes`가 나온다.
- 번호는 화면에 `010-****-1234`처럼 가려서 보여 준다.

## 막힐 때

- **`API 키나 시크릿이 맞지 않아요`:** 3단계를 다시 한다. 키와 시크릿이 서로 다른 키 것이면 이렇게 나온다.
- **발신번호 미등록 오류:** 4단계를 마친다. 유선번호는 서류 심사가 끝나야 쓸 수 있다.
- **잔액 부족:** 5단계에서 쌤에게 충전을 부탁한다.
- **`firebase-secrets` 실패:** Blaze 요금제인지, `firebase login`이 돼 있는지 확인한다.
- **연결 끊기:** `node ~/yomates-solapi/solapi.mjs logout`을 실행하면 이 컴퓨터의 키 파일이 지워진다.
