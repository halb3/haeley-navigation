
/* spellchecker: disable */

import { Observable, ReplaySubject } from 'rxjs';

import { assert } from 'haeley-auxiliaries';
import { bitInBitfield } from 'haeley-math';

import { PointerLock } from './pointerlock';

/* spellchecker: enable */


export class KeyboardEventProvider {

    /**
     * HTML canvas element within the HTML5 document to register event listeners to.
     */
    protected _element: HTMLCanvasElement;

    /**
     * Time frame for events to be buffered (windowTime in rxjs per ReplaySubject).
     */
    protected _timeframe: number | undefined;

    protected _keyDownListener: { (event: KeyboardEvent): void };
    protected _keyDownSubject: ReplaySubject<KeyboardEvent>;

    protected _keyPressListener: { (event: KeyboardEvent): void };
    protected _keyPressSubject: ReplaySubject<KeyboardEvent>;

    protected _keyUpListener: { (event: KeyboardEvent): void };
    protected _keyUpSubject: ReplaySubject<KeyboardEvent>;

    /** @see {@link pointerLock} */
    protected _pointerLockRequestPending = false;

    /**
     * This mask saves for which types of events, event.preventDefault should be called. This is useful to disallow
     * some kinds of standard events.
     */
    protected _preventDefaultMask: KeyboardEventType;

    constructor(element: HTMLCanvasElement, timeframe?: number) {
        assert(element !== undefined, `expected valid canvas element on initialization, given ${element}`);
        this._element = element;
        this._timeframe = timeframe;

        // Add pointer lock stuff if needed. Not sure yet if theres any events we need to watch out for
    }

    /**
     * The pointer lock API requires a little workaround in order to avoid something like '... not called from inside a
     * short running user-generated event handler'. A click event listener is registered and whenever a pointer lock is
     * requested, e.g., from an event handler (which in turn exposes this interface to, e.g., a navigation), the next
     * click will result in a probably more successful pointer lock.
     */
    protected processPointerLockRequests(): void {
        if (!this._pointerLockRequestPending) {
            return;
        }
        PointerLock.request(this._element);
    }

    /**
     * Checks whether or not to prevent the default handling of the given event. This depends on the internal
     * `preventDefaultMask` which can be modified using `preventDefault` function @see{@link preventDefault}.
     * @param type - Internal event type of the incoming event.
     * @param event - Actual event to prevent default handling on (if masked).
     */
    protected preventDefaultOnEvent(type: KeyboardEventType, event: KeyboardEvent): void {
        if (bitInBitfield(this._preventDefaultMask, type)) {
            event.preventDefault();
        }
    }

    /**
     * Prevent default event handling on specific event types (using preventDefault on the event).
     * @param types - Event types to prevent default handling on.
     */
    preventDefault(...types: KeyboardEventType[]): void {
        for (const type of types) {
            if (!bitInBitfield(this._preventDefaultMask, type)) {
                this._preventDefaultMask |= type;
            }
        }
    }

    /**
     * Allow default event handling on specific event types (not calling preventDefault on the event).
     * @param types - Event types to allow default handling on.
     */
    allowDefault(...types: KeyboardEventType[]): void {
        for (const type of types) {
            if (bitInBitfield(this._preventDefaultMask, type)) {
                this._preventDefaultMask &= ~type;
            }
        }
    }

    observable(type: KeyboardEventType): Observable<KeyboardEvent> | undefined {
        switch (type) {
            case KeyboardEventType.KeyDown:
                return this.keyDown$;
            case KeyboardEventType.KeyPress:
                return this.keyPress$;
            case KeyboardEventType.KeyUp:
                return this.keyUp$;
            default:
                return undefined;
        }
    }

    /**
     * Enable/disable pointer lock on click. If true, the next click on this event provider's canvas will invoke a
     * pointer lock request on the canvas element.
     */
    set pointerLock(lock: boolean) {
        this._pointerLockRequestPending = lock;
        if (lock === false) {
            this._pointerLockRequestPending = false;
            PointerLock.exit();
        }
    }
    get pointerLock(): boolean {
        return PointerLock.active(this._element);
    }

    get keyDown$(): Observable<KeyboardEvent> {
        if (this._keyDownSubject === undefined) {
            this._keyDownSubject = new ReplaySubject<KeyboardEvent>(undefined, this._timeframe);
            this._keyDownListener = (event: KeyboardEvent) => {
                this.preventDefaultOnEvent(KeyboardEventType.KeyDown, event);
                this._keyDownSubject.next(event);
            }
            this._element.addEventListener('keydown', this._keyDownListener);
        }
        return this._keyDownSubject.asObservable();
    }

    get keyPress$(): Observable<KeyboardEvent> {
        if (this._keyPressSubject === undefined) {
            this._keyPressSubject = new ReplaySubject<KeyboardEvent>(undefined, this._timeframe);
            this._keyPressListener = (event: KeyboardEvent) => {
                this.preventDefaultOnEvent(KeyboardEventType.KeyPress, event);
                this._keyPressSubject.next(event);
            }
            this._element.addEventListener('keypress', this._keyPressListener);
        }
        return this._keyPressSubject.asObservable();
    }

    get keyUp$(): Observable<KeyboardEvent> {
        if (this._keyUpSubject === undefined) {
            this._keyUpSubject = new ReplaySubject<KeyboardEvent>(undefined, this._timeframe);
            this._keyUpListener = (event: KeyboardEvent) => {
                this.preventDefaultOnEvent(KeyboardEventType.KeyUp, event);
                this._keyUpSubject.next(event);
            }
            this._element.addEventListener('keyup', this._keyUpListener);
        }
        return this._keyUpSubject.asObservable();
    }
}

export enum KeyboardEventType {
    KeyDown = 1 << 0,
    KeyPress = 1 << 1,
    KeyUp = 1 << 2,
}
