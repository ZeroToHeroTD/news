const container1 = document.getElementById("container1");
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");

let animationStarted = false;

function btnClick() {
    container1.classList.add("fade-out");

    setTimeout(() => {
        page1.classList.remove("active");
        page2.classList.add("active");

        if (!animationStarted) {
            animationStarted = true;
            startGalaxyAnimation();
        }
    }, 600); // shorter for mobile
}

/* ============================= 
   🌌 GALAXY ANIMATION (Compact & Mobile Friendly) 
============================= */

function startGalaxyAnimation() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let stars = [];
    let particles = [];
    let phase = 0;
    let zoomSpeed = Math.min(window.innerWidth, window.innerHeight) / 35; // adaptive zoom
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const starCount = Math.floor(window.innerWidth / 1.5);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * window.innerWidth - centerX,
            y: Math.random() * window.innerHeight - centerY,
            z: Math.random() * window.innerWidth
        });
    }

    function heart(t) {
        return {
            x: 16 * Math.sin(t) ** 3,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))
        };
    }

    class Particle {
        constructor(x, y, vx, vy) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.life = 100;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life--;
        }
        draw() {
            ctx.fillStyle = "rgba(255,90,130,0.95)";
            ctx.fillRect(this.x, this.y, 2, 2);
        }
    }

    function explodeHeart(x, y) {
        const scale = Math.min(window.innerWidth, window.innerHeight) / 40; // compact scale
        for (let t = 0; t < Math.PI * 2; t += 0.04) {
            const p = heart(t);
            particles.push(new Particle(
                x,
                y,
                p.x * scale * 0.02, // tight spread
                p.y * scale * 0.02
            ));
        }
    }

    function animate() {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        // STARFIELD
        if (phase === 0) {
            for (let s of stars) {
                s.z -= zoomSpeed;
                if (s.z < 1) s.z = window.innerWidth;

                const sx = (s.x / s.z) * window.innerWidth + centerX;
                const sy = (s.y / s.z) * window.innerHeight + centerY;
                const r = (1 - s.z / window.innerWidth) * 2;

                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fillStyle = "white";
                ctx.fill();
            }

            zoomSpeed *= 0.95;

            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            ctx.fill();

            if (zoomSpeed < 0.5) {
                phase = 1;
                document.getElementById("line1").classList.add("show"); // line1 shows immediately
            }
        }

        // SHOW LINE 1 AND THEN HEART
        if (phase === 1) {
            setTimeout(() => {
                document.getElementById("line1").classList.remove("show");
                explodeHeart(centerX, centerY); // compact center explosion
                phase = 2;
            }, 1500); // short delay, mobile-friendly
            phase = 1.5;
        }

        // PARTICLE ANIMATION
        if (phase >= 2) {
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            });

            if (phase === 2 && particles.length < 20) {
                document.getElementById("line2").classList.add("show");
                phase = 3;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}
