# TASK
## Epic 1. Data Layer

### Task 1.1 Add `user_profiles` table + model helpers
- Description:
  - Create DB schema for `user_profiles` per SPEC (constraints + timestamps).
  - Add a small data model with CRUD helpers and camelCase↔snake_case mapping.
  - Ensure schema is applied on server start by updating the existing DB init module.
- DoD:
  - [ ] `user_profiles` table exists with `nickname` length constraint (1–30) and enum checks for `age_group`, `preferred_tone`, `primary_platform`.
  - [ ] Model exposes `getByUserId(userId)`, `create(userId, input)`, `update(userId, patch)` in TypeScript strict.
  - [ ] Creating a row for the same `user_id` twice fails due to UNIQUE constraint (verified via quick node/route usage).
  - [ ] App builds (`pnpm build`).
- Covers: [F1-AC1 (data support), F1-AC2 (data support), F1-AC3 (data support), F1-AC4 (data support)]
- Files:  
  - `src/lib/db/appSchema.ts` (create)  
  - `src/lib/db.ts` (modify)  
  - `src/lib/models/userProfile.ts` (create)  
  - `src/lib/models/modelTypes.ts` (create)
- Depends on: [none]

### Task 1.2 Add `style_profiles` table + seed 2 system presets + model helpers
- Description:
  - Add `style_profiles` table per SPEC, including system-preset constraints.
  - Seed exactly 2 system presets (`is_system_preset=1`, `user_id=NULL`) during schema initialization.
  - Add model helpers for listing presets/customs, creating custom, getting by id, deleting with ownership checks.
- DoD:
  - [ ] `style_profiles` table exists with constraints: `is_system_preset IN (0,1)` and `user_id NULL iff is_system_preset=1`.
  - [ ] On a fresh DB, exactly 2 rows exist where `is_system_preset=1`.
  - [ ] Model can return `{presets, customs}` for a given userId without throwing.
  - [ ] App builds (`pnpm build`).
- Covers: [F2-AC1 (data support), F2-AC2 (data support), F2-AC4 (data support), F2-AC7 (data support)]
- Files:
  - `src/lib/db/appSchema.ts` (modify)
  - `src/lib/models/styleProfile.ts` (create)
- Depends on: [Task 1.1]

### Task 1.3 Add `places` + `menu_items` tables + model helpers
- Description:
  - Add DB tables `places` and `menu_items` per SPEC (constraints + FK cascade).
  - Implement model helpers to create a place (optionally with initial menu items), get place with menu items, patch place fields, add/delete menu items.
- DoD:
  - [ ] `places` table has enum constraint for `category` and `rating` check (1..5 when non-null).
  - [ ] `menu_items` table FK `place_id` has `ON DELETE CASCADE`.
  - [ ] Model supports: `createPlace(input)`, `getPlaceWithMenu(placeId)`, `patchPlace(placeId, patch)`, `addMenuItem(placeId, input)`, `deleteMenuItem(menuItemId)`.
  - [ ] App builds (`pnpm build`).
- Covers: [F3-AC1 (data support), F3-AC2 (data support), F3-AC3 (data support), F3-AC4 (data support)]
- Files:
  - `src/lib/db/appSchema.ts` (modify)
  - `src/lib/models/place.ts` (create)
  - `src/lib/models/menuItem.ts` (create)
- Depends on: [Task 1.1]

### Task 1.4 Add `photos` table + upload metadata model helper
- Description:
  - Add `photos` table per SPEC (unique `(place_id, order_index)`, caption length, order range).
  - Implement model helpers: create photo row, list by place, update caption, delete.
- DoD:
  - [ ] `photos` table exists with `order_index` check (1..10) and UNIQUE(`place_id`, `order_index`).
  - [ ] Model supports `createPhoto({placeId,filePath,caption,orderIndex})`, `listPhotos(placeId)`, `updateCaption(photoId, caption)`, `deletePhoto(photoId)`.
  - [ ] Listing photos returns sorted order by `order_index` (verified in query).
  - [ ] App builds (`pnpm build`).
- Covers: [F4-AC1 (data support), F4-AC2 (data support), F4-AC3 (data support)]
- Files:
  - `src/lib/db/appSchema.ts` (modify)
  - `src/lib/models/photo.ts` (create)
- Depends on: [Task 1.3]

### Task 1.5 Add `posts` table (schema only) for completeness
- Description:
  - Add `posts` table per SPEC (including JSON defaults and status check). No API/UI yet—schema only.
- DoD:
  - [ ] `posts` table exists with `status IN ('draft','generated')` check and hashtag JSON defaults `'[]'`.
  - [ ] FKs exist for `user_id`, `place_id`, `style_profile_id` with specified delete rules.
  - [ ] App builds (`pnpm build`).
- Covers: []
- Files:
  - `src/lib/db/appSchema.ts` (modify)
- Depends on: [Task 1.4]

---

## Epic 2. API Routes

