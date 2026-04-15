import Link from "next/link";

export default function DeniedPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Access Denied</h1>
        <p className="text-gray-400 mb-6">You are not a current member of our Discord server.</p>
        <Link href="/login" className="bg-white text-black px-6 py-3 rounded-xl">Back to Login</Link>
      </div>
    </main>
  );
}