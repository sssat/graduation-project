// frontend/src/mocks/keywordMockData.ts

/** HomePage / KeywordDetailPage에서 사용하는 키워드 목업 데이터 모음
 *  - HomePage: Top 10 키워드 목록(getTopKeywords)
 *  - KeywordDetailPage: 키워드 상세 분석(getKeywordDetailMock)
 */

export type TopKeywordItem = {
  rank: number;
  label: string;
  count: number;
};

export type WordItem = { text: string; size: 1 | 2 | 3 };
export type BiasItem = { label: string; value: number };

export type KeywordPeriod = "today" | "7d";
export type MediaKey =
  | "all"
  | "chosun"
  | "joongang"
  | "hani"
  | "kbs"
  | "mbc"
  | "sbs"
  | "jtbc"
  | "ytn"
  | "yonhap"
  | "hankyung";

// (선택) UI에서 재사용하려고 라벨 맵도 같이 두면 편함
export const MEDIA_LABEL_MAP: Record<MediaKey, string> = {
  all: "전체 언론사",
  chosun: "조선일보",
  joongang: "중앙일보",
  hani: "한겨레",
  kbs: "KBS",
  mbc: "MBC",
  sbs: "SBS",
  jtbc: "JTBC",
  ytn: "YTN",
  yonhap: "연합뉴스",
  hankyung: "한국경제",
};

export type Sentiment = {
  positive: number; // %
  neutral: number; // %
  negative: number; // %
};

export type KeywordDetailMock = {
  keyword: string;

  /* KeywordDetailPage 상단 메타 */
  rangeLabel: string; // "2025-12-10" 또는 "2025-12-04 ~ 2025-12-10"
  articleCount: number; // 기간/언론사 필터에 따른 기사 수
  mediaCount: number; // all=10, 특정 언론사=1

  /* KeywordDetailPage 본문 데이터 */
  summary: string;
  titleWordCloud: WordItem[];
  sentiment: Sentiment;
  biasItems: BiasItem[];
  entities: string[];
  reactionWordCloud: WordItem[];
};

/* ---------------------------------------------
 * HomePage: Top 10 키워드
 * --------------------------------------------*/

const TOP_KEYWORDS: TopKeywordItem[] = [
  { rank: 1, label: "쿠팡", count: 104 },
  { rank: 2, label: "문재인", count: 94 },
  { rank: 3, label: "윤석열", count: 87 },
  { rank: 4, label: "데이터", count: 65 },
  { rank: 5, label: "개인정보 유출", count: 54 },
  { rank: 6, label: "AI", count: 49 },
  { rank: 7, label: "반도체", count: 46 },
  { rank: 8, label: "금리", count: 39 },
  { rank: 9, label: "부동산", count: 33 },
  { rank: 10, label: "우크라이나", count: 27 },
];

export function getTopKeywords(): TopKeywordItem[] {
  // UI에서 안전하게 쓰도록 복사본 반환
  return TOP_KEYWORDS.map((k) => ({ ...k }));
}

/* ---------------------------------------------
 * KeywordDetailPage: 키워드 상세 목업
 *  - period: today / 7d
 *  - media: all / chosun / joongang / hani / kbs
 * --------------------------------------------*/

const DEFAULT_MEDIA_COUNT_ALL = 10;

/** 안전 디코드: 잘못된 percent-encoding이 들어와도 UI가 죽지 않도록 */
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 내부 키: 공백/대소문자/인코딩 차이를 최소화 */
function normalizeKey(keyword: string) {
  return safeDecode(keyword).trim().toLowerCase();
}

/** 감성 값이 100이 아니더라도 안정적으로 맞춰주기 */
function normalizeSentiment(s: Sentiment): Sentiment {
  const p = Math.max(0, Math.round(s.positive));
  const n = Math.max(0, Math.round(s.neutral));
  const g = Math.max(0, Math.round(s.negative));
  const sum = p + n + g;

  if (sum === 100) return { positive: p, neutral: n, negative: g };
  if (sum === 0) return { positive: 0, neutral: 0, negative: 100 };

  // 합계 100 보정: 부정에 잔여분 반영
  const scaledP = Math.round((p / sum) * 100);
  const scaledN = Math.round((n / sum) * 100);
  const scaledG = 100 - scaledP - scaledN;

  return { positive: scaledP, neutral: scaledN, negative: scaledG };
}

type PeriodSnapshot = {
  rangeLabel: string;
  articleCountTotal: number;

  summary: string;
  titleWordCloud: WordItem[];
  sentimentAll: Sentiment;

  biasItems: BiasItem[];
  entities: string[];
  reactionWordCloud: WordItem[];

  /** 언론사 필터 선택 시 일부 값만 다르게 보여주고 싶을 때 사용 */
  perMedia?: Partial<
    Record<
      Exclude<MediaKey, "all">,
      Partial<{
        articleCount: number;
        summary: string;
        titleWordCloud: WordItem[];
        sentiment: Sentiment;
      }>
    >
  >;
};

type KeywordMockRecord = {
  keyword: string;
  periods: Record<KeywordPeriod, PeriodSnapshot>;
};

