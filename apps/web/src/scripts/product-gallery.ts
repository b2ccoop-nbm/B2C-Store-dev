export function setupProductGallery(): void {
  document.querySelectorAll<HTMLElement>("[data-product-gallery]").forEach((root) => {
    if (root.dataset.galleryBound === "1") return;
    root.dataset.galleryBound = "1";

    const track = root.querySelector<HTMLElement>("[data-gallery-track]");
    if (!track) return;

    const slides = track.children.length;
    if (slides <= 1) return;

    let index = 0;

    const dots = root.querySelectorAll<HTMLButtonElement>("[data-gallery-dot]");
    const prev = root.querySelector<HTMLButtonElement>(".product-gallery-prev");
    const next = root.querySelector<HTMLButtonElement>(".product-gallery-next");

    function paint() {
      track!.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("bg-white", dotIndex === index);
        dot.classList.toggle("bg-white/40", dotIndex !== index);
      });
    }

    prev?.addEventListener("click", () => {
      index = (index - 1 + slides) % slides;
      paint();
    });

    next?.addEventListener("click", () => {
      index = (index + 1) % slides;
      paint();
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const target = Number(dot.dataset.galleryDot);
        if (Number.isInteger(target) && target >= 0 && target < slides) {
          index = target;
          paint();
        }
      });
    });
  });
}
