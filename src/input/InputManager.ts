export class InputManager {
    private onMove: (x: number, y: number) => void;
    private onSplit: () => void;
    private onEject: () => void;

    private controlMode: 'follow' | 'joystick' = 'follow';
    private isJoystickActive = false;
    private joystickStartPos = { x: 0, y: 0 };
    private joystickMaxRadius = 50;

    constructor(handlers: {
        onMove: (x: number, y: number) => void;
        onSplit: () => void;
        onEject: () => void;
    }) {
        this.onMove = handlers.onMove;
        this.onSplit = handlers.onSplit;
        this.onEject = handlers.onEject;

        this.initMouse();
        this.initKeyboard();
        this.initTouch();
        this.initUI();
    }

    private initMouse() {
        window.addEventListener('mousemove', (e) => {
            if (this.controlMode === 'follow') {
                this.onMove(e.clientX, e.clientY);
            }
        });
    }

    private initKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.onSplit();
            } else if (e.code === 'KeyE' || e.code === 'KeyW') {
                this.onEject();
            }
        });
    }

    private joystickTouchId: number | null = null;

    private initTouch() {
        const joystickContainer = document.getElementById('joystickContainer');
        const joystickKnob = document.getElementById('joystickKnob');

        if (!joystickContainer || !joystickKnob) return;

        window.addEventListener('touchstart', (e) => {
            // Only process if we don't already have an active joystick touch
            if (this.joystickTouchId !== null) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                // Check if touch is on the left side of the screen (default joystick area)
                // and NOT on an action button (they stopPropagation, but just in case)
                const isLeftSide = touch.clientX < window.innerWidth / 2;

                if (isLeftSide && this.controlMode === 'joystick') {
                    this.joystickTouchId = touch.identifier;
                    this.joystickStartPos = { x: touch.clientX, y: touch.clientY };

                    joystickContainer.style.display = 'flex';
                    joystickContainer.style.left = `${touch.clientX}px`;
                    joystickContainer.style.top = `${touch.clientY}px`;
                    joystickKnob.style.transform = 'translate(0px, 0px)';

                    this.isJoystickActive = true;
                    // Dont break, maybe other touches are for buttons (though unlikely in same frame)
                } else if (this.controlMode === 'follow') {
                    this.onMove(touch.clientX, touch.clientY);
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.controlMode === 'follow') {
                const touch = e.touches[0];
                if (touch) this.onMove(touch.clientX, touch.clientY);
            }

            if (this.isJoystickActive && this.joystickTouchId !== null) {
                // Find the specific touch for the joystick
                let joystickTouch: Touch | null = null;
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === this.joystickTouchId) {
                        joystickTouch = e.touches[i];
                        break;
                    }
                }

                if (joystickTouch) {
                    const dx = joystickTouch.clientX - this.joystickStartPos.x;
                    const dy = joystickTouch.clientY - this.joystickStartPos.y;
                    const angle = Math.atan2(dy, dx);
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    const limitedDist = Math.min(dist, this.joystickMaxRadius);
                    const moveX = Math.cos(angle) * limitedDist;
                    const moveY = Math.sin(angle) * limitedDist;

                    joystickKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;

                    // Convert joystick vector to world direction
                    const screenCenterX = window.innerWidth / 2;
                    const screenCenterY = window.innerHeight / 2;
                    this.onMove(
                        screenCenterX + Math.cos(angle) * 1000,
                        screenCenterY + Math.sin(angle) * 1000
                    );
                }
            }

            // Prevent scrolling/refresh only if we are interacting with the game
            if (this.controlMode === 'joystick' || this.controlMode === 'follow') {
                e.preventDefault();
            }
        }, { passive: false });

        const endJoystick = (e: TouchEvent) => {
            if (this.joystickTouchId === null) return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.joystickTouchId) {
                    this.isJoystickActive = false;
                    this.joystickTouchId = null;
                    joystickContainer.style.display = 'none';
                    joystickKnob.style.transform = 'translate(0px, 0px)';
                    break;
                }
            }
        };

        window.addEventListener('touchend', endJoystick);
        window.addEventListener('touchcancel', endJoystick);
    }

    private initUI() {
        const splitBtn = document.getElementById('splitBtn');
        const throwBtn = document.getElementById('throwBtn');

        splitBtn?.addEventListener('touchstart', (e) => {
            this.onSplit();
            e.stopPropagation();
        });

        throwBtn?.addEventListener('touchstart', (e) => {
            this.onEject();
            e.stopPropagation();
        });

        // Mouse support for buttons too
        splitBtn?.addEventListener('mousedown', (e) => {
            this.onSplit();
            e.stopPropagation();
        });
        throwBtn?.addEventListener('mousedown', (e) => {
            this.onEject();
            e.stopPropagation();
        });
    }

    public setControlMode(mode: 'follow' | 'joystick') {
        this.controlMode = mode;
        const joystickContainer = document.getElementById('joystickContainer');
        const actionButtons = document.getElementById('actionButtons');

        if (mode === 'joystick') {
            if (joystickContainer) joystickContainer.style.display = 'flex';
            if (actionButtons) actionButtons.style.display = 'flex';
        } else {
            if (joystickContainer) joystickContainer.style.display = 'none';
            if (actionButtons) actionButtons.style.display = 'none';
        }
    }

    public setButtonPosition(position: 'left' | 'right') {
        const joystickContainer = document.getElementById('joystickContainer');
        const actionButtons = document.getElementById('actionButtons');

        if (position === 'left') {
            actionButtons?.classList.add('left');
            joystickContainer?.classList.add('right');
        } else {
            actionButtons?.classList.remove('left');
            joystickContainer?.classList.remove('right');
        }
    }
}
