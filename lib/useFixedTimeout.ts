"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "./supabaseClient" // Imports the client from the utility file

// ⏰ CONSTANTS
const IDLE_TIMEOUT_MINUTES = 5 // Time before the warning modal appears (5 minutes)
const COUNTDOWN_SECONDS = 20 // Time the user has to react in the modal (20 seconds)
const MILLISECONDS_PER_MINUTE = 60 * 1000
const MILLISECONDS_PER_SECOND = 1000

// ✅ Added
export function useFixedTimeout() {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const mainTimer = useRef<NodeJS.Timeout | null>(null) // Main 5-minute timer
  const countdownInterval = useRef<NodeJS.Timeout | null>(null) // Countdown interval
  
  // State for the modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  
  // --- Core Logic Functions ---

  // Action to perform on timeout: clear session and redirect
  const logoutUser = useCallback(async () => {
    // Clear all timers
    if (mainTimer.current) clearTimeout(mainTimer.current)
    if (countdownInterval.current) clearInterval(countdownInterval.current)
    
    setIsModalOpen(false) 
    
    // Get session before logging out, for security check
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return // User is already logged out, do nothing

    console.log("Session expiration reached. Logging out.")
    await supabase.auth.signOut()

    // ➡️ Redirect the user to the auth page
    router.push("/auth")
    router.refresh()
  }, [supabase, router])

  // Function to start the final countdown timer
  const startCountdown = useCallback(() => {
    setIsModalOpen(true)
    setCountdown(COUNTDOWN_SECONDS)

    // Clear any previous countdown interval
    if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
    }

    // Set the interval to decrement the countdown every second
    countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                // When countdown hits 1, the next tick should trigger auto-logout
                return 0
            }
            return prev - 1
        })
    }, MILLISECONDS_PER SECOND)

  }, [])

  // Function to reset the main 5-minute timer (called on initialization or 'Stay' click)
  const resetMainTimer = useCallback(() => { 
    // 1. Clear both timers/intervals
    if (mainTimer.current) clearTimeout(mainTimer.current)
    if (countdownInterval.current) clearInterval(countdownInterval.current) 

    // 2. Hide the modal and reset countdown state
    setIsModalOpen(false) 
    setCountdown(COUNTDOWN_SECONDS) 

    // 3. Start the main 5-minute timer
    mainTimer.current = setTimeout(() => {
        startCountdown() 
    }, IDLE_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE)
  }, [startCountdown]) 

  // --- useEffect Hook for Initialization and Cleanup ---
  
  useEffect(() => {
    const initTimeout = async () => {
      // Check if a user is logged in
      const { data: { user } } = await supabase.auth.getUser()

      // 🛑 Only start the fixed timer if a user is logged in
      if (user) {
        resetMainTimer()
      }
    }

    initTimeout()

    // 🧹 Cleanup logic
    return () => {
        if (mainTimer.current) {
            clearTimeout(mainTimer.current)
        }
        if (countdownInterval.current) {
            clearInterval(countdownInterval.current) 
        }
    }
  }, [supabase, resetMainTimer])

  // Watch for countdown reaching zero and trigger final logout
  useEffect(() => {
    if (countdown === 0 && isModalOpen) {
      logoutUser()
    }
  }, [countdown, isModalOpen, logoutUser])

  // Expose modal state and the main reset function
  return { 
    isModalOpen, 
    countdownSeconds: countdown, 
    resetTimer: resetMainTimer, 
    logoutUser 
  } 
}
// ✅ Added