export class SoundManager {
    static ctx: AudioContext | null = null;
    static initialized = false;

    static init() {
        if (!this.initialized) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
            this.initialized = true;
        }

        // Resume context if it was suspended (browser autoplay policy)
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    static playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1, slideFreq?: number) {
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            if (slideFreq) {
                osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
            }

            // Soft envelope
            gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.error("Audio error", e);
        }
    }

    static playEatFood() {
        // High pitch quick pop
        this.playTone(800, 'sine', 0.1, 0.03, 1200);
    }

    static playEatEnemy() {
        // Deep crunch (two tones offset)
        this.playTone(150, 'sawtooth', 0.4, 0.1, 50);
        setTimeout(() => this.playTone(100, 'square', 0.4, 0.1, 40), 50);
    }

    static playEject() {
        // Pew! (descending square wave)
        this.playTone(400, 'square', 0.15, 0.05, 100);
    }

    static playSplit() {
        // Zshhh! (descending sawtooth)
        this.playTone(600, 'sawtooth', 0.2, 0.08, 100);
    }

    static playMerge() {
        // Bloop (ascending sine)
        this.playTone(200, 'sine', 0.3, 0.08, 400);
    }

    static playPowerUp() {
        // Classic 8-bit power-up arpeggio
        this.playTone(300, 'square', 0.1, 0.05);
        setTimeout(() => this.playTone(450, 'square', 0.1, 0.05), 100);
        setTimeout(() => this.playTone(600, 'square', 0.2, 0.05), 200);
    }
}
