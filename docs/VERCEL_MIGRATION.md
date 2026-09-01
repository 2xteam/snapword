# Cloudways → Vercel 이관 가이드

작성 2026-09-01. 대상 도메인 `snapword.myjane.co.kr`.

## 이관 전 현황

| 항목 | 값 |
|---|---|
| 호스팅 | Cloudways (Nginx + PM2, `ecosystem.config.cjs`) |
| 서버 IP | `165.22.247.25` |
| 배포 | GitHub Actions → SSH → `npm ci` + build + `pm2 reload` |
| 네임서버 | 가비아 (`ns.gabia.co.kr` 외) |
| DNS | `snapword.myjane.co.kr` A → `165.22.247.25` |
| DB | MongoDB Atlas |
| 외부 API | OpenAI (Vision / 텍스트 / 챗) |

> ⚠️ **apex `myjane.co.kr`도 같은 서버(같은 IP)를 가리키며 별도 앱이 동작 중이다.**
> 이관 대상은 `snapword` 서브도메인 뿐이며, apex DNS와 Cloudways 서버는 건드리지 않는다.

## 1. 코드 변경 (완료)

- **업로드 축소**: Vercel Functions는 요청 본문이 4.5MB를 넘으면 함수에 닿기 전에
  `FUNCTION_PAYLOAD_TOO_LARGE`로 잘린다. 휴대폰 사진은 쉽게 초과하므로
  `lib/clientImageResize.ts`에서 업로드 전 **긴 변 2000px / JPEG 품질 0.82**로 줄인다.
  EXIF 회전을 반영하고, 변환 이득이 없으면 원본을 그대로 쓴다.
  적용 위치: `app/(app)/vocab/[vocabId]/words/page.tsx`, `components/VocabWorkbench.tsx`.
  Vision 정확도는 2000px 이상에서 이득이 거의 없어 품질 손실 없이 업로드·토큰 비용이 줄어든다.
- **서버 상한 조정**: `lib/readMultipartImage.ts`의 8MB → 4MB (플랫폼 한도 아래로).
- **실행시간 명시**: `openai-vision` 120초 → **60초**(Hobby 상한). `analyze-text`,
  `chat/threads/[threadId]/messages`에 60초 추가. Pro 전환 후에는 늘려도 된다.
- **리전 고정**: `vercel.json`에 `"regions": ["icn1"]` (서울).
- **미사용 파일 제거**: `eng.traineddata`, `kor.traineddata` (7.4MB, 코드 참조 없음).
- **Cloudways 워크플로 중단**: `workflow_dispatch` 전용으로 변경(롤백 시 수동 실행).

### 변경하지 않은 것

- `next.config.ts`의 `experimental.serverActions.bodySizeLimit: "20mb"` —
  이 프로젝트에는 서버 액션이 없어 실제로 쓰이지 않는다. 남겨두더라도 Vercel에서는
  플랫폼 한도(4.5MB)가 우선하므로 이 값은 효력이 없다는 점만 기억할 것.
- `lib/db.ts` — 이미 전역 커넥션 캐시 + `bufferCommands: false`로 서버리스에 적합하다.

## 2. Vercel 프로젝트 설정

1. **Import**: Vercel → Add New → Project → `2xteam/snapword`
2. **Framework** Next.js 자동 감지, **Node.js Version 22.x**
   (v22 미만에서는 `File` 글로벌이 없어 이미지 업로드가 502로 실패한다)
3. **Environment Variables** — Production/Preview 모두 등록:

   ```
   MONGO_URI
   OPENAI_API_KEY
   OPENAI_MODEL                  # 선택, 기본 gpt-4o-mini
   NEXT_PUBLIC_COOKIE_DOMAIN     # .myjane.co.kr
   SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM
   ```

   `NEXT_PUBLIC_*`는 빌드 타임에 박히므로 값 변경 시 재배포가 필요하다.
   **SMTP 값은 현재 `.env`에 없다** — 비밀번호 찾기/문의 메일을 쓰려면 이번에 채워야 한다.
