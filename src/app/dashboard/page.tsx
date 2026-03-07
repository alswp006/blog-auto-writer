import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    // Stale session — redirect with logged_out param so middleware
    // clears the cookie instead of redirecting back here in a loop.
    // NOTE: Do NOT call destroySession() here — Server Components cannot
    // modify cookies (Next.js 15). Middleware handles cookie deletion.
    redirect("/login?logged_out");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Welcome back, {user.name || user.email}
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Your Profile</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-muted)] w-16">Email</span>
            <span className="text-sm">{user.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-muted)] w-16">Name</span>
            <span className="text-sm">{user.name || "—"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[var(--text-muted)] w-16">Joined</span>
            <span className="text-sm">{new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Placeholder for app-specific content */}
      <div className="card p-6 border-dashed">
        <p className="text-sm text-[var(--text-muted)] text-center">
          Add your app features here. This dashboard is protected — only logged-in users can see it.
        </p>
      </div>
    </div>
  );
}
