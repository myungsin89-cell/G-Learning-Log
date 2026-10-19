# G배움로그의 Google 파일 연결

이 문서는 처음 로그인할 때의 읽기 경계를 설명한다. 새로 추가한 선택적 수집·피드백·비공개 메모 저장은 [live-workspace.md](./live-workspace.md)를 따른다.

## 연결 경계

- 운영 주소는 `https://baeumlog.chorok.app`이다. 예전 `/class`, `/dashboard`, `/student` 진입은 현재 G배움로그 화면으로 이동한다.
- 현재 화면은 `googleReadOnly.mjs`의 읽기 어댑터와 별도의 생성·저장 어댑터를 사용한다.
- OAuth 권한은 `drive.file`만 요청한다. Google Picker에서 교사가 선택한 파일과 G배움로그가 만든 파일만 연결하며, 이미 허용했던 넓은 권한은 이번 요청에 합치지 않는다(`include_granted_scopes: false`).
- 운영 클라이언트 설정은 `NEXT_PUBLIC_GOOGLE_READONLY_CLIENT_ID`에 둔다. Picker용 공개 브라우저 키와 숫자 프로젝트 번호는 각각 `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`에 둔다. Client Secret은 사용하지 않는다.
- 토큰은 브라우저 메모리에만 둔다. 새로고침하거나 만료되면 사용자의 클릭으로 다시 로그인한다. 앱이 닫혀 있을 때 수집하지 않는다.

## Google 설정

운영 프로젝트 ID는 `slidesight-505503`이다. 운영 설정과 개발 설정을 분리한다. 운영 OAuth 클라이언트와 Picker 브라우저 키는 `https://baeumlog.chorok.app`와 `https://g-learning-log-next.vercel.app`을 허용하고, localhost·127.0.0.1·이전 개발 원본은 제거한다. 로컬 개발은 별도 Google Cloud 프로젝트와 별도 OAuth 클라이언트를 사용한다.

테스트용 프로젝트에는 다음을 준비한다.

1. Drive API, Sheets API, Slides API 활성화
2. OAuth 앱 정보와 대상 설정, 외부 앱의 테스트 사용자는 기존 자료를 보유한 교사 Google 계정
3. 웹 애플리케이션 OAuth 클라이언트 생성
4. 승인된 JavaScript 원본: `https://baeumlog.chorok.app`, `https://g-learning-log-next.vercel.app`. 경로는 입력하지 않는다.
5. Picker API를 활성화하고 브라우저 키를 Drive API와 Picker API로 제한한다. 웹사이트 제한에는 두 운영 주소의 `/*`와 Picker iframe용 `https://docs.google.com/*`를 등록한다.
6. Google 로그인 → 기존 자료 가져오기 또는 예시 슬라이드 선택 → 새 파일 생성·기록 저장을 실제 계정으로 확인한다.

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
