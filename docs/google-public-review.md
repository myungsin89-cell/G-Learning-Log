# G배움로그 Google 공개·인증 준비

기준일: 2026-10-14

프로젝트: `slidesight-505503`
운영 주소: `https://baeumlog.chorok.app`

## 심사 대상

Google 심사에는 현재 G배움로그 화면과 기능만 제출한다. 운영 주소의 `/`, `/class`, `/dashboard`, `/student`는 모두 현재 G배움로그로 연결한다. 디자인 시안과 과거 코드 경로는 OAuth 심사 영상과 기능 설명에 포함하지 않는다.

앱 이름, 홈페이지, 개인정보처리방침, 이용 안내는 다음 값으로 통일한다.

- 앱 이름: G배움로그
- 홈페이지: `https://baeumlog.chorok.app/`
- 개인정보처리방침: `https://baeumlog.chorok.app/privacy`
- 이용 안내: `https://baeumlog.chorok.app/terms`
- 승인된 도메인: `chorok.app`

## 요청 권한

운영 코드는 비민감 권한인 `https://www.googleapis.com/auth/drive.file` 하나만 요청한다. Google Picker에서 교사가 직접 선택한 파일과 G배움로그가 만든 파일만 조회·수정한다. `drive`, `drive.readonly`, `spreadsheets`, `spreadsheets.readonly`, `presentations`는 요청·콘솔 데이터 액세스·심사 설명에서 제거한다.

`drive.file`은 교사가 선택하거나 앱이 만든 파일의 Sheets 값, Slides 본문, Drive 댓글을 사용하는 데 적용된다. 앱은 Drive 전체를 탐색하지 않는다. 기존 학급·과제는 사용자가 Picker에서 한 번 선택해 연결한다. 새 학급·과제·학생 슬라이드·교사 기록 시트는 앱이 만들기 때문에 이후 목록에서 다시 찾을 수 있다.

## Google Cloud 운영 설정

1. Google Picker API, Google Drive API, Google Sheets API, Google Slides API를 활성화한다.
2. 운영 웹 OAuth 클라이언트의 승인된 JavaScript 원본은 `https://baeumlog.chorok.app`만 둔다.
3. localhost, 127.0.0.1, Vercel 기본 도메인, 이전 개발·테스트 원본과 사용하지 않는 리디렉션 URI를 운영 클라이언트에서 제거한다.
4. Picker용 브라우저 API 키는 HTTP 리퍼러로 제한한다. 허용 리퍼러는 `https://baeumlog.chorok.app/*`와 Picker iframe에 필요한 `https://docs.google.com/*`다.
5. API 키의 API 제한은 Google Picker API와 Google Drive API로 둔다.
6. 개발이 다시 필요하면 별도 Google Cloud 프로젝트와 OAuth 클라이언트를 사용한다.

## 사용자 데이터 흐름

각 교사는 자기 Google 계정으로 로그인한다. 학급 명단, 과제, 학생 슬라이드, 작업기록, 키워드와 교사 메모는 그 교사의 Google Drive에 저장된다. 다른 G배움로그 사용자가 이 파일에 접근하는 구조가 아니다. 공통 학생 링크를 교사가 켠 경우에만 별도의 최소 학생 접속 시트와 학생 슬라이드 공유 설정이 적용된다.

접근 토큰은 브라우저 메모리에만 두고 서버 데이터베이스나 브라우저 영구 저장소에 저장하지 않는다. 앱 서버는 학생 슬라이드 본문이나 교사 메모를 별도 데이터베이스에 수집하지 않는다.

## 제출 상태

앱 공개 전환과 사이트 소유권 확인은 Google 인증 승인과 별개다. 최종 제출 전에는 다음을 확인한다.

- Cloud 데이터 액세스에 `drive.file`만 남아 있는지
- 운영 OAuth 원본이 `https://baeumlog.chorok.app`로만 정리됐는지
- Picker API와 제한된 브라우저 키가 준비됐는지
- 실제 운영 배포에서 로그인, 기존 파일 선택, 학급 생성, 과제 생성, 기록·메모·댓글이 동작하는지
- 영상의 동의 화면과 콘솔에 등록한 최종 권한이 일치하는지

참고: [Drive 권한 선택](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google Picker 설정](https://developers.google.com/workspace/drive/picker/guides/overview), [OAuth 공개 준비](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
