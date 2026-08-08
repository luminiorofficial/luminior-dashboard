import React, { useState } from "react";

export function Select({ value, onValueChange, disabled, children, ...props }: any) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      {...props}
    >
      {children}
    </select>
  );
}

export function SelectTrigger({ className = "", children, ...props }: any) {
  return (
    <div className={`w-full px-3 py-2 border border-gray-300 rounded-lg cursor-pointer ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SelectValue({ placeholder = "", ...props }: any) {
  return <span>{placeholder}</span>;
}

export function SelectContent({ children, ...props }: any) {
  return <>{children}</>;
}

export function SelectItem({ value, children, ...props }: any) {
  return <option value={value} {...props}>{children}</option>;
}
