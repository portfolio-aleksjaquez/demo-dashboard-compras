// Lightweight toast notifications for success / error / info feedback, with
// an optional action button (e.g. "Deshacer").

const ICONS = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
const MAX_VISIBLE = 3;

/** Keep the toast stack above any open modal dialog (top layer). */
function raise(root) {
  if (typeof root.showPopover !== "function") return;
  if (root.matches(":popover-open")) root.hidePopover();
  root.showPopover();
}

export function showToast(message, type = "info", timeout = 4000, { actionLabel, onAction } = {}) {
  const root = document.getElementById("toast-root");
  if (!root) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.textContent = ICONS[type] ?? ICONS.info;

  const text = document.createElement("span");
  text.className = "toast__text";
  text.textContent = message;

  toast.append(icon, text);
  root.appendChild(toast);
  [...root.children].slice(0, -MAX_VISIBLE).forEach((old) => old.remove());
  raise(root);

  // Trigger enter transition on next frame.
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    clearTimeout(timer);
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  };

  if (actionLabel && onAction) {
    // Only the newest action stays available (e.g. undo the last change).
    root.querySelectorAll(".toast__action").forEach((old) => old.remove());
    const action = document.createElement("button");
    action.type = "button";
    action.className = "toast__action";
    action.textContent = actionLabel;
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      remove();
      onAction();
    });
    toast.append(action);
  }

  const timer = setTimeout(remove, timeout);
  toast.addEventListener("click", remove);
}
