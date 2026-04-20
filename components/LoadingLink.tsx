"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoadingLink({ href, children, ...props }: any) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
  };

  return (
    <>
      {loading && (
        <div style={overlayStyle}>
          <div style={spinnerStyle}></div>
        </div>
      )}

      <Link href={href} onClick={handleClick} {...props}>
        {children}
      </Link>
    </>
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