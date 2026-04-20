"use client";

import { useEffect, useState } from "react";

export default function PageTransitionLoader() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setLoading(true);
    const handleStop = () => setLoading(false);

    window.addEventListener("beforeunload", handleStart);
    window.addEventListener("load", handleStop);

    return () => {
      window.removeEventListener("beforeunload", handleStart);
      window.removeEventListener("load", handleStop);
    };
  }, []);

  if (!loading) return null;

  return (
    <div style={overlayStyle}>
      <div style={spinnerStyle}></div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
};

const spinnerStyle: React.CSSProperties = {
  width: "50px",
  height: "50px",
  border: "5px solid #ccc",
  borderTop: "5px solid #fff",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};