"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "./supabaseClient" 

// ⏰ CONSTANTS
const IDLE_TIMEOUT_MINUTES = 0.1666 // 10 seconds for testing (10 / 60) // ✅ Modified for testing (10 seconds)
const COUNTDOWN_SECONDS = 5 // 5 seconds for testing // ✅ Modified for testing
const MILLISECONDS_PER_MINUTE = 60 * 1000
const MILLISECONDS_PER_SECOND = 1000

// ✅ Added
export function useFixedTimeout() {
  const router = useRouter() 
  const supabase = getSupabaseClient()
  const mainTimer = useRef<NodeJS.Timeout | null>(null) 
  const countdownInterval = useRef<NodeJS.Timeout | null>(null) 
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  
  // Utility to clear all timers
  const clearTimers = useCallback(() => {
    if (mainTimer.current) {
        clearTimeout(mainTimer.current)
        mainTimer.current = null;
    }
    if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
        countdownInterval.current = null;
    }
  }, []) // No dependencies needed for clearing refs

  // Action to perform on timeout: clear session and redirect
  const logoutUser = useCallback(async () => {
    clearTimers() // Use utility to clear timers
    
    setIsModalOpen(false) 
    
    // Check session before logging out (good practice)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 

    console.log("Session expiration reached. Logging out.")
    
    // Perform Supabase logout
    await supabase.auth.signOut()

    // ➡️ Redirect the user to the auth page and refresh the application state
    router.push("/auth")
    router.refresh()
  }, [supabase, router, clearTimers]) 

  // Function to start the final countdown timer
  const startCountdown = useCallback(() => {
    // 1. Ensure any existing main timer is stopped
    if (mainTimer.current) clearTimeout(mainTimer.current);

    setIsModalOpen(true)
    setCountdown(COUNTDOWN_SECONDS)

    // 2. Clear any previous countdown interval before starting a new one
    if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
    }

    // 3. Set the interval to decrement the countdown every second
    countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
            if (prev <= 1) {
                // If countdown reaches 1, the next tick should trigger auto-logout via the useEffect below
                clearInterval(countdownInterval.current!) 
                countdownInterval.current = null;
                return 0
            }
            return prev - 1
        })
    }, MILLISECONDS_PER_SECOND)

  }, [MILLISECONDS_PER_SECOND])

  // Function to reset the main 5-minute timer (called on initialization or 'Stay' click)
  const resetMainTimer = useCallback(() => { 
    // 1. Clear both timers/intervals
    clearTimers()

    // 2. Hide the modal and reset countdown state
    setIsModalOpen(false) 
    setCountdown(COUNTDOWN_SECONDS) 

    // 3. Start the main 5-minute timer
    mainTimer.current = setTimeout(() => {
        startCountdown() 
    }, IDLE_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE) // Will run in 10 seconds
  }, [startCountdown, clearTimers]) 

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

    // 🧹 Cleanup logic: This runs on component unmount
    return () => {
        clearTimers()
    }
  }, [supabase, resetMainTimer, clearTimers]) 

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