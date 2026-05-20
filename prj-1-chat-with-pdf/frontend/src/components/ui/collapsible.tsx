// Standard shadcn `Collapsible` primitive: a thin re-export of Radix's
// Collapsible. Used by `Reasoning` for the Thinking panel's open/close state
// and animations.

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
