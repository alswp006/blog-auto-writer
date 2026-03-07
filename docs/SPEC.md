# SPEC

## Common Principles
- **Auth & authorization**
  - All `/api/**` endpoints in this SPEC require an authenticated session **unless explicitly marked public**.
  - Auth is enforced by server-side session lookup (template repo auth). Unauthorized requests return **`401`** with JSON error shape.
  - Resource authorization rule: a user can only access rows where `userId` matches their session user id (except `style_profiles.isSystemPreset=1`, which are readable by any authenticated user).
- **API conventions**
  - Request/response JSON uses **camelCase**.
  - DB uses **snake_case**.
  - Success responses are JSON and include only fields documented in the contract.
  - Error response shape (all non-2xx):
    - `{"error": {"code": string, "message": string, "fields"?: Record<string, string>}}`
  - Validation errors return **`400`** with `error.code = "VALIDATION_ERROR"` and `fields` containing per-field messages.
  - Not-found returns **`404`** with `error.code = "NOT_FOUND"`.
- **File upload conventions**
  - Photo uploads use `multipart/form-data` with field name `file`.
  - Allowed mime types: `image/jpeg`, `image/png`, `image/webp`.
  - Max file size: **10 MB per photo**.
  - Stored on local filesystem under `./uploads/` with a persisted `filePath` (relative path).
- **Generation conventions (MVP)**
  - Post generation is executed via a server endpoint that writes results to the `posts` row.
  - On a generation attempt: the server performs **at most 2 internal attempts** (initial + 1 auto-retry). If both fail, the request returns `500` and writes `generationError`.
  - Hashtags are stored without `#` prefix in DB; formatting for platform output may add `#` where required.

---

## Data Models

### user_profiles — fields, types, constraints
- **Table:** `user_profiles`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `user_id` INTEGER NOT NULL UNIQUE — FK → `users.id`
  - `nickname` TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 30)
  - `age_group` TEXT NOT NULL CHECK(age_group IN ('20s','30s','40plus'))
  - `preferred_tone` TEXT NOT NULL CHECK(preferred_tone IN ('casual','detailed'))
  - `primary_platform` TEXT NOT NULL CHECK(primary_platform IN ('naver','tistory','medium'))
  - `created_at` TEXT NOT NULL (ISO string)
  - `updated_at` TEXT NOT NULL (ISO string)
- **Relationships:** 1:1 with `users`

### style_profiles — fields, types, constraints
- **Table:** `style_profiles`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `user_id` INTEGER NULL — FK → `users.id` (NULL allowed for system presets)
  - `name` TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40)
  - `is_system_preset` INTEGER NOT NULL CHECK(is_system_preset IN (0,1))
  - `sample_texts_json` TEXT NOT NULL — JSON string array; for system presets can be `[]`
  - `analyzed_tone_json` TEXT NOT NULL — JSON object string
  - `created_at` TEXT NOT NULL
  - `updated_at` TEXT NOT NULL
- **Constraints:**
  - If `is_system_preset = 1` then `user_id IS NULL`
  - If `is_system_preset = 0` then `user_id IS NOT NULL`
- **Relationships:** 1:N with `posts` (`posts.style_profile_id`)

### places — fields, types, constraints
- **Table:** `places`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `name` TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80)
  - `category` TEXT NOT NULL CHECK(category IN ('restaurant','cafe','accommodation','attraction'))
  - `address` TEXT NULL CHECK(address IS NULL OR length(address) <= 200)
  - `rating` REAL NULL CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5))
  - `memo` TEXT NULL CHECK(memo IS NULL OR length(memo) <= 1000)
  - `created_at` TEXT NOT NULL
  - `updated_at` TEXT NOT NULL
- **Relationships:** 1:N with `menu_items`, 1:N with `photos`, 1:N with `posts`

