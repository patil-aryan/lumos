import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
)
Avatar.displayName = "Avatar"

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}
function AvatarImage({ className, ...props }: AvatarImageProps) {
  return (
    <img
      className={cn("aspect-square h-full w-full", className)}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLSpanElement> {}
function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return (
    <span
      className={cn("flex h-full w-full items-center justify-center bg-muted", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback } 