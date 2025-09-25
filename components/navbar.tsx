"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "./ui/button"
import { getSupabaseClient } from "@/lib/supabaseClient"
import { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet"
import { Menu } from "lucide-react"
import Image from "next/image"

export const Navbar = () => {
  const supabase = getSupabaseClient()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null) // State to hold user role
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const fetchUserAndRole = async (currentUser: User | null) => {
      setUser(currentUser)
      if (currentUser) {
        // Fetch the user's role from the 'profiles' table
        try {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single()

          if (error) {
            console.error("Error fetching profile:", error)
            setUserRole(null)
          } else if (profile) {
            setUserRole(profile.role)
          }
        } catch (e) {
          console.error("Exception fetching profile:", e)
          setUserRole(null)
        }
      } else {
        setUserRole(null)
      }
    }

    const initializeSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      await fetchUserAndRole(session?.user ?? null)
    }

    initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserAndRole(session?.user ?? null)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [supabase])

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/order", label: "Order" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact Us" },
  ]

  const closeSheet = () => setIsOpen(false)

  const renderNavLinks = (isMobile = false) => (
    <nav
      className={
        isMobile
          ? "flex flex-col items-start gap-y-4 pt-8"
          : "hidden items-center gap-x-4 md:flex"
      }
    >
      {navLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={isMobile ? closeSheet : undefined}
          className={`text-sm font-medium transition-colors hover:text-primary ${
            pathname === link.href ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )

  const renderAuthButtons = (isMobile = false) => (
    <div
      className={
        isMobile
          ? "mt-auto flex flex-col items-start gap-y-4"
          : "hidden items-center gap-x-2 md:flex"
      }
    >
      {user ? (
        <>
          {/* ✅ Changed: Conditionally render Admin button for arion_admin and org_admin */}
          {(userRole === "arion_admin" || userRole === "org_admin") && (
            <Link
              href="/admin/accounts"
              onClick={isMobile ? closeSheet : undefined}
            >
              <Button variant="ghost">Admin</Button>
            </Link>
          )}
          <Link href="/account" onClick={isMobile ? closeSheet : undefined}>
            <Button variant="ghost">Account</Button>
          </Link>
          <Button
            variant="ghost"
            onClick={async () => {
              if (isMobile) closeSheet()
              await supabase.auth.signOut()
              window.location.href = "/"
            }}
          >
            Logout
          </Button>
        </>
      ) : (
        <Link href="/login" onClick={isMobile ? closeSheet : undefined}>
          <Button>Login</Button>
        </Link>
      )}
    </div>
  )

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/arion-wave-icon.svg"
            alt="Arion Logo"
            width={32}
            height={32}
          />
          <span className="font-bold">Arion</span>
        </Link>

        {renderNavLinks()}

        <div className="flex items-center">
          {renderAuthButtons()}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col">
              <Link href="/" onClick={closeSheet} className="flex items-center">
                <Image
                  src="/arion-wave-icon.svg"
                  alt="Arion Logo"
                  width={24}
                  height={24}
                  className="mr-2"
                />
                <span className="font-bold">Arion</span>
              </Link>
              <div className="flex flex-col h-full">
                {renderNavLinks(true)}
                {renderAuthButtons(true)}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}