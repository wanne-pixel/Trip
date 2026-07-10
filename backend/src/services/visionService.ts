import OpenAI from 'openai';
import type { VisionTags } from '../types/index';

let openaiClient: OpenAI | null = null;

/**
 * OpenAI 클라이언트를 지연 초기화합니다.
 * API 키가 없을 경우 null을 반환하여 앱 전체가 멈추지 않도록 합니다 (Rule 2).
 */
function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[VisionService] OPENAI_API_KEY 환경변수가 설정되지 않았습니다. Vision 분석을 건너뜁니다.');
    return null;
  }

  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// v2.4: category 단일 필드로 개편 — 실용적인 6개 카테고리
const VISION_PROMPT = `이 사진을 보고 JSON으로만 답하세요. 다른 텍스트는 일절 포함하지 마세요.
형식: {"category":"food"|"scenery"|"accommodation"|"activity"|"people"|"other"}
• food: 음식, 식당, 커피, 요리
• scenery: 풍경, 자연, 건축물 외관, 다리, 한옥 등 연경
• accommodation: 호텔, 숙소, 방, 로비 등 숙소 내부
• activity: 스포츠, 액티비티, 어트랙션, 투어
• people: 인물 사진, 단체사진, 셀피
• other: 위에 해당하지 않는 등`;

/**
 * Rule 2 — Graceful Fallback
 * OpenAI Vision API로 사진의 카테고리 태그를 추출합니다. (v2.4 개편)
 * food | scenery | accommodation | activity | people | other
 * API 호출 실패, JSON 파싱 실패 등 모든 에러에서 null을 반환하며
 * 절대 예외를 throw하지 않습니다.
 *
 * @param imageBase64 - 이미지의 base64 인코딩 문자열 (data URL 접두사 제외)
 * @param mimeType    - 이미지 MIME 타입 (기본값: image/jpeg)
 * @returns VisionTags | null — API 실패 시 null 반환
 */
export async function extractVisionTags(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<VisionTags | null> {
  const client = getOpenAIClient();

  if (!client) {
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'low', // 비용 절감을 위해 low 해상도 사용
              },
            },
            {
              type: 'text',
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[VisionService] Vision API 응답 내용 없음 → null 반환');
      return null;
    }

    // JSON 블록이 코드 펜스로 감싸진 경우 처리
    const jsonStr = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr) as Record<string, string>;

    const tags: VisionTags = {};

    // v2.4: category 단일 필드 파싱
    const validCategories = ['food', 'scenery', 'accommodation', 'activity', 'people', 'other'];
    if (validCategories.includes(parsed.category)) {
      tags.category = parsed.category as VisionTags['category'];
    }

    return tags;
  } catch (err) {
    // Rule 2: 재시도 없음, 절대 throw하지 않음
    console.warn('[VisionService] Vision API 호출 실패 → null 반환:', (err as Error).message);
    return null;
  }
}
