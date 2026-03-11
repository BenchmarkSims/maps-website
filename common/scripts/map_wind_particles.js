// 
// Wind Particle System - Windy/Leaflet Style Visualization
// Creates animated wind particles that follow the wind field
//

class WindParticles {
    constructor(canvas, weatherData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true });
        this.weatherData = weatherData;
        
        // Particle configuration
        this.config = {
            particleCount: 5000,       // Lower count to reduce CPU load
            particleLifetime: 90,      // Frames before regeneration
            particleSpeed: 0.05,       // Speed multiplier
            particleWidth: 2,        // Thicker trail width
            particleLength: 1.15,      // Slightly longer trail multiplier
            particleOpacity: 0.8,      // Base opacity
            particleColor: '#ffffff',   // Particle color (overridden by speed)
            fadeOpacity: 0.95,          // Trail fade rate
            minWindSpeed: 0.1,          // Minimum wind speed to show particles (very low)
            altitudeIndex: 0,           // Which altitude layer to use (0 = surface)
            velocitySmoothing: 0.92     // Higher values produce smoother directional transitions
        };
        
        this.particles = [];
        this.isRunning = false;
        this.windField = null;
        this.colorCache = {};  // Cache for color strings
        this.viewport = null;  // {x, y, width, height} in canvas pixels, null = full canvas
        
        this.initParticles();
    }
    
    // Initialize particles with random positions
    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    // Create a single particle
    createParticle() {
        // Spawn only within the visible viewport (with a small margin to avoid pop-in)
        const margin = 50;
        const vp = this.viewport;
        const spawnX = vp ? vp.x - margin : 0;
        const spawnY = vp ? vp.y - margin : 0;
        const spawnW = vp ? vp.width + margin * 2 : this.canvas.width;
        const spawnH = vp ? vp.height + margin * 2 : this.canvas.height;

        const x = spawnX + Math.random() * spawnW;
        const y = spawnY + Math.random() * spawnH;

        return {
            x: x,
            y: y,
            age: Math.random() * this.config.particleLifetime,
            xt: x,
            yt: y,
            vx: 0,
            vy: 0,
            windSpeed: 0  // wind speed for coloring
        };
    }
    
    // Get wind vector at a specific position
    getWindAt(x, y) {
        if (!this.weatherData || !this.weatherData.wind || 
            this.weatherData.wind.length === 0 ||
            !this.weatherData.dimension ||
            !this.weatherData.dimension.x ||
            !this.weatherData.dimension.y ||
            !this.canvas.width ||
            !this.canvas.height) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        const fmap = this.weatherData;
        const normalizedX = Math.max(0, Math.min(this.canvas.width - 1, x));
        const normalizedY = Math.max(0, Math.min(this.canvas.height - 1, y));
        const gridX = Math.min(
            fmap.dimension.x - 1,
            Math.floor(normalizedX / this.canvas.width * fmap.dimension.x)
        );
        const gridY = Math.min(
            fmap.dimension.y - 1,
            Math.floor(normalizedY / this.canvas.height * fmap.dimension.y)
        );
        
        // Boundary check
        if (gridX < 0 || gridX >= fmap.dimension.x || 
            gridY < 0 || gridY >= fmap.dimension.y) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Get wind data
        const row = fmap.wind[gridY];
        const column = row && row[gridX];
        const windData = column && column[this.config.altitudeIndex];
        if (!windData) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Convert direction and speed to u,v components
        // Direction is "from" in degrees, speed in knots
        const direction = windData.direction * Math.PI / 180;
        const speed = windData.speed;
        
        // Convert to screen space velocity (direction is where wind is coming FROM)
        const u = -Math.sin(direction) * speed;
        const v = Math.cos(direction) * speed;
        
        return { u, v, speed };
    }
    
    // Interpolate wind between grid points (bilinear interpolation)
    getInterpolatedWind(x, y) {
        if (!this.weatherData || !this.weatherData.wind || 
            this.weatherData.wind.length === 0 ||
            !this.weatherData.dimension ||
            !this.weatherData.dimension.x ||
            !this.weatherData.dimension.y ||
            !this.canvas.width ||
            !this.canvas.height) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        const fmap = this.weatherData;
        const clampedX = Math.max(0, Math.min(this.canvas.width - 1, x));
        const clampedY = Math.max(0, Math.min(this.canvas.height - 1, y));
        const fx = (clampedX / this.canvas.width) * (fmap.dimension.x - 1);
        const fy = (clampedY / this.canvas.height) * (fmap.dimension.y - 1);
        
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(x0 + 1, fmap.dimension.x - 1);
        const y1 = Math.min(y0 + 1, fmap.dimension.y - 1);
        
        // Boundary check
        if (x0 < 0 || y0 < 0 || x0 >= fmap.dimension.x || y0 >= fmap.dimension.y) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Get fractional parts
        const sx = fx - x0;
        const sy = fy - y0;
        
        // Direct grid access - much faster than calling getWindAt 4 times
        const alt = this.config.altitudeIndex;
        const getWindDirect = (gx, gy) => {
            const row = fmap.wind[gy];
            const column = row && row[gx];
            const windData = column && column[alt];
            if (!windData) return { u: 0, v: 0 };
            const direction = windData.direction * Math.PI / 180;
            const speed = windData.speed;
            const u = -Math.sin(direction) * speed;
            const v = Math.cos(direction) * speed;
            return { u, v };
        };
        
        // Get wind at corners
        const w00 = getWindDirect(x0, y0);
        const w10 = getWindDirect(x1, y0);
        const w01 = getWindDirect(x0, y1);
        const w11 = getWindDirect(x1, y1);
        
        // Bilinear interpolation
        const u = (1 - sx) * (1 - sy) * w00.u + sx * (1 - sy) * w10.u +
                  (1 - sx) * sy * w01.u + sx * sy * w11.u;
        const v = (1 - sx) * (1 - sy) * w00.v + sx * (1 - sy) * w10.v +
                  (1 - sx) * sy * w01.v + sx * sy * w11.v;
        const speed = Math.sqrt(u * u + v * v);
        
        return { u, v, speed };
    }
    
    // Convert wind speed to a continuous color ramp (with caching)
    getColorFromWindSpeed(speed, alpha) {
        // Round speed for better cache hits
        const roundedSpeed = Math.round(speed);
        const cacheKey = `${roundedSpeed}_${alpha.toFixed(2)}`;
        
        if (this.colorCache[cacheKey]) {
            return this.colorCache[cacheKey];
        }
        
        const normalizedSpeed = Math.max(0, Math.min(1, speed / 60));
        const hue = 220 - (220 * normalizedSpeed);
        const saturation = 85;
        const lightness = 58;
        const color = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
        
        this.colorCache[cacheKey] = color;
        return color;
    }
    
    // Update particle position
    updateParticle(particle) {
        particle.age++;
        
        // Define active bounds (viewport + margin, or full canvas)
        const margin = 50;
        const vp = this.viewport;
        const minX = vp ? vp.x - margin : 0;
        const minY = vp ? vp.y - margin : 0;
        const maxX = vp ? vp.x + vp.width + margin : this.canvas.width;
        const maxY = vp ? vp.y + vp.height + margin : this.canvas.height;

        // Reset particle if too old or outside active area
        if (particle.age > this.config.particleLifetime || 
            particle.x < minX || particle.x > maxX ||
            particle.y < minY || particle.y > maxY) {
            Object.assign(particle, this.createParticle());
            return;
        }
        
        // Get wind at particle position
        const wind = this.getInterpolatedWind(particle.x, particle.y);
        
        // Store wind speed for coloring (always, even if very low)
        particle.windSpeed = wind.speed;
        
        // Update tail position
        particle.xt = particle.x;
        particle.yt = particle.y;
        
        // Move particle according to wind with highly smooth velocity transitions
        const scaleFactor = this.canvas.width / Math.max(this.weatherData.dimension.x * 12, 1);
        const targetVx = wind.u * this.config.particleSpeed * scaleFactor;
        const targetVy = wind.v * this.config.particleSpeed * scaleFactor;
        const smoothing = this.config.velocitySmoothing;

        // Exponential smoothing for very smooth acceleration
        particle.vx = particle.vx * smoothing + targetVx * (1 - smoothing);
        particle.vy = particle.vy * smoothing + targetVy * (1 - smoothing);

        particle.x += particle.vx;
        particle.y += particle.vy;
    }
    
    // Draw all particles
    draw() {
        const vp = this.viewport;

        this.ctx.save();

        // Clip to viewport so fade and drawing don't touch offscreen regions
        if (vp) {
            this.ctx.beginPath();
            this.ctx.rect(vp.x, vp.y, vp.width, vp.height);
            this.ctx.clip();
        }

        // Fade effect - erodes trails without darkening background
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.globalAlpha = 1 - this.config.fadeOpacity;
        this.ctx.fillStyle = '#ffffff';
        if (vp) {
            this.ctx.fillRect(vp.x, vp.y, vp.width, vp.height);
        } else {
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Draw particles as short rounded trail segments
        const particles = this.particles;
        const len = particles.length;
        for (let i = 0; i < len; i++) {
            const particle = particles[i];
            // Calculate opacity based on age
            const ageRatio = Math.min(particle.age / 10, 1);
            
            if (ageRatio > 0.1) {
                // Set color based on wind speed
                // Set alpha based on age for smooth fade-in
                const alpha = Math.min(this.config.particleOpacity, ageRatio * this.config.particleOpacity);

                this.ctx.strokeStyle = this.getColorFromWindSpeed(particle.windSpeed, alpha);
                this.ctx.lineWidth = this.config.particleWidth;
                
                const dx = particle.x - particle.xt;
                const dy = particle.y - particle.yt;
                const controlX = particle.xt + dx * 0.5 + particle.vx * 0.35;
                const controlY = particle.yt + dy * 0.5 + particle.vy * 0.35;
                const endX = particle.xt + dx * this.config.particleLength;
                const endY = particle.yt + dy * this.config.particleLength;

                this.ctx.beginPath();
                this.ctx.moveTo(particle.xt, particle.yt);
                this.ctx.quadraticCurveTo(controlX, controlY, endX, endY);
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }
    
    // Convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
    }
    
    // Advance one animation step
    animate() {
        if (!this.isRunning) return;
        
        // Update all particles
        for (const particle of this.particles) {
            this.updateParticle(particle);
        }
        
        // Draw
        this.draw();
    }
    
    // Start animation
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
    }
    
    // Stop animation
    stop() {
        this.isRunning = false;
    }
    
    // Clear canvas
    clear() {
        // Fully clear the canvas with proper transparency
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Fill with transparent black initially for better fade effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Update configuration
    setConfig(newConfig) {
        Object.assign(this.config, newConfig);
        
        // Clear color cache on config changes
        this.colorCache = {};
        
        // Reinitialize particles if count changed
        if (newConfig.particleCount && newConfig.particleCount !== this.particles.length) {
            this.initParticles();
        }
    }
    
    // Update weather data
    setWeatherData(weatherData) {
        this.weatherData = weatherData;
        this.initParticles();
    }
    
    // Resize canvas
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.initParticles();
    }
    
    // Update the visible viewport so particles are only rendered/spawned in the visible area
    // x, y, width, height are in canvas pixel coordinates
    setViewport(x, y, width, height) {
        if (width <= 0 || height <= 0) return;

        const prev = this.viewport;
        // Only respawn particles if viewport changed significantly (> 10px)
        if (!prev || Math.abs(prev.x - x) > 10 || Math.abs(prev.y - y) > 10 ||
                Math.abs(prev.width - width) > 10 || Math.abs(prev.height - height) > 10) {
            this.viewport = { x, y, width, height };
            // Respawn out-of-viewport particles immediately so coverage is dense
            const margin = 50;
            for (let i = 0; i < this.particles.length; i++) {
                const p = this.particles[i];
                if (p.x < x - margin || p.x > x + width + margin ||
                    p.y < y - margin || p.y > y + height + margin) {
                    Object.assign(p, this.createParticle());
                }
            }
        }
    }

    // Update altitude level to display
    setAltitude(altitudeIndex) {
        const nextAltitude = Number(altitudeIndex);
        this.config.altitudeIndex = Math.max(0, Math.min(9, Number.isNaN(nextAltitude) ? 0 : nextAltitude));
        this.colorCache = {};  // Clear cache on altitude change
        this.initParticles(); // Reset particles for new altitude
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindParticles;
}
