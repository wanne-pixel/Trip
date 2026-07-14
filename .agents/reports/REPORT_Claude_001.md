# REPORT_Claude_001 — v3.8 품질 개선 5종

*작성: 2026-07-14 by Claude (Cowork)*

## 📝 status.md To-Do 추가용 한 줄 (반영 완료)

```
- [x] v3.8 - 품질 개선 5종: EXIF 타임존 GPS 기반 자동 판별(해외 사진 현지 시각 표시), photo_count 쿼리 최적화, 업로드 로직 공통 헬퍼 통합, 사진 목록 limit/offset 페이지네이션, 문서·임시파일 정리 (Claude)
```

---

## 변경 상세

### 1. EXIF 타임존 자동 판별 (핵심)
**문제**: `exifService.ts`가 모든 사진에 `+09:00`(KST)을 강제 → 해외 여행 사진의 Day 분리·시각 표시가 KST 이외 환경에서 왜곡.

**변경 파일**:
- `backend/src/services/exifService.ts` — 전면 개편. 오프셋 결정 우선순위:
  1. EXIF `OffsetTimeOriginal` (카메라 기록값)
  2. GPS 좌표 → `tz-lookup`(신규 의존성, 0-dep)으로 IANA 존 추정 → Node 내장 `Intl` longOffset으로 DST 포함 정확한 오프셋 계산 (`offsetForZone()`)
  3. 폴백: `+09:00` (기존 동작 유지)
  - 반환값에 `taken_at_local`(촬영지 벽시계 시각), `tz_offset` 추가
- `backend/src/types/index.ts` — `ExifResult`에 optional `taken_at_local`, `tz_offset` 추가 (기존 계약 유지, Rule 3)
- `backend/src/types/tz-lookup.d.ts` — 신규 타입 선언
- `backend/src/routes/photos.ts` (upload), `trips.ts` (공통 헬퍼) — `taken_at_local`/`tz_offset`을 **photos.metadata JSONB에 저장** (Rule 1: DDL 변경 없음)
- `frontend/app.js` — `photoLocalDate(p)` 헬퍼 신설: `metadata.taken_at_local` 우선, 없으면 `taken_at` 폴백(구버전 사진 100% 호환). 적용 위치: Day 분리(renderTimeline), 타임라인 카드 시각, 지도 팝업 timeStr. 정렬은 절대시각(`taken_at`) 유지.

**검증**: 서울 +09:00 / 파리 여름 +02:00·겨울 +01:00 / NYC -04:00 / 런던 +00:00 정확히 산출 확인.

### 2. photo_count 쿼리 최적화
- `trips.ts` `GET /api/trips`: `photos(id)` 전체 로드 → `photos(count)` 집계로 변경 (`t.photos?.[0]?.count ?? 0`). 응답 계약 동일(metadata.photo_count).

### 3. 업로드 로직 중복 제거
- `trips.ts`: `from-photos`와 `POST /:id/photos`에 복붙돼 있던 ~150줄×2를 공통 헬퍼 2개로 통합:
  - `extractPhotoMeta(files, exifChunks)` — EXIF+Vision 병렬 추출 (3개 단위 배치, allSettled, Rule 2)
  - `uploadAndInsertPhotos(tripId, processedFiles)` — Storage 업로드 + INSERT (3개 단위 배치, allSettled, Rule 2)
- 두 라우트의 응답 형태(`{ trip/trip_id, photos, summary }`)는 그대로 유지 (Rule 3).

### 4. 사진 목록 페이지네이션
- `photos.ts` `GET /api/photos`: 선택적 `limit`/`offset` 쿼리 파라미터 추가. `limit` 미지정 시 기존과 완전히 동일하게 전체 반환 → 기존 프론트 호출 무변경 호환.

### 5. 문서 동기화 및 정리
- `SUPABASE_SCHEMA.sql`: vision_tags 주석을 구버전(time_of_day/environment)에서 v2.4 category 스키마로 정정
- `status.md`: 동시성 "5장 단위" → 실제 코드값 "3장 단위"로 정정 (2곳)
- 루트 임시 파일 `app_old.js`, `temp.js`, `temp2.txt`, `initapp_history.txt` → `_archive/`로 이동
- `backend/package.json`: `tz-lookup ^6.1.25` 추가 (설치 완료)

## 검증
- `npx tsc --noEmit` 통과 (BUILD_OK)
- 타임존 산출 5개 도시 케이스 검증 통과
- 기존 API 계약(Photo/Trip 객체 형태, ApiResponse 포맷) 변경 없음

## 이후 서버 실행 시 참고
- 새 의존성 설치됨: 다른 PC에서 pull 시 `cd backend && npm install` 필요
