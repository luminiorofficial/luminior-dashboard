import React from "react";

export function AlertDialog({ open, onOpenChange, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full mx-4">{children}</div>
    </div>
  );
}

export function AlertDialogTrigger({ children, asChild, ...props }: any) {
  if (asChild) return React.cloneElement(children, props);
  return <button {...props}>{children}</button>;
}

export function AlertDialogContent({ children, className, ...props }: any) {
  return (
    <div className={`p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function AlertDialogHeader({ children, ...props }: any) {
  return <div className="mb-4" {...props}>{children}</div>;
}

export function AlertDialogTitle({ children, ...props }: any) {
  return <h2 className="text-lg font-bold" {...props}>{children}</h2>;
}

export function AlertDialogDescription({ children, ...props }: any) {
  return <p className="text-sm text-gray-600 mt-2" {...props}>{children}</p>;
}

export function AlertDialogFooter({ children, ...props }: any) {
  return (
    <div className="flex gap-2 justify-end mt-6" {...props}>
      {children}
    </div>
  );
}

export function AlertDialogAction({ children, variant, disabled, ...props }: any) {
  const variants: Record<string, string> = {
    destructive: "bg-red-600 text-white hover:bg-red-700",
    default: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 ${variants[variant] || variants.default}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({ children, ...props }: any) {
  return (
    <button
      className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-900 hover:bg-gray-300"
      {...props}
    >
      {children}
    </button>
  );
}