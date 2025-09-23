import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-4xl font-bold text-red-500 mb-4">Access Denied</h1>
      <p className="text-lg mb-6">
        You do not have the required permissions to view this page.
      </p>
      <Link href="/" className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
        Return to Homepage
      </Link>
    </div>
  );
}