// frontend/src/mocks/inquiryMockData.ts

export type InquiryTypeKey = "all" | "bug" | "idea" | "data" | "account" | "etc";
export type StatusKey = "all" | "processing" | "done";

export type InquiryAnswer = {
  teamLabel: string; // 예: "Newsight 운영팀"
  answeredAt: string; // yyyy-mm-dd HH:mm
  body: string; // \n\n 로 문단 구분
};

export type InquiryItem = {
  id: number;
  typeKey: Exclude<InquiryTypeKey, "all">;
  typeLabel: string;
  title: string;

  // 목록에서 쓰는 값(기존 유지)
  date: string; // yyyy-mm-dd

  status: Exclude<StatusKey, "all">;
  isPrivate?: boolean;

  // 상세에서 쓰는 값(추가)
  author: string;
  createdAt: string; // yyyy-mm-dd HH:mm
  body: string; // \n\n 로 문단 구분
  answer?: InquiryAnswer; // 답변 완료일 때만 존재(권장)
};

export const INQUIRY_TYPE_FILTERS: { key: InquiryTypeKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "bug", label: "오류 제보" },
  { key: "idea", label: "기능 제안" },
  { key: "data", label: "데이터 문의" },
  { key: "account", label: "계정/로그인" },
  { key: "etc", label: "기타" },
];

export const INQUIRY_STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "processing", label: "처리 중" },
  { key: "done", label: "답변 완료" },
];

const ADDED_STORAGE_KEY = "NS_INQUIRIES_ADDED_V1";

