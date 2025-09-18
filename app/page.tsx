export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50 to-white text-center px-6">
      <h1 className="text-5xl font-bold text-gray-900 mb-6">
        Your Private AI Flow
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl">
        Secure, compliant, reliable — powered by dedicated ComfyUI workspaces.
      </p>
      <a
        href="/pricing"
        className="px-8 py-3 rounded-lg bg-indigo-600 text-white text-lg font-medium hover:bg-indigo-700 transition"
      >
        View Pricing
      </a>
    </main>
  );
}