### menu_items — fields, types, constraints
- **Table:** `menu_items`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `place_id` INTEGER NOT NULL — FK → `places.id` ON DELETE CASCADE
  - `name` TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80)
  - `price_krw` INTEGER NOT NULL CHECK(price_krw >= 0 AND price_krw <= 10000000)
  - `created_at` TEXT NOT NULL
  - `updated_at` TEXT NOT NULL
- **Relationships:** N:1 to `places`

### photos — fields, types, constraints
- **Table:** `photos`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `place_id` INTEGER NOT NULL — FK → `places.id` ON DELETE CASCADE
  - `file_path` TEXT NOT NULL
  - `caption` TEXT NULL CHECK(caption IS NULL OR length(caption) <= 140)
  - `order_index` INTEGER NOT NULL CHECK(order_index >= 1 AND order_index <= 10)
  - `created_at` TEXT NOT NULL
- **Constraints:**
  - UNIQUE(`place_id`, `order_index`)
- **Relationships:** N:1 to `places`

### posts — fields, types, constraints
- **Table:** `posts`
- **Columns:**
  - `id` INTEGER PRIMARY KEY
  - `user_id` INTEGER NOT NULL — FK → `users.id` ON DELETE CASCADE
  - `place_id` INTEGER NOT NULL — FK → `places.id` ON DELETE RESTRICT
  - `style_profile_id` INTEGER NOT NULL — FK → `style_profiles.id` ON DELETE RESTRICT
  - `title_ko` TEXT NULL
  - `content_ko` TEXT NULL
  - `hashtags_ko_json` TEXT NOT NULL DEFAULT '[]' — JSON string array
  - `title_en` TEXT NULL
  - `content_en` TEXT NULL
  - `hashtags_en_json` TEXT NOT NULL DEFAULT '[]' — JSON string array
  - `status` TEXT NOT NULL CHECK(status IN ('draft','generated'))
  - `generation_error` TEXT NULL
  - `created_at` TEXT NOT NULL
  - `updated_at` TEXT NOT NULL
- **Constraints:**
  - When `status='generated'`, `title_ko`, `content_ko`, `title_en`, `content_en` are NOT NULL (enforced at application layer).
- **Relationships:** N:1 to `users`, N:1 to `places`, N:1 to `style_profiles`

---

## Feature List

### F1. Onboarding User Profile (personalization settings)
- **Description:** On first use, the user creates a profile containing nickname, age group, preferred tone, and primary platform. These settings are saved and later used to influence generation prompts and default platform selection in the UI.
- **Data:** `user_profiles`
- **API:**
  - `GET /api/profile → { profile: { nickname: string, ageGroup: '20s'|'30s'|'40plus', preferredTone: 'casual'|'detailed', primaryPlatform: 'naver'|'tistory'|'medium', createdAt: string, updatedAt: string } | null } | 401`
  - `POST /api/profile { nickname: string, ageGroup: ..., preferredTone: ..., primaryPlatform: ... } → { profile: ... } | 401 | 400`
  - `PATCH /api/profile { nickname?: string, ageGroup?: ..., preferredTone?: ..., primaryPlatform?: ... } → { profile: ... } | 401 | 400 | 404`
- **Requirements:**
  - AC-1: Given an authenticated user with no `user_profiles` row, When `GET /api/profile` is called, Then the response status is `200` and `profile` is `null`.
  - AC-2: Given an authenticated user, When `POST /api/profile` is called with `nickname` length `1..30` and valid enums, Then the response status is `200` and the returned `profile.nickname` equals the request `nickname`.
  - AC-3: Given an authenticated user who already has a profile, When `POST /api/profile` is called, Then the response status is `400` and `error.code` equals `"VALIDATION_ERROR"`.
  - AC-4: Given an authenticated user with an existing profile, When `PATCH /api/profile` is called with `{ preferredTone: "detailed" }`, Then the response status is `200` and `profile.preferredTone` equals `"detailed"`.
  - AC-5 (edge): Given an authenticated user, When `POST /api/profile` is called with `ageGroup: "10s"` (invalid), Then the response status is `400` and `error.fields.ageGroup` is a non-empty string.
  - AC-6 (auth): Given an unauthenticated user, When calling `GET /api/profile`, Then the response status is `401` and the response JSON contains `error.code`.

