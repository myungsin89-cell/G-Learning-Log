# 새 버전의 기존 데이터 읽기 연결

이 문서는 처음 로그인할 때의 읽기 경계를 설명한다. 새로 추가한 선택적 수집·피드백·비공개 메모 저장은 [live-workspace.md](./live-workspace.md)를 따른다.

## 연결 경계

- 운영 앱(`/`, `/class`, `/dashboard`, `/student`)의 URL은 유지한다. 원본 Drive 파일을 복제/생성/변환하지 않는다.
- 새 경로 `/next-version`은 `googleReadOnly.mjs`의 GET 전용 어댑터를 사용한다. 기존 쓰기 모듈이나 gapi 인증 토큰을 가져오지 않는다.
- OAuth 권한은 `drive.readonly`, `spreadsheets.readonly`만 요청한다. 이미 허용했던 권한은 이번 요청에 합치지 않는다(`include_granted_scopes: false`).
- 새 클라이언트 설정은 `NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID` 또는 별도 localStorage 키에 저장한다. 기존 운영 환경 변수·브라우저 설정을 덮어쓰지 않는다. Client Secret, API 키는 필요하지 않다.
- 토큰은 브라우저 메모리에만 둔다. 새로고침하거나 만료되면 사용자의 클릭으로 다시 로그인한다. 앱이 닫혀 있을 때 수집하지 않는다.

## Google 설정

사용자가 알려준 기존 프로젝트 ID는 `slidesight-505503`이다. 2026-10-09 콘솔 읽기 확인 결과 게시 상태는 외부/테스트 중이며, 기존 웹 클라이언트에 `http://localhost:3000`이 등록되어 있다. 따라서 현재 로컬 검증은 이미 허용된 주소와 기존 테스트 클라이언트로 진행할 수 있다. 이 확인 과정에서 Cloud 설정을 변경하지 않았다. 향후 정식 운영 전환 시 Google 정책에 따라 운영/테스트 프로젝트를 분리한다.

테스트용 프로젝트에는 다음을 준비한다.

1. Drive API, Sheets API, Slides API 활성화
2. OAuth 앱 정보와 대상 설정, 외부 앱의 테스트 사용자는 기존 자료를 보유한 교사 Google 계정
3. 웹 애플리케이션 OAuth 클라이언트 생성
4. 승인된 JavaScript 원본: `http://127.0.0.1:3000`, 필요하면 `http://localhost:3000`. 별도 테스트 배포 후 해당 HTTPS 원본도 등록한다. 경로는 입력하지 않는다.
5. `/next-version`의 연결 설정에 공개 Client ID 등록 후 Google 로그인과 읽기 권한 동의

현재는 GIS 팝업 토큰 모델이다. 서버용 client secret이나 리다이렉트 콜백을 추가하지 않는다. 인증정보 생성과 실제 권한 동의는 계정 소유자의 승인/진행이 필요하다.

## 데이터 해석

`students`의 저장된 글자/이미지는 기존 앱이 저장한 추가량이다. 템플릿을 다시 빼지 않는다. 번호는 시트 값이고 빈 번호를 행 순서로 채우지 않는다. 같은 이름이 여러 명이면 이름만으로 과거 로그를 배정하지 않으며, 배정하지 못한 로그도 JSON 원본 행에 보존한다.

확인 시각/이전 시각/변화량이 명시된 구간만 변화 그래프에 사용한다. 구형 로그는 `legacy_unverified`이며 전체 기록은 표시하되 작업량·꾸준함을 추정하지 않는다. 그래프는 최근 12구간, 전체 로그는 목록/JSON에 보존한다.

확인 시각 없는 학생 값은 현재 값으로 취급하지 않는다. 저장 기록 다시 읽기는 저장된 시트를 다시 읽는다. 학생 상세를 열 때 댓글을 읽는다. 슬라이드 본문은 아래의 별도 항목을 펼쳐 직접 요청할 때 한 번 조회한다. 저장 연결 전에는 전체 학생을 자동으로 수집하지 않는다.

현재 내용은 장별 본문·발표자 노트·삽입 이미지 개수와 원본 장 링크로 표시한다. 현재 전체 수치에는 기본 템플릿이 포함되므로 기존 시트의 추가량과 별도로 표시한다. 과거 기록에 합치거나 최신 편집 장을 추정하지 않는다. 조회 실패 시 예시 데이터로 대체하지 않으며, 이전 조회 내용이 남아 있다면 이전 확인 시각과 함께 표시한다. JSON에는 조회한 학생의 현재 내용과 확인 시각을 저장 기록과 별도 필드로 포함한다. 저장된 slide_id가 링크 형식이거나 비어 있다면 신뢰할 수 있는 Google Slides 주소에서 ID를 추출한다.

내 댓글은 교사, 다른 작성자는 미분류로 둔다. 댓글 조회 실패를 댓글 없음으로 치환하지 않는다.

## 검증과 별도 배포

로컬 검사: `node --test tests/*.test.mjs`, 변경 파일 ESLint, `npm run build`.

실계정 검증: 같은 교사 계정 로그인 → 기존 학급/과제 선택 → 학생 번호·기록·슬라이드 ID 비교 → 댓글 조회 → 새로고침 후 원본 시트 내용 보존 확인. Google 인증정보 값은 로그나 공개 문서에 넣지 않는다.

별도 배포는 기존 운영 Vercel 프로젝트에 연결하지 않고 새 대상 또는 격리된 테스트 배포를 사용한다. 테스트 OAuth Client ID와 `NEXT_PUBLIC_APP_MODE=readonly`를 배포 환경 변수에 넣고 재빌드한다. 이 모드에서는 구 버전 진입 경로를 `/next-version`으로 보내고 기존 Google 쓰기 함수도 실행 전에 차단한다. 기존 운영 배포에는 이 모드를 설정하지 않는다. 배포 완료와 Google 로그인/실데이터 확인 완료는 별도로 보고한다.

공식 자료:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
- https://developers.google.com/workspace/drive/api/reference/rest/v3/comments/list
- https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/get