const KEYWORD_MOCKS: KeywordMockRecord[] = [
  {
    keyword: "쿠팡",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 104,
        summary:
          "쿠팡 관련 기사는 총 104건으로 어제보다 노출량이 증가했습니다. 배송·이커머스 이슈가 전체의 절반 이상을 차지하며, 고용·노동과 관련된 부정 기사 비중도 높게 나타납니다. 언론사별로는 경제지에서 긍정적인 톤의 기사 비율이 상대적으로 높고, 일부 방송사는 노동 환경과 관련된 비판적 보도를 중심으로 다루고 있습니다.",
        titleWordCloud: [
          { text: "로켓배송", size: 1 },
          { text: "상장", size: 2 },
          { text: "물류센터", size: 2 },
          { text: "노동환경", size: 3 },
          { text: "할인", size: 1 },
          { text: "식품", size: 3 },
          { text: "파트너사", size: 2 },
          { text: "투자", size: 3 },
          { text: "정규직", size: 3 },
          { text: "배송지연", size: 2 },
          { text: "수수료", size: 2 },
          { text: "쿠팡플레이", size: 2 },
          { text: "멤버십", size: 1 },
          { text: "반품", size: 2 },
          { text: "고객만족", size: 1 },
          { text: "규제", size: 3 },
        ],
        sentimentAll: { positive: 32, neutral: 20, negative: 48 },
        biasItems: [
          { label: "전체", value: 2 },
          { label: "조선", value: 8 },
          { label: "중앙", value: 5 },
          { label: "한겨레", value: -6 },
          { label: "KBS", value: -2 },
          { label: "MBC", value: -4 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: 2 },
          { label: "YTN", value: -3 },
          { label: "연합", value: 0 },
          { label: "한경", value: 4 },
        ],
        entities: [
          "쿠팡",
          "대표이사",
          "노동조합",
          "파트너사",
          "소비자",
          "공정위",
          "물류센터",
        ],
        reactionWordCloud: [
          { text: "배송 빠름", size: 1 },
          { text: "가격 경쟁력", size: 2 },
          { text: "노동 이슈", size: 3 },
          { text: "쿠팡플레이", size: 2 },
          { text: "환불 편리", size: 3 },
          { text: "지역 격차", size: 3 },
          { text: "포장 과다", size: 2 },
          { text: "품질 편차", size: 2 },
          { text: "재고 부족", size: 1 },
          { text: "고객센터", size: 2 },
          { text: "혜택 만족", size: 1 },
          { text: "구독 부담", size: 3 },
        ],
        perMedia: {
          chosun: {
            articleCount: 18,
            sentiment: { positive: 42, neutral: 22, negative: 36 },
            summary:
              "조선일보 기준으로는 유통 경쟁·투자 및 시장 반응 중심의 보도가 상대적으로 많으며, 전반 톤이 완만하게 긍정 쪽으로 치우친 편입니다.",
          },
          hani: {
            articleCount: 16,
            sentiment: { positive: 18, neutral: 24, negative: 58 },
            summary:
              "한겨레 기준으로는 노동 환경·고용 이슈가 비중을 크게 차지하며, 비판적 관점의 제목/서술이 많아 부정 비율이 상대적으로 높습니다.",
          },
          kbs: {
            articleCount: 14,
            sentiment: { positive: 26, neutral: 26, negative: 48 },
            summary:
              "KBS 기준으로는 정책/사회 이슈 맥락에서 다루는 비중이 있으며, 톤은 중립~부정 사이로 분포합니다.",
          },
        },
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 612,
        summary:
          "최근 7일간 쿠팡 관련 보도는 총 612건으로 꾸준히 높은 관심을 유지했습니다. 할인·배송 경쟁과 함께 물류/노동 이슈가 반복적으로 등장했고, 규제·공정 이슈도 간헐적으로 확대되었습니다.",
        titleWordCloud: [
          { text: "로켓배송", size: 1 },
          { text: "블랙프라이데이", size: 2 },
          { text: "물류", size: 2 },
          { text: "노동", size: 2 },
          { text: "공정위", size: 3 },
          { text: "배송지연", size: 3 },
          { text: "파트너", size: 3 },
          { text: "수수료", size: 3 },
          { text: "쿠팡플레이", size: 3 },
          { text: "멤버십", size: 2 },
          { text: "환불", size: 2 },
          { text: "정책", size: 1 },
          { text: "시장점유", size: 2 },
          { text: "가격경쟁", size: 2 },
          { text: "노조", size: 3 },
          { text: "규제논쟁", size: 3 },
        ],
        sentimentAll: { positive: 30, neutral: 24, negative: 46 },
        biasItems: [
          { label: "전체", value: 1 },
          { label: "조선", value: 6 },
          { label: "중앙", value: 3 },
          { label: "한겨레", value: -5 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -3 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: 1 },
          { label: "YTN", value: -2 },
          { label: "연합", value: 0 },
          { label: "한경", value: 3 },
        ],
        entities: ["쿠팡", "노동부", "공정위", "소상공인", "택배기사", "물류센터", "소비자"],
        reactionWordCloud: [
          { text: "가격", size: 1 },
          { text: "배송", size: 1 },
          { text: "노동", size: 2 },
          { text: "환불", size: 3 },
          { text: "수수료", size: 3 },
          { text: "편리", size: 2 },
          { text: "할인 체감", size: 2 },
          { text: "배송 품질", size: 2 },
          { text: "불만 증가", size: 3 },
          { text: "서비스 개선", size: 1 },
          { text: "규제 필요", size: 3 },
          { text: "시장 과점", size: 2 },
        ],
      },
    },
  },

  {
    keyword: "문재인",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 94,
        summary:
          "문재인 관련 보도는 94건으로, 평가·회고성 기사와 현재 정치 이슈와의 연결 보도가 혼재합니다. 특정 사안에 대해 찬반 프레임이 강하게 형성되며 언론사 간 톤 차이가 비교적 뚜렷합니다.",
        titleWordCloud: [
          { text: "회고", size: 2 },
          { text: "정치", size: 1 },
          { text: "논란", size: 2 },
          { text: "발언", size: 3 },
          { text: "정책", size: 3 },
          { text: "검찰", size: 2 },
          { text: "청와대", size: 3 },
          { text: "지지층", size: 3 },
          { text: "평가", size: 2 },
          { text: "국회", size: 2 },
          { text: "여야", size: 2 },
          { text: "외교", size: 1 },
          { text: "경제", size: 1 },
          { text: "공방", size: 3 },
          { text: "프레임", size: 3 },
          { text: "쟁점", size: 2 },
        ],
        sentimentAll: { positive: 22, neutral: 28, negative: 50 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: -7 },
          { label: "중앙", value: -4 },
          { label: "한겨레", value: 6 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 3 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: 2 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: -2 },
        ],
        entities: ["문재인", "청와대", "여야", "검찰", "국회", "지지층"],
        reactionWordCloud: [
          { text: "평가", size: 1 },
          { text: "책임", size: 2 },
          { text: "논란", size: 2 },
          { text: "팩트", size: 3 },
          { text: "프레임", size: 3 },
          { text: "공과", size: 2 },
          { text: "지지", size: 2 },
          { text: "비판", size: 2 },
          { text: "기억", size: 1 },
          { text: "정쟁", size: 3 },
          { text: "맥락", size: 2 },
          { text: "과장", size: 3 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 522,
        summary:
          "최근 7일간 문재인 관련 기사는 522건으로, 과거 정책 평가와 현안 정치 이슈를 엮는 보도가 반복됩니다. 언론사별로 부정/긍정의 편차가 커 편향도 지수가 요동치는 편입니다.",
        titleWordCloud: [
          { text: "정치", size: 1 },
          { text: "정책", size: 2 },
          { text: "논쟁", size: 2 },
          { text: "여야", size: 2 },
          { text: "검찰", size: 3 },
          { text: "회고", size: 3 },
          { text: "쟁점", size: 3 },
          { text: "평가", size: 2 },
          { text: "국회", size: 2 },
          { text: "사법", size: 2 },
          { text: "개혁", size: 3 },
          { text: "프레임", size: 3 },
          { text: "발언", size: 2 },
          { text: "청와대", size: 2 },
          { text: "대립", size: 3 },
          { text: "지지율", size: 1 },
        ],
        sentimentAll: { positive: 20, neutral: 30, negative: 50 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: -6 },
          { label: "중앙", value: -3 },
          { label: "한겨레", value: 5 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 2 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: 2 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: -2 },
        ],
        entities: ["문재인", "여야", "국회", "청와대", "검찰", "정책"],
        reactionWordCloud: [
          { text: "논쟁", size: 1 },
          { text: "평가", size: 2 },
          { text: "팩트", size: 3 },
          { text: "편향", size: 3 },
          { text: "정쟁", size: 2 },
          { text: "과장", size: 3 },
          { text: "맥락", size: 2 },
          { text: "기억", size: 1 },
          { text: "검증", size: 2 },
          { text: "갈등", size: 3 },
          { text: "공방", size: 2 },
          { text: "프레임", size: 3 },
        ],
      },
    },
  },

  {
    keyword: "윤석열",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 87,
        summary:
          "윤석열 관련 기사는 87건으로, 정책 발표/대외 이슈/정치권 공방이 동시에 노출됩니다. 사안에 따라 긍정·부정이 급격히 교차하며, 매체별 관점 차이가 비교적 크게 나타납니다.",
        titleWordCloud: [
          { text: "대통령", size: 1 },
          { text: "정책", size: 2 },
          { text: "공방", size: 2 },
          { text: "외교", size: 3 },
          { text: "경제", size: 3 },
          { text: "지지율", size: 2 },
          { text: "국회", size: 3 },
          { text: "대통령실", size: 2 },
          { text: "안보", size: 2 },
          { text: "민생", size: 1 },
          { text: "인사", size: 3 },
          { text: "여야", size: 2 },
          { text: "협상", size: 2 },
          { text: "논란", size: 3 },
          { text: "발언", size: 2 },
          { text: "정국", size: 3 },
        ],
        sentimentAll: { positive: 28, neutral: 24, negative: 48 },
        biasItems: [
          { label: "전체", value: 0 },
          { label: "조선", value: 5 },
          { label: "중앙", value: 3 },
          { label: "한겨레", value: -5 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -3 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: -2 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 2 },
        ],
        entities: ["윤석열", "국회", "정부", "외교부", "여야", "대통령실"],
        reactionWordCloud: [
          { text: "정책", size: 1 },
          { text: "공방", size: 2 },
          { text: "지지율", size: 2 },
          { text: "외교", size: 3 },
          { text: "민생", size: 2 },
          { text: "성과", size: 2 },
          { text: "논란", size: 3 },
          { text: "갈등", size: 3 },
          { text: "설명 부족", size: 3 },
          { text: "기대", size: 1 },
          { text: "불안", size: 2 },
          { text: "피로감", size: 3 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 480,
        summary:
          "최근 7일간 윤석열 관련 보도는 480건으로, 정책 이슈와 정치적 공방이 번갈아 주도했습니다. 사건 중심 보도일수록 부정 비중이 높아지고, 정책 성과형 기사에서는 중립/긍정이 늘어나는 경향이 있습니다.",
        titleWordCloud: [
          { text: "정책", size: 1 },
          { text: "국회", size: 2 },
          { text: "외교", size: 2 },
          { text: "경제", size: 3 },
          { text: "공방", size: 2 },
          { text: "대통령실", size: 3 },
          { text: "안보", size: 2 },
          { text: "민생", size: 2 },
          { text: "인사", size: 3 },
          { text: "현안", size: 2 },
          { text: "논란", size: 3 },
          { text: "발언", size: 2 },
          { text: "정국", size: 3 },
          { text: "협상", size: 2 },
          { text: "대립", size: 3 },
          { text: "성과", size: 1 },
        ],
        sentimentAll: { positive: 27, neutral: 25, negative: 48 },
        biasItems: [
          { label: "전체", value: 0 },
          { label: "조선", value: 4 },
          { label: "중앙", value: 2 },
          { label: "한겨레", value: -4 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -3 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: -2 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 2 },
        ],
        entities: ["윤석열", "정부", "국회", "여야", "외교", "경제"],
        reactionWordCloud: [
          { text: "공방", size: 1 },
          { text: "정책", size: 2 },
          { text: "성과", size: 3 },
          { text: "논란", size: 2 },
          { text: "민생", size: 2 },
          { text: "갈등", size: 3 },
          { text: "피로감", size: 3 },
          { text: "설명", size: 2 },
          { text: "기대", size: 1 },
          { text: "불안", size: 2 },
          { text: "책임", size: 3 },
          { text: "대응", size: 2 },
        ],
      },
    },
  },

  {
    keyword: "데이터",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 65,
        summary:
          "데이터 키워드는 65건으로, AI/분석/보안/공공 데이터 활용 이슈가 함께 등장합니다. 기술 소개형 기사에서는 중립 비중이 높고, 유출·오남용 이슈가 붙을 때 부정 비중이 상승합니다.",
        titleWordCloud: [
          { text: "분석", size: 1 },
          { text: "AI", size: 2 },
          { text: "보안", size: 2 },
          { text: "개인정보", size: 2 },
          { text: "공공데이터", size: 3 },
          { text: "모델", size: 3 },
          { text: "활용", size: 3 },
          { text: "거버넌스", size: 2 },
          { text: "클라우드", size: 2 },
          { text: "데이터셋", size: 1 },
          { text: "품질", size: 2 },
          { text: "표준화", size: 3 },
          { text: "규제", size: 2 },
          { text: "오남용", size: 3 },
          { text: "혁신", size: 1 },
          { text: "플랫폼", size: 2 },
        ],
        sentimentAll: { positive: 26, neutral: 40, negative: 34 },
        biasItems: [
          { label: "전체", value: 1 },
          { label: "조선", value: 2 },
          { label: "중앙", value: 1 },
          { label: "한겨레", value: 0 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 2 },
        ],
        entities: ["데이터", "AI", "기업", "정부", "보안", "연구기관"],
        reactionWordCloud: [
          { text: "유용", size: 2 },
          { text: "보안", size: 1 },
          { text: "활용", size: 2 },
          { text: "규제", size: 3 },
          { text: "편의", size: 1 },
          { text: "감시 우려", size: 3 },
          { text: "투명성", size: 2 },
          { text: "품질 개선", size: 2 },
          { text: "표준 필요", size: 3 },
          { text: "혁신 기대", size: 1 },
          { text: "데이터 격차", size: 3 },
          { text: "책임", size: 2 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 310,
        summary:
          "최근 7일간 데이터 관련 보도는 310건으로, AI 적용 사례와 함께 데이터 거버넌스·보안 이슈가 반복적으로 등장합니다.",
        titleWordCloud: [
          { text: "AI", size: 1 },
          { text: "분석", size: 2 },
          { text: "보안", size: 2 },
          { text: "클라우드", size: 3 },
          { text: "거버넌스", size: 3 },
          { text: "데이터셋", size: 2 },
          { text: "품질", size: 2 },
          { text: "표준화", size: 3 },
          { text: "규제", size: 2 },
          { text: "개인정보", size: 3 },
          { text: "활용", size: 2 },
          { text: "공공", size: 1 },
          { text: "산업", size: 1 },
          { text: "플랫폼", size: 2 },
          { text: "투명성", size: 2 },
          { text: "책임", size: 3 },
        ],
        sentimentAll: { positive: 24, neutral: 42, negative: 34 },
        biasItems: [
          { label: "전체", value: 1 },
          { label: "조선", value: 2 },
          { label: "중앙", value: 1 },
          { label: "한겨레", value: 0 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 2 },
        ],
        entities: ["데이터", "AI", "클라우드", "보안", "산업", "공공"],
        reactionWordCloud: [
          { text: "보안", size: 1 },
          { text: "활용", size: 2 },
          { text: "편의", size: 3 },
          { text: "감시 우려", size: 3 },
          { text: "품질", size: 2 },
          { text: "표준", size: 2 },
          { text: "혁신", size: 1 },
          { text: "책임", size: 2 },
          { text: "투명성", size: 2 },
          { text: "격차", size: 3 },
          { text: "규제", size: 3 },
          { text: "신뢰", size: 1 },
        ],
      },
    },
  },

  {
    keyword: "개인정보 유출",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 54,
        summary:
          "개인정보 유출 관련 기사는 54건으로, 사고/조치/책임 공방이 중심입니다. 피해 규모·2차 피해 가능성 등 위험 프레임이 강조되며 부정 비율이 높게 나타납니다.",
        titleWordCloud: [
          { text: "유출", size: 1 },
          { text: "해킹", size: 2 },
          { text: "피해", size: 2 },
          { text: "조사", size: 3 },
          { text: "사과", size: 3 },
          { text: "과징금", size: 2 },
          { text: "보안", size: 2 },
          { text: "2차피해", size: 3 },
          { text: "책임", size: 3 },
          { text: "대응", size: 2 },
          { text: "개인정보위", size: 2 },
          { text: "신고", size: 1 },
          { text: "재발방지", size: 3 },
          { text: "소송", size: 2 },
          { text: "보상", size: 2 },
          { text: "취약점", size: 3 },
        ],
        sentimentAll: { positive: 8, neutral: 18, negative: 74 },
        biasItems: [
          { label: "전체", value: -3 },
          { label: "조선", value: -2 },
          { label: "중앙", value: -3 },
          { label: "한겨레", value: -4 },
          { label: "KBS", value: -3 },
          { label: "MBC", value: -4 },
          { label: "SBS", value: -3 },
          { label: "JTBC", value: -4 },
          { label: "YTN", value: -3 },
          { label: "연합", value: -2 },
          { label: "한경", value: -1 },
        ],
        entities: ["개인정보", "해킹", "고객", "기업", "당국", "보안업계"],
        reactionWordCloud: [
          { text: "불안", size: 1 },
          { text: "보상", size: 2 },
          { text: "책임", size: 2 },
          { text: "재발", size: 3 },
          { text: "분노", size: 3 },
          { text: "신뢰 하락", size: 3 },
          { text: "대응 미흡", size: 3 },
          { text: "정보 변경", size: 2 },
          { text: "피싱 걱정", size: 3 },
          { text: "법적 조치", size: 2 },
          { text: "강화 필요", size: 2 },
          { text: "사과 요구", size: 2 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 260,
        summary:
          "최근 7일간 개인정보 유출 보도는 260건으로, 사고 보고 이후 후속 조치(조사·보상·재발 방지) 기사가 이어졌습니다.",
        titleWordCloud: [
          { text: "해킹", size: 1 },
          { text: "유출", size: 1 },
          { text: "조사", size: 2 },
          { text: "보상", size: 2 },
          { text: "보안", size: 3 },
          { text: "사과", size: 2 },
          { text: "과징금", size: 3 },
          { text: "책임", size: 3 },
          { text: "피해", size: 2 },
          { text: "재발방지", size: 3 },
          { text: "취약점", size: 3 },
          { text: "당국", size: 2 },
          { text: "소송", size: 2 },
          { text: "2차피해", size: 3 },
          { text: "신고", size: 1 },
          { text: "정보보호", size: 2 },
        ],
        sentimentAll: { positive: 7, neutral: 20, negative: 73 },
        biasItems: [
          { label: "전체", value: -3 },
          { label: "조선", value: -2 },
          { label: "중앙", value: -3 },
          { label: "한겨레", value: -4 },
          { label: "KBS", value: -3 },
          { label: "MBC", value: -4 },
          { label: "SBS", value: -3 },
          { label: "JTBC", value: -4 },
          { label: "YTN", value: -3 },
          { label: "연합", value: -2 },
          { label: "한경", value: -1 },
        ],
        entities: ["개인정보", "해킹", "보안", "피해자", "기업", "당국"],
        reactionWordCloud: [
          { text: "불안", size: 1 },
          { text: "보상", size: 2 },
          { text: "재발", size: 3 },
          { text: "분노", size: 3 },
          { text: "신뢰 하락", size: 3 },
          { text: "대응", size: 2 },
          { text: "피싱", size: 3 },
          { text: "정보 변경", size: 2 },
          { text: "법적 조치", size: 2 },
          { text: "강화 필요", size: 2 },
          { text: "사과 요구", size: 2 },
          { text: "감사", size: 1 },
        ],
      },
    },
  },

  {
    keyword: "AI",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 49,
        summary:
          "AI 관련 보도는 49건으로, 신규 모델/서비스 출시와 규제·윤리 이슈가 함께 나타납니다. 소개형 기사 비중이 커 중립이 높지만, 저작권·안전 이슈가 등장하면 부정 비율이 상승합니다.",
        titleWordCloud: [
          { text: "모델", size: 1 },
          { text: "생성형", size: 2 },
          { text: "규제", size: 2 },
          { text: "저작권", size: 3 },
          { text: "안전", size: 3 },
          { text: "서비스", size: 2 },
          { text: "기업", size: 1 },
          { text: "투자", size: 2 },
          { text: "윤리", size: 3 },
          { text: "학습데이터", size: 3 },
          { text: "검증", size: 2 },
          { text: "환각", size: 3 },
          { text: "자동화", size: 2 },
          { text: "생산성", size: 2 },
          { text: "경쟁", size: 1 },
          { text: "표준", size: 2 },
        ],
        sentimentAll: { positive: 28, neutral: 46, negative: 26 },
        biasItems: [
          { label: "전체", value: 2 },
          { label: "조선", value: 3 },
          { label: "중앙", value: 2 },
          { label: "한겨레", value: 1 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 1 },
          { label: "한경", value: 3 },
        ],
        entities: ["AI", "기업", "연구", "규제기관", "사용자"],
        reactionWordCloud: [
          { text: "편리", size: 2 },
          { text: "걱정", size: 3 },
          { text: "혁신", size: 1 },
          { text: "저작권", size: 3 },
          { text: "일자리", size: 2 },
          { text: "윤리", size: 2 },
          { text: "생산성", size: 1 },
          { text: "검증 필요", size: 3 },
          { text: "과대광고", size: 3 },
          { text: "기대", size: 1 },
          { text: "불안", size: 2 },
          { text: "규제 필요", size: 3 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 240,
        summary:
          "최근 7일간 AI 관련 기사는 240건으로, 산업 적용 사례와 규제/윤리 이슈가 지속적으로 노출됩니다.",
        titleWordCloud: [
          { text: "생성형", size: 1 },
          { text: "서비스", size: 2 },
          { text: "규제", size: 2 },
          { text: "저작권", size: 3 },
          { text: "안전", size: 3 },
          { text: "투자", size: 2 },
          { text: "윤리", size: 3 },
          { text: "자동화", size: 2 },
          { text: "생산성", size: 2 },
          { text: "학습데이터", size: 3 },
          { text: "검증", size: 2 },
          { text: "기업", size: 1 },
          { text: "산업", size: 1 },
          { text: "표준", size: 2 },
          { text: "경쟁", size: 2 },
          { text: "환각", size: 3 },
        ],
        sentimentAll: { positive: 27, neutral: 47, negative: 26 },
        biasItems: [
          { label: "전체", value: 2 },
          { label: "조선", value: 3 },
          { label: "중앙", value: 2 },
          { label: "한겨레", value: 1 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 1 },
          { label: "한경", value: 3 },
        ],
        entities: ["AI", "기업", "산업", "규제", "연구"],
        reactionWordCloud: [
          { text: "혁신", size: 1 },
          { text: "편리", size: 2 },
          { text: "불안", size: 3 },
          { text: "저작권", size: 3 },
          { text: "윤리", size: 2 },
          { text: "일자리", size: 2 },
          { text: "검증", size: 3 },
          { text: "규제", size: 3 },
          { text: "기대", size: 1 },
          { text: "과장", size: 3 },
          { text: "생산성", size: 1 },
          { text: "안전", size: 2 },
        ],
      },
    },
  },

  {
    keyword: "반도체",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 46,
        summary:
          "반도체 관련 기사는 46건으로, 실적/투자/공급망 이슈가 중심입니다. 업황 전망에 따라 긍정과 부정이 교차하며, 시장/기업 중심 프레임이 강합니다.",
        titleWordCloud: [
          { text: "실적", size: 1 },
          { text: "투자", size: 2 },
          { text: "수출", size: 2 },
          { text: "공급망", size: 3 },
          { text: "가격", size: 3 },
          { text: "메모리", size: 2 },
          { text: "파운드리", size: 2 },
          { text: "AI칩", size: 3 },
          { text: "장비", size: 2 },
          { text: "경쟁", size: 1 },
          { text: "점유율", size: 2 },
          { text: "증설", size: 3 },
          { text: "업황", size: 3 },
          { text: "수요", size: 2 },
          { text: "공장", size: 1 },
          { text: "정책", size: 2 },
        ],
        sentimentAll: { positive: 34, neutral: 38, negative: 28 },
        biasItems: [
          { label: "전체", value: 3 },
          { label: "조선", value: 3 },
          { label: "중앙", value: 2 },
          { label: "한겨레", value: 1 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 1 },
          { label: "한경", value: 4 },
        ],
        entities: ["반도체", "기업", "공급망", "수출", "투자"],
        reactionWordCloud: [
          { text: "호재", size: 2 },
          { text: "경쟁", size: 2 },
          { text: "불안", size: 3 },
          { text: "기대", size: 1 },
          { text: "수출", size: 1 },
          { text: "투자 확대", size: 2 },
          { text: "가격 변동", size: 3 },
          { text: "공급망", size: 2 },
          { text: "기술 격차", size: 3 },
          { text: "정책 지원", size: 2 },
          { text: "실적", size: 1 },
          { text: "리스크", size: 3 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 210,
        summary:
          "최근 7일간 반도체 보도는 210건으로, 실적/수출과 함께 공급망·정책 이슈가 반복적으로 등장합니다.",
        titleWordCloud: [
          { text: "투자", size: 1 },
          { text: "수출", size: 2 },
          { text: "공급망", size: 2 },
          { text: "가격", size: 3 },
          { text: "실적", size: 2 },
          { text: "업황", size: 3 },
          { text: "메모리", size: 2 },
          { text: "AI칩", size: 3 },
          { text: "파운드리", size: 2 },
          { text: "장비", size: 2 },
          { text: "점유율", size: 2 },
          { text: "정책", size: 2 },
          { text: "수요", size: 1 },
          { text: "증설", size: 3 },
          { text: "경쟁", size: 2 },
          { text: "리스크", size: 3 },
        ],
        sentimentAll: { positive: 33, neutral: 39, negative: 28 },
        biasItems: [
          { label: "전체", value: 3 },
          { label: "조선", value: 3 },
          { label: "중앙", value: 2 },
          { label: "한겨레", value: 1 },
          { label: "KBS", value: 1 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 1 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 1 },
          { label: "연합", value: 1 },
          { label: "한경", value: 4 },
        ],
        entities: ["반도체", "수출", "투자", "공급망", "시장"],
        reactionWordCloud: [
          { text: "호재", size: 2 },
          { text: "경쟁", size: 2 },
          { text: "전망", size: 3 },
          { text: "기대", size: 1 },
          { text: "수출", size: 1 },
          { text: "가격", size: 3 },
          { text: "정책", size: 2 },
          { text: "공급망", size: 2 },
          { text: "기술", size: 2 },
          { text: "리스크", size: 3 },
          { text: "투자", size: 1 },
          { text: "증설", size: 2 },
        ],
      },
    },
  },

  {
    keyword: "금리",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 39,
        summary:
          "금리 관련 기사는 39건으로, 기준금리 전망과 가계/부동산 영향 분석이 중심입니다. 생활 체감 이슈와 연결되며 부정 비중이 다소 높아지는 경향이 있습니다.",
        titleWordCloud: [
          { text: "기준금리", size: 1 },
          { text: "대출", size: 2 },
          { text: "물가", size: 2 },
          { text: "가계", size: 3 },
          { text: "전망", size: 3 },
          { text: "동결", size: 2 },
          { text: "인하", size: 2 },
          { text: "인상", size: 3 },
          { text: "환율", size: 2 },
          { text: "경기", size: 2 },
          { text: "소비", size: 1 },
          { text: "부동산", size: 2 },
          { text: "기업", size: 1 },
          { text: "금융시장", size: 3 },
          { text: "채권", size: 2 },
          { text: "부담", size: 3 },
        ],
        sentimentAll: { positive: 14, neutral: 44, negative: 42 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: 0 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -1 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -1 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 1 },
        ],
        entities: ["금리", "중앙은행", "가계", "대출", "부동산"],
        reactionWordCloud: [
          { text: "대출", size: 1 },
          { text: "부담", size: 2 },
          { text: "물가", size: 3 },
          { text: "인하 기대", size: 2 },
          { text: "동결", size: 1 },
          { text: "이자", size: 2 },
          { text: "체감", size: 3 },
          { text: "가계", size: 2 },
          { text: "집값", size: 2 },
          { text: "불안", size: 3 },
          { text: "경기", size: 1 },
          { text: "소비 위축", size: 3 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 180,
        summary:
          "최근 7일간 금리 보도는 180건으로, 금리 동결/인하 기대와 시장 영향 분석이 이어졌습니다.",
        titleWordCloud: [
          { text: "동결", size: 2 },
          { text: "인하", size: 2 },
          { text: "대출", size: 1 },
          { text: "물가", size: 3 },
          { text: "기준금리", size: 2 },
          { text: "환율", size: 2 },
          { text: "경기", size: 2 },
          { text: "채권", size: 2 },
          { text: "시장", size: 1 },
          { text: "가계", size: 3 },
          { text: "부동산", size: 2 },
          { text: "이자", size: 2 },
          { text: "전망", size: 3 },
          { text: "인상", size: 3 },
          { text: "금융", size: 2 },
          { text: "부담", size: 3 },
        ],
        sentimentAll: { positive: 16, neutral: 43, negative: 41 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: 0 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -1 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -1 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 1 },
        ],
        entities: ["금리", "대출", "물가", "가계", "시장"],
        reactionWordCloud: [
          { text: "부담", size: 1 },
          { text: "인하", size: 2 },
          { text: "동결", size: 3 },
          { text: "이자", size: 2 },
          { text: "체감", size: 3 },
          { text: "가계", size: 2 },
          { text: "집값", size: 2 },
          { text: "불안", size: 3 },
          { text: "경기", size: 1 },
          { text: "소비", size: 2 },
          { text: "전망", size: 2 },
          { text: "시장", size: 1 },
        ],
      },
    },
  },

  {
    keyword: "부동산",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 33,
        summary:
          "부동산 키워드는 33건으로, 금리/정책과 맞물린 가격 전망 및 거래량 이슈가 중심입니다. 체감 부담이 강조되며 부정 비율이 상대적으로 높습니다.",
        titleWordCloud: [
          { text: "가격", size: 1 },
          { text: "전세", size: 2 },
          { text: "대출", size: 2 },
          { text: "거래", size: 3 },
          { text: "정책", size: 3 },
          { text: "금리", size: 2 },
          { text: "매매", size: 2 },
          { text: "공급", size: 3 },
          { text: "청약", size: 2 },
          { text: "규제", size: 3 },
          { text: "세입자", size: 2 },
          { text: "집값", size: 3 },
          { text: "거래절벽", size: 3 },
          { text: "전망", size: 2 },
          { text: "지역", size: 1 },
          { text: "부담", size: 3 },
        ],
        sentimentAll: { positive: 10, neutral: 40, negative: 50 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: 0 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -2 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -1 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 1 },
        ],
        entities: ["부동산", "금리", "대출", "정책", "세입자"],
        reactionWordCloud: [
          { text: "불안", size: 1 },
          { text: "대출", size: 2 },
          { text: "전세", size: 3 },
          { text: "집값", size: 3 },
          { text: "부담", size: 2 },
          { text: "거래절벽", size: 3 },
          { text: "정책", size: 2 },
          { text: "규제", size: 2 },
          { text: "지역 격차", size: 3 },
          { text: "전망", size: 2 },
          { text: "매물", size: 1 },
          { text: "청약", size: 2 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 150,
        summary:
          "최근 7일간 부동산 보도는 150건으로, 지역별 가격 변동과 정책/금리 영향 분석이 이어졌습니다.",
        titleWordCloud: [
          { text: "가격", size: 1 },
          { text: "전세", size: 2 },
          { text: "거래", size: 2 },
          { text: "정책", size: 3 },
          { text: "금리", size: 2 },
          { text: "대출", size: 2 },
          { text: "매매", size: 2 },
          { text: "공급", size: 3 },
          { text: "청약", size: 2 },
          { text: "규제", size: 3 },
          { text: "지역", size: 1 },
          { text: "집값", size: 3 },
          { text: "거래량", size: 2 },
          { text: "전망", size: 2 },
          { text: "세입자", size: 2 },
          { text: "부담", size: 3 },
        ],
        sentimentAll: { positive: 11, neutral: 41, negative: 48 },
        biasItems: [
          { label: "전체", value: -1 },
          { label: "조선", value: 0 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -2 },
          { label: "KBS", value: -1 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -1 },
          { label: "YTN", value: -1 },
          { label: "연합", value: 0 },
          { label: "한경", value: 1 },
        ],
        entities: ["부동산", "정책", "금리", "대출", "거래"],
        reactionWordCloud: [
          { text: "불안", size: 1 },
          { text: "거래", size: 2 },
          { text: "정책", size: 3 },
          { text: "집값", size: 3 },
          { text: "부담", size: 2 },
          { text: "전세", size: 2 },
          { text: "대출", size: 2 },
          { text: "규제", size: 3 },
          { text: "지역 격차", size: 3 },
          { text: "전망", size: 2 },
          { text: "청약", size: 2 },
          { text: "매물", size: 1 },
        ],
      },
    },
  },

  {
    keyword: "우크라이나",
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 27,
        summary:
          "우크라이나 관련 보도는 27건으로, 전황 변화/외교 협상/지원 논의가 중심입니다. 사건 중심 기사 비중이 높아 부정 비율이 크게 나타납니다.",
        titleWordCloud: [
          { text: "전황", size: 1 },
          { text: "협상", size: 2 },
          { text: "지원", size: 2 },
          { text: "제재", size: 3 },
          { text: "외교", size: 3 },
          { text: "러시아", size: 2 },
          { text: "유럽", size: 2 },
          { text: "미국", size: 1 },
          { text: "방공", size: 3 },
          { text: "드론", size: 2 },
          { text: "휴전", size: 3 },
          { text: "확전", size: 3 },
          { text: "난민", size: 2 },
          { text: "경제", size: 1 },
          { text: "국제사회", size: 2 },
          { text: "인도지원", size: 2 },
        ],
        sentimentAll: { positive: 6, neutral: 28, negative: 66 },
        biasItems: [
          { label: "전체", value: -2 },
          { label: "조선", value: -1 },
          { label: "중앙", value: -1 },
          { label: "한겨레", value: -2 },
          { label: "KBS", value: -2 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -2 },
          { label: "YTN", value: -2 },
          { label: "연합", value: -1 },
          { label: "한경", value: -1 },
        ],
        entities: ["우크라이나", "러시아", "유럽", "미국", "외교"],
        reactionWordCloud: [
          { text: "전쟁", size: 1 },
          { text: "지원", size: 2 },
          { text: "협상", size: 3 },
          { text: "피로감", size: 3 },
          { text: "불안", size: 2 },
          { text: "휴전 기대", size: 2 },
          { text: "확전 우려", size: 3 },
          { text: "제재", size: 2 },
          { text: "민간 피해", size: 3 },
          { text: "외교", size: 2 },
          { text: "인도지원", size: 1 },
          { text: "국제 공조", size: 2 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 120,
        summary:
          "최근 7일간 우크라이나 보도는 120건으로, 전황 및 외교 이슈가 반복적으로 노출됩니다.",
        titleWordCloud: [
          { text: "전황", size: 1 },
          { text: "협상", size: 2 },
          { text: "지원", size: 2 },
          { text: "제재", size: 3 },
          { text: "러시아", size: 2 },
          { text: "외교", size: 2 },
          { text: "미국", size: 1 },
          { text: "유럽", size: 1 },
          { text: "휴전", size: 3 },
          { text: "확전", size: 3 },
          { text: "드론", size: 2 },
          { text: "방공", size: 2 },
          { text: "난민", size: 2 },
          { text: "경제", size: 1 },
          { text: "국제사회", size: 2 },
          { text: "인도지원", size: 2 },
        ],
        sentimentAll: { positive: 7, neutral: 27, negative: 66 },
        biasItems: [
          { label: "전체", value: -2 },
          { label: "조선", value: -1 },
          { label: "중앙", value: -1 },
          { label: "한겨레", value: -2 },
          { label: "KBS", value: -2 },
          { label: "MBC", value: -2 },
          { label: "SBS", value: -1 },
          { label: "JTBC", value: -2 },
          { label: "YTN", value: -2 },
          { label: "연합", value: -1 },
          { label: "한경", value: -1 },
        ],
        entities: ["우크라이나", "러시아", "외교", "지원", "전황"],
        reactionWordCloud: [
          { text: "전쟁", size: 1 },
          { text: "협상", size: 2 },
          { text: "지원", size: 3 },
          { text: "피로감", size: 3 },
          { text: "불안", size: 2 },
          { text: "휴전 기대", size: 2 },
          { text: "확전 우려", size: 3 },
          { text: "제재", size: 2 },
          { text: "민간 피해", size: 3 },
          { text: "외교", size: 2 },
          { text: "인도지원", size: 1 },
          { text: "국제 공조", size: 2 },
        ],
      },
    },
  },
];

