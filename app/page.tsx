import DecemberCountdown from "@/components/DecemberCountdown";
import { isComingSoon } from "@/lib/site-mode";

export default function HomePage() {
  return (
    <main
      className={isComingSoon ? "relative flex min-h-svh items-center justify-center px-4 py-14 text-white sm:px-6" : "hub-empty-home"}
    >
      {isComingSoon ? (
        <DecemberCountdown />
      ) : (
        <h1 className="sr-only">Dyrene</h1>
      )}
    </main>
  );
}
