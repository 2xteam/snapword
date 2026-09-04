# SnapWord 배포 및 인프라 가이드

> **스택**: Next.js 15 · Node.js 22 · MongoDB Atlas · OpenAI API · Vercel

2026-09-02 Cloudways(Nginx + PM2)에서 Vercel로 이관했다.
이관 과정과 배경은 [VERCEL_MIGRATION.md](VERCEL_MIGRATION.md)에 정리되어 있다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [MongoDB Atlas 설정](#2-mongodb-atlas-설정)
3. [OpenAI API 키 발급](#3-openai-api-키-발급)
4. [로컬 개발 환경 구성](#4-로컬-개발-환경-구성)
5. [Vercel 배포](#5-vercel-배포)
6. [도메인 및 SSL](#6-도메인-및-ssl)
7. [주요 설정 파일 요약](#7-주요-설정-파일-요약)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. 사전 준비

| 항목 | 설명 |
|------|------|
| Node.js | **v22 이상 필수** — v20 미만에서는 `File` 클래스가 글로벌에 없어 이미지 업로드(OpenAI Vision) 시 `File is not defined` 에러 → 502 발생 |
| npm | Node.js 설치 시 포함 |
| Git | 소스 관리 |
| MongoDB Atlas 계정 | 무료 Cluster 사용 가능 |
| OpenAI 계정 | API 키 필요 (Vision API 사용) |
| Vercel 계정 | 호스팅 (GitHub 연동 자동 배포) |
| Gmail 계정 | SMTP 발송용 앱 비밀번호 필요 |

---

## 2. MongoDB Atlas 설정

### 2-1. 클러스터 생성

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 접속 → 회원가입/로그인
2. **Build a Cluster** → Free Tier(M0) 선택
3. 클라우드 제공자/리전 선택 (서울 리전 권장: `ap-northeast-2`)
4. 클러스터 이름 지정 후 **Create Cluster**

### 2-2. 데이터베이스 사용자 생성

1. 좌측 메뉴 **Database Access** → **Add New Database User**
2. 인증 방식: **Password**
3. 사용자명/비밀번호 설정
4. 권한: **Read and write to any database**

### 2-3. 네트워크 액세스 설정

1. 좌측 메뉴 **Network Access** → **Add IP Address**
2. 로컬 개발: **Add Current IP Address**
3. **Vercel: `0.0.0.0/0` 필수** — Vercel Functions는 고정 IP가 없어서
   특정 IP만 허용하면 모든 요청이 연결 실패한다. DB 비밀번호를 충분히 강하게 유지할 것

> 무료(M0) 클러스터는 일정 기간 미사용 시 **자동으로 일시정지(Paused)** 된다.
> 이 상태에서는 연결이 타임아웃되므로 Atlas 대시보드에서 **Resume** 해야 한다.

### 2-4. 연결 문자열 확인

1. **Database** → **Connect** → **Drivers**
2. 연결 문자열 복사:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

> **Windows 로컬에서 SRV DNS 오류가 나면** 표준 URI(`mongodb://`)를 쓴다.
> 다만 표준 URI는 Atlas가 클러스터를 이전하면 샤드 호스트명이 바뀌어 끊길 수 있으므로,
> **Vercel 환경 변수에는 `mongodb+srv://` 형식을 권장**한다(서버 DNS는 SRV 조회에 문제가 없다).

### 2-5. 데이터베이스/컬렉션

| 컬렉션 | 설명 |
|--------|------|
| `users` | 사용자 (전화번호 기반 인증) |
| `folders` | 폴더 |
| `vocabularies` | 단어장 |
| `words` | 단어 |
| `chathistories` | 채팅 이력 |
| `testwordstats` | 테스트 통계 |

> 컬렉션은 앱 실행 시 Mongoose가 자동 생성한다.

---

## 3. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 접속 → 로그인
2. 좌측 메뉴 **API keys** → **Create new secret key**
3. `sk-proj-...` 형태의 키를 안전하게 보관
4. **Billing**에서 결제 수단 등록 및 크레딧 충전

> 기본 모델은 `gpt-4o-mini`이며 `OPENAI_MODEL`로 변경할 수 있다.

---

## 4. 로컬 개발 환경 구성

### 4-1. 소스 클론

```bash
git clone https://github.com/2xteam/snapword.git
cd snapword
npm install
```

### 4-2. 환경 변수 파일 생성

프로젝트 루트에 `.env.local` 생성:

```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/vocab?retryWrites=true&w=majority
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
# 선택: 기본은 gpt-4o-mini
# OPENAI_MODEL=gpt-4o-mini

# 메일 발송 (PIN 찾기·문의)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail 주소>
SMTP_PASS=<gmail 앱 비밀번호 16자리>
```

> `.env.local`은 `.gitignore`에 포함되어 Git에 커밋되지 않는다.
> `SMTP_PORT=587`은 STARTTLS 방식이므로 **`SMTP_SECURE`를 설정하면 안 된다**(465일 때만 `true`).

### 4-3. 개발 서버 실행

```bash
npm run dev          # http://localhost:3001
npm run dev:https    # https://localhost:3001 (인증서 경고 허용 필요)
```

### 4-4. 빌드 확인

```bash
npm run build
npm run start
```

---

## 5. Vercel 배포

`main` 브랜치에 push하면 자동 배포된다. 별도의 CI 설정은 없다.

### 5-1. 프로젝트 설정

- **Framework**: Next.js (자동 감지)
- **Node.js Version**: **22.x** (Settings → General)
- **Function Region**: `icn1`(서울) — [vercel.json](../vercel.json)에 지정되어 있다

### 5-2. 환경 변수

**프로젝트 Settings → Environment Variables**에 등록한다.
계정(팀) 공용 Environment Variables 페이지에 넣으면 프로젝트에 연결되지 않아 적용되지 않는다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `MONGO_URI` | O | MongoDB 연결 문자열 |
| `OPENAI_API_KEY` | O | OpenAI API 키 |
| `OPENAI_MODEL` | X | 기본 `gpt-4o-mini` |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | O | `.myjane.co.kr` (SnapNote와 세션 쿠키 공유) |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | O | 메일 발송 |
| `SMTP_FROM` | X | 미설정 시 `SMTP_USER` 사용 |

> ⚠️ **환경 변수는 배포 시점에 그 배포로 고정된다.** 값을 추가·수정한 뒤에는
> 반드시 **Redeploy** 해야 반영된다. `NEXT_PUBLIC_*`은 클라이언트 번들에 빌드 타임에
> 박히므로 "Use existing Build Cache"를 해제하고 재배포한다.

### 5-3. 플랫폼 제약

| 항목 | 값 |
|---|---|
| 요청 본문 | **4.5MB** — 초과 시 함수에 닿기 전에 `FUNCTION_PAYLOAD_TOO_LARGE`로 잘린다 |
| 함수 실행 시간 | Hobby 최대 60초 (`maxDuration`이 이를 넘으면 배포가 거부된다) |

이미지 업로드는 이 제한 때문에 **업로드 전 브라우저에서 축소**한다
([lib/clientImageResize.ts](../lib/clientImageResize.ts) — 긴 변 2000px, JPEG 0.82).

---

## 6. 도메인 및 SSL

- 운영 도메인: `snapword.myjane.co.kr`
- 네임서버: 가비아. My가비아 → 도메인 → DNS 정보 → **DNS 관리**
- 레코드: `snapword` **CNAME** → Vercel Domains 탭에 표시되는 값 (TTL 600)
- SSL은 Vercel이 자동 발급·갱신한다. 별도 작업 없음

> 같은 도메인의 `@`·`www`·`snapnote` 레코드는 각각 다른 서비스가 쓰고 있으므로 건드리지 않는다.

---

## 7. 주요 설정 파일 요약

| 파일 | 설명 |
|------|------|
| `.env.local` | 로컬 개발용 환경 변수 (Git 제외) |
| `vercel.json` | 함수 리전(`icn1`) 지정 |
| `next.config.ts` | Next.js 설정 |
| `lib/db.ts` | MongoDB 연결 (전역 커넥션 캐시) |
| `lib/clientImageResize.ts` | 업로드 전 이미지 축소 |
| `lib/mail.ts` | nodemailer SMTP 발송 |
| `package.json` | 의존성 및 스크립트 |

### npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (HTTP) |
| `npm run dev:https` | 개발 서버 (HTTPS) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 (포트 3000) |
| `npm run lint` | ESLint 검사 |

---

## 8. 트러블슈팅

### 이미지 업로드가 실패한다 (`FUNCTION_PAYLOAD_TOO_LARGE` / 413)

- **원인**: Vercel Functions의 요청 본문 4.5MB 제한. 라우트 코드에 도달하기 전에 잘리므로
  서버 쪽 상한 값을 올려도 소용없다
- **확인**: 업로드 전 축소가 동작하는지(`lib/clientImageResize.ts`), 축소 후에도 4MB를 넘는지

### `MONGO_URI 환경 변수가 설정되지 않았습니다`

- **원인 1**: 환경 변수를 추가하기 **전에** 만들어진 배포를 그대로 쓰고 있다 → **Redeploy**
- **원인 2**: 프로젝트가 아니라 **계정 공용** Environment Variables 페이지에 등록했다
  → 프로젝트 Settings에 다시 등록

### DB 연결이 타임아웃된다

- Atlas **Network Access에 `0.0.0.0/0`** 이 있는지 확인
- Atlas 클러스터가 **Paused** 상태인지 확인 → Resume
- 연결 문자열의 사용자/비밀번호, DB 이름 확인

### 메일이 발송되지 않는다

- `SMTP_PASS`가 Gmail **앱 비밀번호(16자리)** 인지 확인 (계정 비밀번호로는 실패한다)
- `SMTP_PORT=587`에 `SMTP_SECURE=true`를 함께 설정하지 않았는지 확인 (587은 `false`여야 한다)
- Vercel → 해당 배포 → **Logs**에서 nodemailer 에러 확인

### `File is not defined` (이미지 업로드 502)

- **원인**: Node.js 20 미만에서는 `File` 클래스가 글로벌에 없다
- **해결**: Vercel Settings → General → **Node.js Version을 22.x**로 설정 후 재배포

### 배포는 됐는데 화면이 예전 그대로다

- `NEXT_PUBLIC_*` 값은 빌드 타임에 박힌다. **빌드 캐시를 해제하고 재배포**한다
- 브라우저 캐시·서비스워커가 남아 있는지 확인
