import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-0.5 overflow-x-auto border-b border-line no-scrollbar',
      className,
    )}
    {...props}
  />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { badge?: number }
>(({ className, children, badge, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'group relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-120 hover:text-ink-soft focus-visible:outline-none data-[state=active]:border-brand data-[state=active]:text-ink',
      className,
    )}
    {...props}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="rounded bg-surface-3 px-1 py-px text-xs font-semibold text-ink-muted tnum group-data-[state=active]:bg-brand-wash group-data-[state=active]:text-brand">
        {badge}
      </span>
    )}
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 animate-fade-in focus-visible:outline-none', className)}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
