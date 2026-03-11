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
            minWindSpeed: 1,            // Minimum wind speed to show particles
            altitudeIndex: 0,           // Which altitude layer to use (0 = surface)
            velocitySmoothing: 0.84     // Higher values produce smoother directional transitions
        };
        
        this.particles = [];
        this.isRunning = false;
        this.windField = null;
        
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
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;

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
        
        // Get wind at corners
        const w00 = this.getWindAt(x0 / fmap.dimension.x * this.canvas.width, 
                                    y0 / fmap.dimension.y * this.canvas.height);
        const w10 = this.getWindAt(x1 / fmap.dimension.x * this.canvas.width, 
                                    y0 / fmap.dimension.y * this.canvas.height);
        const w01 = this.getWindAt(x0 / fmap.dimension.x * this.canvas.width, 
                                    y1 / fmap.dimension.y * this.canvas.height);
        const w11 = this.getWindAt(x1 / fmap.dimension.x * this.canvas.width, 
                                    y1 / fmap.dimension.y * this.canvas.height);
        
        // Bilinear interpolation
        const u = (1 - sx) * (1 - sy) * w00.u + sx * (1 - sy) * w10.u +
                  (1 - sx) * sy * w01.u + sx * sy * w11.u;
        const v = (1 - sx) * (1 - sy) * w00.v + sx * (1 - sy) * w10.v +
                  (1 - sx) * sy * w01.v + sx * sy * w11.v;
        const speed = Math.sqrt(u * u + v * v);
        
        return { u, v, speed };
    }
    
    // Convert wind speed to a continuous color ramp
    getColorFromWindSpeed(speed, alpha) {
        const normalizedSpeed = Math.max(0, Math.min(1, speed / 60));
        const hue = 220 - (220 * normalizedSpeed);
        const saturation = 85;
        const lightness = 58;
        return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    }
    
    // Update particle position
    updateParticle(particle) {
        particle.age++;
        
        // Reset particle if too old or out of bounds
        if (particle.age > this.config.particleLifetime || 
            particle.x < 0 || particle.x > this.canvas.width ||
            particle.y < 0 || particle.y > this.canvas.height) {
            Object.assign(particle, this.createParticle());
            return;
        }
        
        // Get wind at particle position
        const wind = this.getInterpolatedWind(particle.x, particle.y);
        if (wind.speed < this.config.minWindSpeed) {
            Object.assign(particle, this.createParticle());
            return;
        }
        
        // Store wind speed for coloring
        particle.windSpeed = wind.speed;
        
        // Update tail position
        particle.xt = particle.x;
        particle.yt = particle.y;
        
        // Move particle according to wind
        const scaleFactor = this.canvas.width / Math.max(this.weatherData.dimension.x * 12, 1);
        const targetVx = wind.u * this.config.particleSpeed * scaleFactor;
        const targetVy = wind.v * this.config.particleSpeed * scaleFactor;
        const smoothing = this.config.velocitySmoothing;

        particle.vx = particle.vx * smoothing + targetVx * (1 - smoothing);
        particle.vy = particle.vy * smoothing + targetVy * (1 - smoothing);

        particle.x += particle.vx;
        particle.y += particle.vy;
    }
    
    // Draw all particles
    draw() {
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-in';
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.config.fadeOpacity})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // Draw particles as short rounded trail segments
        for (const particle of this.particles) {
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
    
    // Update altitude level to display
    setAltitude(altitudeIndex) {
        const nextAltitude = Number(altitudeIndex);
        this.config.altitudeIndex = Math.max(0, Math.min(9, Number.isNaN(nextAltitude) ? 0 : nextAltitude));
        this.initParticles(); // Reset particles for new altitude
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindParticles;
}
