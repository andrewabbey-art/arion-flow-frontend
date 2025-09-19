"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import { useRouter } from "next/navigation"
import Card from "@/components/card"

// helper: generate 3 random words
function generateName() {
  const words = [
    "football", "pig", "house", "river", "cloud", "sky",
    "mountain", "banana", "train", "wolf", "rocket", "garden"
  ]
  const pick = () => words[Math.floor(Math.random() * words.length)]
  return `${pick()}-${pick()}-${pick()}`
}

export default function OrderPage() {
  const router = useRouter()
  const [datacenter, setDatacenter] = useState("EU-CZ-1")
  const [storage, setStorage] = useState(50)
  const [gpu, setGpu] = useState("NVIDIA GeForce RTX 4090")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage("Submitting your order...")

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage("You must be logged in to place an order.")
      router.push("/auth")
      return
    }

    const resp = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        name: generateName(),
        datacenter_id: datacenter,
        storage_gb: storage,
        gpu_type: gpu,
      }),
    })

    const data = await resp.json()
    if (!data.ok) {
      setMessage("❌ " + data.error)
      setIsSubmitting(false)
    } else {
      setMessage("✅ Order submitted successfully! Redirecting...")
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    }
  }

  const selectStyles = "w-full p-3 bg-background border border-border rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-secondary appearance-none"
  const labelStyles = "block text-sm font-semibold mb-2 text-foreground text-left"

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-4 pt-20">
      <Card className="p-8 w-full max-w-lg">
        <h2 className="text-3xl font-bold mb-6 text-center text-primary">
          Configure Your Workspace
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Datacenter */}
          <div>
            <label htmlFor="datacenter" className={labelStyles}>Storage Location</label>
            <select
              id="datacenter"
              value={datacenter}
              onChange={(e) => setDatacenter(e.target.value)}
              className={selectStyles}
            >
              <option value="AP-JP-1">Japan (AP-JP-1)</option>
              <option value="CA-MTL-3">Canada (CA-MTL-3)</option>
              <option value="CA-MTL-4">Canada (CA-MTL-4)</option>
              <option value="EU-CZ-1">Europe (EU-CZ-1)</option>
              <option value="EU-RO-1">Europe (EU-RO-1, S3)</option>
              <option value="EU-SE-1">Europe (EU-SE-1)</option>
              <option value="EUR-IS-1">Europe (EUR-IS-1, S3)</option>
              <option value="EUR-NO-1">Europe (EUR-NO-1)</option>
              <option value="US-CA-2">United States (US-CA-2, S3)</option>
              <option value="US-GA-2">United States (US-GA-2)</option>
              <option value="US-IL-1">United States (US-IL-1)</option>
              <option value="US-KS-2">United States (US-KS-2, S3)</option>
              <option value="US-MO-1">United States (US-MO-1)</option>
              <option value="US-NC-1">United States (US-NC-1)</option>
              <option value="US-TX-3">United States (US-TX-3)</option>
              <option value="US-WA-1">United States (US-WA-1)</option>
            </select>
          </div>

          {/* Storage */}
          <div>
            <label htmlFor="storage" className={labelStyles}>Workspace Size (GB)</label>
            <select
              id="storage"
              value={storage}
              onChange={(e) => setStorage(parseInt(e.target.value))}
              className={selectStyles}
            >
              <option value={50}>50 GB</option>
              <option value={100}>100 GB</option>
              <option value={250}>250 GB</option>
              <option value={500}>500 GB</option>
            </select>
          </div>

          {/* GPU */}
          <div>
            <label htmlFor="gpu" className={labelStyles}>GPU Model</label>
            <select
              id="gpu"
              value={gpu}
              onChange={(e) => setGpu(e.target.value)}
              className={selectStyles}
            >
              <option value="NVIDIA GeForce RTX 4090">NVIDIA GeForce RTX 4090 ✅</option>
              <option disabled>H200 SXM</option>
              <option disabled>A40</option>
              <option disabled>RTX 5090</option>
              <option disabled>RTX 6000 Ada</option>
              <option disabled>H100 SXM</option>
              <option disabled>H100 PCIe</option>
              <option disabled>A100 PCIe</option>
              <option disabled>RTX PRO 6000</option>
              <option disabled>RTX 3090</option>
              <option disabled>RTX A5000</option>
              <option disabled>RTX A4500</option>
              <option disabled>RTX 2000 Ada</option>
              <option disabled>RTX 4000 Ada</option>
              <option disabled>B200</option>
              <option disabled>A100 SXM</option>
              <option disabled>MI300X</option>
              <option disabled>RTX A6000</option>
              <option disabled>RTX A4000</option>
              <option disabled>L4</option>
              <option disabled>H100 NVL</option>
              <option disabled>L40S</option>
              <option disabled>RTX PRO 6000 WK</option>
              <option disabled>L40</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-accent text-primary font-bold p-3 rounded-[var(--radius)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Processing..." : "Submit Order"}
          </button>
        </form>
        {message && <p className="mt-4 text-center text-sm text-muted-foreground">{message}</p>}
      </Card>
    </div>
  )
}