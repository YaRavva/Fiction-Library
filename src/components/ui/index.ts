// Shadix UI Components
export { default as ActionButton } from "./action-button";
export type { ActionButtonProps } from "./action-button";

export {
  MotionDialog,
  MotionDialogTrigger,
  MotionDialogContent,
  MotionDialogHeader,
  MotionDialogTitle,
  MotionDialogDescription,
  MotionDialogFooter,
  MotionDialogBody,
  useMotionDialog,
} from "./motion-dialog";

export { ConfirmDialog } from "./confirm-dialog";
export { AlertDialogMotion, useAlertDialog } from "./alert-dialog-motion";
export { PageTransition, ContentTransition, ListTransition } from "./page-transition";

// Standard shadcn/ui Components
export { Button, buttonVariants } from "./button";
export { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
export { Input } from "./input";
export { Label } from "./label";
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
export { Checkbox } from "./checkbox";
export { Badge } from "./badge";
export { Avatar, AvatarFallback, AvatarImage } from "./avatar";
export { Progress } from "./progress";
export { Separator } from "./separator";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

// Dialog components
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

// Animation variants
export type { AnimationVariant } from "../../lib/popup-variants";
export { animationVariants, overlayVariants } from "../../lib/popup-variants";