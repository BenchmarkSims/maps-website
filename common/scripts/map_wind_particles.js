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
            particleCount: 8000,       // Number of particles (much denser)
            particleLifetime: 80,       // Frames before regeneration (shorter lifespan)
            particleSpeed: 0.12,        // Speed multiplier
            particleWidth: 0.5,         // Point size (very small)
            particleLength: 1,          // Trail length (almost none)
            particleOpacity: 0.5,       // Base opacity (semi-transparent)
            particleColor: '#ffffff',   // Particle color (overridden by speed)
            fadeOpacity: 0.80,          // Trail fade rate (very fast fade)
            minWindSpeed: 1,            // Minimum wind speed to show particles
            altitudeIndex: 0            // Which altitude layer to use (0 = surface)
        };
        
        this.particles = [];
        this.animationId = null;
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
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            age: Math.random() * this.config.particleLifetime,
            xt: 0,  // x tail
            yt: 0,  // y tail
            windSpeed: 0  // wind speed for coloring
        };
    }
    
    // Get wind vector at a specific position
    getWindAt(x, y) {
        if (!this.weatherData || !this.weatherData.wind || 
            this.weatherData.wind.length === 0) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        const fmap = this.weatherData;
        const gridX = Math.floor(x / this.canvas.width * fmap.dimension.x);
        const gridY = Math.floor(y / this.canvas.height * fmap.dimension.y);
        
        // Boundary check
        if (gridX < 0 || gridX >= fmap.dimension.x || 
            gridY < 0 || gridY >= fmap.dimension.y) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        // Get wind data
        const windData = fmap.wind[gridY][gridX][this.config.altitudeIndex];
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
            this.weatherData.wind.length === 0) {
            return { u: 0, v: 0, speed: 0 };
        }
        
        const fmap = this.weatherData;
        const fx = (x / this.canvas.width) * fmap.dimension.x;
        const fy = (y / this.canvas.height) * fmap.dimension.y;
        
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
    
    // Convert wind speed to color (slow=blue, moderate=green, fast=red/orange)
    getColorFromWindSpeed(speed) {
        // Normalize speed: 0-10 knots = slow, 10-25 = moderate, 25+ = fast
        if (speed < 10) {
            // Blue (slow wind)
            return '#4488FF';
        } else if (speed < 20) {
            // Green (moderate wind)
            return '#44FF88';
        } else if (speed < 35) {
            // Yellow-Orange (strong wind)
            return '#FFAA44';
        } else {
            // Red (very strong wind)
            return '#FF4444';
        }
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
        
        // Store wind speed for coloring
        particle.windSpeed = wind.speed;
        
        // Update tail position
        particle.xt = particle.x;
        particle.yt = particle.y;
        
        // Move particle according to wind
        // Use a more realistic scale factor: canvas pixels / map cells / scale factor
        // This creates smooth, visible movement without being too fast
        const scaleFactor = this.canvas.width / (this.weatherData.dimension.x * 20);
        particle.x += wind.u * this.config.particleSpeed * scaleFactor;
        particle.y += wind.v * this.config.particleSpeed * scaleFactor;
    }
    
    // Draw all particles
    draw() {
        // Create fade effect by reducing opacity
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // Reduce opacity of existing pixels for fade effect
        const fadeAmount = Math.max(0.01, 1 - this.config.fadeOpacity);
        for (let i = 3; i < data.length; i += 4) {
            // Reduce alpha channel
            data[i] *= fadeAmount;
        }
        
        // Put faded image back
        this.ctx.putImageData(imageData, 0, 0);
        
        // Draw particles as small dots (Windy-style)
        for (const particle of this.particles) {
            // Calculate opacity based on age
            const ageRatio = Math.min(particle.age / 10, 1);
            
            if (ageRatio > 0.1) {
                // Set color based on wind speed
                const color = this.getColorFromWindSpeed(particle.windSpeed);
                
                // Set alpha based on age for smooth fade-in
                const alpha = Math.min(this.config.particleOpacity, ageRatio * this.config.particleOpacity);
                
                // Convert hex color to RGB with alpha
                const rgbColor = this.hexToRgb(color);
                this.ctx.fillStyle = `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${alpha})`;
                
                // Draw particle as a small circle
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, this.config.particleWidth, 0, Math.PI * 2);
                this.ctx.fill();
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
    
    // Animation loop
    animate() {
        if (!this.isRunning) return;
        
        // Update all particles
        for (const particle of this.particles) {
            this.updateParticle(particle);
        }
        
        // Draw
        this.draw();
        
        // Continue animation
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    // Start animation
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.animate();
    }
    
    // Stop animation
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
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
    }
    
    // Resize canvas
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.initParticles();
    }
    
    // Update altitude level to display
    setAltitude(altitudeIndex) {
        this.config.altitudeIndex = Math.max(0, Math.min(9, altitudeIndex));
        this.initParticles(); // Reset particles for new altitude
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindParticles;
}
