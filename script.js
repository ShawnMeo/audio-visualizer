// Audio Visualizer - Live Audio Capture
// Uses screen/tab sharing to capture audio from any source

class AudioVisualizer {
    constructor() {
        // Canvas setup
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');

        // Audio context and nodes
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.stream = null;

        // Visualization settings
        this.mode = 'bars';
        this.theme = 'neon';
        this.sensitivity = 1.5;
        this.smoothing = 0.8;
        this.isListening = false;

        // Animation data
        this.dataArray = null;
        this.bufferLength = 0;
        this.animationId = null;
        this.particles = [];

        // Color themes
        this.themes = {
            neon: ['#ff006e', '#8338ec', '#3a86ff', '#00f5d4'],
            sunset: ['#f72585', '#ff7b00', '#ffd000', '#ff006e'],
            ocean: ['#00b4d8', '#0077b6', '#023e8a', '#48cae4'],
            forest: ['#2d6a4f', '#40916c', '#95d5b2', '#74c69d'],
            fire: ['#ff0000', '#ff7700', '#ffdd00', '#ff4400']
        };

        // Initialize
        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.bindEvents();
        this.drawIdleState();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    bindEvents() {
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => this.startListening());

        // Stop button
        document.getElementById('stopBtn').addEventListener('click', () => this.stopListening());

        // Visualization mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.mode = e.target.dataset.mode;
                if (this.mode === 'particles') this.initParticles();
            });
        });

        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.theme = e.target.dataset.theme;
            });
        });

        // Sensitivity slider
        const sensitivitySlider = document.getElementById('sensitivitySlider');
        sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivity = parseFloat(e.target.value);
            document.getElementById('sensitivityValue').textContent = `${this.sensitivity}x`;
        });

        // Smoothing slider
        const smoothingSlider = document.getElementById('smoothingSlider');
        smoothingSlider.addEventListener('input', (e) => {
            this.smoothing = parseFloat(e.target.value);
            document.getElementById('smoothingValue').textContent = this.smoothing.toFixed(2);
            if (this.analyser) {
                this.analyser.smoothingTimeConstant = this.smoothing;
            }
        });
    }

    async startListening() {
        try {
            // Use getDisplayMedia to capture screen/tab audio
            // This is the most reliable way to capture system audio
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // Required, but we won't use it
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000
                }
            });

            // Check if we got audio
            const audioTracks = this.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No audio track found. Make sure to check "Share audio" or "Share tab audio" in the dialog.');
            }

            // We don't need the video track, stop it to save resources
            const videoTracks = this.stream.getVideoTracks();
            videoTracks.forEach(track => track.stop());

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Resume audio context (required for some browsers)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = this.smoothing;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;

            // Connect source to analyser
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);

            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);

            // Update UI
            document.getElementById('startSection').classList.add('hidden');
            document.getElementById('activeIndicator').classList.remove('hidden');
            document.getElementById('stopBtn').classList.remove('hidden');

            // Hide source section since we're using tab audio
            const sourceSection = document.getElementById('sourceSection');
            if (sourceSection) sourceSection.classList.add('hidden');

            // Start visualization
            this.isListening = true;
            if (this.mode === 'particles') this.initParticles();
            this.animate();

            console.log('Audio capture started successfully!');
            console.log('Audio tracks:', audioTracks.length);
            console.log('Sample rate:', this.audioContext.sampleRate);

        } catch (error) {
            console.error('Error accessing audio:', error);

            let message = 'Could not capture audio. ';
            if (error.name === 'NotAllowedError') {
                message += 'You need to allow screen/tab sharing and make sure to check "Share audio" or "Share tab audio".';
            } else if (error.message.includes('audio')) {
                message += error.message;
            } else {
                message += 'Please try again and make sure to: 1) Select a Chrome tab 2) Check "Share tab audio" at the bottom of the dialog.';
            }

            alert(message);
        }
    }

    stopListening() {
        this.isListening = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        // Reset UI
        document.getElementById('startSection').classList.remove('hidden');
        document.getElementById('activeIndicator').classList.add('hidden');
        document.getElementById('stopBtn').classList.add('hidden');

        this.drawIdleState();
    }

    animate() {
        if (!this.isListening) return;

        this.animationId = requestAnimationFrame(() => this.animate());

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Check if we're getting any audio data
        const hasAudio = this.dataArray.some(v => v > 0);

        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw based on mode
        switch (this.mode) {
            case 'bars':
                this.drawBars();
                break;
            case 'wave':
                this.drawWave();
                break;
            case 'circular':
                this.drawCircular();
                break;
            case 'particles':
                this.drawParticles();
                break;
        }

        // Debug: show audio level indicator
        if (!hasAudio) {
            this.drawNoAudioIndicator();
        }
    }

    drawNoAudioIndicator() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No audio detected - play some music in the shared tab!', this.canvas.width / 2, 50);
    }

    getColors() {
        return this.themes[this.theme] || this.themes.neon;
    }

    createGradient(x1, y1, x2, y2) {
        const colors = this.getColors();
        const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
        colors.forEach((color, i) => {
            gradient.addColorStop(i / (colors.length - 1), color);
        });
        return gradient;
    }

    drawBars() {
        const barCount = 128;
        const barWidth = (this.canvas.width / barCount) * 0.8;
        const gap = (this.canvas.width / barCount) * 0.2;
        const colors = this.getColors();

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor(i * this.bufferLength / barCount);
            const value = this.dataArray[dataIndex] * this.sensitivity;
            const barHeight = (value / 255) * this.canvas.height * 0.8;

            const x = i * (barWidth + gap);
            const y = this.canvas.height - barHeight;

            // Create gradient for each bar
            const gradient = this.ctx.createLinearGradient(x, this.canvas.height, x, y);
            const colorIndex = Math.floor((i / barCount) * colors.length);
            gradient.addColorStop(0, colors[colorIndex % colors.length]);
            gradient.addColorStop(1, colors[(colorIndex + 1) % colors.length]);

            // Draw bar with rounded top
            this.ctx.beginPath();
            this.ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Add glow effect
            this.ctx.shadowColor = colors[colorIndex % colors.length];
            this.ctx.shadowBlur = 15;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
    }

    drawWave() {
        const colors = this.getColors();
        const sliceWidth = this.canvas.width / this.bufferLength;

        // Draw multiple waves with offset
        for (let w = 0; w < 3; w++) {
            this.ctx.beginPath();
            this.ctx.lineWidth = 3 - w;
            this.ctx.strokeStyle = colors[w % colors.length];
            this.ctx.shadowColor = colors[w % colors.length];
            this.ctx.shadowBlur = 20;

            let x = 0;
            for (let i = 0; i < this.bufferLength; i++) {
                const v = (this.dataArray[i] / 128.0) * this.sensitivity;
                const y = (this.canvas.height / 2) + (v - 1) * (this.canvas.height / 3) * Math.sin(w * 0.5);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }

            this.ctx.stroke();
        }
        this.ctx.shadowBlur = 0;
    }

    drawCircular() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const baseRadius = Math.min(centerX, centerY) * 0.3;
        const colors = this.getColors();

        // Draw circular bars
        const barCount = 180;

        for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor(i * this.bufferLength / barCount);
            const value = this.dataArray[dataIndex] * this.sensitivity;
            const barHeight = (value / 255) * baseRadius * 1.5;

            const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;

            const x1 = centerX + Math.cos(angle) * baseRadius;
            const y1 = centerY + Math.sin(angle) * baseRadius;
            const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
            const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

            const colorIndex = Math.floor((i / barCount) * colors.length);

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = colors[colorIndex % colors.length];
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = colors[colorIndex % colors.length];
            this.ctx.shadowBlur = 10;
            this.ctx.stroke();
        }

        // Draw center circle
        const avgVolume = this.dataArray.reduce((a, b) => a + b, 0) / this.bufferLength;
        const pulseRadius = baseRadius * 0.8 + (avgVolume / 255) * baseRadius * 0.3 * this.sensitivity;

        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius);
        gradient.addColorStop(0, colors[0] + '40');
        gradient.addColorStop(0.5, colors[1] + '20');
        gradient.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        this.ctx.shadowBlur = 0;
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: Math.random() * 3 + 1,
                colorIndex: Math.floor(Math.random() * 4)
            });
        }
    }

    drawParticles() {
        const colors = this.getColors();
        const avgVolume = this.dataArray.reduce((a, b) => a + b, 0) / this.bufferLength;
        const intensity = (avgVolume / 255) * this.sensitivity;

        this.particles.forEach((particle, index) => {
            // Update particle position based on audio
            const freqIndex = Math.floor((index / this.particles.length) * this.bufferLength);
            const freqValue = this.dataArray[freqIndex] / 255;

            particle.x += particle.vx * (1 + freqValue * 3);
            particle.y += particle.vy * (1 + freqValue * 3);

            // Wrap around screen
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;

            // Draw particle
            const color = colors[particle.colorIndex % colors.length];
            const size = particle.size * (1 + freqValue * 2);

            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = size * 3;
            this.ctx.fill();
        });

        // Draw connections between nearby particles
        this.ctx.shadowBlur = 0;
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 80 + intensity * 50) {
                    const opacity = (1 - distance / (80 + intensity * 50)) * 0.3;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawIdleState() {
        this.ctx.fillStyle = 'rgba(10, 10, 15, 1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw subtle ambient animation
        const colors = this.getColors();
        const time = Date.now() * 0.001;

        for (let i = 0; i < 5; i++) {
            const x = this.canvas.width / 2 + Math.sin(time + i) * 100;
            const y = this.canvas.height / 2 + Math.cos(time + i * 0.7) * 50;
            const radius = 100 + Math.sin(time * 0.5 + i) * 30;

            const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, colors[i % colors.length] + '20');
            gradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        }

        if (!this.isListening) {
            requestAnimationFrame(() => this.drawIdleState());
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AudioVisualizer();
});