/** 키워드 문자열로 목업 레코드 찾기 */
function findKeywordRecord(keyword: string): KeywordMockRecord | undefined {
  const key = normalizeKey(keyword);
  return KEYWORD_MOCKS.find((r) => normalizeKey(r.keyword) === key);
}

/** KeywordDetailPage에서 필요한 값만 뽑아주는 목업 getter */
export function getKeywordDetailMock(
  keyword: string,
  period: KeywordPeriod,
  media: MediaKey
): KeywordDetailMock {
  const decodedKeyword = safeDecode(keyword);
  const rec = findKeywordRecord(decodedKeyword);

  // 미등록 키워드가 들어와도 UI가 깨지지 않도록 기본값 제공
  const fallback: KeywordMockRecord = {
    keyword: decodedKeyword,
    periods: {
      today: {
        rangeLabel: "2025-12-10",
        articleCountTotal: 50,
        summary: `${decodedKeyword} 관련 기사는 오늘 기준으로 수집·분석 중입니다. 주요 이슈와 톤 분포를 요약하면 중립 기사 비중이 높고, 일부 사건/논란성 기사에서 부정 비율이 증가합니다.`,
        titleWordCloud: [
          { text: "이슈", size: 1 },
          { text: "분석", size: 2 },
          { text: "논란", size: 3 },
          { text: "전망", size: 3 },
          { text: "핵심", size: 2 },
          { text: "쟁점", size: 2 },
          { text: "발언", size: 2 },
          { text: "정책", size: 2 },
          { text: "반응", size: 1 },
          { text: "팩트체크", size: 3 },
          { text: "확대", size: 2 },
          { text: "후속", size: 2 },
        ],
        sentimentAll: { positive: 25, neutral: 45, negative: 30 },
        // KeywordDetailPage bias 차트가 11칸 고정이라, fallback도 11개로 맞춤
        biasItems: [
          { label: "전체", value: 0 },
          { label: "조선", value: 1 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -1 },
          { label: "KBS", value: 0 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 0 },
          { label: "연합", value: 0 },
          { label: "한경", value: 0 },
        ],
        entities: [decodedKeyword, "기관", "기업", "관계자"],
        reactionWordCloud: [
          { text: "관심", size: 2 },
          { text: "걱정", size: 3 },
          { text: "기대", size: 2 },
          { text: "논쟁", size: 2 },
          { text: "피로감", size: 3 },
          { text: "확인 필요", size: 3 },
          { text: "공감", size: 1 },
          { text: "비판", size: 2 },
          { text: "불안", size: 3 },
          { text: "중립", size: 1 },
          { text: "팩트", size: 2 },
          { text: "설명", size: 2 },
        ],
      },
      "7d": {
        rangeLabel: "2025-12-04 ~ 2025-12-10",
        articleCountTotal: 260,
        summary: `${decodedKeyword} 관련 기사는 최근 7일 기준으로 흐름을 분석 중입니다. 반복 등장 이슈는 유사하며, 기간이 길어져 중립 비중이 소폭 증가하는 경향이 있습니다.`,
        titleWordCloud: [
          { text: "이슈", size: 1 },
          { text: "분석", size: 2 },
          { text: "흐름", size: 3 },
          { text: "반복", size: 2 },
          { text: "확대", size: 2 },
          { text: "쟁점", size: 3 },
          { text: "정책", size: 2 },
          { text: "논란", size: 3 },
          { text: "후속", size: 2 },
          { text: "전망", size: 2 },
          { text: "맥락", size: 2 },
          { text: "키워드", size: 1 },
        ],
        sentimentAll: { positive: 24, neutral: 46, negative: 30 },
        biasItems: [
          { label: "전체", value: 0 },
          { label: "조선", value: 1 },
          { label: "중앙", value: 0 },
          { label: "한겨레", value: -1 },
          { label: "KBS", value: 0 },
          { label: "MBC", value: 0 },
          { label: "SBS", value: 0 },
          { label: "JTBC", value: 0 },
          { label: "YTN", value: 0 },
          { label: "연합", value: 0 },
          { label: "한경", value: 0 },
        ],
        entities: [decodedKeyword, "기관", "기업", "관계자"],
        reactionWordCloud: [
          { text: "관심", size: 2 },
          { text: "걱정", size: 3 },
          { text: "기대", size: 2 },
          { text: "논쟁", size: 2 },
          { text: "피로감", size: 3 },
          { text: "확인 필요", size: 3 },
          { text: "공감", size: 1 },
          { text: "비판", size: 2 },
          { text: "불안", size: 3 },
          { text: "중립", size: 1 },
          { text: "팩트", size: 2 },
          { text: "설명", size: 2 },
        ],
      },
    },
  };

  const picked = rec ?? fallback;
  const snap = picked.periods[period];

  const mediaCount = media === "all" ? DEFAULT_MEDIA_COUNT_ALL : 1;

  // 언론사별 오버라이드(있는 경우만 적용)
  const mediaOverride = media !== "all" ? snap.perMedia?.[media] : undefined;

  const articleCount =
    media === "all"
      ? snap.articleCountTotal
      : mediaOverride?.articleCount ??
        Math.max(1, Math.round(snap.articleCountTotal * 0.15));

  const summary = mediaOverride?.summary ?? snap.summary;
  const titleWordCloud = mediaOverride?.titleWordCloud ?? snap.titleWordCloud;

  const sentiment = normalizeSentiment(mediaOverride?.sentiment ?? snap.sentimentAll);

  return {
    keyword: picked.keyword,
    rangeLabel: snap.rangeLabel,
    articleCount,
    mediaCount,
    summary,
    titleWordCloud,
    sentiment,
    biasItems: snap.biasItems,
    entities: snap.entities,
    reactionWordCloud: snap.reactionWordCloud,
  };
}