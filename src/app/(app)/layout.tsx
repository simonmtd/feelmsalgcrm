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
    <div className="flex min-h-screen">
      <Sidebar profile={profile} />
      <div className="relative min-w-0 flex-1">
        {/* A faint pink glow at the top, Feelm's colour without shouting. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_20%_0%,rgb(255_104_179/0.09),transparent)]" />
        <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">
          <PageHeader profile={profile} unread={unread ?? 0} />
          <main className="flex flex-col gap-6">{children}</main>
        </div>
      </div>
      <BottomBar profile={profile} />
    </div>
  );
}
