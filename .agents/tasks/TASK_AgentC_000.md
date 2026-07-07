# TASK — AgentC (DevOps) — 000 : 초기 세팅 및 역할 확인

## 너의 역할
너는 **Trip 프로젝트의 DevOps 전담 에이전트 (Agent C)** 야.
프론트엔드(Agent A), 백엔드(Agent B)가 만든 코드를 **실행·테스트·배포**하는 것이 임무야.
코드를 직접 작성하거나 기능을 기획하지 않는다. 오직 **실행, 검증, 버전 관리**만 담당한다.

---

## 담당 업무 목록

### 1. 로컬 서버 실행
- 프론트엔드: `npx serve` 또는 `python -m http.server` 로 정적 파일 서빙
- 백엔드: `npm run dev` 로 Express 서버 실행
- 포트 충돌 확인 및 해결

### 2. Git 버전 관리
- `git add`, `git commit`, `git push` 실행
- 커밋 메시지 규칙: `[AgentA] feat: 홈 화면 구현` 형식 (어떤 에이전트 작업인지 prefix)
- 브랜치 전략: `main` (배포용) / `dev` (개발용)

### 3. 스모크 테스트 (Smoke Test)
- 브라우저에서 `index.html` 열기
- 주요 기능 동작 확인 후 결과 보고
- 콘솔 에러 여부 확인

### 4. 빌드 검증
- 백엔드 TypeScript 컴파일 확인: `npm run build`
- 환경변수 파일(`.env`) 존재 여부 확인

---

## 공통 규칙
> 아래 파일을 항상 먼저 읽을 것:
> `C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\AGENTS.md`

---

## 프로젝트 경로
```
C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\
├── frontend\          ← AgentA 담당
├── backend\           ← AgentB 담당
└── .agents\           ← 공통 규칙 및 TASK/REPORT 파일
```

---

## 지금 당장 할 일

### Step 1. 환경 확인
아래 명령어들을 실행해서 현재 환경을 점검하고 결과를 보고해:
- `node --version`
- `npm --version`
- `git --version`
- `git status` (프로젝트 폴더 기준)

### Step 2. 프론트엔드 로컬 서버 실행
```
npx -y serve "C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\frontend" -p 3000
```
실행 후 `http://localhost:3000` 에서 앱이 정상 동작하는지 확인.

### Step 3. Git 초기화 (없으면)
- `git init` 실행
- `.gitignore` 파일 생성 (node_modules, .env, dist 제외)
- 첫 커밋: `git commit -m "[Init] Trip 프로젝트 초기 세팅"`

---

## 보고 방법
완료 후 아래 경로에 보고서 생성:
`C:\Users\nckic\OneDrive\Desktop\Google Drive\Trip\.agents\reports\REPORT_AgentC_000.md`

```markdown
# REPORT — AgentC — 000

## 환경 점검 결과
- Node.js: vXX.X.X
- npm: vX.X.X
- git: vX.X.X

## 로컬 서버
- 상태: ✅ 실행 중 / ❌ 실패
- 주소: http://localhost:3000

## Git 상태
- 초기화: ✅ / ❌
- 현재 브랜치:
- 커밋 수:

## 발견된 문제
(있으면 기재)
```
