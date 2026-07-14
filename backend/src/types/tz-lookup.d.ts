// tz-lookup 라이브러리 타입 선언 (공식 @types 없음)
declare module 'tz-lookup' {
  /** 위도/경도로 IANA 타임존 이름을 반환 (예: "Asia/Seoul", "Europe/Paris") */
  function tzlookup(latitude: number, longitude: number): string;
  export = tzlookup;
}
