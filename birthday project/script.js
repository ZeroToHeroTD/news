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

    // Create background stars
    const starCount = Math.floor(window.innerWidth / 1.5);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * window.innerWidth - centerX,
            y: Math.random() * window.innerHeight - centerY,
            z: Math.random() * window.innerWidth
        });
    }

    // Heart math formula
    function heart(t) {
        return {
            x: 16 * Math.sin(t) ** 3,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
        };
    }

    // === NEW PARTICLE SYSTEM ===
    class Particle {
        constructor(x, y, targetX, targetY) {
            this.x = x;
            this.y = y;
            this.targetX = targetX;
            this.targetY = targetY;
            
            // EXPLOSION PHYSICS
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20 + 5; // Huge explosion speed
            
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            
            this.friction = 0.92; // How fast they slow down to form the heart
            this.life = 300; // Lasts longer
            this.hue = 40; // Start Gold/Yellow
            this.saturation = 100;
            this.lightness = 80;
        }

        update() {
            // Apply simple physics
            this.vx *= this.friction;
            this.vy *= this.friction;

            this.x += this.vx;
            this.y += this.vy;

            // COLOR TRANSITION: From Gold Explosion -> Pink Heart
            if (this.hue > 0) this.hue -= 2; // Fade hue to Red/Pink (0-340 range)
            if (this.hue < 0) this.hue = 340; // Loop to pink range
            if (this.lightness > 60) this.lightness -= 0.5;

            // THE MAGIC: Pull particles to heart shape when they slow down
            if (Math.abs(this.vx) < 1.5 && Math.abs(this.vy) < 1.5) {
                 this.x += (this.targetX - this.x) * 0.08;
                 this.y += (this.targetY - this.y) * 0.08;
            }

            this.life--;
        }

        draw() {
            ctx.fillStyle = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
            ctx.fillRect(this.x, this.y, 2.5, 2.5); // Slightly larger particles
        }
    }

    function createFireworkToHeart(x, y) {
        const scale = Math.min(window.innerWidth, window.innerHeight) / 45;
        
        // Increase loop density for a "Huge" explosion (0.015 step)
        for (let t = 0; t < Math.PI * 2; t += 0.015) {
            const p = heart(t);
            
            // Calculate where the particle SHOULD end up (The Heart)
            const targetX = x + (p.x * scale);
            const targetY = y + (p.y * scale);

            // Create particle at center (x,y)
            particles.push(new Particle(x, y, targetX, targetY));
        }
    }

    let line1Shown = false;
    const message = "On this day, the universe received what it didn’t even know it was missing - you";

    function animate() {
        // Slightly darker trails for better fireworks contrast
        ctx.fillStyle = "rgba(0,0,0,0.25)"; 
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        // Draw Stars (Background)
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

        // Center Star
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();

        // PHASE 1: Text Typing
        if (!line1Shown && zoomSpeed < (isMobile ? 3.5 : 2)) {
            line1Shown = true;
            phase = 1;
            const line1 = document.getElementById("line1");

            typeWriter(line1, message, 50, () => {
                setTimeout(() => {
                    line1.classList.remove("show");
                    setTimeout(() => {
                        // PHASE 2: Trigger the Huge Firework
                        createFireworkToHeart(centerX, centerY);
                        phase = 2;
                    }, 1000); // Shorter wait before boom
                }, 2000);
            });
        }

        // PHASE 2: Particles Animation
        if (phase === 2) {
            particles.forEach((p, i) => {
                p.update();
                p.draw();
                if (p.life <= 0) particles.splice(i, 1);
            });

            // Transition to Final Message
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