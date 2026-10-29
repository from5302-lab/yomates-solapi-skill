# yomates-solapi-skill

<!-- yomates-install:readme -->
> **먼저 요메이트(Yomates)가 필요해요.** 이 스킬은 요메이트 앱 안에서 돌아가요. 아직 설치하지 않았다면 [YOMATES-INSTALL.md](YOMATES-INSTALL.md) 순서대로 설치한 뒤 돌아오세요. 공식 다운로드는 https://yomates.ai 하나뿐이에요.
<!-- /yomates-install:readme -->

요메이트(Yomates)에서 솔라피(SOLAPI) 문자 발송을 연결하는 스킬과 CLI예요. 학원 쌤들이 쓰도록 만들었어요.

## 쓰는 법

1. 요메이트 팀원에게 이렇게 보내요.
   > https://github.com/from5302-lab/yomates-solapi-skill 의 SKILL.md 읽고 'solapi-연결' 스킬로 저장해 줘. 그다음 그대로 연결해 줘.
2. 쌤이 하실 일은 세 가지예요.
   - 솔라피 로그인(처음이면 회원가입·본인 인증)
   - 발신번호 인증번호 입력
   - 충전 결제
3. 나머지는 요메이트 팀원이 해요.
   - CLI 설치
   - API 키 만들기와 저장
   - 발신번호 등록 화면 조작
   - 잔액·발신번호 확인
   - 내 번호로 시험 문자(보내기 전에 확인받아요)
   - Firebase 비밀값 넣기와 문자 발송 함수 코드

## 들어 있는 것

- `solapi.mjs`: Node.js 18 이상만 있으면 도는 솔라피 CLI예요. 외부 패키지를 쓰지 않아요.
- `SKILL.md`: 요메이트 팀원이 읽는 연결·사용 안내예요.

## 보안

- 키는 맥이면 키체인, 윈도우면 내 계정만 풀 수 있는 암호화 파일, 리눅스면 내 계정만 읽는 파일에 저장돼요.
- 키는 솔라피 화면의 복사 버튼으로 클립보드에 담고, CLI가 한 번 읽어 저장한 뒤 바로 클립보드를 비워요. 채팅이나 AI 화면에 나오지 않아요.
- 클립보드 기록 앱(Paste, Raycast, Win+V 등)을 쓰시면, 연결 뒤 기록에서 그 항목을 지워 주세요.
- 문자는 `--yes`를 붙여야 실제로 나가요. 그전에는 미리보기만 보여 줘요.

같이 쓰면 좋은 스킬:
- [yomates-firebase-skill](https://github.com/from5302-lab/yomates-firebase-skill)
- [yomates-threads-skill](https://github.com/from5302-lab/yomates-threads-skill)
