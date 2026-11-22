import Link from "next/link";

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const { reason } = await searchParams;
  const loginFailed = reason === "login_failed";
  const verificationFailed = reason === "verification_failed";
  const title = loginFailed || verificationFailed ? "Login Unavailable" : "Access Denied";
  const message = loginFailed
    ? "We couldn't complete your login. The sign-in may have expired or the login service may be unreachable. Please try again."
    : verificationFailed
      ? "We couldn't verify your Discord access. Please try again shortly."
      : reason === "missing_role"
        ? "Your Discord account is in the server, but it doesn't have the role required to access this website."
        : "We couldn't verify access for this account. Sign in with the Discord account that has the required server role.";

  return (
    <main className="min-h-screen text-white flex items-center justify-center">
      <div className="max-w-xl px-6 text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">{title}</h1>
        <p className="text-gray-300 mb-6">{message}</p>
        <Link href="/login" className="bg-white text-black px-6 py-3 rounded-xl">Back to Login</Link>
      </div>
    </main>
  );
}
