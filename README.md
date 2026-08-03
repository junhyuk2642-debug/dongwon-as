# 동원모터펌프 AS 접수 시스템

## 1. 서비스 주소

고객 접수 화면
- https://dongwon-as.vercel.app/

관리자 화면
- 관리자 전용 주소 사용
- 관리자 키는 외부에 공개하지 말 것

## 2. 주요 파일

### 고객 화면

- index.html
  - 고객 접수 화면의 구조
  - 입력창, 사진 첨부, 접수 버튼

- style.css
  - 고객 화면 디자인

- app.js
  - 고객 접수 처리
  - 사진 업로드
  - 접수 정보 전송

### 관리자 화면

- admin.html
  - 관리자 접수 목록 화면

- admin.css
  - 관리자 화면 디자인

- admin.js
  - 접수 목록 조회
  - 상태 변경
  - 메모 저장
  - 접수 삭제
  - 사진 확인

- admin-key.js
  - 관리자 접근키 처리
  - 키를 GitHub에 직접 저장하지 않도록 주의

### 서버 기능

- api/requests.js
  - 고객 접수 등록
  - 관리자 접수 조회
  - 수정 및 삭제 처리
  - Supabase와 통신

### PWA 설치 기능

- manifest-customer.json
  - 고객 화면 앱 설치 설정

- manifest-admin.json
  - 관리자 화면 앱 설치 설정

- pwa.js
  - 서비스워커 등록

- service-worker.js
  - 앱 캐시 및 설치 기능

### 아이콘

- customer-icon-192.png
- customer-icon-512.png
- customer-apple-touch-icon.png
- admin-icon-192.png
- admin-icon-512.png
- admin-apple-touch-icon.png

## 3. 외부 서비스

### GitHub

소스코드 저장소
- junhyuk2642-debug/dongwon-as

main 브랜치에 push하면 Vercel에서 자동 배포된다.

### Vercel

웹사이트 배포 담당

환경변수 위치
- Vercel 프로젝트
- Settings
- Environment Variables

주요 환경변수
- SUPABASE_URL
- SUPABASE_SECRET_KEY
- ADMIN_ACCESS_KEY

환경변수의 실제 값은 이 문서나 GitHub에 기록하지 않는다.

### Supabase

담당 기능
- 고객 접수 데이터 저장
- 접수 사진 저장
- 관리자 데이터 조회

## 4. 수정 후 배포 방법

VS Code 터미널에서 실행

```bash
git add .
git commit -m "수정 내용"
git push프로젝트 루트(C:\\dongwon-as)에 이 파일들을 복사하세요.