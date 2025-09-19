"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from 'next/image'; // Import Image component

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo / Brand */}
        <Link href="/" className="text-xl font-bold font-heading text-primary flex items-center gap-2">
            {/* You can replace this with your actual SVG logo component if you have one */}
            <Image src="/dolphin-logo.svg" alt="Arion Flow Logo" width={28} height={28} />
            Arion Flow
        </Link>

        {/* Links */}
        <div className="flex space-x-8 items-center">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a href="/contact" className="hidden sm:block px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Book a Demo
          </a>
        </div>
      </div>
    </nav>
  );
}