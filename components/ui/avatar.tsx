import React from "react";

export function Avatar({ className = "", children }: any) {
  return (
    <div className={`w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium ${className}`}>
      {children}
    </div>
  );
}

export function AvatarFallback({ children, ...props }: any) {
  return <span {...props}>{children}</span>;
}
