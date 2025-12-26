import { useEffect, useRef } from 'react';

interface UseReadingTimerProps {
  onTick?: () => void;
  inactivityTimeout?: number; // ms, default 5 mins
  enabled?: boolean;
}

export function useReadingTimer({
  onTick,
  inactivityTimeout = 5 * 60 * 1000,
  enabled = true
}: UseReadingTimerProps = {}) {
  const lastActivityRef = useRef(Date.now());
  const onTickRef = useRef(onTick);

  // Keep ref fresh to avoid closure staleness in interval
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled) return;

    // Initialize lastActivity
    lastActivityRef.current = Date.now();

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Add activity listeners
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel', 'click'];
    // Use capture to ensure we catch events even if propagation stopped? 
    // Usually bubbling is fine for window.
    // Passive: true for scroll/wheel performance.
    const options = { passive: true };
    
    events.forEach(e => window.addEventListener(e, handleActivity, options));

    const timer = setInterval(() => {
      // Check visibility
      if (document.visibilityState === 'hidden') return;

      const now = Date.now();
      // Check inactivity
      if (now - lastActivityRef.current < inactivityTimeout) {
        onTickRef.current?.();
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [enabled, inactivityTimeout]);
}
