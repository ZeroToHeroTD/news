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
    }, 1800);
}

/* =============================
   🌌 GALAXY ANIMATION
============================= */

function startGalaxyAnimation() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        ctx.scale(dpr, dpr);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let stars = [];
    let particles = [];
    let phase = 0;
    let zoomSpeed = 28;
    let mainStar = { alpha: 1, glow: 0 };

    const starCount = Math.min(900, window.innerWidth); // reduce for small screens
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width - canvas.width / 2,
            y: Math.random() * canvas.height - canvas.height / 2,
            z: Math.random() * canvas.width
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
            this.life = 140;
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
        const scale = Math.min(canvas.width, canvas.height) / 40; // compact scale
        for (let t = 0; t < Math.PI * 2; t += 0.04) {
            const p = heart(t);
            particles.push(new Particle(
                x,
                y,
                p.x * scale * 0.02, // reduce spread
                p.y * scale * 0.02
            ));
        }
    }

    function animate() {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2 / (window.devicePixelRatio || 1);
        const centerY = canvas.height / 2 / (window.devicePixelRatio || 1);

        if (phase === 0) {
            for (let s of stars) {
                s.z -= zoomSpeed;
                if (s.z < 1) s.z = canvas.width;

                const sx = (s.x / s.z) * canvas.width + centerX;
                const sy = (s.y / s.z) * canvas.height + centerY;
                const r = (1 - s.z / canvas.width) * 2;

                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fillStyle = "white";
                ctx.fill();
            }

            zoomSpeed *= 0.965;

            ctx.fillStyle = `rgba(255,255,255,${mainStar.alpha})`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            ctx.fill();

            if (zoomSpeed < 0.6) {
                phase = 1;
                setTimeout(() => {
                    document.getElementById("line1").classList.add("show");
                }, 1500);
            }
        }

        if (phase === 1) {
            setTimeout(() => {
                document.getElementById("line1").classList.remove("show");
                explodeHeart(centerX, centerY);
                phase = 2;
            }, 5000);
            phase = 1.5;
        }

        if (phase >= 2) {
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            });
            
            if (phase === 2 && particles.length < 40) {
                document.getElementById("line2").classList.add("show");
                phase = 3;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}

