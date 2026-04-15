// app/api/envs/route.ts
export async function GET() {
  const url = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // also log to server console for extra visibility
  console.log("API ENV CHECK -> URL:", url, "KEY:", key);

  return new Response(
    JSON.stringify({ urlExists: url, keyExists: key }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
}