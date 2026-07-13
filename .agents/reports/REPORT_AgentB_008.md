# [REPORT] 백엔드 사진 업로드 동시성 제어 및 한도 상향 (TASK_AgentB_008)

## 1. 작업 개요
- **작업자**: Agent B (Backend)
- **작업일시**: 2026-07-13
- **주요 목표**: 대량 업로드 시 백엔드 과부하를 막기 위한 Concurrency Control(동시성 제어) 구현 및 Multer 업로드 한도를 200장으로 상향.

## 2. 주요 변경 사항
- **`backend/src/routes/trips.ts` 수정**
  - **업로드 한도 변경**: `uploadMulti` 설정 및 라우트 선언(`POST /from-photos`, `POST /:id/photos`)에서 `maxCount`를 기존 50에서 200으로 상향 조정.
  - **동시성 제어 적용**:
    - EXIF 및 Vision API 메타데이터 추출 시 기존 `Promise.allSettled(files.map(...))` 구조를 5개 단위의 Chunk로 분할(Batch size = 5)하여 순차적으로 병렬 처리되도록 수정 (`CONCURRENCY_LIMIT = 5`).
    - Supabase Storage 업로드 및 DB `photos` 테이블 INSERT 과정에서도 5개 단위로 Chunk를 나누어 순차 병렬 처리되도록 수정 (`UPLOAD_CONCURRENCY_LIMIT = 5`).
    - 처리 로직은 모두 기존의 Fallback(일부 실패해도 전체 여행 생성/추가를 중단하지 않음)을 그대로 유지함 (`Promise.allSettled` 사용).

## 3. 남은 작업 및 특이사항
- 프론트엔드에서는 이미 Chunk 전송이 구현되어 있으며(`TASK_AgentA_019`), 백엔드의 200장 수용 상향 및 배치 처리로 더 안정적인 대량 처리가 가능해짐.
