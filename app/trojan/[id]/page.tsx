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
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-emerald-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#020617_0%,#03130d_45%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(34,197,94,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.9)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 px-3 pt-24 pb-6 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-[96rem]">
          <Link
            href="/trojan"
            className="mb-6 inline-flex rounded-xl border border-emerald-400/20 bg-black/40 px-4 py-2 font-mono text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 hover:text-white"
          >
            ← cd ../trojan
          </Link>

          <article className="min-h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/60 shadow-[0_0_50px_rgba(16,185,129,0.12)] backdrop-blur">
            <div className="flex items-center gap-2 border-b border-emerald-400/20 bg-emerald-950/30 px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/90" />
              <span className="h-3 w-3 rounded-full bg-yellow-300/90" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
              <span className="ml-3 font-mono text-xs text-emerald-300/80">
                guide@trojan:~/{guide.id.slice(0, 8)}
              </span>
            </div>

            {guide.cover_image ? (
              <div className="relative border-b border-emerald-400/20">
                <img
                  src={guide.cover_image}
                  alt={guide.title}
                  className="h-56 w-full object-cover opacity-90 sm:h-64 lg:h-72"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              </div>
            ) : null}

            <div className="p-5 sm:p-7 lg:p-10">
              <div className="mb-4 flex flex-wrap gap-2">
                {guide.category ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-emerald-200">
                    #{guide.category}
                  </span>
                ) : null}

                {guide.difficulty ? (
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide text-cyan-200">
                    clearance: {guide.difficulty}
                  </span>
                ) : null}
              </div>

              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                {guide.title}
              </h1>

              {guide.short_description ? (
                <p className="mt-3 text-lg text-emerald-100/75">
                  {guide.short_description}
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 rounded-xl border border-emerald-400/15 bg-black/40 p-4 font-mono text-sm text-emerald-300/80 lg:grid-cols-3">
                <div>
                  <span className="text-emerald-400">status:</span> online
                </div>

                <div className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                  <span className="text-emerald-400">last updated:</span>
                  <span>
                    {new Intl.DateTimeFormat("da-DK", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(guide.updated_at || guide.created_at))}
                  </span>
                </div>

                <div className="inline-flex items-center gap-2 lg:justify-end">
                  {authorProfile?.avatar_url ? (
                    <img
                      src={authorProfile.avatar_url}
                      alt={authorName}
                      className="h-6 w-6 rounded-full border border-cyan-300/30 object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-xs text-cyan-200">
                      @
                    </span>
                  )}
                  <span className="text-cyan-400">author:</span>
                  <span className="text-cyan-100">{authorName}</span>
                </div>
              </div>

              <TrojanGuideContent html={guide.content || ""} />

              {images.length > 0 ? (
                <div className="mt-10">
                  <h2 className="mb-4 font-mono text-2xl font-black text-white">
                    ./extra-screenshots
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {images.map((image, index) => (
                      <a
                        key={`${image}-${index}`}
                        href={image}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-black/45 hover:bg-emerald-500/10"
                      >
                        <img
                          src={image}
                          alt={`${guide.title} image ${index + 1}`}
                          className="h-64 w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