---

### F2. Style Profiles (presets + custom from sample texts)
- **Description:** The app provides two system preset style profiles and allows users to create custom style profiles by pasting 3–5 sample texts. Each style profile stores sample texts and a computed `analyzedTone` JSON used during generation.
- **Data:** `style_profiles`
- **API:**
  - `GET /api/style-profiles → { presets: StyleProfileSummary[], customs: StyleProfileSummary[] } | 401`
    - `StyleProfileSummary = { id: number, name: string, isSystemPreset: boolean, createdAt: string, updatedAt: string }`
  - `POST /api/style-profiles { name: string, sampleTexts: string[] } → { styleProfile: { id: number, name: string, isSystemPreset: false, sampleTexts: string[], analyzedTone: object, createdAt: string, updatedAt: string } } | 401 | 400`
  - `GET /api/style-profiles/:id → { styleProfile: { id: number, name: string, isSystemPreset: boolean, sampleTexts: string[], analyzedTone: object, createdAt: string, updatedAt: string } } | 401 | 404`
  - `DELETE /api/style-profiles/:id → { deleted: true } | 401 | 404 | 403`
- **Requirements:**
  - AC-1: Given an authenticated user, When `GET /api/style-profiles` is called, Then the response status is `200` and `presets.length` equals `2`.
  - AC-2: Given an authenticated user, When `POST /api/style-profiles` is called with `sampleTexts` array length `3`, Then the response status is `200` and `styleProfile.sampleTexts.length` equals `3`.
  - AC-3: Given an authenticated user, When `POST /api/style-profiles` is called, Then the response JSON includes `styleProfile.analyzedTone` as an object (not `null`).
  - AC-4: Given an authenticated user, When `GET /api/style-profiles/:id` is called for a system preset id, Then the response status is `200` and `styleProfile.isSystemPreset` equals `true`.
  - AC-5 (edge): Given an authenticated user, When `POST /api/style-profiles` is called with `sampleTexts.length = 2`, Then the response status is `400` and `error.fields.sampleTexts` is a non-empty string.
  - AC-6 (edge): Given an authenticated user, When `POST /api/style-profiles` is called with `sampleTexts.length = 6`, Then the response status is `400` and `error.fields.sampleTexts` is a non-empty string.
  - AC-7 (authz): Given an authenticated user A and a custom style profile owned by user B, When user A calls `DELETE /api/style-profiles/:id` for that profile, Then the response status is `403` and `error.code` equals `"FORBIDDEN"`.
  - AC-8 (auth): Given an unauthenticated user, When calling `GET /api/style-profiles`, Then the response status is `401`.

---

### F3. Place Input (place details + menu list)
- **Description:** Users can enter place information with required name and optional category/address/rating/memo, plus a list of menu items with prices. This data is later referenced by posts and generation.
- **Data:** `places`, `menu_items`
- **API:**
  - `POST /api/places { name: string, category: 'restaurant'|'cafe'|'accommodation'|'attraction', address?: string, rating?: number, memo?: string, menuItems?: { name: string, priceKrw: number }[] } → { place: PlaceDTO, menuItems: MenuItemDTO[] } | 401 | 400`
  - `GET /api/places/:id → { place: PlaceDTO, menuItems: MenuItemDTO[] } | 401 | 404`
  - `PATCH /api/places/:id { name?: string, category?: ..., address?: string|null, rating?: number|null, memo?: string|null } → { place: PlaceDTO } | 401 | 400 | 404`
  - `POST /api/places/:id/menu-items { name: string, priceKrw: number } → { menuItem: MenuItemDTO } | 401 | 400 | 404`
  - `DELETE /api/menu-items/:id → { deleted: true } | 401 | 404`
  - `PlaceDTO = { id: number, name: string, category: string, address: string|null, rating: number|null, memo: string|null, createdAt: string, updatedAt: string }`
  - `MenuItemDTO = { id: number, placeId: number, name: string, priceKrw: number, createdAt: string, updatedAt: string }`
