import {
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MoreIcon } from "@/components/ui/ToolbarIcons";

/** The least room the menu keeps from the viewport's edge. */
const SCREEN_MARGIN_PX = 8;

/** Which item takes focus when the menu opens. */
type Landing = "first" | "last";

/** Every kind of menu item: commands, choices and checks. */
const ITEM =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

/** The items of a menu, in order. */
const itemsIn = (menu: HTMLElement | null) => [
  ...(menu?.querySelectorAll<HTMLElement>(ITEM) ?? []),
];

/** The toolbar a menu sits in, which says what it has folded away. */
const toolbarOf = (wrapper: HTMLElement | null) =>
  wrapper?.closest<HTMLElement>("[data-fold]") ?? null;

/** What the toolbar has folded away (its `data-fold` tokens). */
export type Folded = ReadonlySet<string>;

/**
 * The toolbar's More button and its menu, where what the toolbar has no room
 * for goes (the ARIA menu button pattern). Enter, Space or Down Arrow open it
 * on its first item, Up Arrow on its last; the arrows, Home and End move
 * between items; Escape closes it and returns focus to the button; Tab
 * closes it and moves on, as does a press anywhere else. Choosing an item
 * closes it with focus back on the button, which a dialog the item opens
 * then returns focus to.
 * @param children - The menu's items, or a function of what the toolbar has
 * folded, read as the menu opens, that returns them
 * @param badge - Drawn on the button, for a status folded into the menu; its
 * CSS shows it only while that control is folded
 */
export const ToolbarMenu = ({
  badge,
  children,
}: {
  badge?: ReactNode;
  children: ReactNode | ((folded: Folded) => ReactNode);
}) => {
  const [landing, setLanding] = useState<Landing | null>(null);
  const [folded, setFolded] = useState<Folded>(new Set());
  const isOpen = landing !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const menuId = useId();

  const open = (on: Landing) => {
    const tokens =
      toolbarOf(wrapperRef.current)?.dataset.fold?.split(/\s+/) ?? [];
    setFolded(new Set(tokens.filter(Boolean)));
    setLanding(on);
  };

  const close = (returnFocus: boolean) => {
    setLanding(null);
    if (returnFocus) buttonRef.current?.focus();
  };

  // Before paint, place the menu under its button, right edges aligned, then
  // moved back on screen: the button can wrap anywhere along a row
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const wrapper = wrapperRef.current;
    if (!isOpen || !menu || !wrapper) return;
    const anchor = wrapper.getBoundingClientRect();
    const width = menu.getBoundingClientRect().width;
    const viewport = document.documentElement.clientWidth;
    const left = Math.max(
      SCREEN_MARGIN_PX,
      Math.min(anchor.right - width, viewport - SCREEN_MARGIN_PX - width),
    );
    menu.style.left = `${left - anchor.left}px`;
    menu.style.right = "auto";
  }, [isOpen]);

  // Once the items are shown, focus the one the menu opened on
  useEffect(() => {
    if (!landing) return;
    const all = itemsIn(menuRef.current);
    (landing === "first" ? all[0] : all.at(-1))?.focus();
  }, [landing]);

  // A press outside the menu and its button closes it, as does the toolbar
  // folding otherwise: what the menu holds would no longer match
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setLanding(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    const refolds = new MutationObserver(() => setLanding(null));
    const toolbar = toolbarOf(wrapperRef.current);
    if (toolbar) {
      refolds.observe(toolbar, {
        attributeFilter: ["data-fold"],
        attributes: true,
      });
    }
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      refolds.disconnect();
    };
  }, [isOpen]);

  const onButtonKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    open(event.key === "ArrowDown" ? "first" : "last");
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
    if ((event.target as Element).closest(ITEM)) close(true);
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
        onClick={() => (isOpen ? close(false) : open("first"))}
        onKeyDown={onButtonKeyDown}
        ref={buttonRef}
        title="More actions"
        type="button"
      >
        <MoreIcon />
        <span className="sr-only">More</span>
        {badge}
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
        {typeof children === "function" ? children(folded) : children}
      </div>
    </div>
  );
};

type ToolbarMenuItemProps = {
  /** A state shown after the label, in quieter text, and named with it */
  detail?: string;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
  testId: string;
} & Pick<
  ComponentProps<"button">,
  "onFocus" | "onPointerDown" | "onPointerEnter"
>;

/**
 * A command of the More menu: an icon and its label, reached with the arrow
 * keys rather than Tab.
 */
export const ToolbarMenuItem = ({
  detail,
  icon,
  label,
  onSelect,
  testId,
  ...handlers
}: ToolbarMenuItemProps) => (
  <button
    {...handlers}
    // The item lays its parts out as flex items, which browsers name with
    // spaces of their own between them: one name, label then state, as shown
    aria-label={detail ? `${label} ${detail}` : undefined}
    className="toolbar-menu__item"
    data-testid={testId}
    onClick={onSelect}
    role="menuitem"
    tabIndex={-1}
    type="button"
  >
    {icon}
    {label}
    {detail && (
      <>
        {" "}
        <span className="toolbar-menu__detail">{detail}</span>
      </>
    )}
  </button>
);

type ToolbarMenuChoiceProps = {
  checked: boolean;
  /** One of several (a radio) or on and off (a checkbox) */
  kind: "radio" | "checkbox";
  label: string;
  onSelect: () => void;
  testId: string;
};

/**
 * A setting of the More menu: one choice among several, or a check. A tick
 * shows its state on screen, `aria-checked` says it.
 */
export const ToolbarMenuChoice = ({
  checked,
  kind,
  label,
  onSelect,
  testId,
}: ToolbarMenuChoiceProps) => {
  const content = (
    <>
      <span aria-hidden="true" className="toolbar-menu__tick">
        {checked ? "✓" : ""}
      </span>
      {label}
    </>
  );
  const shared = {
    className: "toolbar-menu__item",
    "data-testid": testId,
    onClick: onSelect,
    tabIndex: -1,
    type: "button",
  } as const;
  return kind === "radio" ? (
    <button {...shared} aria-checked={checked} role="menuitemradio">
      {content}
    </button>
  ) : (
    <button {...shared} aria-checked={checked} role="menuitemcheckbox">
      {content}
    </button>
  );
};

/** Items that belong together, named on screen and to assistive technology. */
export const ToolbarMenuGroup = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <fieldset aria-label={label} className="toolbar-menu__group">
    <div aria-hidden="true" className="toolbar-menu__heading">
      {label}
    </div>
    {children}
  </fieldset>
);

/** A line between the menu's commands and its folded settings. */
export const ToolbarMenuSeparator = () => (
  <hr className="toolbar-menu__separator" />
);
