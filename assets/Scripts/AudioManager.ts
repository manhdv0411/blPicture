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

    private static _instance: AudioManager | null = null;
    public static get instance(): AudioManager | null {
        if (AudioManager._instance) return AudioManager._instance;

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

    @property(AudioClip)
    clipBlockPickup: AudioClip | null = null;

    @property(AudioClip)
    clipBlockDrop: AudioClip | null = null;

    @property(AudioClip)
    clipBlockMatch: AudioClip | null = null;

    @property(AudioClip)
    clipWin: AudioClip | null = null;

    @property(AudioClip)
    clipTimeout: AudioClip | null = null;

    @property(AudioClip)
    clipTick: AudioClip | null = null;

    @property(AudioClip)
    clipBgm: AudioClip | null = null;

    @property(AudioClip)
    clipGroupCollected: AudioClip | null = null;

    @property({ range: [0, 1], slide: true })
    sfxVolume: number = 1.0;

    @property({ range: [0, 1], slide: true })
    bgmVolume: number = 0.45;

    @property
    tickWarningThreshold: number = 10;

    private sfxSource: AudioSource | null = null;
    private bgmSource: AudioSource | null = null;

    private _sfxMuted = false;
    private _bgmMuted = false;
    private _tickActive = false;
    private _tickScheduled = false;
    private _lastTimeLeft = -1;
    private _bgmUnlocked = false;
    onLoad() {
        if (AudioManager._instance && AudioManager._instance !== this) {
            this.node.destroy();
            return;
        }
        AudioManager._instance = this;

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


    playBlockUp() {
        console.log('playBlockUp called, clip:', this.clipBlockPickup, 'muted:', this._sfxMuted);
        this.playSfx(this.clipBlockPickup);
    }

    playBlockDown() {
        this.playSfx(this.clipBlockDrop);
    }

    playBlockMatch() {
        this.playSfx(this.clipBlockMatch);
    }

    playWin() {
        this.stopBgm();
        this.playSfx(this.clipWin);
    }
    playGroupCollected() {
        this.playSfx(this.clipGroupCollected);
    }
    playTimeout() {
        this.stopBgm();
        this.stopTick();
        this.playSfx(this.clipTimeout);
    }


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

    playTick() {
        this.playSfx(this.clipTick, 0.75);
    }

    stopTick() {
        this._tickActive = false;
    }


    playBgm() {
        if (!this.bgmSource || !this.clipBgm || this._bgmMuted) return;
        if (this.bgmSource.playing) return;
        this.bgmSource.clip = this.clipBgm;
        this.bgmSource.volume = this.bgmVolume;
        this.bgmSource.play();
    }
    private getAudioContext(): AudioContext | null {
        // Cocos 3.x lưu AudioContext trong các vị trí này
        const win = window as any;
        return (
            win.__audioContext ||
            win.cc?.director?.root?.device?._gfxAPI?.audioContext ||
            (AudioSource as any)._audioContext ||
            (AudioSource as any).__audioContext ||
            win.AudioContext && win._cocosAudioCtx ||
            null
        );
    }

    unlockAndPlayBgm() {
    if (this._bgmUnlocked) {
        this.playBgm(); // Đã unlock rồi thì chỉ play lại nếu chưa playing
        return;
    }
    this._bgmUnlocked = true;
    this.playBgm();
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


    private playSfx(clip: AudioClip | null, volumeScale: number = 1) {
        console.log('playSfx:', clip, 'source:', this.sfxSource, 'muted:', this._sfxMuted);
        if (!clip || !this.sfxSource || this._sfxMuted) return;
        this.sfxSource.volume = this.sfxVolume * volumeScale;
        this.sfxSource.playOneShot(clip, this.sfxVolume * volumeScale);
    }
}