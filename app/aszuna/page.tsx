import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AsZunaFishingTracker from "@/components/AsZunaFishingTracker";

const ACCESS_COOKIE = "aszuna_access";
const DEFAULT_PASSCODE = "2075";

async function unlockAsZunaPage(formData: FormData) {
  "use server";

  const passcode = String(formData.get("passcode") ?? "").trim();
  const secretPasscode = process.env.ASZUNA_PASSCODE ?? DEFAULT_PASSCODE;

  if (passcode !== secretPasscode) {
    redirect("/aszuna?locked=1");
  }

  const cookieStore = await cookies();

  cookieStore.set(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/aszuna");
}

async function lockAsZunaPage() {
  "use server";

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/aszuna");
}

export default async function AsZunaPage() {
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(ACCESS_COOKIE)?.value === "true";

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#07070b] px-4 pb-16 pt-32 text-white sm:px-6 lg:px-8">
        <section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#00ffbf]/30 bg-[#00ffbf]/10 text-2xl font-black text-[#00ffbf] shadow-lg shadow-[#00ffbf]/10">
                A
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#00ffbf]">
                Secret Access
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
                AsZuna
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-400">
                Enter the secret passcode to unlock this private page.
              </p>
            </div>

            <form action={unlockAsZunaPage} className="space-y-4">
              <div>
                <label htmlFor="passcode" className="mb-2 block text-sm font-semibold text-gray-200">
                  Passcode
                </label>
                <input
                  id="passcode"
                  name="passcode"
                  type="password"
                  autoComplete="off"
                  placeholder="Enter passcode"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ffbf]/60 focus:ring-4 focus:ring-[#00ffbf]/10"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#00ffbf] px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-[#00ffbf]/20 transition hover:-translate-y-0.5 hover:bg-[#23ffd0] active:translate-y-0"
              >
                Unlock Page
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07070b] px-4 pb-16 pt-32 text-white sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-[1800px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-r from-[#00ffbf]/15 via-white/[0.03] to-transparent p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#00ffbf]">
                  Private Page
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  AsZuna
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400">
                  Private tools locked behind the AsZuna passcode. First tool is a fishing tracker
                  where you add baits and fish with images, then log sessions to calculate real drop chances.
                </p>
              </div>

              <form action={lockAsZunaPage}>
                <button
                  type="submit"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
                >
                  Lock page
                </button>
              </form>
            </div>
          </div>

          <AsZunaFishingTracker />
        </div>
      </section>
    </main>
  );
}
