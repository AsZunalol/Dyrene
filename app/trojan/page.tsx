import PageHeader from "@/components/PageHeader";
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
    <main className="hub-page">
      <PageHeader icon="terminal" eyebrow="Knowledge base" title="Trojan guides" description="Your shared library of roleplay guides, screenshots, commands, and walkthroughs." />
      <TrojanGuides initialGuides={guidesWithAuthors} isAdmin={isAdmin} />
    </main>
  );
}