4. **Functions Region**: `vercel.json`으로 `icn1` 지정됨. 대시보드에서도 Seoul인지 확인.
5. **MongoDB Atlas** → Network Access에 `0.0.0.0/0` 추가.
   **Cloudways IP(`165.22.247.25`) 항목은 컷오버 완료 후 제거**한다(롤백 대비).

## 3. 검증 (도메인 연결 전, `*.vercel.app`에서)

- [ ] 회원가입 / 로그인 / PIN 재설정
- [ ] **이미지로 단어 추출**(OpenAI Vision) — 큰 사진(5MB 이상)으로 반드시 확인
- [ ] 텍스트 붙여넣기 분석, 챗
- [ ] 단어장 CRUD, 학습·테스트·점수, 인쇄
- [ ] 관리자 화면(통계·문의·공지), RSS 피드
- [ ] 문의/메일 발송 (SMTP 설정 후)

쿠키 도메인이 `.myjane.co.kr`이므로 `*.vercel.app`에서는 세션 쿠키의 domain 속성이
적용되지 않는다(코드가 호스트 불일치 시 domain을 생략하도록 처리되어 있다).
로그인 동작에 문제가 없어야 정상이다.

## 4. DNS 컷오버 (가비아)

`snapword` 서브도메인만 교체한다. **apex(`@`) 레코드는 절대 건드리지 않는다.**

**사전 준비**: 가비아 DNS 관리툴에서 `snapword` 레코드 TTL을 600초로 낮춘다.

**Vercel**: Project → Settings → Domains에 `snapword.myjane.co.kr` 추가.

**가비아 DNS 관리툴** — 값은 반드시 Vercel Domains 탭에 표시된 것을 사용한다:

| 호스트 | 타입 | 값 | 비고 |
|---|---|---|---|
| `snapword` | CNAME | Vercel이 안내하는 CNAME 호스트 | 기존 A 레코드(`165.22.247.25`) 삭제 |

서브도메인이므로 CNAME을 쓸 수 있다(A와 CNAME은 공존 불가 → 기존 A는 삭제).

**확인**:

```bash
nslookup -type=CNAME snapword.myjane.co.kr 8.8.8.8
curl -sSI https://snapword.myjane.co.kr/ | head -5   # Server 헤더가 nginx가 아니면 전환 완료
```

## 5. Cloudways 정리 (컷오버 1~2주 후)

**서버 자체는 apex 앱이 사용 중이므로 삭제하지 않는다.** SnapWord 앱만 정리한다.

- [ ] Cloudways → Application에서 SnapWord 앱 정지 → 이상 없으면 삭제
- [ ] Cloudways Domain Management에서 `snapword.myjane.co.kr` 매핑 제거
- [ ] MongoDB Atlas Network Access에서 Cloudways IP 제거
- [ ] GitHub Secrets `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PATH` 삭제
- [ ] `.github/workflows/deploy-cloudways.yml`, `ecosystem.config.cjs` 삭제 검토

## 롤백

가비아에서 `snapword` 레코드를 A → `165.22.247.25`로 되돌린다(TTL 600초면 10분 내).
Cloudways 앱이 살아 있어야 하므로 위 정리 작업은 충분히 관찰한 뒤 진행한다.

## 알려진 문제 (이관과 별개)

- **2026-09-01 시점 `snapword.myjane.co.kr`이 503**이었다. Cloudways nginx와 apex 앱은
  정상이었으므로 SnapWord PM2 프로세스만 죽은 상태로 보인다. 이관 후에는 해당하지 않지만,
  롤백 경로를 유지하려면 Cloudways 앱을 한 번 되살려 둘 필요가 있다
  (`pm2 restart snapword` 또는 Cloudways 대시보드).
- SMTP 환경 변수가 비어 있어 메일 발송 기능이 동작하지 않는 상태다.
