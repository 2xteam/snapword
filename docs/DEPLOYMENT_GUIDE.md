# SnapWord 배포 및 인프라 가이드

> **스택**: Next.js 15 · Node.js 22 · MongoDB Atlas · OpenAI API · Cloudways (Nginx + Apache Hybrid) · GitHub Actions CI/CD

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [MongoDB Atlas 설정](#2-mongodb-atlas-설정)
3. [OpenAI API 키 발급](#3-openai-api-키-발급)
4. [로컬 개발 환경 구성](#4-로컬-개발-환경-구성)
5. [GitHub 저장소 설정](#5-github-저장소-설정)
6. [Cloudways 서버 생성 및 설정](#6-cloudways-서버-생성-및-설정)
7. [Cloudways SSH 환경 구성](#7-cloudways-ssh-환경-구성)
8. [GitHub Actions 자동 배포](#8-github-actions-자동-배포)
9. [도메인 및 SSL 설정](#9-도메인-및-ssl-설정)
10. [수동 배포 / 장애 대응](#10-수동-배포--장애-대응)
11. [주요 설정 파일 요약](#11-주요-설정-파일-요약)
12. [트러블슈팅](#12-트러블슈팅)

---

## 1. 사전 준비

| 항목 | 설명 |
|------|------|
| Node.js | **v22 이상 필수** — v20 미만에서는 `File` 클래스가 글로벌에 없어 이미지 업로드(OpenAI Vision) 시 `File is not defined` 에러 → 502 발생. **반드시 v22 이상 사용** |
| npm | Node.js 설치 시 포함 |
| Git | 소스 관리 및 배포 |
| MongoDB Atlas 계정 | 무료 Cluster 사용 가능 |
| OpenAI 계정 | API 키 필요 (Vision API 사용) |
| Cloudways 계정 | 관리형 클라우드 호스팅 |
| GitHub 계정 | 저장소 및 Actions CI/CD |

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
3. 사용자명/비밀번호 설정 (예: `myuser` / `MyStr0ngP@ss`)
4. 권한: **Read and write to any database**
5. **Add User** 클릭

### 2-3. 네트워크 액세스 설정

1. 좌측 메뉴 **Network Access** → **Add IP Address**
2. 로컬 개발: **Add Current IP Address**
3. Cloudways 서버: 서버 공인 IP 추가 (Cloudways 대시보드에서 확인)
4. 전체 허용 시: `0.0.0.0/0` (보안상 비권장, 테스트 시만)

### 2-4. 연결 문자열 확인

1. **Database** → **Connect** → **Drivers**
2. 연결 문자열 복사:

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority
```

> **SRV DNS 오류 시**: 표준 URI(mongodb://) 사용. Connect 화면에서 **Node.js 2.2.12 or later**를 선택하면 샤드 호스트 직접 연결 URI를 볼 수 있습니다.

```
mongodb://<username>:<password>@shard-00.xxxxx.mongodb.net:27017,shard-01.xxxxx.mongodb.net:27017,shard-02.xxxxx.mongodb.net:27017/<dbname>?ssl=true&authSource=admin&replicaSet=atlas-xxxxx-shard-0&retryWrites=true&w=majority
```

### 2-5. 데이터베이스/컬렉션

| 컬렉션 | 설명 |
|--------|------|
| `users` | 사용자 (전화번호 기반 인증) |
| `folders` | 폴더 |
| `vocabularies` | 단어장 |
| `words` | 단어 |
| `chathistories` | 채팅 이력 |
| `testwordstats` | 테스트 통계 |

> 컬렉션은 앱 실행 시 Mongoose가 자동 생성합니다. 수동으로 만들 필요 없습니다.

---

## 3. OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 접속 → 로그인
2. 좌측 메뉴 **API keys** → **Create new secret key**
3. 키 이름 지정 후 **Create secret key**
4. `sk-proj-...` 형태의 키를 안전하게 보관
5. **Billing**에서 결제 수단 등록 및 크레딧 충전

> 기본 모델은 `gpt-4o-mini`이며, `.env`에 `OPENAI_MODEL`로 변경 가능합니다.

---

## 4. 로컬 개발 환경 구성

### 4-1. 소스 클론

```bash
git clone https://github.com/2xteam/snapword.git
cd snapword
npm install
```

### 4-2. 환경 변수 파일 생성

프로젝트 루트에 `.env.local` 파일 생성:

```env
# MongoDB 연결 문자열
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/vocab?retryWrites=true&w=majority

# OpenAI API 키
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx

# 선택: 기본은 gpt-4o-mini
# OPENAI_MODEL=gpt-4o-mini
```

> `.env.local`은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다.

### 4-3. 개발 서버 실행

```bash
# HTTP
npm run dev

# HTTPS (로컬 인증서 자동 생성)
npm run dev:https
```

- 기본 주소: `http://localhost:3000`
- HTTPS: `https://localhost:3000` (브라우저에서 인증서 경고 허용 필요)

### 4-4. 빌드 확인

```bash
npm run build
npm run start
```

---

## 5. GitHub 저장소 설정

### 5-1. 저장소 구성

- **저장소**: `https://github.com/2xteam/snapword`
- **기본 브랜치**: `main`
- **배포 트리거**: `main` 브랜치에 push 시 자동 배포

### 5-2. Repository Secrets 등록

**Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret 이름 | 값 | 설명 |
|-------------|---|------|
| `DEPLOY_HOST` | `165.22.xxx.xxx` | Cloudways 서버 공인 IP |
| `DEPLOY_USER` | `master_xxxxxxxxxx` | Cloudways SSH 사용자명 |
| `DEPLOY_SSH_KEY` | (개인 키 전체 내용) | 배포용 SSH 개인 키 (PEM, 줄바꿈 포함) |
| `DEPLOY_PATH` | `/home/master/applications/xxxxxxx/public_html` | Cloudways 앱 경로 |
| `DEPLOY_PORT` | `22` | (선택) SSH 포트, 미설정 시 22 |

### 5-3. SSH 키 생성 (배포용)

PowerShell에서:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\cloudways_deploy -C "github-actions-deploy"
```

- 비밀번호: 빈 값 (Enter 두 번)
- **개인 키** (`cloudways_deploy`): GitHub Secret `DEPLOY_SSH_KEY`에 등록
- **공개 키** (`cloudways_deploy.pub`): Cloudways에 등록

공개 키 내용 확인:

```powershell
Get-Content $HOME\.ssh\cloudways_deploy.pub
```

---

## 6. Cloudways 서버 생성 및 설정

### 6-1. 서버 생성

1. Cloudways 대시보드 → **Launch** → **Add Server**
2. 서버 옵션:
   - **Application**: PHP (Node.js 앱이지만 Cloudways는 PHP 기반 서버를 제공)
   - **Cloud Provider**: DigitalOcean 등 선택
   - **Server Size**: 최소 1GB RAM 이상 권장
   - **Location**: 서울 또는 가까운 리전
3. **Launch Now** 클릭

### 6-2. Application Stack 변경 (필수)

1. **Application** → **Settings & Packages** → **ADVANCED** 탭
2. **Application Stack**을 **Nginx + Apache (Hybrid)**로 변경

> **중요**: 기본값 "Nginx Only"에서는 `.htaccess`가 작동하지 않습니다. 반드시 Hybrid로 변경해야 합니다.

### 6-3. Apache 모듈 활성화 (Cloudways 지원팀 요청)

Cloudways **라이브 챗**에서 다음을 요청합니다:

> "Please enable `mod_proxy` and `mod_proxy_http` Apache modules on my server."

- `mod_proxy`와 `mod_proxy_http`는 기본 비활성화 상태입니다.
- 이 모듈이 없으면 `.htaccess`의 `RewriteRule [P]` (프록시) 가 작동하지 않습니다.

### 6-4. SSH 공개 키 등록

1. Cloudways 대시보드 → **Server** → **SSH Keys**
2. **Add SSH Key** 클릭
3. 이름: `github-actions-deploy`
4. 공개 키 내용 붙여넣기 (`.pub` 파일 내용)
5. **Submit** 클릭

### 6-5. Nginx Upload Size 확인

1. **Server** → **Settings & Packages** → **ADVANCED**
2. **Upload Size** (= `client_max_body_size`): **20MB 이상**으로 설정
3. 파일 업로드(이미지 → OpenAI Vision) 시 502 에러 방지

---

## 7. Cloudways SSH 환경 구성

Cloudways SSH 접속 방법:

**방법 1: 웹 터미널 (브라우저)**

```
https://<서버IP>:4200/
```

브라우저에서 위 주소로 접속하면 Cloudways 웹 SSH 터미널을 사용할 수 있습니다.

**방법 2: SSH 클라이언트**

- **호스트**: 서버 공인 IP (대시보드에서 확인)
- **사용자**: `master_xxxxxxxxxx`
- **포트**: 22

```bash
ssh master_xxxxxxxxxx@<서버IP>
```

### 7-1. NVM & Node.js 22 설치

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

쉘 재시작 또는 수동 소스:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Node.js 22 설치:

```bash
nvm install 22
nvm alias default 22
node -v   # v22.x.x 확인
```

> **주의**: Node.js 20 미만에서는 `File` 클래스가 글로벌에 없어 이미지 업로드 시 `File is not defined` 에러가 발생합니다. **반드시 v20 이상(권장 v22)** 사용.

### 7-2. PM2 설치

```bash
npm install -g pm2
pm2 -v
```

### 7-3. .env 파일 생성

```bash
cd /home/master/applications/xxxxxxx/public_html
```

> `.env` 파일은 각 변수를 **반드시 별도의 줄**에 작성해야 합니다. 한 줄에 여러 변수가 들어가면 MongoDB 연결 오류가 발생합니다.

```bash
echo 'MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/vocab?retryWrites=true&w=majority' > .env
echo 'OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx' >> .env
```

확인:

```bash
cat .env
```

두 줄이 분리되어 출력되는지 반드시 확인합니다.

### 7-4. .htaccess 생성

```bash
cd /home/master/applications/xxxxxxx/public_html

# 기본 PHP 파일 제거
rm -f index.php

# .htaccess 생성
cat > .htaccess << 'EOF'
DirectoryIndex disabled
RewriteEngine On
RewriteBase /
RewriteRule ^(.*)?$ http://127.0.0.1:3000/$1 [P,L]
EOF
```

> 이 파일은 Apache가 모든 요청을 Node.js(포트 3000)로 프록시합니다.
>
> GitHub Actions 배포 시 `rsync --filter 'protect .htaccess'`로 이 파일이 삭제되지 않도록 보호됩니다.

### 7-5. 최초 수동 빌드 및 실행

```bash
cd /home/master/applications/xxxxxxx/public_html
npm ci --production=false
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 8. GitHub Actions 자동 배포

### 8-1. 워크플로 파일

`.github/workflows/deploy-cloudways.yml` — `main` 브랜치에 push하거나 수동 실행(workflow_dispatch) 시 동작합니다.

### 8-2. 배포 흐름

```
main 브랜치 push
  → GitHub Actions 실행
    → rsync로 소스 파일만 서버에 전송
      (제외: .git, .github, .cursor, .env, node_modules, .next)
      (보호: .env, .htaccess, node_modules/, .next/)
    → SSH로 서버 접속
      → npm ci --production=false
      → npm run build
      → pm2 reload snapword
      → pm2 save
```

### 8-3. rsync 옵션 설명

| 옵션 | 설명 |
|------|------|
| `-rlzv` | 재귀, 심링크, 압축, 상세 출력 (타임스탬프 제외) |
| `--delete` | 소스에 없는 파일은 서버에서 삭제 |
| `--omit-dir-times` | 디렉터리 타임스탬프 변경 안 함 (권한 에러 방지) |
| `--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r` | 적절한 파일 권한 강제 부여 |
| `--filter 'protect ...'` | `--delete`에서 보호할 서버 전용 파일/폴더 지정 |

### 8-4. 수동 배포 실행

GitHub → **Actions** 탭 → **Deploy to Cloudways** → **Run workflow** 클릭

---

## 9. 도메인 및 SSL 설정

### 9-1. 도메인 연결

1. Cloudways 대시보드 → **Application** → **Domain Management**
2. **Primary Domain**에 도메인 입력 (예: `snapword.myjane.co.kr`)
3. DNS 설정: 도메인의 **A 레코드**를 Cloudways 서버 IP로 지정

### 9-2. SSL 인증서 설치 (Let's Encrypt)

> **선행 조건**: HTTP로 사이트 접속이 되는 상태여야 합니다.

1. Cloudways 대시보드 → **Application** → **SSL Certificate**
2. **Let's Encrypt** 선택
3. 도메인 입력: `snapword.myjane.co.kr`
4. **Install Certificate** 클릭
5. 자동 갱신 활성화 체크

### 9-3. HTTPS 리다이렉션

1. **Application** → **Settings** → **General** 탭
2. **HTTPS Redirection** → 활성화
3. Varnish 캐시가 활성화되어 있다면 **Purge** 실행

---

## 10. 수동 배포 / 장애 대응

### 서버 SSH 접속 후 수동 빌드

```bash
ssh master_xxxxxxxxxx@165.22.xxx.xxx
cd /home/master/applications/xxxxxxx/public_html

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

npm ci --production=false
npm run build
pm2 reload snapword
```

### PM2 로그 확인

```bash
pm2 logs snapword --lines 50 --nostream
```

### PM2 상태 확인

```bash
pm2 status
```

### PM2 프로세스 재시작

```bash
pm2 reload snapword
# 또는 완전 재시작
pm2 delete snapword
pm2 start ecosystem.config.cjs
pm2 save
```

### .env 파일 확인/수정

```bash
cat .env
# 수정 시
nano .env
# 수정 후 반드시 PM2 재시작
pm2 reload snapword
```

---

## 11. 주요 설정 파일 요약

| 파일 | 설명 |
|------|------|
| `.env.local` | 로컬 개발용 환경 변수 (Git 제외) |
| `.env` (서버) | 운영 서버 환경 변수 (Git 제외, rsync 보호) |
| `.htaccess` (서버) | Apache → Node.js 프록시 설정 (Git 제외, rsync 보호) |
| `ecosystem.config.cjs` | PM2 프로세스 설정 |
| `next.config.ts` | Next.js 설정 (serverActions bodySizeLimit: 20mb) |
| `.github/workflows/deploy-cloudways.yml` | GitHub Actions 배포 워크플로 |
| `.gitignore` | Git 제외 파일 목록 (.env, node_modules, .next 등) |
| `lib/db.ts` | MongoDB 연결 (Mongoose, 연결 풀 캐싱) |
| `package.json` | 프로젝트 의존성 및 스크립트 |

### 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `MONGO_URI` | O | MongoDB 연결 문자열 |
| `OPENAI_API_KEY` | O | OpenAI API 키 (`sk-proj-...`) |
| `OPENAI_MODEL` | X | 사용할 모델 (기본: `gpt-4o-mini`) |

### npm 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 (HTTP) |
| `npm run dev:https` | 개발 서버 (HTTPS, 인증서 자동 생성) |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 실행 (포트 3000) |
| `npm run lint` | ESLint 검사 |

---

## 12. 트러블슈팅

### `File is not defined` (서버 이미지 업로드 502) — Node.js 22 필수

- **원인**: Node.js 18에서는 `File` 클래스가 글로벌 스코프에 존재하지 않음. `readMultipartImage.ts`의 `file instanceof File` 체크가 실패하면서 502 에러 발생
- **증상**: 이미지 업로드 시 브라우저 콘솔에 `File is not defined`, 서버 응답 `502 Bad Gateway`
- **해결**:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22
nvm alias default 22
node -v  # v22.x.x 확인
cd /home/master/applications/xxxxxxx/public_html
npm ci --production=false
npm run build
pm2 delete snapword
pm2 start ecosystem.config.cjs
pm2 save
```

> **주의**: `pm2 reload`만으로는 이전 Node.js 버전의 프로세스가 유지될 수 있습니다. `pm2 delete` → `pm2 start`로 새 프로세스를 시작해야 확실합니다.

### rsync error code 23 (`some files/attrs were not transferred`)

- **원인**: 디렉터리 타임스탬프 변경 권한 없음 (Nginx 소유 디렉터리)
- **해결**: rsync에 `--omit-dir-times` 옵션 및 `--chmod` 옵션 추가 (현재 워크플로에 반영됨)

### `.env` 파일 파싱 오류 (MongoDB `No write concern mode named 'majority OPENAI_API_KEY=...'`)

- **원인**: `.env` 파일에서 `MONGO_URI`와 `OPENAI_API_KEY`가 같은 줄에 있음
- **해결**: 각 변수를 별도의 줄에 작성. `echo` 명령으로 개별 추가

### Cloudways 기본 PHP 페이지만 표시됨

- **원인**: Application Stack이 "Nginx Only"로 설정되어 `.htaccess` 미작동
- **해결**: **Settings & Packages → ADVANCED → Application Stack → Nginx + Apache (Hybrid)** 변경

### `.htaccess` 프록시 미작동 (403/500)

- **원인**: `mod_proxy`, `mod_proxy_http` Apache 모듈 비활성화
- **해결**: Cloudways 라이브 챗에서 모듈 활성화 요청

### HTTPS "주의 요함" 경고

- **확인사항**:
  1. SSL Certificate가 정상 설치되었는지 확인
  2. HTTPS Redirection이 켜져 있는지 확인
  3. Varnish 캐시 Purge 실행
  4. 브라우저 캐시 삭제

### PM2 `command not found`

- **원인**: NVM이 소스되지 않아 npm/pm2 경로를 찾지 못함
- **해결**:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
pm2 -v
```

### 이미지 업로드 502 Bad Gateway

- **확인사항**:
  1. **Node.js 버전 22 이상인지 확인** (`node -v`) — 가장 흔한 원인
  2. Cloudways Nginx Upload Size가 20MB 이상인지 확인
  3. `next.config.ts`의 `bodySizeLimit`이 `"20mb"`인지 확인
  4. PM2 로그 확인: `pm2 logs snapword --lines 30 --nostream`

### 데이터 수정 후 이전 데이터가 계속 조회됨 (Varnish 캐시)

- **원인**: Cloudways의 **Varnish** 캐시 서버가 GET 응답을 캐싱하여 최신 데이터가 반영되지 않음
- **해결**:
  - **방법 1 (권장)**: Cloudways 대시보드 → **Server** → **Manage Services** → **Varnish** → **Disable**
  - **방법 2**: Varnish 유지 시, **Application** → **Settings** → **Varnish** 섹션에서 `/api/.*` 경로를 캐시 제외 추가
- **참고**: API 응답이 실시간으로 변경되는 앱에서는 Varnish 비활성화 권장
