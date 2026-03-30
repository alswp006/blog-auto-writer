import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import * as userProfileModel from "@/lib/models/userProfile";
import * as postModel from "@/lib/models/post";
import * as publishHistoryModel from "@/lib/models/publishHistory";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardPostList } from "./dashboard-client";

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

  // Convert Map to plain object for serialization to client
  const platformsObj: Record<number, string[]> = {};
  for (const [postId, platforms] of publishedPlatforms) {
    platformsObj[postId] = platforms;
  }

  // Time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "좋은 아침이에요" : hour < 18 ? "오늘도 글쓰기 화이팅" : "오늘 하루 수고했어요";
  const generatedCount = posts.filter((p) => p.status === "generated").length;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
      {/* Header — personalized, asymmetric */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--warm)] font-medium mb-1">{greeting}</p>
          <h1 className="text-3xl font-bold">
            {profile.nickname}<span className="text-[var(--text-muted)] font-normal">님의 블로그</span>
          </h1>
        </div>
        <Button asChild className="btn-gradient px-6 shrink-0 w-full sm:w-auto">
          <Link href="/dashboard/new" className="no-underline">
            + 새 글 쓰기
          </Link>
        </Button>
      </div>

      {/* Stats — hero stat + secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Hero stat: month count, larger */}
        <Card className="md:col-span-1 bg-gradient-to-br from-[var(--accent)]/8 to-[var(--warm-glow)] border-[var(--accent)]/20">
          <CardContent className="p-6">
            <p className="text-xs text-[var(--accent)] font-medium mb-2">이번 달 작성</p>
            <p className="text-5xl font-black gradient-text-warm">{monthCount}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">편의 글을 쓰셨어요</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">전체 글</p>
            <p className="text-3xl font-bold">{posts.length}<span className="text-sm font-normal text-[var(--text-muted)] ml-1">편</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-[var(--text-muted)] mb-1">생성 완료</p>
            <p className="text-3xl font-bold">
              {generatedCount}
              <span className="text-sm font-normal text-[var(--text-muted)] ml-1">편</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Posts List with Search/Filter/Pagination */}
      <div>
        <h2 className="text-lg font-semibold mb-4">작성한 글</h2>
        <DashboardPostList posts={posts} publishedPlatforms={platformsObj} />
      </div>

      {/* Monetization Guide */}
      <div>
        <h2 className="text-lg font-semibold mb-4">수익화 가이드</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
