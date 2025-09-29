// lib/useFixedTimeout.ts

import { useCallback, useEffect, useRef, useState } from "react"
import { getSupabaseClient } from "./supabaseClient"

const MILLISECONDS_PER_SECOND = 1000
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND
const IDLE_TIMEOUT_MINUTES = 5
const COUNTDOWN_SECONDS = 30

export function useFixedTimeout() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)

  const mainTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = getSupabaseClient()

  // Clears both timers
  const clearTimers = useCallback(() => {
    if (mainTimer.current) {
      clearTimeout(mainTimer.current)
      mainTimer.current = null
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current)
      countdownInterval.current = null
    }
  }, [])

  // Handles logging out the user
  const logoutUser = useCallback(async () => {
    await supabase.auth.signOut()
    clearTimers()
    setIsModalOpen(false)
    setCountdown(COUNTDOWN_SECONDS)
  }, [clearTimers])

  // Start countdown when main timer expires
  const startCountdown = useCallback(() => {
    setIsModalOpen(true)
    setCountdown(COUNTDOWN_SECONDS)

    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, MILLISECONDS_PER_SECOND)
  }, [])

  // Reset main timer
  const resetMainTimer = useCallback(() => {
    clearTimers()
    mainTimer.current = setTimeout(() => {
      startCountdown()
    }, IDLE_TIMEOUT_MINUTES * MILLISECONDS_PER_MINUTE)
  }, [clearTimers, startCountdown])

  // Setup initial timers and auth state listeners
  useEffect(() => {
    function initTimeout() {
      if (!mainTimer.current) {
        resetMainTimer()
      }
    }

    initTimeout()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          if (session) {
            resetMainTimer()
          }
        }

        if (event === "SIGNED_OUT") {
          clearTimers()
          setIsModalOpen(false)
          setCountdown(COUNTDOWN_SECONDS)
        }
      }
    )

    // 🧹 Cleanup logic: This runs on component unmount
    return () => {
      clearTimers()
      subscription.unsubscribe()
    }
  }, [resetMainTimer, clearTimers])

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
    logoutUser,
  }
}
