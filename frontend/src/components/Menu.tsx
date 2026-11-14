import { useId, useRef, useState, type ReactNode } from "react";

interface MenuProps {
  label: string;
  title?: string;
  triggerClass: string;
  menuClass: string;
  disabled?: boolean;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
}

/**
 * Menu nativo do Chromium: o popover cuida de Esc, clique fora e retorno do foco;
 * o focusgroup dá as setas, Home/End e os papéis menu/menuitem.
 */
export function Menu({ label, title, triggerClass, menuClass, disabled, trigger, children }: MenuProps) {
  const id = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const fromKeyboard = useRef(false);
  const [open, setOpen] = useState(false);
  const close = () => menuRef.current?.hidePopover();

  return (
    <>
      <button
        type="button"
        id={`${id}t`}
        className={`${triggerClass} ${open ? "active" : ""}`}
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        {...({ commandfor: `${id}m`, command: "toggle-popover" } as object)}
        // Clique sem ponteiro (Enter/Espaço) entra no menu; clique do mouse não.
        onClick={(event) => (fromKeyboard.current = event.detail === 0)}
      >
        {trigger}
      </button>
      <div
        id={`${id}m`}
        ref={menuRef}
        popover="auto"
        className={menuClass}
        onToggle={(event) => {
          const isOpen = (event.nativeEvent as ToggleEvent).newState === "open";
          setOpen(isOpen);
          if (isOpen && fromKeyboard.current) menuRef.current?.querySelector("button")?.focus();
        }}
      >
        <div {...({ focusgroup: "menu nomemory" } as object)} aria-labelledby={`${id}t`}>
          {children(close)}
        </div>
      </div>
    </>
  );
}
