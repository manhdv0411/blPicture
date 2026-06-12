import {
    _decorator,
    AudioClip,
    AudioSource,
    Component,
    Node,
    game,
    find,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {

    // ── Singleton ──────────────────────────────────────────
    private static _instance: AudioManager | null = null;
    // Trong AudioManager.ts, thêm static method này:
    public static get instance(): AudioManager | null {
        if (AudioManager._instance) return AudioManager._instance;

        // Tự tìm nếu chưa set (fix lỗi thứ tự khởi tạo)
        const canvas = find('Canvas') || find('block/Canvas');
        if (canvas) {
            const am = canvas.getComponent(AudioManager);
            if (am) {
                AudioManager._instance = am;
                return am;
            }
        }
        console.warn('AudioManager: instance not found!');
        return null;
    }

    // ── Clip slots (kéo file vào Inspector) ────────────────
    @property(AudioClip)
    clipBlockPickup: AudioClip | null = null;       // nhấc block lên

    @property(AudioClip)
    clipBlockDrop: AudioClip | null = null;         // thả block xuống

    @property(AudioClip)
    clipBlockMatch: AudioClip | null = null;        // ghép đúng nhóm

    @property(AudioClip)
    clipWin: AudioClip | null = null;               // thắng level

    @property(AudioClip)
    clipTimeout: AudioClip | null = null;           // hết giờ

    @property(AudioClip)
    clipTick: AudioClip | null = null;              // đồng hồ đếm ngược

    @property(AudioClip)
    clipBgm: AudioClip | null = null;              // nhạc nền

    // ── Cài đặt âm lượng ───────────────────────────────────
    @property({ range: [0, 1], slide: true })
    sfxVolume: number = 1.0;

    @property({ range: [0, 1], slide: true })
    bgmVolume: number = 0.45;

    // Tick bắt đầu kêu khi còn bao nhiêu giây
    @property
    tickWarningThreshold: number = 10;

    // ── AudioSource nodes ───────────────────────────────────
    private sfxSource: AudioSource | null = null;   // dùng chung cho SFX
    private bgmSource: AudioSource | null = null;   // nhạc nền riêng

    // ── Trạng thái ─────────────────────────────────────────
    private _sfxMuted = false;
    private _bgmMuted = false;
    private _tickActive = false;
    private _tickScheduled = false;
    private _lastTimeLeft = -1;

    // ── Lifecycle ───────────────────────────────────────────
    onLoad() {
        if (AudioManager._instance && AudioManager._instance !== this) {
            this.node.destroy();
            return;
        }
        AudioManager._instance = this;
        game.addPersistRootNode(this.node); // không bị destroy khi đổi scene

        this.sfxSource = this.createSource(false);
        this.bgmSource = this.createSource(true);
    }

    onDestroy() {
        if (AudioManager._instance === this) {
            AudioManager._instance = null;
        }
    }

    private createSource(loop: boolean): AudioSource {
        const n = new Node(loop ? '__BGM' : '__SFX');
        n.setParent(this.node);
        const src = n.addComponent(AudioSource);
        src.loop = loop;
        src.volume = loop ? this.bgmVolume : this.sfxVolume;
        return src;
    }

    // ── SFX public API ──────────────────────────────────────

    /** Nhấc block lên */
    playBlockUp() {
         console.log('playBlockUp called, clip:', this.clipBlockPickup, 'muted:', this._sfxMuted);
        this.playSfx(this.clipBlockPickup);
    }

    /** Thả block xuống */
    playBlockDown() {
        this.playSfx(this.clipBlockDrop);
    }

    /** Ghép đúng nhóm màu */
    playBlockMatch() {
        this.playSfx(this.clipBlockMatch);
    }

    /** Thắng level */
    playWin() {
        this.stopBgm();
        this.playSfx(this.clipWin);
    }

    /** Hết giờ */
    playTimeout() {
        this.stopBgm();
        this.stopTick();
        this.playSfx(this.clipTimeout);
    }

    /**
     * Gọi mỗi giây từ timer — tự động bật tick khi còn <= threshold giây.
     * @param timeLeft số giây còn lại
     */
    updateTimer(timeLeft: number) {
        const rounded = Math.ceil(timeLeft);
        if (rounded === this._lastTimeLeft) return;
        this._lastTimeLeft = rounded;

        if (rounded <= this.tickWarningThreshold && rounded > 0) {
            this.playTick();
        } else if (rounded > this.tickWarningThreshold) {
            this.stopTick();
        }
    }

    /** Bật tick một tiếng (gọi từ updateTimer hoặc thủ công) */
    playTick() {
        this.playSfx(this.clipTick, 0.75);
    }

    /** Dừng tick đếm ngược */
    stopTick() {
        this._tickActive = false;
    }

    // ── BGM public API ──────────────────────────────────────

    playBgm() {
        if (!this.bgmSource || !this.clipBgm || this._bgmMuted) return;
        if (this.bgmSource.playing) return;
        this.bgmSource.clip = this.clipBgm;
        this.bgmSource.volume = this.bgmVolume;
        this.bgmSource.play();
    }

    stopBgm() {
        this.bgmSource?.stop();
    }

    pauseBgm() {
        this.bgmSource?.pause();
    }

    resumeBgm() {
        if (this._bgmMuted) return;
        this.bgmSource?.play();
    }

    // ── Volume / Mute ───────────────────────────────────────

    setSfxVolume(v: number) {
        this.sfxVolume = Math.max(0, Math.min(1, v));
        if (this.sfxSource) this.sfxSource.volume = this.sfxVolume;
    }

    setBgmVolume(v: number) {
        this.bgmVolume = Math.max(0, Math.min(1, v));
        if (this.bgmSource) this.bgmSource.volume = this.bgmVolume;
    }

    muteSfx(mute: boolean) {
        this._sfxMuted = mute;
        if (this.sfxSource) this.sfxSource.volume = mute ? 0 : this.sfxVolume;
    }

    muteBgm(mute: boolean) {
        this._bgmMuted = mute;
        if (mute) this.bgmSource?.pause();
        else this.resumeBgm();
    }

    get isSfxMuted() { return this._sfxMuted; }
    get isBgmMuted() { return this._bgmMuted; }

    // ── Internal ────────────────────────────────────────────

    private playSfx(clip: AudioClip | null, volumeScale: number = 1) {
    console.log('playSfx:', clip, 'source:', this.sfxSource, 'muted:', this._sfxMuted);
    if (!clip || !this.sfxSource || this._sfxMuted) return;
    this.sfxSource.volume = this.sfxVolume * volumeScale;
    this.sfxSource.playOneShot(clip, this.sfxVolume * volumeScale);
}
}