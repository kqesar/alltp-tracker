import {
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { MoreIcon } from "@/components/ui/ToolbarIcons";

/** Which item takes focus when the menu opens. */
type Landing = "first" | "last";

/** The items of a menu, in order. */
const itemsIn = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
];

/**
 * The toolbar's More button and its menu, where the secondary actions go on
 * screens too narrow for the full toolbar (the ARIA menu button pattern).
 * Enter, Space or Down Arrow open it on its first item, Up Arrow on its
 * last; the arrows, Home and End move between items; Escape closes it and
 * returns focus to the button; Tab closes it and moves on, as does a press
 * anywhere else. Choosing an item closes it with focus back on the button,
 * which a dialog the item opens then returns focus to.
 * @param children - The menu's items: `ToolbarMenuItem`s
 */
export const ToolbarMenu = ({ children }: { children: ReactNode }) => {
  const [landing, setLanding] = useState<Landing | null>(null);
  const isOpen = landing !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const menuId = useId();

  const close = (returnFocus: boolean) => {
    setLanding(null);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Once the items are shown, focus the one the menu opened on
  useEffect(() => {
    if (!landing) return;
    const all = itemsIn(menuRef.current);
    (landing === "first" ? all[0] : all.at(-1))?.focus();
  }, [landing]);

  // A press outside the menu and its button closes it
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setLanding(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setLanding(event.key === "ArrowDown" ? "first" : "last");
  };

  // React bubbles a portal's events through its React parents: the dialog an
  // item opens is drawn in the body, yet its keys and focus changes would
  // reach these handlers. Only events from the menu's own DOM count.
  const fromMenu = (event: { target: EventTarget }) =>
    Boolean(menuRef.current?.contains(event.target as Node));

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (!fromMenu(event)) return;
    const all = itemsIn(menuRef.current);
    const current = all.indexOf(document.activeElement as HTMLElement);
    const focus = (index: number) =>
      all[(index + all.length) % all.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        focus(current + 1);
        break;
      case "ArrowUp":
        focus(current - 1);
        break;
      case "Home":
        focus(0);
        break;
      case "End":
        focus(all.length - 1);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        // Focus moves on to the next control by itself
        close(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  // Choosing an item: its own click handler has run, the menu closes
  const onMenuClick = (event: MouseEvent) => {
    if (!fromMenu(event)) return;
    if ((event.target as Element).closest('[role="menuitem"]')) close(true);
  };

  // Focus leaving for good (a click on another control) closes the menu too
  const onBlur = (event: FocusEvent) => {
    if (!wrapperRef.current?.contains(event.target as Node)) return;
    const next = event.relatedTarget as Node | null;
    if (next && !wrapperRef.current.contains(next)) close(false);
  };

  return (
    <div className="toolbar-more" onBlur={onBlur} ref={wrapperRef}>
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="tracker-controls__button"
        data-testid="toolbar-more"
        id={buttonId}
        onClick={() => (isOpen ? close(false) : setLanding("first"))}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        title="More actions"
        type="button"
      >
        <MoreIcon />
        <span className="sr-only">More</span>
      </button>
      <div
        aria-labelledby={buttonId}
        className="toolbar-menu"
        data-testid="toolbar-more-menu"
        hidden={!isOpen}
        id={menuId}
        onClick={onMenuClick}
        onKeyDown={onMenuKeyDown}
        ref={menuRef}
        role="menu"
      >
        {children}
      </div>
    </div>
  );
};

type ToolbarMenuItemProps = {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  testId: string;
} & Pick<
  ComponentProps<"button">,
  "onFocus" | "onPointerDown" | "onPointerEnter"
>;

/**
 * An item of the More menu: an icon and its label, reached with the arrow
 * keys rather than Tab.
 */
export const ToolbarMenuItem = ({
  icon,
  label,
  onSelect,
  testId,
  ...handlers
}: ToolbarMenuItemProps) => (
  <button
    {...handlers}
    className="toolbar-menu__item"
    data-testid={testId}
    onClick={onSelect}
    role="menuitem"
    tabIndex={-1}
    type="button"
  >
    {icon}
    {label}
  </button>
);
