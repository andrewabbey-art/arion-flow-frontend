"use client";

import Link from "next/link";
import Image from "next/image"; // Import the Next.js Image component
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="bg-background border-b border-border fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-1 py-1 flex justify-between items-center">
        {/* Logo / Brand with Icon */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-primary">
          <Image 
            src="/arion-wave-icon.svg" 
            alt="Arion Flow icon" 
            width={80} 
            height={80} 
          />
          <span>Arion Flow</span>
        </Link>

        {/* Right side navigation */}
        <div className="flex items-center space-x-8">
          {/* Page Links */}
          <div className="hidden md:flex space-x-6">
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
          </div>

          {/* Auth Link */}
          <Link
            href="/auth"
            className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
          >
            Login / Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}