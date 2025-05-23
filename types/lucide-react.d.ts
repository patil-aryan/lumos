declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    stroke?: string;
    strokeWidth?: string | number;
  }

  type Icon = FC<IconProps>;

  // Export common icons used in the project
  export const X: Icon;
  export const Check: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;
  
  // Add other icons as needed...
} 