// PAGE TRANSITION
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

/* =========================
   GALAXY + STAR + HEART FIREWORKS
=========================== */
function startGalaxyAnimation() {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    window.addEventListener("resize", () => {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
    });

    let stars = [];
    let particles = [];
    let phase = 0; // 0=zoom,1=text,2=text fade out,3=fireworks,4=final text
    let zoomSpeed = 28;
    let mainStar = { alpha: 1, glow: 0 };

    const line1 = document.getElementById("line1");
    const line2 = document.getElementById("line2");

    for (let i = 0; i < 900; i++) {
        stars.push({
            x: Math.random() * canvas.width - canvas.width / 2,
            y: Math.random() * canvas.height - canvas.height / 2,
            z: Math.random() * canvas.width
        });
    }

    // HEART FUNCTION
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

    // FLUFFY HEART FIREWORK
    function explodeHeart(x, y) {
        for (let burst = 0; burst < 3; burst++) {
            setTimeout(() => {
                for (let t = 0; t < Math.PI * 2; t += 0.06) {
                    const p = heart(t);
                    const rand = (Math.random() - 0.5) * 0.2;
                    particles.push(new Particle(
                        x, y,
                        p.x * (0.5 + Math.random()*0.3),
                        p.y * (0.5 + Math.random()*0.3)
                    ));
                }
            }, burst * 200);
        }
    }

    function animate() {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // GALAXY ZOOM
        if (phase === 0) {
            for (let s of stars) {
                s.z -= zoomSpeed;
                if (s.z < 1) s.z = canvas.width;
                const sx = (s.x / s.z) * canvas.width + canvas.width/2;
                const sy = (s.y / s.z) * canvas.height + canvas.height/2;
                const r = (1 - s.z/canvas.width) * 2;
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI*2);
                ctx.fillStyle = "white";
                ctx.fill();
            }

            zoomSpeed *= 0.965;

            mainStar.glow += 0.05;
            ctx.fillStyle = `rgba(255,255,255,${mainStar.alpha})`;
            ctx.beginPath();
            ctx.arc(canvas.width/2, canvas.height/2, 3, 0, Math.PI*2);
            ctx.fill();

            if (zoomSpeed < 0.6) {
                phase = 1;
                setTimeout(() => {
                    line1.classList.add("show"); // fade in text
                }, 1500);
            }
        }

        // PHASE 1 → FADE OUT TEXT
        if (phase === 1.5) {
            line1.classList.add("hide");
            line1.addEventListener("transitionend", () => {
                explodeHeart(canvas.width/2, canvas.height/2);
                phase = 2;
            }, { once: true });
            phase = 1.6; // prevent repeat
        }

        // PHASE 2 → FIREWORKS
        if (phase >= 2) {
            particles.forEach((p,i) => {
                p.update();
                p.draw();
                if (p.life<=0) particles.splice(i,1);
            });

            if (phase === 2 && particles.length < 40) {
                line2.classList.add("show");
                phase = 3;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}
