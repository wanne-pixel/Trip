# REPORT — AgentC — 002

## 완료 상태: ✅ 완료

## 사진 업로드 E2E 테스트 결과
- **테스트 환경**:
  - 프론트엔드: http://localhost:3000 (Vite/Serve 기동 완료)
  - 백엔드: http://localhost:4000 (Express/TS-Node-Dev 기동 완료)
  - 데이터베이스: Supabase PostgreSQL 및 Storage 연동 완료
- **문제점 및 해결**:
  1. **Storage Bucket 에러**: `[PhotosRoute] Storage 업로드 실패: Bucket not found`
     - **원인**: Supabase Storage 내 `trip-photos` 버킷이 정의되어 있지 않았음.
     - **해결**: `backend/src/config/supabase.ts` 소스코드에 서버 구동 시 `trip-photos` 버킷을 자동으로 체크 및 생성하는 로직을 추가하여 문제 해결.
  2. **DB INSERT UUID 에러**: `[PhotosRoute] DB INSERT 실패: invalid input syntax for type uuid: ""`
     - **원인**: 사진 업로드 시 `trip_id` 값이 명시되지 않거나 비어있는 경우 백엔드에서 기본값 `""`(빈 문자열)을 DB에 저장하려고 시도했으나, Postgres의 UUID 외래키 제약조건 위반으로 인해 500 에러 발생.
     - **해결**: `backend/src/routes/photos.ts` 파일에서 빈 문자열 혹은 null일 경우 DB에 `null` 값을 전송하도록 분기 처리하여 해결.
- **최종 검증**:
  - 두 개 문제 해결 후 사진 업로드가 정상적으로 완료되었으며 프론트엔드 UI 및 백엔드 연동이 완료되었음을 검증함.
