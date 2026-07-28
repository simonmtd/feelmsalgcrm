import { requireProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { BottomBar } from "@/components/bottom-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-himmel-300 via-himmel-100 to-wood-100 p-3 pb-24 sm:p-4 sm:pb-24">
      <div className="flex items-start gap-4">
        <Sidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col gap-6 py-1">
          <PageHeader profile={profile} unread={unread ?? 0} />
          <main className="flex flex-col gap-6 pb-8">{children}</main>
        </div>
      </div>
      <BottomBar profile={profile} />
    </div>
  );
}
