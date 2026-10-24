# yomates-solapi-skill

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

- 키는 내 컴퓨터의 `~/.yomates-solapi/config.json`에만 저장돼요. 내 계정만 읽을 수 있어요.
- 키는 솔라피 화면의 복사 버튼으로 클립보드에 담아 바로 저장해요. 채팅이나 화면에 나오지 않아요.
- 문자는 `--yes`를 붙여야 실제로 나가요. 그전에는 미리보기만 보여 줘요.

같이 쓰면 좋은 스킬:
- [yomates-firebase-skill](https://github.com/from5302-lab/yomates-firebase-skill)
- [yomates-threads-skill](https://github.com/from5302-lab/yomates-threads-skill)
