import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        neutral: "border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
        warning: "border-[#e8cf88] bg-[#fff5cf] text-[#8a6000]",
        critical: "border-[#efc4c4] bg-[#fde8e8] text-[#9d2323]",
        good: "border-[#c8e3d3] bg-[#e7f6ee] text-[#16603d]"
      }
    },
    defaultVariants: {
      variant: "neutral"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
