const tiers = [
  { name: "Solo", desc: "Freelancers, small studios", price: "£299/mo", gpu: "30 GPU hrs" },
  { name: "Studio", desc: "Busy agency teams", price: "£699/mo", gpu: "80 GPU hrs" },
  { name: "Pro Studio", desc: "Heavy batches / video", price: "£1,499/mo", gpu: "150 GPU hrs" },
  { name: "Enterprise", desc: "Large multi-brand teams", price: "£3,999/mo", gpu: "400 GPU hrs" },
];

export default function PricingPage() {
  return (
    <main className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center mb-10">
          Simple Pricing, Predictable Budgets
        </h1>
        <p className="text-center max-w-2xl mx-auto text-gray-600 mb-12">
          Clear monthly tiers with included GPU hours. Privacy by design —
          your assets stay in your workspace, never used for training.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="border rounded-2xl p-6 shadow-sm hover:shadow-md transition"
            >
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{tier.desc}</p>
              <p className="text-3xl font-bold mt-4">{tier.price}</p>
              <p className="text-gray-500">{tier.gpu}</p>
              <button className="mt-6 w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                Book a Demo
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Overage from £1.20–£7.50/hr by GPU class. Dark-Site deployments
          available on dedicated hardware.
        </p>
      </div>
    </main>
  );
}
