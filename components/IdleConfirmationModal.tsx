"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { XCircle } from "lucide-react"; 

interface IdleConfirmationModalProps {
  isOpen: boolean;
  onStay: () => void;
  onLogout: () => void;
  countdownSeconds: number;
}

// ✅ Added
export function IdleConfirmationModal({
  isOpen,
  onStay,
  onLogout,
  countdownSeconds,
}: IdleConfirmationModalProps) {
  const [currentCountdown, setCurrentCountdown] = useState(countdownSeconds);

  // Sync the internal state when the modal opens or the countdown value changes
  useEffect(() => {
    setCurrentCountdown(countdownSeconds);
  }, [countdownSeconds]);

  // Handle the countdown logic
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isOpen && currentCountdown > 0) {
      // Set the timer to decrement every second
      timer = setTimeout(() => {
        setCurrentCountdown((prev) => prev - 1);
      }, 1000);
    }
    
    // Auto-logout when countdown hits zero
    if (currentCountdown === 0 && isOpen) {
      onLogout();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, currentCountdown, onLogout]);

  // Handle the "Stay Logged In" action
  const handleStay = () => {
    onStay();
  };
  
  // Handle the "Log Out" action
  const handleLogout = () => {
    onLogout();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}> 
      {/* Note: onOpenChange is ignored here as the modal is controlled only by the timer logic */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row items-center space-x-3">
          <XCircle className="h-6 w-6 text-red-500" />
          <DialogTitle>Session Expiration Warning</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Your session is about to expire. You will be automatically logged out in:
          <p className="text-3xl font-bold text-primary mt-2">
            {currentCountdown} seconds
          </p>
          Click 'Stay Logged In' to reset the 5-minute timer.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={handleLogout}>
            Log Out Now
          </Button>
          <Button onClick={handleStay}>
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ✅ Added