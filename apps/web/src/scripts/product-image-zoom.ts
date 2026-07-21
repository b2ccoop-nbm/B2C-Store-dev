let bound = false;

export function setupProductImageZoom() {
  if (bound) return;
  bound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest<HTMLElement>("[data-zoom-open]");
    if (!trigger) return;

    const dialogId = trigger.getAttribute("data-zoom-open");
    if (!dialogId) return;

    const dialog = document.getElementById(dialogId);
    if (!(dialog instanceof HTMLDialogElement)) return;

    event.preventDefault();
    dialog.showModal();
  });
}
