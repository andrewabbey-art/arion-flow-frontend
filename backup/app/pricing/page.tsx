const tiers = [
  { name: "Solo", desc: "Freelancers, small studios", price: "£299/mo", gpu: "30 GPU hrs", featured: false },
  { name: "Studio", desc: "Busy agency teams", price: "£699/mo", gpu: "80 GPU hrs", featured: false },
  { name: "Pro Studio", desc: "Heavy batches / video", price: "£1,499/mo", gpu: "150 GPU hrs", featured: false },
  { name: "Enterprise", desc: "Large multi-brand teams", price: "£3,999/mo", gpu: "400 GPU hrs", featured: false },
];

export default function PricingPage() {
  return (
    <main className="py-20">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold font-heading text-center mb-6">
          Simple Pricing, Predictable Budgets
        </h1>
        <p className="text-center max-w-2xl mx-auto text-muted-foreground mb-16">
          Clear monthly tiers with included GPU hours. Privacy by design —
          your assets stay in your workspace, never used for training.
        </p>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`border rounded-lg p-8 shadow-sm hover:shadow-xl transition-all flex flex-col ${
                tier.featured ? 'bg-secondary text-secondary-foreground -translate-y-2' : 'bg-card'
              }`}
            >
              <h3 className={`text-xl font-semibold font-heading ${tier.featured && 'text-white'}`}>{tier.name}</h3>
              <p className={`text-sm mt-1 flex-grow ${tier.featured ? 'text-gray-300' : 'text-muted-foreground'}`}>{tier.desc}</p>
              <p className={`text-4xl font-bold mt-6 ${tier.featured && 'text-white'}`}>{tier.price}</p>
              <p className={tier.featured ? 'text-gray-400' : 'text-muted-foreground'}>{tier.gpu}</p>
              <button className={`mt-8 w-full px-4 py-3 rounded-lg font-medium transition-colors ${
                tier.featured ? 'bg-accent text-accent-foreground hover:bg-accent/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}>
                Book a Demo
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-12">
          Overage from £1.20–£7.50/hr by GPU class. Dark-Site deployments
          available on dedicated hardware.
        </p>
      </div>
    </main>
  );
}