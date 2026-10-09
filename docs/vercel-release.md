# 신버전 별도 배포

기존 운영 배포와 Google 파일을 유지하며 별도 Vercel 프로젝트에서 신버전을 제공한다. 기존 main 대신 release 브랜치를 사용한다.

## 공개 환경 변수

- `NEXT_PUBLIC_APP_ENTRY=next`: 도메인 첫 화면을 신버전 로그인으로 연결한다.
- `NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID`: slidesight-505503 프로젝트의 기존 웹 OAuth 클라이언트 ID. 공개 설정이며 클라이언트 비밀 키를 사용하지 않는다.
- `NEXT_PUBLIC_APP_MODE`: 비워 둔다. readonly는 쓰기 기능을 막는 별도 테스트 모드다.
- `NEXT_PUBLIC_SUPPORT_EMAIL`: 공개할 문의 이메일을 운영자가 정한 경우만 설정한다. 미설정 시 Google 로그인 앱 정보의 지원 이메일을 안내한다.

개인정보처리방침 `/privacy`, 이용 안내 `/terms`, 학생 접속 `/join/[sheetId]`는 로그인 없이 열려야 한다. 학생 접속 시트와 교사 비공개 기록 시트를 분리한다.

## Google 연결과 인증 준비

현재 신버전은 GIS `initTokenClient` 팝업 모델이다. 클라이언트 비밀 키와 서버 콜백 URL을 넣지 않는다. 실제 배포 도메인의 HTTPS 원본을 기존 웹 OAuth 클라이언트의 승인된 JavaScript 원본에 추가하고 기존 원본은 유지한다.

최초 로그인은 Drive/Sheets 읽기, 기록·메모·댓글 저장은 drive.file, 예시 슬라이드 주소로 복사·배부하는 생성 기능은 Drive 권한을 요청한다. 기존 파일 탐색과 임의 주소 복사를 지원하므로 좁은 권한만 사용하는 앱이라고 설명하면 안 된다. 권한별 사용 화면을 실제 계정으로 검증하고 심사 자료에 설명한다.

공개 홈페이지, 같은 도메인의 개인정보처리방침, 실제 지원 이메일, 도메인 소유권 확인, 앱 이름·로고, 요청 권한의 이유, 실제 동작 영상은 Google 인증 준비 항목이다. 테스트 사용자 등록, 공개 상태 전환, 브랜딩 검증, 민감·제한 권한 검증은 각각 별개다. 배포 또는 로그인 성공만으로 Google 인증 완료라고 표시하지 않는다.

브랜딩 공개·공개 상태 변경·심사 제출·새로운 권한 부여는 별도 실제 변경이다. 운영자의 승인을 확인한 뒤 수행한다. 토큰·비밀 키·학생 실제 자료를 코드, 로그 또는 심사 공개 영상에 노출하지 않는다.

## 배포 확인

1. Vercel의 실제 빌드 커밋과 Ready 상태를 확인한다.
2. 새 도메인 첫 화면, `/privacy`, `/terms`, 학생 접속 경로를 확인한다.
3. 승인된 원본 등록 후 새 도메인에서 Google 로그인과 기존 학급·과제·학생 기록 조회를 확인한다.
4. 기존 운영 사이트·원본 기록을 수정하거나 초기화하지 않는다. 공유 링크나 교사 기록 저장을 새로 만드는 테스트는 지정된 테스트 자료로만 수행한다.

참고: [Google 브랜딩 검증](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Google 사용자 데이터 정책](https://developers.google.com/terms/api-services-user-data-policy).
