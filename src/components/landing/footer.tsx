import Link from "next/link";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

interface FooterProps {
  columns?: FooterColumn[];
  copyright?: string;
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Blog Auto Writer";

export function Footer({ columns, copyright }: FooterProps) {
  const defaultColumns: FooterColumn[] = [
    {
      title: "제품",
      links: [
        { label: "대시보드", href: "/dashboard" },
        { label: "새 글 작성", href: "/dashboard/new" },
        { label: "문체 프로필", href: "/style-profiles" },
      ],
    },
    {
      title: "계정",
      links: [
        { label: "회원가입", href: "/signup" },
        { label: "로그인", href: "/login" },
        { label: "설정", href: "/dashboard/settings" },
      ],
    },
    {
      title: "더 알아보기",
      links: [
        { label: "소개", href: "/about" },
        { label: "분석", href: "/dashboard/analytics" },
      ],
    },
  ];

  const cols = columns || defaultColumns;
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-[var(--border)] py-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <span className="text-sm font-bold text-[var(--text)]">
              {siteName} <span className="text-[var(--accent)]">.</span>
            </span>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              사진과 메모로 만드는<br />나만의 블로그 글
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="space-y-3">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors duration-200 py-1 inline-block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border)] pt-6 text-xs text-[var(--text-muted)]">
          {copyright || `\u00A9 ${year} ${siteName}. 가족이 함께 쓰는 블로그 수익화 도구.`}
        </div>
      </div>
    </footer>
  );
}
