"use client"

import { useFixedTimeout } from "@/lib/useFixedTimeout" // ✅ Modified import
import { IdleConfirmationModal } from "./IdleConfirmationModal" 

/**
 * Renders an invisible component to activate the client-side fixed-time session
 * timeout logic and displays the confirmation modal when the session is about to expire.
 */
// ✅ Added
export default function IdleTimer() {
  const { isModalOpen, countdownSeconds, resetTimer, logoutUser } = useFixedTimeout() 
  
  // The onStay function simply calls the hook's reset timer
  const handleStay = () => {
    resetTimer()
  }

  return (
    <>
      <IdleConfirmationModal
        isOpen={isModalOpen}
        onStay={handleStay}
        onLogout={logoutUser}
        countdownSeconds={countdownSeconds}
      />
    </>
  )
}
// ✅ Added