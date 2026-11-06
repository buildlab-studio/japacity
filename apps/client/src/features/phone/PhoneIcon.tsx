// The phone's icons by name (the contract's `PhoneApp.icon` and `Ask.icon` are names, so plain data
// can carry them). Lucide's own names, so a new one is one line.
import { ArrowLeftRight, Briefcase, CalendarDays, FolderOpen, Hand, House, Landmark, MessageCircle, MoveVertical, Newspaper, Plane, Receipt, Settings, ShoppingBag, Ticket, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  calendar: CalendarDays,
  landmark: Landmark,
  "message-circle": MessageCircle,
  plane: Plane,
  "folder-open": FolderOpen,
  briefcase: Briefcase,
  ticket: Ticket,
  receipt: Receipt,
  newspaper: Newspaper,
  settings: Settings,
  "arrow-left-right": ArrowLeftRight,
  "move-vertical": MoveVertical,
  house: House,
  "shopping-bag": ShoppingBag,
  // An act's card at a thing in a place: the hand that does it.
  hand: Hand,
};

/** The icon a name draws, or null for a name the set does not hold (cross-feature/icons.test.ts holds every name carried to one). */
export function iconOf(name: string): LucideIcon | null {
  return ICONS[name] ?? null;
}

export function PhoneIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = iconOf(name) ?? Settings;
  return <Icon size={size} aria-hidden />;
}

/** For the shared sheet's corner. */
export function iconFor(name: string) {
  return <PhoneIcon name={name} size={22} />;
}
