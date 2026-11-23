import { getTranslations } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import TrojanGuideContent from "@/components/TrojanGuideContent";

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

function getDiscordDisplayName(profile?: Profile | null) {
  return profile?.global_name || profile?.discord_username || "Unknown operator";
}

export default async function TrojanGuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, locale } = await getTranslations();
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: guide } = await supabase
    .from("trojan_guides")
    .select("*")
    .eq("id", id)
    .single<TrojanGuide>();

  if (!guide) return notFound();

  const images = Array.isArray(guide.images) ? guide.images.filter(Boolean) : [];

  const { data: authorProfile } = guide.created_by
    ? await supabase
        .from("profiles")
        .select("id, discord_username, global_name, avatar_url")
        .eq("id", guide.created_by)
        .maybeSingle<Profile>()
    : { data: null };

  const authorName = getDiscordDisplayName(authorProfile);

  return (
    <main className="hub-page">
      <Link href="/trojan" className="hub-secondary mb-6">{t("All guides")}</Link>
      <article className="hub-panel overflow-hidden">
        {guide.cover_image && <img src={guide.cover_image} alt={guide.title} className="h-56 w-full object-cover sm:h-72" />}
        <div className="p-5 sm:p-8">
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
            {guide.category && <span className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-1 text-accent">{guide.category}</span>}
            {guide.difficulty && <span className="rounded-lg border border-line bg-elevated px-3 py-1 text-muted">{t(guide.difficulty)}</span>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{guide.title}</h1>
          {guide.short_description && <p className="mt-3 max-w-3xl text-base leading-7 text-muted">{guide.short_description}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-line py-4 text-sm text-muted">
            <div className="flex items-center gap-3">
              {authorProfile?.avatar_url && <img src={authorProfile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
              <span>{t("By")} <span className="text-foreground">{authorName}</span></span>
            </div>
            <span>{t("Updated")} {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(guide.updated_at || guide.created_at))}</span>
          </div>
          <TrojanGuideContent html={guide.content || ""} />
          {images.length > 0 && (
            <section className="mt-10">
              <h2 className="hub-section-title mb-4">{t("Screenshots")}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {images.map((image, index) => (
                  <a key={image + index} href={image} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-line bg-inset">
                    <img src={image} alt={guide.title + t(" image ") + (index + 1)} className="h-64 w-full object-cover" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </main>
  );
}
