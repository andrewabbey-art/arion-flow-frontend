import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-secondary border-t border-secondary mt-16">
      <div className="container mx-auto px-6 py-8 text-center md:text-left md:flex md:items-center md:justify-between">
        {/* Left side */}
        <div className="text-gray-400 text-sm">
          © {new Date().getFullYear()} Arion Flow. All rights reserved.
        </div>

        {/* Right side */}
        <div className="mt-4 md:mt-0 flex space-x-6 justify-center md:justify-end">
          <Link href="/pricing" className="text-gray-300 hover:text-primary-foreground text-sm transition-colors">
            Pricing
          </Link>
          <Link href="/contact" className="text-gray-300 hover:text-primary-foreground text-sm transition-colors">
            Contact
          </Link>
          <a
            href="https://www.linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-primary-foreground text-sm transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}