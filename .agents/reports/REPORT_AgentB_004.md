# REPORT_AgentB_004 — v2.4 기존 여행 사진 추가 API 및 Vision 태그 개편 보고서

- **작업 ID**: TASK_AgentB_004
- **담당 에이전트**: Agent B (Backend & Data)
- **작업 일시**: 2026-07-10
- **상태**: ✅ 완료
- **tsc --noEmit**: ✅ 에러 0개

---

## 1. 작업 요약

Vision API의 태그 체계를 실용적인 카테고리 단일 필드로 개편하고,
기존 여행에 다중 사진을 추가하는 전용 엔드포인트를 구현했습니다.

---

## 2. 변경된 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `backend/src/types/index.ts` | `VisionTags` 인터페이스 개편 |
| `backend/src/services/visionService.ts` | VISION_PROMPT 및 파싱 로직 개편 |
| `backend/src/routes/trips.ts` | `POST /api/trips/:id/photos` 신규 엔드포인트 추가 |
| `backend/src/index.ts` | 신규 엔드포인트 시작 로그 추가 |

---

## 3. 세부 변경 내용

### 3-1. VisionTags 인터페이스 개편 (`types/index.ts`)

**이전 (v2.3)**
```typescript
export interface VisionTags {
  time_of_day?: 'morning' | 'afternoon' | 'night';
  environment?: 'indoor' | 'outdoor' | 'urban' | 'nature';
}
```

**이후 (v2.4)**
```typescript
export interface VisionTags {
  category?: 'food' | 'scenery' | 'accommodation' | 'activity' | 'people' | 'other';
}
```

### 3-2. Vision 프롬프트 및 파싱 로직 개편 (`visionService.ts`)

- `VISION_PROMPT`: category 단일 필드 JSON 응답으로 변경
  - 각 카테고리별 한국어 설명 포함 (food, scenery, accommodation, activity, people, other)
- 파싱 로직: `time_of_day`, `environment` 파싱 코드 삭제 → `category` 파싱으로 교체
- `validCategories` 배열로 유효값 검증 후 할당

### 3-3. 기존 여행 다중 사진 추가 API (`routes/trips.ts`)

**엔드포인트**: `POST /api/trips/:id/photos`

**처리 흐름**:
```
req.params.id → trip_id 획득
req.files (multipart) → 최대 50장

Promise.allSettled:
  각 파일 → EXIF 추출 + Vision API(category) 호출 병렬 처리
  실패 시 FALLBACK {classified:false, vision:null} 대체 (Rule 2)

Promise.allSettled:
  각 파일 → Storage 업로드 → photos DB INSERT (trip_id 부여)
  일부 실패해도 다른 사진은 계속 저장 (Rule 2)

응답: { trip_id, photos[], summary { total, succeeded, failed, classified, unclassified } }
```

**from-photos와의 차이점**:
- 여행 제목/테마 AI 생성 없음
- 날짜 범위 description 계산 없음
- 순수 사진 처리(EXIF+Vision+Storage+DB)만 수행

### 3-4. 부수 수정

- `from-photos` 메타데이터 요약 생성 코드에서 `vision?.time_of_day`, `vision?.environment` → `vision?.category` 교체

---

## 4. API 응답 표준 예시

```json
{
  "success": true,
  "data": {
    "trip_id": "uuid-...",
    "photos": [ /* Photo[] */ ],
    "summary": {
      "total": 5,
      "succeeded": 5,
      "failed": 0,
      "classified": 4,
      "unclassified": 1
    }
  }
}
```

---

## 5. 에러 핸들링 (Rule 2 준수)

| 상황 | 처리 방식 |
|---|---|
| EXIF 추출 실패 | `classified: false` FALLBACK, 앱 중단 없음 |
| Vision API 실패 | `vision_tags: null` FALLBACK, 앱 중단 없음 |
| Storage 업로드 실패 | 해당 사진만 실패 처리, 나머지 계속 저장 |
| DB INSERT 실패 | 해당 사진만 실패 처리, `summary.failed` 카운트 |

---

*보고서 작성: Agent B (Backend & Data) — 2026-07-10*
