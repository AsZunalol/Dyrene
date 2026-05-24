import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import TrojanGuides from "@/components/TrojanGuides";

type TrojanGuide = {
  id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  short_description: string | null;
  content: string | null;
  cover_image: string | null;
  images: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type Profile = {
  id: string;
  discord_username: string | null;
  global_name: string | null;
  avatar_url: string | null;
};

function getDiscordDisplayName(profile?: Profile) {
  return profile?.global_name || profile?.discord_username || "Unknown operator";
}


export default async function TrojanPage() {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin);

  const { data: guides } = await supabase
    .from("trojan_guides")
    .select("*")
    .order("created_at", { ascending: false });

  const guideRows = (guides ?? []) as TrojanGuide[];
  const authorIds = Array.from(
    new Set(guideRows.map((guide) => guide.created_by).filter(Boolean) as string[]),
  );

  const { data: authorProfiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, discord_username, global_name, avatar_url")
        .in("id", authorIds)
    : { data: [] as Profile[] };

  const profileMap = new Map(
    ((authorProfiles ?? []) as Profile[]).map((authorProfile) => [authorProfile.id, authorProfile]),
  );

  const guidesWithAuthors = guideRows.map((guide) => {
    const authorProfile = guide.created_by ? profileMap.get(guide.created_by) : undefined;

    return {
      ...guide,
      author_name: getDiscordDisplayName(authorProfile),
      author_avatar_url: authorProfile?.avatar_url ?? null,
    };
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-emerald-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#03130d_45%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(34,197,94,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.9)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/10 to-transparent" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 px-6 pt-32 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/55 shadow-[0_0_50px_rgba(16,185,129,0.12)] backdrop-blur">
            <div className="flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-950/30 px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/90" />
              <span className="h-3 w-3 rounded-full bg-yellow-300/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
              <span className="ml-3 font-mono text-xs text-emerald-300/80">
                root@dyrene:~/trojan-guides
              </span>
            </div>

            <div className="p-8">
              <p className="font-mono text-sm uppercase tracking-[0.35em] text-emerald-300/80">
                Dyrene Intel System
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Trojan Terminal
              </h1>
              <p className="mt-4 max-w-3xl text-lg text-emerald-100/75">
                Hacking guides, screenshots, commands, notes, and step-by-step tutorials built like a clean terminal archive.
              </p>

              <div className="mt-6 rounded-xl border border-emerald-400/20 bg-black/50 p-4 font-mono text-sm text-emerald-200 shadow-inner">
                <span className="text-emerald-400">$</span> load --guides --mode=roleplay --status=online
                <span className="ml-2 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-emerald-300" />
              </div>
            </div>
          </div>

          <TrojanGuides initialGuides={guidesWithAuthors} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
