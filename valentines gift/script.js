  const track = document.querySelector(".carousel-track");
  const distance = track.scrollWidth / 2;

  gsap.to(track, {
    x: -distance,
    duration: 50,     // higher = slower
    ease: "none",
    repeat: -1
  });   

  document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll(".carousel-track img");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImg = document.querySelector(".lightbox-img");

  images.forEach(img => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;

      gsap.to(lightbox, {
        opacity: 1,
        pointerEvents: "auto",
        duration: 0.3
      });

      gsap.fromTo(
        lightboxImg,
        { scale: 0.8 },
        { scale: 1, duration: 0.5, ease: "power3.out" }
      );
    });
  });

  // close on background click
  lightbox.addEventListener("click", () => {
    gsap.to(lightbox, {
      opacity: 0,
      pointerEvents: "none",
      duration: 0.3
    });
  });

  // close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      gsap.to(lightbox, {
        opacity: 0,
        pointerEvents: "none",
        duration: 0.3
      });
    }
  });
});


