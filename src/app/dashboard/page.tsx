import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import * as userProfileModel from "@/lib/models/userProfile";
import * as postModel from "@/lib/models/post";
import * as publishHistoryModel from "@/lib/models/publishHistory";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeletePostButton } from "./delete-button";

const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "맛집",
  cafe: "카페",
  accommodation: "숙소",
  attraction: "여행지",
};

const MONETIZATION_LINKS = [
  {
    title: "네이버 애드포스트 설정",
    desc: "네이버 블로그 수익화 공식 가이드",
    href: "https://adpost.naver.com/",
  },
  {
    title: "구글 애드센스 가이드",
    desc: "Google AdSense 시작하기",
    href: "https://www.google.com/adsense/start/",
  },
  {
    title: "Medium Partner Program",
    desc: "Medium 파트너 프로그램 가입",
    href: "https://medium.com/earn",
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?logged_out");
  }

  const profile = await userProfileModel.getByUserId(user.id);
  if (!profile) {
    redirect("/onboarding/profile");
  }

  const posts = await postModel.listByUserWithMeta(user.id);
  const monthCount = await postModel.countByUserThisMonth(user.id);
  const publishedPlatforms = await publishHistoryModel.getPublishedPlatformsByPostIds(posts.map((p) => p.id));

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {profile.nickname}님, 환영합니다!
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new" className="no-underline">
            + 새 글 작성
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">이번 달 작성</p>
            <p className="text-3xl font-bold">{monthCount}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">편</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">전체 글</p>
            <p className="text-3xl font-bold">{posts.length}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">편</span></p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">생성 완료</p>
            <p className="text-3xl font-bold">
              {posts.filter((p) => p.status === "generated").length}
              <span className="text-sm font-normal text-[var(--text-muted)] ml-1">편</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Posts List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">최근 작성한 글</h2>
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-[var(--text-muted)] mb-4">아직 작성한 글이 없습니다.</p>
              <Button asChild>
                <Link href="/dashboard/new" className="no-underline">첫 번째 글 작성하기</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Thumbnail */}
                    <Link href={`/dashboard/${post.id}/edit`} className="no-underline shrink-0">
                      {post.thumbnailPath ? (
                        <img
                          src={post.thumbnailPath}
                          alt=""
                          className="w-24 h-24 md:w-32 md:h-28 object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 md:w-32 md:h-28 bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs">
                          No photo
                        </div>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="flex-1 p-4 min-w-0 flex flex-col justify-between">
                      <div>
                        <Link href={`/dashboard/${post.id}/edit`} className="no-underline block group">
                          <h3 className="font-semibold text-sm group-hover:text-[var(--accent)] transition-colors truncate">
                            {post.titleKo ?? "(제목 없음)"}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-[var(--text-muted)]">{post.placeName}</span>
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
                          {(publishedPlatforms.get(post.id) ?? []).map((p) => (
                            <Badge key={p} variant="outline" className="text-[9px] py-0 px-1.5">
                              {p === "naver" ? "N" : p === "tistory" ? "T" : p === "medium" ? "M" : "W"}
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
      </div>

      {/* Monetization Guide */}
      <div>
        <h2 className="text-lg font-semibold mb-4">수익화 가이드</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MONETIZATION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline"
            >
              <Card className="h-full hover:border-[var(--border-hover)] transition-colors">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-[var(--text)]">{link.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{link.desc}</p>
                  <span className="text-xs text-[var(--accent)] mt-2 inline-block">바로가기 &rarr;</span>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
