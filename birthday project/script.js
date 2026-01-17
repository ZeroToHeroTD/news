const container1 = document.getElementById("container1");
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");

let animationStarted = false;

function btnClick() {
    // === MUSIC INTEGRATION START ===
    const music = document.getElementById("bg-music");
    if (music) {
        music.volume = 0; // Start silent for fade-in
        music.play().catch(err => console.log("Audio blocked or file missing:", err));
        
        // Smoothly increase volume to 60% over 2 seconds
        let vol = 0;
        const fadeInInterval = setInterval(() => {
            if (vol < 0.6) {
                vol += 0.05;
                music.volume = vol;
            } else {
                clearInterval(fadeInInterval);
            }
        }, 100);
    }
    // === MUSIC INTEGRATION END ===

    container1.classList.add("fade-out");

    setTimeout(() => {
        page1.classList.remove("active");
        page2.classList.add("active");

        if (!animationStarted) {
            animationStarted = true;
            startGalaxyAnimation();
        }
    }, 1200);
}

function typeWriter(element, text, speed, callback) {
    let i = 0;
    element.innerHTML = ""; 
    element.classList.add("show"); 
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}

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

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const isMobile = window.innerWidth < 768;

    let stars = [];
    let particles = [];
    let phase = 0;
    let zoomSpeed = Math.min(window.innerWidth, window.innerHeight) / 60;

    // Background Stars
    const starCount = Math.floor(window.innerWidth / 1.5);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * window.innerWidth - centerX,
            y: Math.random() * window.innerHeight - centerY,
            z: Math.random() * window.innerWidth
        });
    }

    // Heart Math
    function heart(t) {
        return {
            x: 16 * Math.sin(t) ** 3,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
        };
    }

    // === UPDATED PARTICLE SYSTEM ===
    class Particle {
        constructor(x, y, targetX, targetY) {
            this.x = x;
            this.y = y;
            this.targetX = targetX;
            this.targetY = targetY;
            
            // PHYSICS
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 25 + 8; // Very high initial speed for "Huge" effect
            
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            
            // TIMING
            this.friction = 0.94; // Higher friction so they drift longer
            this.timer = 0;
            // They wait 100-130 frames (approx 2 seconds) before forming
            this.driftDelay = Math.random() * 30 + 100; 
            
            this.life = 400; // Live longer
            
            // COLORS
            this.hue = Math.random() * 360; // Start as RAINBOW
            this.saturation = 100;
            this.lightness = 60;
            this.finalHue = 340; // The Pink/Red color of the heart
        }

        update() {
            this.timer++;

            // 1. EXPLOSION & DRIFT PHASE
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.x += this.vx;
            this.y += this.vy;

            // 2. FORMATION PHASE (Only after driftDelay)
            if (this.timer > this.driftDelay) {
                // Ease towards target position (heart shape)
                this.x += (this.targetX - this.x) * 0.06;
                this.y += (this.targetY - this.y) * 0.06;

                // Gradually fade color from Rainbow -> Pink
                const diff = this.finalHue - this.hue;
                // Handle hue wrapping (shortest path to pink)
                if (Math.abs(diff) > 180) {
                     if (this.hue > this.finalHue) this.hue += 2;
                     else this.hue -= 2;
                } else {
                     this.hue += diff * 0.05;
                }
                
                // Make them brighter as they form the heart
                if(this.lightness < 80) this.lightness += 0.5;
            }

            // Keep Hue within 0-360
            if (this.hue > 360) this.hue -= 360;
            if (this.hue < 0) this.hue += 360;

            this.life--;
        }

        draw() {
            ctx.fillStyle = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
            // Make particles slightly smaller for a "glitter" effect
            ctx.fillRect(this.x, this.y, 2, 2); 
        }
    }

    function createFireworkToHeart(x, y) {
        const scale = Math.min(window.innerWidth, window.innerHeight) / 45;
        
        // High density for explosion
        for (let t = 0; t < Math.PI * 2; t += 0.01) {
            const p = heart(t);
            const targetX = x + (p.x * scale);
            const targetY = y + (p.y * scale);
            particles.push(new Particle(x, y, targetX, targetY));
        }
    }

    let line1Shown = false;
    const message = "On this day, the universe received what it didn’t even know it was missing - you";

    function animate() {
        ctx.fillStyle = "rgba(0,0,0,0.2)"; // Lower opacity trail for longer streaks
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

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

        if (zoomSpeed > 0.5) zoomSpeed *= 0.97;

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        if (!line1Shown && zoomSpeed < (isMobile ? 3.5 : 2)) {
            line1Shown = true;
            phase = 1;
            const line1 = document.getElementById("line1");
            
            typeWriter(line1, message, 50, () => {
                setTimeout(() => {
                    line1.classList.remove("show");
                    setTimeout(() => {
                        createFireworkToHeart(centerX, centerY);
                        phase = 2;
                    }, 800);
                }, 2000);
            });
        }

        if (phase === 2) {
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            });

            if (particles.length < 10) {
                const line2 = document.getElementById("line2");
                line2.classList.add("show");
                const img = line2.querySelector("img");
                if (img) img.style.opacity = "1";
                phase = 3;
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
}