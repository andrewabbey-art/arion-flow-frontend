import React from "react"

interface CardProps {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`bg-background border border-border rounded-[var(--radius)] shadow-lg shadow-primary/10 ${className}`}
    >
      {children}
    </div>
  )
}