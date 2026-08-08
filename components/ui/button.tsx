import { forwardRef } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className = "", variant = "default", size = "default", type = "button", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-md border border-transparent text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
    const variants = {
      default: "bg-slate-900 text-white hover:bg-slate-700",
      outline: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    };
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-11 px-5",
    };

    return (
      <button ref={ref} type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
