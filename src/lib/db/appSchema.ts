import type { Client } from "@libsql/client";

export async function applyAppSchema(client: Client): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
      category TEXT NOT NULL CHECK(category IN ('restaurant','cafe','accommodation','attraction')),
      address TEXT NULL CHECK(address IS NULL OR length(address) <= 200),
      rating REAL NULL CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
      memo TEXT NULL CHECK(memo IS NULL OR length(memo) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY,
      place_id INTEGER NOT NULL,
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
      price_krw INTEGER NOT NULL CHECK(price_krw >= 0 AND price_krw <= 10000000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY,
      place_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      caption TEXT NULL CHECK(caption IS NULL OR length(caption) <= 140),
      order_index INTEGER NOT NULL CHECK(order_index >= 1 AND order_index <= 20),
      created_at TEXT NOT NULL,
      FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE,
      UNIQUE(place_id, order_index)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 30),
      age_group TEXT NOT NULL CHECK(age_group IN ('20s','30s','40plus')),
      preferred_tone TEXT NOT NULL CHECK(preferred_tone IN ('casual','detailed')),
      primary_platform TEXT NOT NULL CHECK(primary_platform IN ('naver','tistory','medium')),
      watermark_text TEXT NULL,
      watermark_position TEXT NOT NULL DEFAULT 'bottom-right' CHECK(watermark_position IN ('bottom-right','bottom-left','top-right','top-left')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS style_profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NULL,
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
      description TEXT NULL,
      is_system_preset INTEGER NOT NULL CHECK(is_system_preset IN (0,1)),
      sample_texts_json TEXT NOT NULL,
      analyzed_tone_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK((is_system_preset=1 AND user_id IS NULL) OR (is_system_preset=0 AND user_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS platform_connections (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('tistory','medium')),
      access_token TEXT NOT NULL,
      blog_name TEXT NULL,
      platform_user_id TEXT NULL,
      platform_username TEXT NULL,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, platform)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      place_id INTEGER NOT NULL,
      style_profile_id INTEGER NOT NULL,
      title_ko TEXT NULL,
      content_ko TEXT NULL,
      hashtags_ko_json TEXT NOT NULL DEFAULT '[]',
      title_en TEXT NULL,
      content_en TEXT NULL,
      hashtags_en_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('draft','generated')),
      generation_error TEXT NULL,
      scheduled_at TEXT NULL,
      scheduled_platform TEXT NULL CHECK(scheduled_platform IS NULL OR scheduled_platform IN ('tistory','medium','wordpress','naver')),
      scheduled_lang TEXT NULL CHECK(scheduled_lang IS NULL OR scheduled_lang IN ('ko','en')),
      is_revisit INTEGER NOT NULL DEFAULT 0 CHECK(is_revisit IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE RESTRICT,
      FOREIGN KEY(style_profile_id) REFERENCES style_profiles(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS publish_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('tistory','medium','wordpress','naver')),
      lang TEXT NOT NULL CHECK(lang IN ('ko','en')),
      published_url TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','failed','copied')),
      error TEXT,
      published_at TEXT NOT NULL,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS post_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('tistory','medium','wordpress','naver')),
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
  `);

  await seedSystemPresets(client);
}

const SYSTEM_PRESETS = [
  {
    name: "일상 블로거",
    description: "친근하고 따뜻한 톤. ~했어요 체로 일상을 나누듯 자연스럽게 씁니다.",
    sampleTexts: [
      "오늘 정말 재미있는 경험을 했어요! 솔직히 처음엔 걱정됐는데 결과가 너무 좋았어요.",
      "이건 꼭 써봐야 해요. 생각보다 훨씬 편하고 가성비도 최고예요.",
    ],
    analyzedTone: { tone: "casual", formality: "low", emotion: "warm" },
  },
  {
    name: "전문 리뷰어",
    description: "객관적이고 꼼꼼한 톤. 장단점을 균형 있게 분석합니다.",
    sampleTexts: [
      "본 포스팅에서는 최신 트렌드를 심층적으로 분석하겠습니다.",
      "데이터를 기반으로 객관적인 시각을 제시하며 독자의 이해를 돕겠습니다.",
    ],
    analyzedTone: { tone: "detailed", formality: "high", emotion: "neutral" },
  },
  {
    name: "감성 에세이",
    description: "서정적이고 감성적인 톤. 분위기와 감정 묘사에 집중합니다.",
    sampleTexts: [
      "창밖으로 스며드는 오후 햇살이 참 좋았어요. 커피 한 잔의 여유가 이렇게 소중하다니.",
      "골목길을 걷다 보면 문득 시간이 멈춘 듯한 공간을 만나게 되는데, 이곳이 딱 그랬어요.",
    ],
    analyzedTone: { tone: "casual", formality: "medium", emotion: "warm" },
  },
  {
    name: "실용 정보형",
    description: "핵심 정보를 간결하게 전달. 가격, 위치, 꿀팁 위주로 씁니다.",
    sampleTexts: [
      "주차는 건물 뒤편 무료 주차장 이용 가능. 평일 점심은 웨이팅 필수.",
      "가성비로 따지면 A메뉴가 가장 낫고, 2인 기준 3만원이면 충분합니다.",
    ],
    analyzedTone: { tone: "detailed", formality: "medium", emotion: "neutral" },
  },
];

async function seedSystemPresets(client: Client): Promise<void> {
  const now = new Date().toISOString();

  // Add description column if missing (for existing DBs) — MUST run before any query that references description
  try {
    await client.execute("ALTER TABLE style_profiles ADD COLUMN description TEXT NULL");
  } catch {
    // Column already exists — ignore
  }

  // Migrate old English preset names
  await client.execute({ sql: "UPDATE style_profiles SET name = ?, description = ? WHERE name = ? AND is_system_preset = 1", args: ["일상 블로거", SYSTEM_PRESETS[0].description, "Casual Blogger"] });
  await client.execute({ sql: "UPDATE style_profiles SET name = ?, description = ? WHERE name = ? AND is_system_preset = 1", args: ["전문 리뷰어", SYSTEM_PRESETS[1].description, "Professional Writer"] });

  // Update descriptions for existing Korean presets
  for (const preset of SYSTEM_PRESETS) {
    await client.execute({
      sql: "UPDATE style_profiles SET description = ? WHERE name = ? AND is_system_preset = 1 AND (description IS NULL OR description = '')",
      args: [preset.description, preset.name],
    });
  }

  const existing = await client.execute(
    "SELECT name FROM style_profiles WHERE is_system_preset = 1",
  );
  const existingNames = existing.rows.map((r) => r.name as string);

  for (const preset of SYSTEM_PRESETS) {
    if (!existingNames.includes(preset.name)) {
      await client.execute({
        sql: `INSERT INTO style_profiles (user_id, name, description, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
              VALUES (NULL, ?, ?, 1, ?, ?, ?, ?)`,
        args: [
          preset.name,
          preset.description,
          JSON.stringify(preset.sampleTexts),
          JSON.stringify(preset.analyzedTone),
          now,
          now,
        ],
      });
    }
  }
}
