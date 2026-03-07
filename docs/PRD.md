# Blog Auto Writer (blog-auto-writer)

# PRD
## Background / Problem
블로그(네이버/티스토리/Medium)로 광고 수익을 내려는 가족 구성원들은 맛집/카페/숙소/여행지 방문 후 글 1편 작성에 **1~2시간**이 소요된다. 사진 정리, 글 구성, SEO 제목 작성, 플랫폼별 포맷 변환까지 합치면 **하루 1개 포스팅도 벅찬** 상황이며, 같은 장소를 한국어+영어로 동시 발행하면 시간이 사실상 2배로 늘어난다. 특히 네이버 저품질 우려로 “AI 티”가 나지 않는 자연스러운 글이 필요하지만, 이를 수작업으로 맞추기에는 시간 비용이 과도하다.

## Goal (1-sentence product definition)
사진(최소 1장)과 장소 정보/짧은 메모만 입력하면 **5분 이내**에 사용자 나이대/문체에 맞춘 **한국어+영어 블로그 글을 생성**하고, **네이버(HTML)/티스토리(MD)/Medium(MD) 포맷으로 원클릭 복사**까지 완료하게 한다.

## Non-goals
- 티스토리/Medium/WordPress 등 **플랫폼 API 자동 발행**
- 네이버/구글 기반 **장소 검색 자동완성** 및 외부 지도/플레이스 연동
- 예약 발행, 수익 대시보드, 애드센스/애드포스트 연동
- SEO 키워드 추천 엔진(키워드 리서치/난이도 등)
- 이미지 워터마크/AI 사진 분석(이미지 내용 인식) 및 사진 순서 변경
- 사진 없이 텍스트만으로 글 생성(항상 **사진 최소 1장 필수**)

## Target Users (personas + use cases)
- **민지 (28세, 직장인)** — 주말 방문한 맛집/카페를 네이버 블로그에 올려 애드포스트 수익을 내지만, 평일에는 글 작성 시간이 없어 업로드가 끊긴다. (원하는 것: 이모지/친근한 일상체의 빠른 글 완성 + 네이버 포맷 복사)
- **수현 (45세, 주부)** — 가족 여행 후기를 티스토리에 상세 리뷰로 올리며 애드센스 수익을 기대한다. 영어 블로그도 시작하고 싶지만 번역/영어 교정이 부담이다. (원하는 것: 차분하고 자세한 톤 + 한영 동시 생성 + 티스토리/Medium용 마크다운 복사)

## Target Market
- **South Korea (KR)**: 네이버 블로그/티스토리 사용 비중이 높고, 가족 단위의 여행/맛집 후기 콘텐츠 제작 수요가 큰 시장

## Data Entities (nouns with key fields)
- **UserProfile**
  - `id`, `userId`
  - `nickname`
  - `ageGroup` (enum: `20s` | `30s` | `40plus`)
  - `preferredTone` (enum: `casual` | `detailed`)
  - `primaryPlatform` (enum: `naver` | `tistory` | `medium`)
  - `createdAt`, `updatedAt`
- **StyleProfile**
  - `id`, `userId`
  - `name`
  - `isSystemPreset` (boolean)
  - `sampleTexts` (string[]; 커스텀 프로필 생성용 3~5개)
  - `analyzedTone` (JSON: 예 `formality`, `emojiFrequency`, `sentenceLengthRange` 등)
  - `createdAt`, `updatedAt`
- **Place**
  - `id`
  - `name` (required)
  - `category` (enum: `restaurant` | `cafe` | `accommodation` | `attraction`)
  - `address` (optional)
  - `rating` (number; 1~5, optional)
  - `memo` (optional)
  - `createdAt`, `updatedAt`
- **MenuItem**
  - `id`, `placeId`
  - `name`
  - `priceKrw` (number)
  - `createdAt`, `updatedAt`
- **Photo**
  - `id`, `placeId`
  - `filePath` (업로드 저장 경로)
  - `caption` (optional; 한줄 설명)
  - `orderIndex` (number; 업로드 순서 고정)
  - `createdAt`
- **Post**
  - `id`, `userId`, `placeId`, `styleProfileId`
  - `titleKo`, `contentKo`, `hashtagsKo` (string[])
  - `titleEn`, `contentEn`, `hashtagsEn` (string[])
  - `status` (enum: `draft` | `generated`)
  - `generationError` (string | null)
  - `createdAt`, `updatedAt`

## Core Flow (numbered steps)
1. 사용자 로그인 후 대시보드에서 **새 글 작성** 진입  
2. **장소 정보 입력**(장소명 필수, 카테고리/주소/별점/메뉴+가격/메모 선택)  
3. **사진 1~10장 업로드** 및 사진별 한줄 설명(선택) 입력  
4. **문체 프로필 선택**(기본 프리셋 2개 또는 커스텀 프로필)  
5. **글 생성** 실행 → 실패 시 자동 1회 재시도, 이후 사용자가 **다시 시도** 가능  
6. 생성 결과를 **미리보기/텍스트 수정** 후, 플랫폼별 포맷으로 **원클릭 복사**(네이버/티스토리/Medium)

