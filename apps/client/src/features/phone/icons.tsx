// The phone's icons by name (the contract's `PhoneApp.icon` and `Ask.icon` are names, so plain data
// can carry them). Lucide's own names, so a new one is one line.
import { ArrowLeftRight, Briefcase, Landmark, MessageCircle, MoveVertical, Newspaper, Plane, Receipt, Settings, Ticket, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  "message-circle": MessageCircle,
  plane: Plane,
  briefcase: Briefcase,
  ticket: Ticket,
  receipt: Receipt,
  newspaper: Newspaper,
  settings: Settings,
  "arrow-left-right": ArrowLeftRight,
  "move-vertical": MoveVertical,
};

export function PhoneIcon({ name, size = 24 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Settings;
  return <Icon size={size} aria-hidden />;
}

/** For the shared sheet's corner. */
export function iconFor(name: string) {
  return <PhoneIcon name={name} size={22} />;
}
