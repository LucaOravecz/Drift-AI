/**
 * Drift AI Design System
 * Centralized utilities for consistent UI/UX patterns across the application
 */

export type ComponentVariant = 'primary' | 'secondary' | 'subtle' | 'danger' | 'success'
export type ComponentSize = 'sm' | 'md' | 'lg' | 'xl'
export type ComponentState = 'default' | 'hover' | 'active' | 'disabled' | 'loading'

export const DESIGN_SYSTEM = {
  /**
   * Button styles — semantic colors mapped to actions
   */
  button: {
    variants: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
      subtle: 'bg-muted text-muted-foreground hover:bg-muted/80 focus:ring-muted',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
      success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    },
    sizes: {
      sm: 'px-3 py-1 text-sm rounded-md',
      md: 'px-4 py-2 text-base rounded-lg',
      lg: 'px-6 py-3 text-lg rounded-lg',
      xl: 'px-8 py-4 text-xl rounded-xl',
    },
  },

  /**
   * Card styles — container patterns for content organization
   */
  card: {
    base: 'rounded-lg border bg-card text-card-foreground shadow-sm',
    elevated: 'rounded-lg border bg-card text-card-foreground shadow-lg',
    interactive: 'rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer',
  },

  /**
   * Typography scales — semantic heading and text styles
   */
  typography: {
    h1: 'text-4xl font-bold tracking-tight',
    h2: 'text-3xl font-semibold tracking-tight',
    h3: 'text-2xl font-semibold tracking-tight',
    h4: 'text-xl font-semibold',
    h5: 'text-lg font-semibold',
    h6: 'text-base font-semibold',
    body: 'text-base leading-relaxed',
    bodySmall: 'text-sm leading-relaxed text-muted-foreground',
    bodySmallerst: 'text-xs leading-tight text-muted-foreground',
    label: 'text-sm font-medium',
    code: 'bg-muted px-2 py-1 rounded font-mono text-sm',
  },

  /**
   * Spacing scale — consistent padding and margins
   */
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  /**
   * Border radius — consistent corner rounding
   */
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },

  /**
   * Shadows — depth and elevation
   */
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },

  /**
   * Transitions — smooth animations
   */
  transition: {
    fast: 'transition-all duration-100 ease-out',
    base: 'transition-all duration-200 ease-out',
    smooth: 'transition-all duration-300 ease-out',
    slow: 'transition-all duration-500 ease-out',
  },
} as const

/**
 * Responsive breakpoints for responsive design
 */
export const BREAKPOINTS = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

/**
 * Color palette — semantic color mappings
 */
export const COLOR_PALETTE = {
  primary: '#4f46e5',
  secondary: '#7c3aed',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  info: '#0284c7',
  muted: '#6b7280',
  foreground: '#ffffff',
  background: '#000000',
} as const

/**
 * Create a button className with variant and size
 */
export function buttonClassName(variant: ComponentVariant = 'primary', size: ComponentSize = 'md'): string {
  return `${DESIGN_SYSTEM.button.variants[variant]} ${DESIGN_SYSTEM.button.sizes[size]} transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`
}

/**
 * Create a card className with optional elevation
 */
export function cardClassName(elevated = false): string {
  return elevated ? DESIGN_SYSTEM.card.elevated : DESIGN_SYSTEM.card.base
}

/**
 * Create a heading className with semantic level
 */
export function headingClassName(level: 1 | 2 | 3 | 4 | 5 | 6 = 1): string {
  const levels = {
    1: DESIGN_SYSTEM.typography.h1,
    2: DESIGN_SYSTEM.typography.h2,
    3: DESIGN_SYSTEM.typography.h3,
    4: DESIGN_SYSTEM.typography.h4,
    5: DESIGN_SYSTEM.typography.h5,
    6: DESIGN_SYSTEM.typography.h6,
  }
  return levels[level]
}

/**
 * Merge design system classNames with custom classes
 */
export function mergeClasses(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

/**
 * Get responsive class string for different breakpoints
 * Example: responsiveClass('md:px-6 lg:px-8')
 */
export function responsiveClass(className: string): string {
  return className
}
