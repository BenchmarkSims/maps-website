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
            particleCount: 5000,       // Active particle count after zoom adjustment
            baseParticleCount: 5000,   // Reference count used at zoom 1
            minParticleCount: 1200,    // Prevent the layer from becoming too sparse
            maxParticleCount: 9000,    // Cap CPU usage when zoomed out
            particleLifetime: 90,      // Frames before regeneration
            particleSpeed: 0.05,       // Speed multiplier
            particleWidth: 2,        // Thicker trail width
            particleLength: 1.15,      // Slightly longer trail multiplier
            particleOpacity: 1,      // Base opacity
            particleColor: '#ffffff',   // Particle color (overridden by speed)
            fadeOpacity: 0.95,          // Trail fade rate
            minWindSpeed: 0.1,          // Minimum wind speed to show particles (very low)
            altitudeIndex: 0,           // Which altitude layer to use (0 = surface)
            velocitySmoothing: 0.92,    // Higher values produce smoother directional transitions
            zoom: 1                     // Current map zoom used to tune density
        };
        
        this.particles = [];
        this.isRunning = false;
        this.windField = null;      // Precomputed Float32Array [u0,v0, u1,v1, ...]
        this.windFieldDimX = 0;
        this.windFieldDimY = 0;
        this.colorCache = {};       // Cache for color strings
        this.viewport = null;       // {x, y, width, height} in canvas pixels, null = full canvas
        
        this.initParticles();
    }
    
    // Initialize particles with random positions
    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }

    syncParticleCount() {
        const targetCount = Math.max(0, Math.round(this.config.particleCount));
        const currentCount = this.particles.length;

        if (targetCount === currentCount) {
            return;
        }

        if (targetCount > currentCount) {
            for (let i = currentCount; i < targetCount; i++) {
                this.particles.push(this.createParticle());
            }
            return;
        }

        this.particles.length = targetCount;
    }

    getParticleCountForZoom(zoomLevel) {
        const safeZoom = Math.max(Number(zoomLevel) || 1, 0.01);
        const zoomRatio = 1 / (safeZoom * safeZoom);
        const baseCount = this.config.baseParticleCount;
        const minCount = this.config.minParticleCount;
        const maxCount = this.config.maxParticleCount;

        return Math.max(minCount, Math.min(maxCount, Math.round(baseCount * zoomRatio)));
    }

    setZoom(zoomLevel, forceRebuild) {
        const safeZoom = Math.max(Number(zoomLevel) || 1, 0.01);
        const targetCount = this.getParticleCountForZoom(safeZoom);
        const zoomChanged = Math.abs((this.config.zoom || 1) - safeZoom) > 0.001;
        const countChanged = targetCount !== this.config.particleCount;

        this.config.zoom = safeZoom;
        this.config.particleCount = targetCount;

        if (forceRebuild) {
            this.initParticles();
            return;
        }

        if (zoomChanged || countChanged) {
            this.syncParticleCount();
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
    
    // Precompute u/v for every grid cell into a flat Float32Array.
    // Called once when weather data changes — O(dimX*dimY) instead of per-particle per-frame.
    _buildWindField() {
        const fmap = this.weatherData;
        if (!fmap || !fmap.wind || !fmap.dimension) {
            this.windField = null;
            return;
        }
        const dimX = fmap.dimension.x;
        const dimY = fmap.dimension.y;
        const alt  = this.config.altitudeIndex;
        const buf  = new Float32Array(dimX * dimY * 2); // [u, v, u, v, ...]
        const PI_DIV_180 = Math.PI / 180;

        for (let gy = 0; gy < dimY; gy++) {
            const row = fmap.wind[gy];
            for (let gx = 0; gx < dimX; gx++) {
                const idx = (gy * dimX + gx) * 2;
                const col  = row && row[gx];
                const cell = col && col[alt];
                if (cell) {
                    const dir = cell.direction * PI_DIV_180;
                    const spd = cell.speed;
                    buf[idx]     = -Math.sin(dir) * spd;  // u
                    buf[idx + 1] =  Math.cos(dir) * spd;  // v
                }
                // else remains 0,0
            }
        }
        this.windField    = buf;
        this.windFieldDimX = dimX;
        this.windFieldDimY = dimY;
    }

    // Get wind vector at a specific position (kept for compatibility)
    getWindAt(x, y) {
        const res = { u: 0, v: 0, speed: 0 };
        if (!this.windField) return res;
        const dimX = this.windFieldDimX;
        const dimY = this.windFieldDimY;
        const gx = Math.min(dimX - 1, Math.max(0, Math.floor(x / this.canvas.width  * dimX)));
        const gy = Math.min(dimY - 1, Math.max(0, Math.floor(y / this.canvas.height * dimY)));
        const idx = (gy * dimX + gx) * 2;
        res.u = this.windField[idx];
        res.v = this.windField[idx + 1];
        res.speed = Math.sqrt(res.u * res.u + res.v * res.v);
        return res;
    }

    // Bilinear interpolation directly on the precomputed Float32Array — no object allocations
    getInterpolatedWind(x, y) {
        if (!this.windField) return { u: 0, v: 0, speed: 0 };

        const dimX = this.windFieldDimX;
        const dimY = this.windFieldDimY;
        const buf  = this.windField;

        const fx = (x / this.canvas.width)  * (dimX - 1);
        const fy = (y / this.canvas.height) * (dimY - 1);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = x0 + 1 < dimX ? x0 + 1 : x0;
        const y1 = y0 + 1 < dimY ? y0 + 1 : y0;
        const sx = fx - x0;
        const sy = fy - y0;
        const _sx = 1 - sx;
        const _sy = 1 - sy;

        const i00 = (y0 * dimX + x0) * 2;
        const i10 = (y0 * dimX + x1) * 2;
        const i01 = (y1 * dimX + x0) * 2;
        const i11 = (y1 * dimX + x1) * 2;

        const u = _sx * _sy * buf[i00] + sx * _sy * buf[i10] + _sx * sy * buf[i01] + sx * sy * buf[i11];
        const v = _sx * _sy * buf[i00+1] + sx * _sy * buf[i10+1] + _sx * sy * buf[i01+1] + sx * sy * buf[i11+1];
        return { u, v, speed: Math.sqrt(u * u + v * v) };
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
        // Kept for API compatibility — actual update is done inline in animate()
    }
    
    // Advance one animation step
    animate() {
        if (!this.isRunning) return;

        // Hoist all per-frame constants outside the particle loop
        const vp         = this.viewport;
        const margin     = 50;
        const minX       = vp ? vp.x - margin : 0;
        const minY       = vp ? vp.y - margin : 0;
        const maxX       = vp ? vp.x + vp.width  + margin : this.canvas.width;
        const maxY       = vp ? vp.y + vp.height + margin : this.canvas.height;
        const lifetime   = this.config.particleLifetime;
        const smoothing  = this.config.velocitySmoothing;
        const iSmoothing = 1 - smoothing;
        const scaleFactor = this.weatherData
            ? this.canvas.width / Math.max(this.windFieldDimX * 12, 1)
            : 0;
        const speedMul   = this.config.particleSpeed * scaleFactor;
        const particles  = this.particles;
        const len        = particles.length;
        const buf        = this.windField;
        const dimX       = this.windFieldDimX;
        const dimY       = this.windFieldDimY;
        const cw         = this.canvas.width;
        const ch         = this.canvas.height;
        const dimX1      = dimX - 1;
        const dimY1      = dimY - 1;

        for (let i = 0; i < len; i++) {
            const p = particles[i];
            p.age++;

            if (p.age > lifetime || p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
                // Inline createParticle to avoid function call + object allocation
                const spawnX = vp ? vp.x - margin : 0;
                const spawnY = vp ? vp.y - margin : 0;
                const spawnW = vp ? vp.width  + margin * 2 : cw;
                const spawnH = vp ? vp.height + margin * 2 : ch;
                p.x  = spawnX + Math.random() * spawnW;
                p.y  = spawnY + Math.random() * spawnH;
                p.xt = p.x;
                p.yt = p.y;
                p.vx = 0;
                p.vy = 0;
                p.age = Math.random() * lifetime;
                p.windSpeed = 0;
                continue;
            }

            // Bilinear wind interpolation directly on Float32Array — zero allocations
            let u = 0, v = 0, speed = 0;
            if (buf) {
                const fx = (p.x / cw) * dimX1;
                const fy = (p.y / ch) * dimY1;
                const x0 = fx | 0;
                const y0 = fy | 0;
                const x1 = x0 < dimX1 ? x0 + 1 : x0;
                const y1 = y0 < dimY1 ? y0 + 1 : y0;
                const sx = fx - x0;
                const sy = fy - y0;
                const _sx = 1 - sx;
                const _sy = 1 - sy;
                const i00 = (y0 * dimX + x0) * 2;
                const i10 = (y0 * dimX + x1) * 2;
                const i01 = (y1 * dimX + x0) * 2;
                const i11 = (y1 * dimX + x1) * 2;
                u = _sx * _sy * buf[i00]   + sx * _sy * buf[i10]   + _sx * sy * buf[i01]   + sx * sy * buf[i11];
                v = _sx * _sy * buf[i00+1] + sx * _sy * buf[i10+1] + _sx * sy * buf[i01+1] + sx * sy * buf[i11+1];
                speed = Math.sqrt(u * u + v * v);
            }

            p.windSpeed = speed;
            p.xt = p.x;
            p.yt = p.y;

            const tvx = u * speedMul;
            const tvy = v * speedMul;
            p.vx = p.vx * smoothing + tvx * iSmoothing;
            p.vy = p.vy * smoothing + tvy * iSmoothing;
            p.x += p.vx;
            p.y += p.vy;
        }

        this.draw();
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
    
    // Advance one animation step — the real implementation is the new animate() above
    // This old stub is replaced; keeping hexToRgb below for compatibility if needed.
    
    // Convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
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
        
        // Rebuild wind field if altitude changed
        if (newConfig.altitudeIndex !== undefined) {
            this._buildWindField();
        }

        if (newConfig.baseParticleCount !== undefined ||
            newConfig.minParticleCount !== undefined ||
            newConfig.maxParticleCount !== undefined ||
            newConfig.zoom !== undefined) {
            this.setZoom(this.config.zoom, false);
            return;
        }
        
        // Reinitialize particles if count changed
        if (newConfig.particleCount && newConfig.particleCount !== this.particles.length) {
            this.syncParticleCount();
        }
    }
    
    // Update weather data
    setWeatherData(weatherData) {
        this.weatherData = weatherData;
        this._buildWindField();
        this.initParticles();
    }
    
    // Resize canvas
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.setZoom(this.config.zoom, true);
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
        this.colorCache = {};
        this._buildWindField();  // Rebuild field for new altitude layer
        this.initParticles();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WindParticles;
}
