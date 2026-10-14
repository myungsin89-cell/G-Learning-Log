# G배움로그 운영 배포

기존 Google 파일을 유지하며 현재 G배움로그를 Vercel 운영 프로젝트에서 제공한다.

- Vercel 프로젝트: `g-learning-log-next`
- 운영 브랜치: `release/next-version-2026-10-09`
- 운영 원본: `https://baeumlog.chorok.app`
- 개인정보처리방침: `https://baeumlog.chorok.app/privacy`
- 이용 안내: `https://baeumlog.chorok.app/terms`

운영 원본은 Google OAuth 허용 원본에 별도로 등록해야 한다. 등록·로그인 확인과 Google 심사 완료는 별개다.

## 공개 환경 변수

- `NEXT_PUBLIC_APP_ENTRY=next`: 도메인 첫 화면과 예전 진입 경로를 현재 G배움로그로 연결한다.
- `NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID`: slidesight-505503 프로젝트의 기존 웹 OAuth 클라이언트 ID. 공개 설정이며 클라이언트 비밀 키를 사용하지 않는다.
- `NEXT_PUBLIC_APP_MODE`: 비워 둔다. readonly는 쓰기 기능을 막는 별도 테스트 모드다.
- `NEXT_PUBLIC_SUPPORT_EMAIL`: `myungsin89@gmail.com`. 미설정 시에도 같은 직접 문의 이메일을 코드 기본값으로 제공한다.

개인정보처리방침 `/privacy`, 이용 안내 `/terms`, 학생 접속 `/join/[sheetId]`는 로그인 없이 열려야 한다. 학생 접속 시트와 교사 비공개 기록 시트를 분리한다.

## Google 연결과 인증 준비

현재 운영 버전은 GIS `initTokenClient` 팝업 모델이다. 클라이언트 비밀 키와 서버 콜백 URL을 넣지 않는다. 운영 OAuth 클라이언트의 승인된 JavaScript 원본은 `https://baeumlog.chorok.app`만 사용한다. localhost, 127.0.0.1, Vercel 기본 도메인과 이전 운영 원본은 운영 클라이언트에서 제거한다. 개발이 필요하면 별도 Google Cloud 프로젝트와 OAuth 클라이언트를 사용한다.

최초 교사 로그인에서 비민감 권한인 `drive.file` 하나만 요청한다. 유효한 토큰은 조회·학급 생성·과제 배부·기록 저장에서 재사용하며, 추가 기능마다 계정 선택을 다시 열지 않는다. 예시 슬라이드와 예전 학급·과제는 Google Picker에서 교사가 직접 선택한다. 새 학급·과제·학생 슬라이드·교사 기록 시트는 앱이 만들기 때문에 이후 자동으로 표시할 수 있다. 토큰은 메모리에만 보관하므로 새로고침·로그아웃·만료 후에는 연결이 필요할 수 있다.

과제 관찰 화면은 유효한 로그인 연결로 저장소를 초기화한 뒤 자동 확인을 시작한다. 초기화가 끝나기 전에 학생별 중지·과제 종료 상태를 확인하며, 종료 과제는 저장된 기록만 표시한다. 연결 실패·만료 시 자동 OAuth 팝업을 열지 않고 사용자에게 다시 연결을 안내한다.

공개 홈페이지, 같은 도메인의 개인정보처리방침, 실제 지원 이메일, 도메인 소유권 확인, 앱 이름·로고, 요청 권한의 이유, 실제 동작 영상은 Google 인증 준비 항목이다. 테스트 사용자 등록, 공개 상태 전환, 브랜딩 검증, 민감·제한 권한 검증은 각각 별개다. 배포 또는 로그인 성공만으로 Google 인증 완료라고 표시하지 않는다.

브랜딩 공개·공개 상태 변경·심사 제출·새로운 권한 부여는 별도 실제 변경이다. 운영자의 승인을 확인한 뒤 수행한다. 토큰·비밀 키·학생 실제 자료를 코드, 로그 또는 심사 공개 영상에 노출하지 않는다.

## 배포 확인

1. Vercel의 실제 빌드 커밋과 Ready 상태를 확인한다.
2. 새 도메인 첫 화면, `/privacy`, `/terms`, 학생 접속 경로를 확인한다.
3. 승인된 원본 등록 후 새 도메인에서 Google 로그인과 기존 학급·과제·학생 기록 조회를 확인한다.
4. 기존 운영 사이트·원본 기록을 수정하거나 초기화하지 않는다. 공유 링크나 교사 기록 저장을 새로 만드는 테스트는 지정된 테스트 자료로만 수행한다.

참고: [Google 브랜딩 검증](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification), [Google 사용자 데이터 정책](https://developers.google.com/terms/api-services-user-data-policy).
