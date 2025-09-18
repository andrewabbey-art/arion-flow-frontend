import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-16">
      <div className="container mx-auto px-6 py-8 text-center md:text-left md:flex md:items-center md:justify-between">
        {/* Left side */}
        <div className="text-gray-600 text-sm">
          © {new Date().getFullYear()} Arion Flow. All rights reserved.
        </div>

        {/* Right side */}
        <div className="mt-4 md:mt-0 flex space-x-6 justify-center md:justify-end">
          <Link href="/pricing" className="text-gray-600 hover:text-indigo-600 text-sm">
            Pricing
          </Link>
          <Link href="/contact" className="text-gray-600 hover:text-indigo-600 text-sm">
            Contact
          </Link>
          <a
            href="https://www.linkedin.com" // replace with your profile/company page
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-indigo-600 text-sm"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
