import React from "react";

export function Dialog({ open, onOpenChange, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">{children}</div>
    </div>
  );
}

export function DialogTrigger({ children, asChild, ...props }: any) {
  if (asChild) return React.cloneElement(children, props);
  return <button {...props}>{children}</button>;
}

export function DialogContent({ children, className, ...props }: any) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function DialogHeader({ children, ...props }: any) {
  return <div className="mb-4" {...props}>{children}</div>;
}

export function DialogTitle({ children, ...props }: any) {
  return <h2 className="text-lg font-bold" {...props}>{children}</h2>;
}

export function DialogDescription({ children, ...props }: any) {
  return <p className="text-sm text-gray-600 mt-1" {...props}>{children}</p>;
}

export function DialogFooter({ children, ...props }: any) {
  return (
    <div className="flex gap-2 justify-end mt-6" {...props}>
      {children}
    </div>
  );
}
