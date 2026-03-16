# Railway Deployment Guide — AI-Factory Apps

이 문서는 AI-Factory 오케스트레이터가 Next.js 앱을 Railway에 배포할 때 반복되는 실패를 방지하기 위한 규칙입니다.

---

## 1. Dockerfile 필수 규칙

### Next.js standalone 모노레포 문제
Next.js `output: "standalone"` 빌드 시, 프로젝트가 monorepo 하위에 있으면 standalone 출력이 **전체 경로를 유지**합니다:
```
.next/standalone/apps/orchestrator/.work/my-app/server.js  ← 여기에 생김
.next/standalone/server.js  ← 여기에 안 생김
```

**반드시 `find`로 server.js 위치를 찾아 복사해야 함:**
```dockerfile
COPY --from=builder /app/.next/standalone /tmp/standalone
RUN SERVERJS=$(find /tmp/standalone -name "server.js" -not -path "*/node_modules/*" | head -1) && \
    SERVERDIR=$(dirname "$SERVERJS") && \
    cp -r "$SERVERDIR"/. /app/ && \
    rm -rf /tmp/standalone
```

### public/ 디렉토리
- Git에 `public/` 폴더가 없으면 `COPY --from=builder /app/public ./public`이 **실패**함
- 빌더 스테이지에서 `RUN mkdir -p public` 필수
- 또는 `public/.gitkeep` 파일을 git에 커밋

### .next/static 별도 복사
standalone 출력에 `.next/static`이 포함되지 않음. 반드시 별도 복사:
```dockerfile
COPY --from=builder /app/.next/static /app/.next/static
```

### 참조용 Dockerfile 템플릿
```dockerfile
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-workspace

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone /tmp/standalone
RUN SERVERJS=$(find /tmp/standalone -name "server.js" -not -path "*/node_modules/*" | head -1) && \
    SERVERDIR=$(dirname "$SERVERJS") && \
    mkdir -p /app && cp -r "$SERVERDIR"/. /app/ && rm -rf /tmp/standalone
COPY --from=builder /app/.next/static /app/.next/static
WORKDIR /app
RUN mkdir -p /app/uploads /tmp/uploads
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

---

## 2. next.config.ts 필수 설정

```typescript
const nextConfig: NextConfig = {
  output: "standalone",           // Railway Docker 빌드 필수
  serverExternalPackages: ["sharp"], // sharp 네이티브 모듈 번들링 제외
};
```

---

## 3. 파일 업로드 / 스토리지

### Vercel vs Railway 차이
| | Vercel | Railway |
|---|---|---|
| 요청 크기 제한 | **4.5MB** (serverless) | **없음** (컨테이너) |
| /tmp | 함수 실행 중만 유지 | 컨테이너 재시작 시 삭제 |
| 파일 서빙 | public/ 자동 서빙 | API route로 직접 서빙 필요 |
| sharp | 자주 실패 | 정상 동작 |

### 클라이언트 이미지 압축 (Vercel 호환 유지 시)
Vercel에도 배포할 가능성이 있으면 클라이언트에서 압축 필수:
- `createImageBitmap` + `OffscreenCanvas` 사용 (HEIC 지원)
- `<img>` + `<canvas>` 폴백
- 타겟 3MB 이하, JPEG 품질 점진 하락 (0.8 → 0.2)

### 파일 서빙 API route
Railway에서는 `/tmp/uploads/` 파일을 Next.js가 자동 서빙하지 않음. 반드시 catch-all route 필요:
```
src/app/uploads/[...path]/route.ts
```
`resolveFilePath()`로 파일 찾아서 `readFile` → `NextResponse`로 반환.

### UPLOAD_DIR 환경변수
Railway Volume 마운트 시 `UPLOAD_DIR=/app/uploads`로 설정. storage.ts에서 이 값을 우선 사용.

---

## 4. 모바일 파일 업로드 주의사항

### file.type이 빈 문자열
모바일 브라우저(특히 iOS)에서 HEIC 파일의 `file.type`이 빈 문자열로 올 수 있음.
- 서버/클라이언트 모두 **파일 확장자 폴백 체크** 필수
- `<input accept="image/*">` 사용 (구체적 MIME 나열 금지)

### sharp 동적 import
sharp가 없는 환경에서도 동작하도록 dynamic import + fallback:
```typescript
try {
  const sharp = (await import("sharp")).default;
  // process...
} catch {
  // save original without processing
}
```

---

## 5. railway.toml

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- healthcheckTimeout: **최소 60초** (Next.js 초기 시작 + DB 스키마 마이그레이션 시간)
- healthcheckPath: 앱 루트 `/` 또는 `/api/health`

---

## 6. 환경변수

Railway 서비스 Variables에 설정:
- `UPLOAD_DIR=/app/uploads` — 파일 저장 경로
- `NODE_ENV=production` — Dockerfile에서 설정하지만 명시적으로도 추가
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — DB
- `OPENAI_API_KEY` — AI 기능
- 기타 앱별 환경변수

---

## 7. .dockerignore 필수 항목

```
node_modules
.next
.git
.gitignore
.env.local
.env
*.db
*.db-shm
*.db-wal
*.db-journal
.vercel
.claude
README.md
src/__tests__
```

---

## 8. 흔한 빌드/배포 실패와 해결

| 에러 | 원인 | 해결 |
|---|---|---|
| `COPY /app/public not found` | public/ 디렉토리 없음 | builder에서 `mkdir -p public` |
| `Healthcheck failed` | server.js 위치 불일치 | `find`로 server.js 찾아 복사 |
| `FUNCTION_PAYLOAD_TOO_LARGE` | Vercel 4.5MB 제한 | 클라이언트 이미지 압축 |
| `sharp module not found` | 네이티브 바이너리 불일치 | `serverExternalPackages: ["sharp"]` |
| 사진 안 보임 | /tmp 파일 서빙 안 됨 | `/uploads/[...path]/route.ts` API |
| `UNIQUE constraint` 사진 | orderIndex 충돌 | 서버에서 자동 배정 |
| 모바일 파일 업로드 실패 | file.type 빈 문자열 | 확장자 폴백 + `accept="image/*"` |
