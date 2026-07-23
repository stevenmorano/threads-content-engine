import { Sidebar } from "@/components/sidebar";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <div className="app-shell">
      <Sidebar email={user.email ?? "Admin"} />
      <main className="main-content">{children}</main>
    </div>
  );
}
