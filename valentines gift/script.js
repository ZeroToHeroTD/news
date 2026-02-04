document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  const images = track.querySelectorAll("img");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImg = document.querySelector(".lightbox-img");
  const prevBtn = document.querySelector(".lightbox-prev");
  const nextBtn = document.querySelector(".lightbox-next");
  const toggle = document.querySelector("#darkModeToggle");

  let currentIndex = 0;


  const distance = track.scrollWidth / 2;


  const carouselAnimation = gsap.to(track, {
    x: -distance,
    duration: 50,      
    ease: "none",
    repeat: -1

  });

images.forEach(img => {
  img.addEventListener("mouseenter", () => {
    gsap.to(img, {
      scale: 1.08,
      y: -6,
      boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto"
    });
  });

  img.addEventListener("mouseleave", () => {
    gsap.to(img, {
      scale: 1,
      y: 0,
      boxShadow: "0 6px 15px rgba(0,0,0,0.15)",
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto"
    });
  });
});


  gsap.to(img, {
    scale: 1.08,
    y: -6,
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)"
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("show")) {
      lightbox.classList.remove("show");
      carouselAnimation.play();
    }


    if (lightbox.classList.contains("show")) {
      if (e.key === "ArrowLeft") prevBtn.click();
      if (e.key === "ArrowRight") nextBtn.click();
    }
  });


  prevBtn.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    lightboxImg.src = images[currentIndex].src;
  });


  nextBtn.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % images.length;
    lightboxImg.src = images[currentIndex].src;
  });


  let startX = 0;
  lightboxImg.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  lightboxImg.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (diff > 50) nextBtn.click();
    else if (diff < -50) prevBtn.click();
  });


  window.addEventListener("scroll", () => {
    const footer = document.querySelector("footer");
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.body.scrollHeight;

    if (scrollTop + windowHeight >= docHeight - 50) {
      footer.classList.add("show");
    } else {
      footer.classList.remove("show");
    }
  });


  gsap.registerPlugin(ScrollTrigger);

  document.querySelectorAll(".page").forEach((page) => {
    gsap.from(page, {
      opacity: 0,
      y: 50,
      duration: 1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: page,
        start: "top 80%",
        toggleActions: "play none none none"
      }
    });
  });

  gsap.from(".carousel-track img", {
    opacity: 0,
    y: 30,
    duration: 0.8,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: "#page2",
      start: "top 80%"
    }
  });


const toggle1 = document.getElementById("darkModeToggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}

toggle1.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

});