function readAddedFromStorage(): InquiryItem[] {
  try {
    const raw = localStorage.getItem(ADDED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as InquiryItem[];
  } catch {
    return [];
  }
}

function writeAddedToStorage(items: InquiryItem[]) {
  try {
    localStorage.setItem(ADDED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function getAllInquiries(): InquiryItem[] {
  const added = readAddedFromStorage();
  const merged = [...added, ...INQUIRY_MOCK_ITEMS];
  merged.sort((a, b) => b.id - a.id);
  return merged;
}

export function addInquiryToStorage(newItem: InquiryItem) {
  const added = readAddedFromStorage();
  const next = [newItem, ...added];
  writeAddedToStorage(next);
}

export function getNextInquiryId(): number {
  const all = getAllInquiries();
  const maxId = all.reduce((acc, cur) => Math.max(acc, cur.id), 0);
  return maxId + 1;
}

export const INQUIRY_MOCK_ITEMS: InquiryItem[] = [
  {
    id: 12,
    typeKey: "bug",
    typeLabel: "오류 제보",
    title: "언론사 비교 페이지에서 표 정렬이 간헐적으로 풀립니다",
    date: "2025-12-16",
    status: "processing",
    author: "newsight_user12",
    createdAt: "2025-12-16 10:05",
    body:
      "언론사 비교 페이지에서 표(기사 수/감성 비율 등)를 클릭해 정렬하면 정상 동작하다가,\n\n" +
      "필터(기간/언론사)를 바꾸고 다시 돌아오면 정렬 기준이 초기화되거나 헤더 클릭이 먹지 않는 경우가 있습니다.\n\n" +
      "재현은 자주 되진 않지만 가끔 발생합니다.",
  },
  {
    id: 11,
    typeKey: "data",
    typeLabel: "데이터 문의",
    title: "감성 분석 기준(모델/라벨링 방식)이 궁금합니다",
    date: "2025-12-15",
    status: "done",
    author: "analyst_01",
    createdAt: "2025-12-15 18:22",
    body:
      "감성(긍·부정·중립) 분류가 어떤 기준으로 산출되는지 궁금합니다.\n\n" +
      "제목 기반인지 본문 기반인지, 그리고 중립 판정 기준이 따로 있는지도 알고 싶습니다.",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-12-15 20:10",
      body:
        "안녕하세요, Newsight 운영팀입니다.\n\n" +
        "현재 목업 단계에서는 제목 기반으로 감성 비율을 산출하는 것으로 가정하고 있습니다.\n\n" +
        "정식 분석 파이프라인에서는 제목/본문 각각의 분석을 분리 제공하는 방안도 검토 중이며, 중립 판정 기준은 모델의 확률 분포와 임계값 정책에 따라 결정될 예정입니다.\n\n" +
        "추가 요구사항(연구 목적, 필요 지표)이 있다면 상세히 남겨주시면 설계에 반영하겠습니다.",
    },
  },
  {
    id: 10,
    typeKey: "etc",
    typeLabel: "기타",
    title: "다크 모드에서 일부 텍스트 대비가 약해 보입니다",
    date: "2025-12-14",
    status: "done",
    author: "visitor_10",
    createdAt: "2025-12-14 09:30",
    body:
      "다크 배경에서 카드 내부 설명 텍스트가 조금 흐릿하게 보여서 가독성이 떨어집니다.\n\n" +
      "특히 모바일에서 더 그렇게 느껴집니다. 대비(명도)를 약간만 올려주실 수 있을까요?",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-12-14 11:02",
      body:
        "안녕하세요, Newsight 운영팀입니다.\n\n" +
        "가독성 제보 감사드립니다. 텍스트 대비(회색 계열 토큰)를 조정해 모바일에서도 읽기 편하도록 개선하겠습니다.\n\n" +
        "다음 UI 업데이트에 반영 예정입니다.",
    },
  },
  {
    id: 9,
    typeKey: "account",
    typeLabel: "계정/로그인",
    title: "로그아웃 후에도 간헐적으로 인증이 유지됩니다",
    date: "2025-12-13",
    status: "processing",
    isPrivate: true,
    author: "newsight_user09",
    createdAt: "2025-12-13 21:14",
    body:
      "로그아웃을 눌렀는데, 새로고침하면 다시 로그인 상태처럼 보이는 경우가 있어요.\n\n" +
      "쿠키/토큰 처리 이슈인지 확인 부탁드립니다.",
  },
  {
    id: 8,
    typeKey: "idea",
    typeLabel: "기능 제안",
    title: "키워드 상세에서 언론사별 '대표 문장' 요약이 있으면 좋겠습니다",
    date: "2025-12-12",
    status: "done",
    author: "newsight_user08",
    createdAt: "2025-12-12 15:40",
    body:
      "키워드 상세에서 언론사별 특징을 한눈에 보기 어렵습니다.\n\n" +
      "언론사별로 대표 문장(요약)을 1~2개씩 보여주면 편향/프레이밍 차이를 더 쉽게 볼 수 있을 것 같습니다.",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-12-12 17:05",
      body:
        "안녕하세요, Newsight 운영팀입니다.\n\n" +
        "대표 문장/요약 기능 제안 감사합니다. 언론사별 핵심 문장 추출(또는 요약) 기능을 후속 버전에서 검토하겠습니다.\n\n" +
        "추가로 원하는 출력 형태(한 줄 요약/하이라이트/출처 링크 등)가 있다면 공유 부탁드립니다.",
    },
  },
  {
    id: 7,
    typeKey: "data",
    typeLabel: "데이터 문의",
    title: "키워드 TOP 10 기준이 '기사 수'인지 '조회 수'인지 궁금합니다",
    date: "2025-12-11",
    status: "processing",
    author: "curious_07",
    createdAt: "2025-12-11 12:01",
    body:
      "홈에 표시되는 TOP 10 키워드 기준이 무엇인지 궁금합니다.\n\n" +
      "기사 수 기반인지, 검색량/조회수 같은 지표를 포함하는지 안내 부탁드립니다.",
  },
  {
    id: 6,
    typeKey: "etc",
    typeLabel: "기타",
    title: "문의 답변 알림(이메일/푸시)이 있으면 좋겠습니다",
    date: "2025-12-11",
    status: "processing",
    author: "visitor_06",
    createdAt: "2025-12-11 08:50",
    body:
      "문의 답변이 달렸는지 직접 들어와서 확인해야 해서 불편합니다.\n\n" +
      "가능하다면 이메일 또는 푸시 알림으로 답변 등록 여부를 알려주면 좋겠습니다.",
  },
  {
    id: 5,
    typeKey: "bug",
    typeLabel: "오류 제보",
    title: "키워드 상세 페이지에서 감성 비율 차트가 보이지 않는 현상",
    date: "2025-12-10",
    status: "done",
    isPrivate: true,
    author: "newsight_user01",
    createdAt: "2025-12-10 14:32",
    body:
      "안녕하세요, 항상 좋은 서비스 제공해 주셔서 감사합니다.\n\n" +
      "오늘(12월 10일) 기준으로 언론사 비교 대시보드 → 키워드 상세 페이지에 접속했을 때, 특정 키워드에서 감성 비율(긍·부정·중립) 도넛 차트가 렌더링되지 않는 현상이 발생하고 있습니다.\n\n" +
      "특히 데스크톱(Chrome, Edge) 환경에서 자주 발생하며, 모바일 브라우저에서는 문제가 발생하지 않는 것 같습니다. 키워드를 변경했다가 다시 돌아오면 간헐적으로 차트가 보이기도 해서, 프론트엔드 렌더링 이슈처럼 보입니다.\n\n" +
      "혹시 현재 알려진 제약 사항인지, 아니면 버그라면 향후 수정 계획이 있는지 안내해 주시면 감사하겠습니다.",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-12-10 16:08",
      body:
        "안녕하세요, Newsight 운영팀입니다. 먼저 상세한 제보와 함께 서비스를 이용해 주셔서 감사합니다.\n\n" +
        "말씀해 주신 감성 비율 차트 미표시 문제는 내부 확인 결과, 특정 조건에서 차트 컴포넌트가 초기 렌더링 시점에 컨테이너 크기를 제대로 인식하지 못하는 이슈로 확인되었습니다.\n\n" +
        "현재 임시 조치로는 키워드를 한번 더 전환하는 방식으로 정상 렌더링이 가능하지만, 근본적인 해결을 위해 1) 감성 분석 데이터 로딩 시점 조정 및 2) 차트 라이브러리 옵션 수정을 진행하고 있습니다.\n\n" +
        "해당 수정은 12월 11일 새벽 점검 배포에 포함될 예정이며, 배포 이후에도 동일 현상이 반복될 경우 다시 한번 제보해 주시면 감사하겠습니다.\n\n" +
        "서비스 이용에 불편을 드려 죄송하며, 더 안정적인 대시보드 제공을 위해 계속해서 개선해 나가겠습니다.",
    },
  },
  {
    id: 4,
    typeKey: "idea",
    typeLabel: "기능 제안",
    title: "언론사별 편향도 지수에 기간 비교(전일 대비) 기능 추가 요청",
    date: "2025-12-08",
    status: "processing",
    author: "newsight_user07",
    createdAt: "2025-12-08 11:10",
    body:
      "언론사별 편향도 지수가 너무 유용합니다.\n\n" +
      "다만 '오늘' 값만 보이는 것보다, 전일 대비 변화(증감)를 같이 보여주면 트렌드를 더 빨리 파악할 수 있을 것 같습니다.\n\n" +
      "가능하다면 최근 7일 평균 대비도 함께 볼 수 있으면 좋겠습니다.",
  },
  {
    id: 3,
    typeKey: "data",
    typeLabel: "데이터 문의",
    title: "수집된 기사 원문 데이터를 연구 목적으로 활용할 수 있을까요?",
    date: "2025-12-03",
    status: "done",
    author: "researcher_02",
    createdAt: "2025-12-03 09:44",
    body:
      "연구 과제로 언론사 비교 분석을 진행하고 있습니다.\n\n" +
      "Newsight에서 수집된 기사 데이터(제목/본문/언론사 메타)를 연구 목적으로 사용할 수 있는지 궁금합니다.\n\n" +
      "가능하다면 제공 범위와 절차를 안내 부탁드립니다.",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-12-03 13:02",
      body:
        "안녕하세요, Newsight 운영팀입니다.\n\n" +
        "현재 서비스 내 수집 데이터는 제휴/저작권 이슈로 인해 원문(본문) 전체 제공은 제한될 수 있습니다.\n\n" +
        "다만 연구 목적의 최소 범위(제목/링크/일부 메타) 제공은 내부 검토 후 가능할 수 있어, 문의 내용을 바탕으로 별도 안내드리겠습니다.\n\n" +
        "추가로 필요한 항목(기간/키워드/형식)을 회신 주시면 검토에 도움이 됩니다.",
    },
  },
  {
    id: 2,
    typeKey: "account",
    typeLabel: "계정/로그인",
    title: "비밀번호를 잊어버렸어요",
    date: "2025-11-30",
    status: "done",
    isPrivate: true,
    author: "newsight_user99",
    createdAt: "2025-11-30 19:20",
    body:
      "비밀번호를 분실했습니다.\n\n" + "비밀번호 재설정 링크를 이메일로 받을 수 있을까요?",
    answer: {
      teamLabel: "Newsight 운영팀",
      answeredAt: "2025-11-30 19:55",
      body:
        "안녕하세요, Newsight 운영팀입니다.\n\n" +
        "로그인 화면의 '비밀번호 찾기'를 통해 재설정 링크를 이메일로 발송받을 수 있습니다.\n\n" +
        "만약 메일이 도착하지 않는다면 스팸함을 확인해 주세요.",
    },
  },
  {
    id: 1,
    typeKey: "etc",
    typeLabel: "기타",
    title: "서비스 이용 요금제 및 향후 정식 오픈 일정 문의",
    date: "2025-11-20",
    status: "processing",
    author: "visitor_01",
    createdAt: "2025-11-20 08:12",
    body:
      "서비스가 너무 흥미롭습니다.\n\n" +
      "향후 요금제가 생기는지, 정식 오픈 일정이 있는지 궁금합니다.",
  },
];

export function getInquiryById(id: number): InquiryItem | undefined {
  return getAllInquiries().find((it) => it.id === id);
}
