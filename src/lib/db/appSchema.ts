import type Database from "better-sqlite3";

export function applyAppSchema(db: Database.Database): void {
  db.exec(`
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
      order_index INTEGER NOT NULL CHECK(order_index >= 1 AND order_index <= 10),
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS style_profiles (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NULL,
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
      is_system_preset INTEGER NOT NULL CHECK(is_system_preset IN (0,1)),
      sample_texts_json TEXT NOT NULL,
      analyzed_tone_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      CHECK((is_system_preset=1 AND user_id IS NULL) OR (is_system_preset=0 AND user_id IS NOT NULL))
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE RESTRICT,
      FOREIGN KEY(style_profile_id) REFERENCES style_profiles(id) ON DELETE RESTRICT
    );
  `);

  seedSystemPresets(db);
}

function seedSystemPresets(db: Database.Database): void {
  const now = new Date().toISOString();

  const insert = db.prepare(
    `INSERT INTO style_profiles (user_id, name, is_system_preset, sample_texts_json, analyzed_tone_json, created_at, updated_at)
     VALUES (NULL, ?, 1, ?, ?, ?, ?)`,
  );

  const existingNames = (
    db.prepare("SELECT name FROM style_profiles WHERE is_system_preset = 1").all() as { name: string }[]
  ).map((r) => r.name);

  if (!existingNames.includes("Casual Blogger")) {
    insert.run(
      "Casual Blogger",
      JSON.stringify([
        "오늘 정말 재미있는 경험을 했어요! 솔직히 처음엔 걱정됐는데 결과가 너무 좋았어요.",
        "이건 꼭 써봐야 해요. 생각보다 훨씬 편하고 가성비도 최고예요.",
      ]),
      JSON.stringify({ tone: "casual", formality: "low", emotion: "warm" }),
      now,
      now,
    );
  }

  if (!existingNames.includes("Professional Writer")) {
    insert.run(
      "Professional Writer",
      JSON.stringify([
        "본 포스팅에서는 최신 트렌드를 심층적으로 분석하겠습니다.",
        "데이터를 기반으로 객관적인 시각을 제시하며 독자의 이해를 돕겠습니다.",
      ]),
      JSON.stringify({ tone: "detailed", formality: "high", emotion: "neutral" }),
      now,
      now,
    );
  }
}
