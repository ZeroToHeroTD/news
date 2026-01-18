const container1 = document.getElementById("container1");
const page1 = document.getElementById("page1");
const page2 = document.getElementById("page2");

let animationStarted = false;


function btnClick() {
    const music = document.getElementById("bg-music");
    if (music) {
        music.volume = 0;
        music.play().catch(err => console.log("Audio blocked:", err));
        
        let vol = 0;
        const fadeInInterval = setInterval(() => {
            if (vol < 0.6) {
                vol += 0.05;
                music.volume = vol;
            } else {
                clearInterval(fadeInInterval);
            }
        }, 200);
    }

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
    element.style.opacity = "1";
    element.classList.add("show");
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            setTimeout(callback, 1500); 
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
        ctx.scale(dpr, dpr);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const isMobile = window.innerWidth < 768;

    let stars = [];
    let particles = [];
    let shockwaves = [];
    let phase = 0; 
    let zoomSpeed = 45; 
    let frame = 0;
    let heartForming = false;
    let heartFading = false;
    let sequenceStarted = false;


    const starCount = isMobile ? 600 : 1200;
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: (Math.random() - 0.5) * 2000,
            y: (Math.random() - 0.5) * 2000,
            z: Math.random() * 2000,
            px: 0, py: 0
        });
    }

    function heart(t) {
        return {
            x: 16 * Math.sin(t) ** 3,
            y: -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t))
        };
    }

    class Particle {
        constructor(targetX, targetY) {
            this.x = centerX;
            this.y = centerY;
            this.targetX = targetX;
            this.targetY = targetY;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 4;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.hue = Math.random() * 60 + 300;
            this.finalHue = 340; 
            this.saturation = 100;
            this.lightness = 60;
            this.alpha = 1;
            this.friction = 0.94; 
            this.lerpSpeed = 0.06;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.friction;
            this.vy *= this.friction;

            if (heartForming) {
                this.x += (this.targetX - this.x) * this.lerpSpeed;
                this.y += (this.targetY - this.y) * this.lerpSpeed;
                this.hue += (this.finalHue - this.hue) * 0.05;
             
                this.x += Math.sin(frame * 0.05 + this.y) * 0.2;
            }

            if (heartFading) {
                this.alpha -= 0.015;
            }
        }
        draw() {
            if (this.alpha <= 0) return;
            ctx.fillStyle = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, ${this.alpha})`;
            ctx.fillRect(this.x, this.y, 2, 2);
        }
    }

    function prepareHeart() {
        const scale = Math.min(window.innerWidth, window.innerHeight) / (isMobile ? 55 : 45);
        for (let t = 0; t < Math.PI * 2; t += 0.015) { 
            const p = heart(t);
            particles.push(new Particle(centerX + p.x * scale, centerY + p.y * scale));
        }
    }

    function animate() {
        frame++;
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)"; 
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);


        for (let s of stars) {
            s.z -= zoomSpeed; 
            if (s.z <= 1) { s.z = 2000; s.x = (Math.random() - 0.5) * 2000; s.y = (Math.random() - 0.5) * 2000; s.px = 0; s.py = 0; }
            const scale = 1000 / s.z;
            const sx = s.x * scale + centerX;
            const sy = s.y * scale + centerY;
            if (s.px !== 0) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, scale / 4)})`;
                ctx.lineWidth = Math.min(3, scale * 1.5);
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(s.px, s.py); ctx.stroke();
            }
            s.px = sx; s.py = sy;
        }

        if (zoomSpeed > 1) zoomSpeed *= 0.985;


        if (phase < 2) {
            const p = 1 + 0.3 * Math.sin(frame * 0.15);
            ctx.beginPath(); ctx.arc(centerX, centerY, 5 * p, 0, Math.PI*2);
            ctx.fillStyle = "white"; ctx.fill();
        }


        if (!sequenceStarted && zoomSpeed < 4) {
            sequenceStarted = true;
            const line1 = document.getElementById("line1");
            const finalLine = document.getElementById("final-birthday-text");
            const line2Box = document.getElementById("line2");


            typeWriter(line1, "On this day, the universe received what it didn’t even know it was missing - you", 50, () => {
                line1.style.opacity = "0";
                setTimeout(() => {

                    typeWriter(line1, "Every star led me to you...", 60, () => {
                        line1.style.opacity = "0";
                        setTimeout(() => {

                            phase = 2;
                            prepareHeart();
                            shockwaves.push({r: 0, a: 1});
                            setTimeout(() => { heartForming = true; }, 700);


                            setTimeout(() => {
                                heartFading = true;
                                setTimeout(() => {
                                    line2Box.classList.add("show");
                                    typeWriter(finalLine, "happy birthday, my love.", 80);
                                }, 1000);
                            }, 4000); 

                        }, 1000);
                    });
                }, 1000);
            });
        }


        shockwaves.forEach((sw, i) => {
            sw.r += 20; sw.a *= 0.94;
            if(sw.a < 0.01) shockwaves.splice(i, 1);
            else {
                ctx.beginPath(); ctx.arc(centerX, centerY, sw.r, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255, 100, 150, ${sw.a})`; ctx.stroke();
            }
        });

        if (phase === 2) {
            particles.forEach(p => { p.update(); p.draw(); });
        }

        requestAnimationFrame(animate);
    }
    animate();
};