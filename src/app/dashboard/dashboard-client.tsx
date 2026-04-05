"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeletePostButton } from "./delete-button";
import { Search, FileText } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  accommodation: "숙소",
  attraction: "여행지",
};

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  tistory: "티스토리",
  medium: "미디엄",
  wordpress: "워드프레스",
};

const PLATFORM_COLOR: Record<string, string> = {
  naver: "bg-green-500/15 text-green-400 border-green-500/20",
  tistory: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  medium: "bg-white/10 text-white/80 border-white/20",
  wordpress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

const CATEGORIES = ["all", "restaurant", "cafe", "accommodation", "attraction"] as const;
const STATUSES = ["all", "generated", "draft"] as const;

const PAGE_SIZE = 10;

type PostItem = {
  id: number;
  titleKo: string | null;
  placeName: string;
  placeCategory: string;
  status: string;
  thumbnailPath: string | null;
  createdAt: string;
};

type Props = {
  posts: PostItem[];
  publishedPlatforms: Record<number, string[]>;
};

export function DashboardPostList({ posts, publishedPlatforms }: Props) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = posts;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          (p.titleKo ?? "").toLowerCase().includes(q) ||
          p.placeName.toLowerCase().includes(q),
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.placeCategory === categoryFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result;
  }, [posts, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <Input
            placeholder="제목 또는 장소명 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setPage(1); }}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors min-h-[44px] flex items-center ${
                categoryFilter === cat
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
              }`}
            >
              {cat === "all" ? "전체" : CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {STATUSES.map((st) => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setPage(1); }}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors min-h-[44px] flex items-center ${
                statusFilter === st
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
              }`}
            >
              {st === "all" ? "전체" : st === "generated" ? "완료" : "초안"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[var(--text-muted)]">
        {filtered.length}개의 글{filtered.length !== posts.length && ` (전체 ${posts.length}개 중)`}
      </p>

      {/* Posts */}
      {paginated.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            {/* Simple pen + paper illustration */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--warm-soft)] flex items-center justify-center">
              <FileText className="w-7 h-7 text-[var(--warm)]" />
            </div>
            <p className="text-[var(--text)] font-medium mb-1">
              {search || categoryFilter !== "all" || statusFilter !== "all"
                ? "조건에 맞는 글이 없어요"
                : "아직 글이 없어요"}
            </p>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              {search || categoryFilter !== "all" || statusFilter !== "all"
                ? "다른 조건으로 검색해보세요"
                : "첫 번째 맛집 후기를 써볼까요?"}
            </p>
            <Button asChild className="btn-gradient">
              <Link href="/dashboard/new" className="no-underline">사진 올리고 시작하기</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginated.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  <Link href={`/dashboard/${post.id}/edit`} className="no-underline shrink-0">
                    {post.thumbnailPath ? (
                      <img
                        src={post.thumbnailPath}
                        alt={post.placeName}
                        className="w-24 h-24 md:w-32 md:h-28 object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 md:w-32 md:h-28 bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs">
                        사진 없음
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 p-4 min-w-0 flex flex-col justify-between">
                    <div>
                      <Link href={`/dashboard/${post.id}/edit`} className="no-underline block group">
                        <h3 className="font-semibold text-sm group-hover:text-[var(--accent)] transition-colors truncate">
                          {post.titleKo ?? "(제목 없음)"}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-1.5 min-w-0">
                        <span className="text-xs text-[var(--text-muted)] truncate">{post.placeName}</span>
                        <Badge variant="secondary" className="text-[10px] py-0">
                          {CATEGORY_LABEL[post.placeCategory] ?? post.placeCategory}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={post.status === "generated" ? "default" : "secondary"} className="text-[10px]">
                          {post.status === "generated" ? "완료" : "초안"}
                        </Badge>
                        {(publishedPlatforms[post.id] ?? []).map((p) => (
                          <Badge
                            key={p}
                            variant="outline"
                            className={`text-[9px] py-0 px-1.5 ${PLATFORM_COLOR[p] ?? ""}`}
                          >
                            {PLATFORM_LABEL[p] ?? p}
                          </Badge>
                        ))}
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <DeletePostButton postId={post.id} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="text-xs text-[var(--text-muted)]">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