- **Requirements:**
  - AC-1: Given an authenticated user, When `POST /api/places` is called with `{ name: "X", category: "cafe" }`, Then the response status is `200` and `place.name` equals `"X"`.
  - AC-2: Given an authenticated user, When `POST /api/places` is called with `menuItems` containing 2 items, Then the response status is `200` and `menuItems.length` equals `2`.
  - AC-3: Given an authenticated user, When `GET /api/places/:id` is called for an existing id, Then the response status is `200` and the response JSON includes `place.id` equal to the path id.
  - AC-4: Given an authenticated user, When `PATCH /api/places/:id` is called with `{ rating: 4.5 }`, Then the response status is `200` and `place.rating` equals `4.5`.
  - AC-5 (edge): Given an authenticated user, When `POST /api/places` is called with `{ name: "", category: "cafe" }`, Then the response status is `400` and `error.fields.name` is a non-empty string.
  - AC-6 (edge): Given an authenticated user, When `POST /api/places` is called with `{ name: "X", category: "cafe", rating: 6 }`, Then the response status is `400` and `error.fields.rating` is a non-empty string.
  - AC-7 (auth): Given an unauthenticated user, When calling `POST /api/places`, Then the response status is `401`.

---

### F4. Photo Upload (1–10) + per-photo captions
- **Description:** Users upload 1–10 photos for a place and optionally enter a caption per photo. Upload order is preserved via `orderIndex`, and missing captions are treated as `"사진 N"` during formatting/generation.
- **Data:** `photos`, filesystem `./uploads`
- **API:**
  - `POST /api/places/:placeId/photos (multipart/form-data: file, caption?: string, orderIndex: number) → { photo: PhotoDTO } | 401 | 400 | 404`
  - `GET /api/places/:placeId/photos → { photos: PhotoDTO[] } | 401 | 404`
  - `PATCH /api/photos/:id { caption: string|null } → { photo: PhotoDTO } | 401 | 400 | 404`
  - `DELETE /api/photos/:id → { deleted: true } | 401 | 404`
  - `PhotoDTO = { id: number, placeId: number, filePath: string, caption: string|null, orderIndex: number, createdAt: string }`
- **Requirements:**
  - AC-1: Given an authenticated user and an existing place id, When `POST /api/places/:placeId/photos` uploads a `image/jpeg` file with `orderIndex: 1`, Then the response status is `200` and `photo.orderIndex` equals `1`.
  - AC-2: Given an authenticated user and an existing place id with 2 uploaded photos, When `GET /api/places/:placeId/photos` is called, Then the response status is `200` and `photos.length` equals `2`.
  - AC-3: Given an authenticated user and an existing photo id, When `PATCH /api/photos/:id` is called with `{ caption: "입구 간판" }`, Then the response status is `200` and `photo.caption` equals `"입구 간판"`.
  - AC-4 (edge): Given an authenticated user and an existing place id, When uploading a photo with `orderIndex: 11`, Then the response status is `400` and `error.fields.orderIndex` is a non-empty string.
  - AC-5 (edge): Given an authenticated user and an existing place id, When uploading a file with mime type `image/gif`, Then the response status is `400` and `error.fields.file` is a non-empty string.
  - AC-6 (edge): Given an authenticated user and an existing place id that already has 10 photos, When uploading an 11th photo, Then the response status is `400` and `error.code` equals `"VALIDATION_ERROR"`.
  - AC-7 (auth): Given an unauthenticated user, When calling `POST /api/places/:placeId