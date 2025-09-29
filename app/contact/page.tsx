"use client";

import { useState } from "react";

export default function ContactPage() {
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("");
    setIsSubmitting(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    const res = await fetch("/api/contact", {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        message: data.get("message"),
      }),
      headers: { 
        "Content-Type": "application/json",
        Accept: "application/json" 
      },
    });

    setIsSubmitting(false);

    if (res.ok) {
      setStatus("Message sent! We'll be in touch soon. ✅"); // ✅ Changed: escaped apostrophe
      form.reset();
    } else {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      setStatus(`Something went wrong: ${error.error || "Please try again."}  ❌`);
    }
  }

  return (
    <main className="py-20">
      <div className="container mx-auto px-6 max-w-xl">
        <h1 className="text-4xl font-bold font-heading text-center mb-8">Contact Us</h1>
        <p className="text-muted-foreground text-center mb-12">
          Got questions about Arion Flow? Fill out the form below and we&apos;ll get back to you. {/* ✅ Changed: escaped apostrophe */}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground">Name</label>
            <input
              id="name"
              type="text"
              name="name"
              required
              disabled={isSubmitting}
              className="mt-1 block w-full rounded-lg border bg-card p-3 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              required
              disabled={isSubmitting}
              className="mt-1 block w-full rounded-lg border bg-card p-3 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-foreground">Message</label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              disabled={isSubmitting}
              className="mt-1 block w-full rounded-lg border bg-card p-3 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>

        {status && <p className="mt-6 text-center text-muted-foreground">{status}</p>}
      </div>
    </main>
  );
}