### Task 2.1 API auth + error helpers (401 + error shape)
- Description:
  - Create shared helpers for:
    - requiring authenticated session (server-side session lookup using template auth)
    - returning JSON errors in the SPEC error shape
    - mapping validation errors to `400` with `code="VALIDATION_ERROR"` and `fields`
- DoD:
  - [ ] `requireAuthUser()` returns `{userId}` for authenticated requests; otherwise throws/returns a `401` JSON response containing `error.code`.
  - [ ] `jsonError(status, code, message, fields?)` produces `{"error":{"code","message","fields?"}}`.
  - [ ] At least one route (can be a tiny `/api/_health-auth`) uses the helper and returns 401 when logged out (manual check).
  - [ ] App builds (`pnpm build`).
- Covers: [F1-AC6 (enabler), F2-AC8 (enabler), F3-AC7 (enabler), F4-AC7 (enabler)]
- Files:
  - `src/lib/api/errors.ts` (create)
  - `src/lib/api/auth.ts` (create)
  - `src/app/api/_health-auth/route.ts` (create)
- Depends on: [Task 1.1]

### Task 2.2 `GET /api/profile` route
- Description:
  - Implement `GET /api/profile` to return `{profile: ... | null}` for the authenticated user.
- DoD:
  - [ ] Unauthenticated call returns `401` with JSON containing `error.code`.
  - [ ] Authenticated user with no row returns `200` with `{ profile: null }`.
  - [ ] Authenticated user with row returns `200` and camelCased fields per contract.
  - [ ] App builds (`pnpm build`).
- Covers: [F1-AC1, F1-AC6]
- Files:
  - `src/app/api/profile/route.ts` (create)
- Depends on: [Task 2.1, Task 1.1]

### Task 2.3 `POST /api/profile` route (create + validation + duplicate protection)
- Description:
  - Implement `POST /api/profile` to create a profile for the authenticated user with full validation.
- DoD:
  - [ ] Valid input creates a profile and returns `200` with `profile.nickname` matching request.
  - [ ] Invalid enum (e.g., `ageGroup="10s"`) returns `400` with `error.code="VALIDATION_ERROR"` and non-empty `error.fields.ageGroup`.
  - [ ] Calling POST when profile already exists returns `400` with `error.code="VALIDATION_ERROR"`.
  - [ ] App builds (`pnpm build`).
- Covers: [F1-AC2, F1-AC3, F1-AC5]
- Files:
  - `src/app/api/profile/route.ts` (modify)
  - `src/lib/validators/profile.ts` (create)
- Depends on: [Task 2.2]

### Task 2.4 `PATCH /api/profile` route (partial update)
- Description:
  - Implement `PATCH /api/profile` to update an existing profile for the authenticated user; return 404 if missing.
- DoD:
  - [ ] If no profile exists, returns `404` with `error.code="NOT_FOUND"`.
  - [ ] Patch `{ preferredTone: "detailed" }` returns `200` and `profile.preferredTone==="detailed"`.
  - [ ] Invalid fields return `400` with `error.code="VALIDATION_ERROR"` and field messages.
  - [ ] App builds (`pnpm build`).
- Covers: [F1-AC4]
- Files:
  - `src/app/api/profile/route.ts` (modify)
- Depends on: [Task 2.3]

### Task 2.5 `GET /api/style-profiles` route (presets + customs)
- Description:
  - Implement listing route returning `{ presets: StyleProfileSummary[], customs: StyleProfileSummary[] }`.
- DoD:
  - [ ] Unauthenticated returns `401` with `error.code`.
  - [ ] Authenticated returns `200` and `presets.length===2` (from seeded system presets).
  - [ ] Response objects use camelCase and only summary fields.
  - [ ] App builds (`pnpm build`).
- Covers: [F2-AC1, F2-AC8]
- Files:
  - `src/app/api/style-profiles/route.ts` (create)
- Depends on: [Task 1.2, Task 2.1]

### Task 2.6 `POST /api/style-profiles` route (create custom + analyzedTone)
- Description:
  - Implement custom style profile creation with:
    - `sampleTexts` validation (length 3–5)
    - `analyzedTone` computed as a non-null object (MVP heuristic is fine; must be an object)
- DoD:
  - [ ] `sampleTexts.length===3` returns `200` and `styleProfile.sampleTexts.length===3`.
  - [ ] Response includes `styleProfile.analyzedTone` as an object (typeof === "object", not null).
  - [ ] `sampleTexts.length===2` returns `400` with non-empty `error.fields.sampleTexts`.
  - [ ] `sampleTexts.length===6` returns `400` with non-empty `error.fields.sampleTexts`.
- Covers: [F2-AC2, F2-AC3, F2-AC5, F2-AC6]
- Files:
  - `src/app/api/style-profiles/route.ts` (modify)
  - `src/lib/validators/styleProfile.ts` (create)
  - `src/lib/style/analyzeTone.ts` (create)
- Depends on: [Task 2.5]

### Task 2.7 `GET /api/style-profiles/:id` route
- Description:
  - Implement detail route returning full style profile, readable by any authenticated user for system presets; customs can be read only by owner.
- DoD:
  - [ ] Unauthenticated returns