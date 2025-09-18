import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Arion Flow",
  description: "Your private AI flow — secure, compliant, reliable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Top navigation bar */}
        <Navbar />

        {/* Page content */}
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
