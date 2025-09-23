import Link from "next/link"

export default function AccessDeniedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-brand-950 text-white">
      <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
      <p className="mb-6 text-lg text-gray-300">
        You don’t have permission to access this page.
      </p>
      <Link
        href="/"
        className="rounded bg-brand-500 px-4 py-2 text-white hover:bg-brand-700"
      >
        Go back home
      </Link>
    </div>
  )
}
