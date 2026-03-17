"use client";

import { useState, useEffect, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Already running as an installed PWA — hide
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    ) return;

    setShow(true);
    setIsTouchDevice(navigator.maxTouchPoints > 0);

    // Capture native install prompt when available (Chrome / Edge / Android)
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  // Close tip on outside click
  useEffect(() => {
    if (!showTip) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowTip(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showTip]);

  const handleClick = async () => {
    if (deferredPrompt.current) {
      // Native install prompt — Chrome / Edge / Android
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      if (outcome === "accepted") setShow(false);
    } else {
      // iOS Safari, Firefox, etc. — show manual instructions
      setShowTip((v) => !v);
    }
  };

  if (!show) return null;

  return (
    <div className="a2hs-wrap" ref={wrapRef}>
      <button className="a2hs-btn" onClick={handleClick} title="Install app">
        Save to Home Screen
      </button>
      {showTip && (
        <div className="a2hs-tip" role="tooltip">
          <span className="a2hs-tip-text">
            {isTouchDevice
              ? <>Tap <strong>Share</strong> then <strong>Add to Home Screen</strong></>
              : <>Open in <strong>Chrome</strong> or <strong>Edge</strong> to install</>}
          </span>
          <button
            className="a2hs-tip-close"
            onClick={() => setShowTip(false)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
