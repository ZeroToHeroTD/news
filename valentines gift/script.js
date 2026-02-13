document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  const images = track.querySelectorAll("img");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImg = document.querySelector(".lightbox-img");
  const prevBtn = document.querySelector(".lightbox-prev");
  const nextBtn = document.querySelector(".lightbox-next");
  const toggle = document.querySelector(".theme-toggle"); // matches your HTML

  let currentIndex = 0;

  // Calculate total distance for infinite slide
  const distance = track.scrollWidth / 2;

  // Infinite carousel animation
  const carouselAnimation = gsap.to(track, {
    x: -distance,
    duration: 50,
    ease: "none",
    repeat: -1
  });

  // Hover scale + shadow effect using GSAP
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

      img.addEventListener("mousemove", (e) => {
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20; // -10 to 10deg
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    gsap.to(img, { rotateY: x, rotateX: y, transformPerspective: 500, duration: 0.3 });
    });
    img.addEventListener("mouseleave", () => {
      gsap.to(img, { rotateY: 0, rotateX: 0, duration: 0.3 });
    });

    

    // Open lightbox on click
    img.addEventListener("click", () => {
      currentIndex = Array.from(images).indexOf(img);
      lightboxImg.src = img.src;
      lightbox.classList.add("show");
      // Optional: pause carousel while lightbox is open
      carouselAnimation.pause();
    });
  });

  gsap.to(lightboxImg, { opacity: 0, duration: 0.2, onComplete: () => {
    lightboxImg.src = images[currentIndex].src;
    gsap.to(lightboxImg, { opacity: 1, duration: 0.2 });
}});

gsap.to("body", { backgroundPosition: "50% 30%", scrollTrigger: { scrub: true } });
gsap.from("#page1 h1", { y: 50, opacity: 0, duration: 1, ease: "power2.out", stagger: 0.05 });


  // Close lightbox when clicking outside image
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove("show");
      carouselAnimation.play();
    }
  });

  // Keyboard navigation
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

  
// Function to update lightbox image with fade
function updateLightbox(index) {
  gsap.to(lightboxImg, {
    opacity: 0,
    duration: 0.2,
    onComplete: () => {
      lightboxImg.src = images[index].src;
      gsap.to(lightboxImg, { opacity: 1, duration: 0.2 });
    }
  });
}

// Arrow button navigation
prevBtn.addEventListener("click", () => {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  updateLightbox(currentIndex);
});
nextBtn.addEventListener("click", () => {
  currentIndex = (currentIndex + 1) % images.length;
  updateLightbox(currentIndex);
});

// Optional: keyboard arrows
document.addEventListener("keydown", e => {
  if (lightbox.classList.contains("show")) {
    if (e.key === "ArrowLeft") prevBtn.click();
    if (e.key === "ArrowRight") nextBtn.click();
    if (e.key === "Escape") lightbox.classList.remove("show");
  }
});

// Swipe on mobile
let startX = 0;
lightboxImg.addEventListener("touchstart", e => startX = e.touches[0].clientX);
lightboxImg.addEventListener("touchend", e => {
  const diff = startX - e.changedTouches[0].clientX;
  if (diff > 50) nextBtn.click();
  if (diff < -50) prevBtn.click();
});

const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");

let particlesArray = [];
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

// Resize canvas on window resize
window.addEventListener("resize", () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

// Particle class
class Particle {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * 3 + 1; // size
    this.speedX = (Math.random() - 0.5) * 0.5; // horizontal drift
    this.speedY = (Math.random() - 0.5) * 0.5; // vertical drift
    this.alpha = Math.random() * 0.5 + 0.1; // transparency
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Wrap around edges
    if (this.x > width) this.x = 0;
    if (this.x < 0) this.x = width;
    if (this.y > height) this.y = 0;
    if (this.y < 0) this.y = height;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
    ctx.fill();
  }
}

// Create particles
function initParticles(count = 80) {
  particlesArray = [];
  for (let i = 0; i < count; i++) {
    particlesArray.push(new Particle());
  }
}
initParticles();

// Animate particles
function animateParticles() {
  ctx.clearRect(0, 0, width, height);
  particlesArray.forEach(p => {
    p.update();
    p.draw();
  });
  requestAnimationFrame(animateParticles);
}
animateParticles();


  lightboxImg.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (diff > 50) nextBtn.click();
    else if (diff < -50) prevBtn.click();
  });

  // Footer show on scroll bottom
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

  // Scroll-triggered page animations
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

  gsap.to("body", {
  backgroundPosition: "50% 20%", // subtle movement
  ease: "none",
  scrollTrigger: { scrub: true }
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

  // Dark mode toggle
  // Apply previous theme
if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");

// Toggle click
toggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  // Animate gradient background for flair
  gsap.fromTo(
    "body",
    { backgroundPosition: "0% 0%" },
    { backgroundPosition: "100% 100%", duration: 1 }
  );
});

  //audio function
const music = new Audio('La Maritza - Piano Version.mp3');
let isPlaying = false;
let firstPlay = true; // track first play

document.getElementById('play-button').addEventListener('click', () => {
    if (!isPlaying) {
        if (firstPlay) {
            music.currentTime = 45; // start at 45s on first play
            firstPlay = false;
        }
        music.play().catch(() => console.log('Playback blocked by browser.'));
        document.getElementById('icon').textContent = 'pause';
        document.getElementById('text').textContent = 'Pause Music';
        isPlaying = true;
    } else {
        music.pause();
        document.getElementById('icon').textContent = 'play_arrow';
        document.getElementById('text').textContent = 'Play Music';
        isPlaying = false;
    }
});

// Optional: loop normally after music ends
music.loop = true;
});
