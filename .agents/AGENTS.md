# Trip Project — 프로젝트 공통 규칙 (Ground Rules)

> 이 파일은 Trip 프로젝트의 **모든 에이전트(프론트엔드, 백엔드 등)** 가 반드시 준수해야 하는 불변의 규칙입니다.
> 마스터 에이전트(PM)는 다른 에이전트에게 작업 지시서를 작성할 때, 이 규칙들이 반드시 반영되도록 강제합니다.

---

## Rule 1 — 유연한 데이터 스키마 (Flexible Schema)

- 모든 부가 정보(예산, 별점, 감정, 메모 등)는 **Supabase의 JSONB 컬럼** 또는 NoSQL 형태로 저장한다.
- 새로운 카테고리(테마)가 추가되어도 **DB 테이블 구조(DDL)를 절대 변경하지 않는다**.
- 프론트엔드는 `metadata` JSONB 필드를 동적으로 렌더링할 수 있는 구조로 설계한다.
- **위반 금지 사례**: `rating INT`, `budget FLOAT` 같은 고정 컬럼을 새로 추가하는 행위.

```jsonc
// 올바른 예시 — metadata JSONB 안에 모든 부가 정보를 담는다
{
  "id": "photo-uuid",
  "metadata": {
    "rating": 4.5,
    "budget": 35000,
    "emotion": "행복",
    "restaurant_name": "어머니 김밥"
  }
}
```

---

## Rule 2 — 실패에 대한 방어 로직 (Graceful Fallback)

- **EXIF 데이터 없음** → 즉시 `classified: false`, `taken_at: null`, `latitude: null` 반환. 앱을 멈추거나 에러를 throw하지 않는다.
- **Vision API 실패** → `vision_tags: null` 반환. 재시도 없이 그냥 null로 처리하며, 사용자에게는 "분석 불가" UI를 보여준다.
- 프론트엔드는 `classified: false`인 사진을 **"미분류 서랍(Unclassified Drawer)"** UI로 분기 처리해야 한다.
- 백엔드 API는 에러 발생 시 항상 `{ success: false, error: "..." }` 형태의 JSON을 반환하며, **절대 500 에러로 서버를 죽이지 않는다**.

```
사진 업로드 → EXIF 추출 성공? 
  ├── YES → classified: true → 타임라인 배치
  └── NO  → classified: false → 미분류 서랍 (앱은 계속 동작)
              └── Vision API 호출 → 성공? vision_tags 저장 / 실패? null 저장
```

---

## Rule 3 — API 계약 우선 (API Contract First)

- 프론트엔드(Agent A)와 백엔드(Agent B)에게 작업 지시를 내리기 **전에** 반드시 두 에이전트가 주고받을 **핵심 데이터 객체(JSON Contract)를 먼저 정의**하고 합의시킨다.
- 프론트엔드는 이 계약을 기반으로 **Mock 데이터로 선 개발**하고, 백엔드 완성 후 실제 API로 교체한다.
- 계약은 아래 `Photo Object` 스펙을 기준으로 한다.

### 핵심 데이터 계약: Photo Object

```typescript
interface Photo {
  id: string;                    // UUID
  trip_id: string;               // 소속 여행 ID
  storage_path: string;          // Supabase Storage URL
  original_filename: string;
  taken_at: string | null;       // ISO 8601, EXIF 없으면 null
  latitude: number | null;       // EXIF 없으면 null
  longitude: number | null;      // EXIF 없으면 null
  classified: boolean;           // false = 미분류 서랍행
  vision_tags: {
    time_of_day?: string;        // "morning" | "afternoon" | "night"
    environment?: string;        // "indoor" | "outdoor" | "urban" | ...
  } | null;                      // Vision API 실패 시 null
  metadata: Record<string, any>; // 테마별 부가 정보 (JSONB)
  created_at: string;            // ISO 8601
}

interface Trip {
  id: string;
  title: string;
  description: string | null;
  theme: string;                 // "travel" | "food" | "diary" | ...
  metadata: Record<string, any>; // 테마별 부가 정보 (JSONB)
  created_at: string;
}
```

### API 응답 표준 포맷

```typescript
// 성공
{ "success": true, "data": Photo | Photo[] | Trip }

// 실패 (서버 죽이지 않고 반드시 이 형태로 반환)
{ "success": false, "error": "설명 문자열" }
```

---

## 에이전트 역할 정의

| 에이전트 | 역할 | 주요 기술 |
|----------|------|-----------|
| **Master Agent (PM)** | 요구사항 분석, 태스크 분배, 아키텍처 수호 | — |
| **Agent A (Frontend)** | UI/UX 구현, Mock 데이터 연동, API 연결 | HTML/CSS/JS 또는 React |
| **Agent B (Backend)** | API 구현, DB 설계, EXIF/Vision 처리 | Node.js, Express, Supabase |

---

## 기술 스택 (확정)

| 레이어 | 기술 |
|--------|------|
| 데이터베이스 | Supabase (PostgreSQL + Storage) |
| EXIF 파싱 | `exifr` |
| Vision AI | OpenAI `gpt-4o-mini` |
| 백엔드 런타임 | Node.js 20 + TypeScript + Express |
| 환경 변수 | `dotenv` |

---

## Rule 4 — 상태 보고 및 현황판 업데이트 (Status Reporting)

- 모든 에이전트는 하나의 작업을 완료하면 **반드시** 다음을 수행한다:
  1. `.agents/reports/` 폴더 내에 해당 작업 ID의 보고서(예: `REPORT_AgentA_001.md`)를 양식에 맞춰 작성/생성한다.
  2. `.agents/status.md` (상태판 파일)를 직접 열어 본인의 최근 작업 상태와 진행 중인 To-Do 리스트 항목을 **최신 정보로 갱신(수정)**한다.
- 사용자가 에이전트에게 직접 지시를 내리더라도, 에이전트는 이 상태판(`status.md`) 업데이트 및 보고서 작성을 누락해선 안 된다.

---

## Rule 5 — 자동 작업 종료 및 보고 처리 (Auto-Completion & Reporting Command)

- 사용자가 **"끝"** 또는 **"끝났어"**라고 입력하는 경우, 에이전트 C(DevOps/Test Agent)는 대화 형태로 다른 말 없이 즉시 아래 작업을 조용히 처리해야 한다:
  1. 실행한 테스트 결과 및 서버 상태(서버 구동 여부, 포트 등) 요약.
  2. `.agents/reports/` 폴더 내에 해당 작업 번호에 맞는 완료 보고서 `REPORT_AgentC_[번호].md` 생성.
  3. `.agents/status.md` 파일을 열어 최근 작업 내용 및 To-Do 현황을 최신화.
  4. 모든 작업이 완료되면 사용자에게 **"상태판 및 보고서 업데이트가 완료되었습니다."**라는 메시지만 단독으로 응답한다.

---

*Last updated: 2026-07-07 by Master Agent*
