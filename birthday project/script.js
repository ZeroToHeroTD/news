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
    let phase = 0; // 0=zoom,1=text fadeIn,2=text fadeOut/fireworks,3=finalText
    let zoomSpeed = 28;
    let mainStarAlpha = 1;

    const line1 = document.getElementById("line1");
    const line2 = document.getElementById("line2");

    for (let i = 0; i < 900; i++) {
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
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = 140;
        }
        update() { this.x += this.vx; this.y += this.vy; this.life--; }
        draw() { ctx.fillStyle = "rgba(255,90,130,0.95)"; ctx.fillRect(this.x,this.y,2,2); }
    }

    function explodeHeart(x, y) {
        for (let burst = 0; burst < 3; burst++) {
            setTimeout(() => {
                for (let t = 0; t < Math.PI * 2; t += 0.06) {
                    const p = heart(t);
                    particles.push(new Particle(
                        x, y,
                        p.x*(0.5+Math.random()*0.3),
                        p.y*(0.5+Math.random()*0.3)
                    ));
                }
            }, burst*200);
        }
    }

    function animate() {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // ---------------- GALAXY ZOOM ----------------
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

            ctx.fillStyle = `rgba(255,255,255,${mainStarAlpha})`;
            ctx.beginPath();
            ctx.arc(canvas.width/2, canvas.height/2, 3, 0, Math.PI*2);
            ctx.fill();

            if (zoomSpeed < 0.6) {
                phase = 1; // fade in first text
                setTimeout(() => line1.classList.add("show"), 500);
            }
        }

        // ---------------- TEXT FADE OUT & FIREWORKS ----------------
        if (phase === 1) {
            // After text shows for 3s, fade out
            setTimeout(() => {
                line1.classList.add("hide");
                line1.addEventListener("transitionend", () => {
                    explodeHeart(canvas.width/2, canvas.height/2);
                    phase = 2;
                }, { once: true });
            }, 3000);
            phase = 1.1; // prevent repeat
        }

        // ---------------- FIREWORKS ----------------
        if (phase === 2) {
            particles.forEach((p,i) => {
                p.update();
                p.draw();
                if (p.life<=0) particles.splice(i,1);
            });

            // once fireworks nearly done, show final text
            if (phase === 2 && particles.length < 40) {
                line2.classList.add("show");
                phase = 3;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
}
