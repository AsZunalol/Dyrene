import HubIcon from "@/components/HubIcon";
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
    <main className="hub-auth">
      <div className="hub-auth-card">
        <div className="hub-auth-mark"><HubIcon name="lock" /></div>
        <h1 className="text-red-300">{title}</h1>
        <p className="text-muted mb-6">{message}</p>
        <Link href="/login" className="hub-primary">Back to Login</Link>
      </div>
    </main>
  );
}
