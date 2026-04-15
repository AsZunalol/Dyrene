'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()

    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-white hover:opacity-90"
    >
      Log out
    </button>
  )
}