import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execute } from "@/lib/db";
import { hashPassword, createSessionToken } from "@/lib/auth";
import * as placeModel from "@/lib/models/place";
import * as menuItemModel from "@/lib/models/menuItem";
import * as photoModel from "@/lib/models/photo";
import * as postModel from "@/lib/models/post";
import * as styleProfileModel from "@/lib/models/styleProfile";

const TEST_EMAIL = `test-mvp-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
let testUserId: number;
let sessionToken: string;

beforeEach(async () => {
  const hash = await hashPassword("password123");
  const result = await execute(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
    TEST_EMAIL + Math.random(),
    hash,
    "Test User",
  );
  testUserId = Number(result.lastInsertRowid);
  sessionToken = await createSessionToken(testUserId);
});

afterEach(async () => {
  // Clean up in FK order
  await execute("DELETE FROM posts WHERE user_id = ?", testUserId);
  await execute("DELETE FROM photos WHERE place_id IN (SELECT id FROM places)");
  await execute("DELETE FROM menu_items WHERE place_id IN (SELECT id FROM places)");
  await execute("DELETE FROM style_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM user_profiles WHERE user_id = ?", testUserId);
  await execute("DELETE FROM sessions WHERE userId = ?", testUserId);
  await execute("DELETE FROM users WHERE id = ?", testUserId);
});

describe("Place model", () => {
  it("creates and retrieves a place", async () => {
    const place = await placeModel.create({
      name: "Test Restaurant",
      category: "restaurant",
      address: "Seoul",
      rating: 4.5,
      memo: "Great food",
    });

    expect(place.id).toBeGreaterThan(0);
    expect(place.name).toBe("Test Restaurant");
    expect(place.category).toBe("restaurant");

    const found = await placeModel.getById(place.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Test Restaurant");

    // Cleanup
    await placeModel.remove(place.id);
  });
});

describe("Post model", () => {
  it("creates a draft post and updates with generated content", async () => {
    const place = await placeModel.create({
      name: "Test Place",
      category: "cafe",
    });

    const presets = await styleProfileModel.getSystemPresets();
    expect(presets.length).toBeGreaterThan(0);

    const post = await postModel.create({
      userId: testUserId,
      placeId: place.id,
      styleProfileId: presets[0].id,
    });

    expect(post.status).toBe("draft");
    expect(post.titleKo).toBeNull();

    const updated = await postModel.updateGenerated(post.id, {
      titleKo: "카페 리뷰",
      contentKo: "맛있는 커피",
      hashtagsKo: ["#카페", "#커피"],
      titleEn: "Cafe Review",
      contentEn: "Great coffee",
      hashtagsEn: ["#cafe", "#coffee"],
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("generated");
    expect(updated!.titleKo).toBe("카페 리뷰");
    expect(updated!.titleEn).toBe("Cafe Review");

    // Cleanup
    await postModel.remove(post.id);
    await placeModel.remove(place.id);
  });

  it("lists posts by user", async () => {
    const place = await placeModel.create({ name: "Place", category: "restaurant" });
    const presets = await styleProfileModel.getSystemPresets();

    const post1 = await postModel.create({ userId: testUserId, placeId: place.id, styleProfileId: presets[0].id });
    const post2 = await postModel.create({ userId: testUserId, placeId: place.id, styleProfileId: presets[0].id });

    const posts = await postModel.listByUser(testUserId);
    expect(posts.length).toBeGreaterThanOrEqual(2);

    await postModel.remove(post1.id);
    await postModel.remove(post2.id);
    await placeModel.remove(place.id);
  });
});

describe("API: POST /api/places", () => {
  it("creates a place with valid data", async () => {
    const { POST } = await import("@/app/api/places/route");

    const req = new Request("http://localhost/api/places", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `session_token=${sessionToken}`,
      },
      body: JSON.stringify({
        name: "API Test Place",
        category: "restaurant",
        address: "Test Address",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.place.name).toBe("API Test Place");

    // Cleanup
    await placeModel.remove(data.place.id);
  });

  it("rejects without auth", async () => {
    const { POST } = await import("@/app/api/places/route");

    const req = new Request("http://localhost/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", category: "restaurant" }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });
});

describe("API: POST /api/posts/generate", () => {
  it("generates a post with fallback (no OpenAI key)", async () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { POST } = await import("@/app/api/posts/generate/route");

    const place = await placeModel.create({
      name: "Fallback Test",
      category: "restaurant",
      rating: 4.5,
    });
    const presets = await styleProfileModel.getSystemPresets();

    const req = new Request("http://localhost/api/posts/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `session_token=${sessionToken}`,
      },
      body: JSON.stringify({
        placeId: place.id,
        styleProfileId: presets[0].id,
        memo: "Really great experience",
      }),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.post.status).toBe("generated");
    expect(data.post.titleKo).toBeTruthy();
    expect(data.post.titleEn).toBeTruthy();
    expect(data.post.contentKo).toBeTruthy();
    expect(data.post.contentEn).toBeTruthy();

    // Cleanup
    await postModel.remove(data.post.id);
    await placeModel.remove(place.id);
    if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
  });
});

describe("API: PATCH /api/posts/[id]", () => {
  it("updates post content", async () => {
    const { PATCH } = await import("@/app/api/posts/[id]/route");

    const place = await placeModel.create({ name: "Edit Test", category: "cafe" });
    const presets = await styleProfileModel.getSystemPresets();
    const post = await postModel.create({
      userId: testUserId,
      placeId: place.id,
      styleProfileId: presets[0].id,
    });
    await postModel.updateGenerated(post.id, {
      titleKo: "Original",
      contentKo: "Original content",
      hashtagsKo: ["#original"],
      titleEn: "Original EN",
      contentEn: "Original content EN",
      hashtagsEn: ["#original"],
    });

    const req = new Request(`http://localhost/api/posts/${post.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: `session_token=${sessionToken}`,
      },
      body: JSON.stringify({
        titleKo: "Updated Title",
        contentKo: "Updated content",
      }),
    });

    const res = await PATCH(req as any, { params: Promise.resolve({ id: post.id.toString() }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.post.titleKo).toBe("Updated Title");
    expect(data.post.titleEn).toBe("Original EN"); // unchanged

    // Cleanup
    await postModel.remove(post.id);
    await placeModel.remove(place.id);
  });
});
