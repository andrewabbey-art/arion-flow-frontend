import Image from 'next/image';

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background 
                      [background-image:radial-gradient(var(--color-border)_1px,transparent_1px),radial-gradient(var(--color-border)_1px,theme(colors.background)_1px)] 
                      [background-size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      
      <h1 className="text-5xl md:text-6xl font-bold font-heading mb-6 max-w-3xl text-foreground">
        Your Private AI Flow
      </h1>
      <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
        Secure, compliant, reliable — powered by dedicated ComfyUI workspaces.
      </p>
      <a
        href="/pricing"
        className="px-8 py-3 rounded-lg bg-primary text-primary-foreground text-lg font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow-lg"
      >
        View Pricing
      </a>
    </main>
  );
}