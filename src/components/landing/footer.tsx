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

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "App";

export function Footer({ columns, copyright }: FooterProps) {
  const defaultColumns: FooterColumn[] = [
    {
      title: "Product",
      links: [
        { label: "Dashboard", href: "/dashboard" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "Sign Up", href: "/signup" },
        { label: "Login", href: "/login" },
      ],
    },
  ];

  const cols = columns || defaultColumns;
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-[var(--border)] py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {cols.map((col) => (
            <div key={col.title} className="space-y-3">
              <h4 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {copyright || `\u00A9 ${year} ${siteName}. All rights reserved.`}
        </div>
      </div>
    </footer>
  );
}