## Success Metrics (measurable)
- 주 1회 이상 글 생성하는 **활성 가족 구성원 3명+**
- 글 생성 완료까지 **평균 소요 시간 ≤ 5분**
- 생성된 글 중 **플랫폼별 “복사” 실행 비율 ≥ 80%**
- 가족 전체 **월 작성(생성) 글 수 ≥ 20개**
- (모니터링 지표) **네이버 저품질 처리율 0%** (3개월 관찰)

## MVP Scope (exhaustive feature list)
- **온보딩 기반 개인화 설정 저장**: 첫 로그인 시 닉네임/나이대/선호 문체/주 사용 플랫폼을 저장하고, 생성 프롬프트에 반영
- **장소 정보 입력 폼 + 메뉴 리스트**: 장소명 필수, 카테고리/주소/별점/메모/메뉴+가격(복수) 입력 지원
- **사진 업로드(1~10장) + 사진별 캡션(선택)**: 캡션 미입력 사진은 “사진 N”으로 처리, 캡션 입력 사진만 본문에 구체 반영
- **문체 프로필 관리**: 기본 프리셋 2개 제공 + 샘플 글 3~5개 붙여넣기 기반 커스텀 프로필 생성/저장/선택
- **AI 한영 동시 글 생성**: 카테고리별 글 구조 템플릿 적용, 영어는 번역이 아닌 외국인 관점 재작성(가까운 지하철역/달러 환산 1300원 고정/영어 메뉴 유무 포함), SEO 제목+해시태그 생성, 실패 시 자동 1회 재시도 + 수동 재시도
- **미리보기/텍스트 편집 + 플랫폼별 변환/복사**: 네이버 HTML, 티스토리 마크다운, Medium 마크다운으로 변환 후 복사 및 토스트 알림

## Target Audience & Marketing
- **Target user persona (1 sentence)**: 블로그로 부수입을 내고 싶지만 글 작성에 1~2시간을 쓰기 어려운 20~40대 가족 구성원.
- **Key value proposition (1 sentence)**: 사진만 올리면 5분 안에 한영 포스팅을 완성하고, 네이버/티스토리/Medium에 맞는 포맷으로 바로 복사해 “발행 직전”까지 시간을 줄인다.
- **3 top features for landing page hero section**
  1. 나이대/문체 프로필 기반 “AI 티 덜 나는” 톤으로 글 자동 생성
  2. 한국어+영어 동시 생성 + 플랫폼별(네이버/티스토리/Medium) 원클릭 복사
  3. 기본 프리셋으로 즉시 시작 + 샘플 글 붙여넣기로 커스텀 문체 저장
- **Desired brand tone**: practical (실용적)

## Monetization Strategy
- **Recommended strategy**: **freemium** (KR 시장 가이드에 따라 무료 진입 장벽을 낮추고, 반복 사용/가족 단위 사용에서 유료 전환 유도)
- **Payments**: Toss / KakaoPay / Stripe (결제 도입 시)
- **Pricing tiers (KRW)**
  - Free: 월 생성 10회, 기본 프리셋 2개, 플랫폼별 복사 제공
  - Plus (₩9,900/월): 월 생성 100회, 커스텀 문체 프로필 5개
  - Pro (₩19,900/월): 생성 무제한(합리적 사용 정책 별도), 커스텀 문체 프로필 20개, 우선 생성(큐 우선권)
- **Premium features (if freemium)**: 월 생성 횟수 상향/무제한, 커스텀 문체 프로필 개수 확장, 우선 생성

## Assumptions
1. 사용자는 글 생성에 필요한 최소 입력(장소명 + 사진 1장)을 제공할 의지가 있다.
2. 카테고리 4종(맛집/카페/숙소/여행지) 구조화만으로도 대부분의 후기 글 니즈를 커버한다.
3. 영어 글은 “직역”보다 “외국인 관점 재작성”이 사용자 만족에 더 기여한다.
4. 플랫폼별 변환은 텍스트 중심(HTML/MD)만으로도 MVP 가치가 충분하다(이미지 재배치/자동 삽입은 제외).
5. 네이버 저품질 우려를 줄이기 위해 구어체/문장 길이 랜덤화/개인 경험 표현이 도움이 된다.
6. 실패 시 자동 1회 재시도만으로도 체감 안정성이 크게 개선된다.
7. 가족 구성원은 각자 계정으로 로그인하며, 개인별 문체/나이대 설정이 필요하다.
8. 수익화 가이드는 앱 내부 콘텐츠 제작 대신 외부 링크 모음으로도 MVP 목적에 부합한다.

## Open Questions
1. “네이버 저품질 처리율 0%” 측정을 위한 관찰/수집 방식은 무엇으로 정의할 것인가(사용자 자가보고 vs 별도 기록)?
2. 영어 글의 “가장 가까운 지하철역” 정보는 사용자가 입력하지 않을 때 어떤 규칙으로 처리할 것인가(미기재 문구 vs 사용자 입력 필드 추가)?
3. 사진은 본문에 “자리표시자(사진 1)”로만 표현할지, 사용자가 붙여넣을 때 활용할 수 있는 캡션 목록을 별도로 제공할지?
4. “한영 해시태그”는 플랫폼별 관례가 달라서(네이버/티스토리/Medium) 기본 정책을 어떻게 둘 것인가(개수/형식/# 포함 여부)?
5. 커스텀 문체 프로필 생성 시 “톤 분석” 결과를 사용자에게 보여줄지(투명성) 아니면 저장만 할지?