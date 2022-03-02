
/* spellchecker: disable */

import { Observable, Subscription } from 'rxjs';

import { assert, Invalidate } from '@haeley/auxiliaries';
import { vec2 } from '@haeley/math';

// import { EyeGazeEvent } from './eyegazeevent.ts';
// import { EyeGazeEventProvider } from './eyegazeeventprovider.ts';
import { MouseEventProvider, MouseEventType } from './mouseeventprovider';
import { PointerEventProvider, PointerEventType } from './pointereventprovider';
import { TouchEventProvider, TouchEventType } from './toucheventprovider';
import { KeyboardEventProvider, KeyboardEventType } from './keyboardeventprovider';

/* spellchecker: enable */


export interface EventProvider {
    pointerEventProvider?: PointerEventProvider;
    mouseEventProvider?: MouseEventProvider;
    keyboardEventProvider?: KeyboardEventProvider;
    // eyeGazeEventProvider?: EyeGazeEventProvider;
}

/**
 * Callback for handling mouse events, given the latest mouse events (since last update) as well as the previous.
 */
export interface MouseEventHandler { (latests: Array<MouseEvent>, previous: Array<MouseEvent>): void; }

/**
 * Callback for handling touch events, given the latest touch events (since last update) as well as the previous.
 */
export interface TouchEventHandler { (latests: Array<TouchEvent>, previous: Array<TouchEvent>): void; }

/**
 * Callback for handling pointer events, given the latest touch events (since last update) as well as the previous.
 */
export interface PointerEventHandler { (latests: Array<PointerEvent>, previous: Array<PointerEvent>): void; }

/**
 * Callback for handling keyboard events, given the latest keyboard events (since last update) as well as the previous.
 */
export interface KeyboardEventHandler { (latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>): void; }


// /**
//  * Callback for handling eye gaze events, given the latest eye gaze events (since last update) as well as the previous.
//  */
// export interface EyeGazeEventHandler { (latests: Array<EyeGazeEvent>, previous: Array<EyeGazeEvent>): void; }


/**
 * ... Provider and event handler are explicitly separated in order to reduce the number of observables (reuse of event
 * provider for multiple handler).
 */
export class EventHandler {

    /**
     * The event handler's invalidation callback. This should usually be setup by the owning renderer and invoke the
     * same callback the renderer has been given by the canvas. This invalidation is required, when continuous
     * rendering is not present, events might cause need for new rendering requests.
     */
    protected _invalidate: Invalidate | undefined;

    protected _subscriptions = new Array<Subscription>();


    /**
     * Assigned key event provider. This is usually created and owned by the canvas.
     */
    // protected _keyEventProvider: KeyEventProvider | undefined;

    /**
     * Assigned mouse event provider. This is usually created and owned by the canvas.
     */
    protected _mouseEventProvider: MouseEventProvider | undefined;

    /**
     * Assigned touch event provider. This is usually created and owned by the canvas.
     */
    protected _touchEventProvider: TouchEventProvider | undefined;

    /**
     * Assigned pointer event provider. This is usually created and owned by the canvas.
     */
    protected _pointerEventProvider: PointerEventProvider | undefined;

    /**
     * Assigned pointer event provider. This is usually created and owned by the canvas.
     */
    protected _keyboardEventProvider: KeyboardEventProvider | undefined;

    // /**
    //  * Assigned eye gaze event provider. This is usually created and owned by the eye gaze data stream.
    //  */
    // protected _eyeGazeEventProvider: EyeGazeEventProvider | undefined;


    protected _latestMouseEventsByType =
        new Map<MouseEventType, Array<MouseEvent>>();
    protected _previousMouseEventsByType =
        new Map<MouseEventType, Array<MouseEvent>>();
    protected _mouseEventHandlerByType =
        new Map<MouseEventType, Array<MouseEventHandler>>();

    protected _latestTouchEventsByType =
        new Map<TouchEventType, Array<TouchEvent>>();
    protected _previousTouchEventsByType =
        new Map<TouchEventType, Array<TouchEvent>>();
    protected _touchEventHandlerByType =
        new Map<TouchEventType, Array<TouchEventHandler>>();

    protected _latestPointerEventsByType =
        new Map<PointerEventType, Array<PointerEvent>>();
    protected _previousPointerEventsByType =
        new Map<PointerEventType, Array<PointerEvent>>();
    protected _pointerEventHandlerByType =
        new Map<PointerEventType, Array<PointerEventHandler>>();

    protected _latestKeyboardEventsByType =
        new Map<KeyboardEventType, Array<KeyboardEvent>>();
    protected _previousKeyboardEventsByType =
        new Map<KeyboardEventType, Array<KeyboardEvent>>();
    protected _keyboardEventHandlerByType =
        new Map<KeyboardEventType, Array<KeyboardEventHandler>>();

    // protected _latestEyeGazeEventsByType =
    //     new Map<EyeGazeEventType, Array<EyeGazeEvent>>();
    // protected _previousEyeGazeEventsByType =
    //     new Map<EyeGazeEventType, Array<EyeGazeEvent>>();
    // protected _eyeGazeEventHandlerByType =
    //     new Map<EyeGazeEventType, Array<EyeGazeEventHandler>>();


    constructor(invalidate: Invalidate | undefined,
        eventProvider: EventProvider) {
        this._invalidate = invalidate;

        this._mouseEventProvider = eventProvider.mouseEventProvider;
        if (this._mouseEventProvider) {
            this._mouseEventProvider.preventDefault(MouseEventType.Wheel);
        }

        this._pointerEventProvider = eventProvider.pointerEventProvider;
        this._keyboardEventProvider = eventProvider.keyboardEventProvider;
        // this._eyeGazeEventProvider = eventProvider.eyeGazeEventProvider;
    }

    /** @callback Invalidate
     * A callback intended to be invoked whenever the specialized event handler itself is invalid. By default only
     * optional updates (renderer decides whether or not to continue redraw) are triggered.
     */
    protected invalidate(force: boolean = false): void {
        if (this._invalidate) {
            this._invalidate(force);
        }
    }


    /**
     * Utility for registering an additional mouse event handler for updates on mouse events of the given type. The
     * handler is to be called on update if at least a single mouse event of the given type has occurred since last
     * update.
     * @param type - Mouse event type the handler is to be associated with.
     * @param handler - Handler to be called on update.
     */
    protected pushMouseEventHandler(type: MouseEventType, handler: MouseEventHandler): void {
        if (this._mouseEventHandlerByType.has(type)) {
            (this._mouseEventHandlerByType.get(type) as Array<MouseEventHandler>).push(handler);
            return;
        }

        this._mouseEventHandlerByType.set(type, new Array<MouseEventHandler>());

        this._previousMouseEventsByType.set(type, new Array<MouseEvent>());
        const latest = new Array<MouseEvent>();
        this._latestMouseEventsByType.set(type, latest);

        assert(this._mouseEventProvider !== undefined, `expected valid mouse event provider`);
        const observable = (this._mouseEventProvider as MouseEventProvider).observable(type);

        switch (type) {
            case MouseEventType.Wheel:
                this._subscriptions.push((observable as Observable<WheelEvent>).subscribe(
                    (event) => { latest.push(event); this.invalidate(); }));
                break;
            default:
                this._subscriptions.push((observable as Observable<MouseEvent>).subscribe(
                    (event) => { latest.push(event); this.invalidate(); }));
                break;
        }
        (this._mouseEventHandlerByType.get(type) as Array<MouseEventHandler>).push(handler);
    }

    protected invokeMouseEventHandler(type: MouseEventType): void {
        const handlers = this._mouseEventHandlerByType.get(type);
        if (handlers === undefined || handlers.length === 0) {
            return;
        }
        const latest = this._latestMouseEventsByType.get(type) as Array<MouseEvent>;
        if (latest.length === 0) {
            return;
        }
        const previous = this._previousMouseEventsByType.get(type) as Array<MouseEvent>;
        handlers.forEach((handler) => handler(latest, previous));

        Object.assign(previous, latest);
        latest.length = 0;
    }

    /**
     * Utility for registering an additional touch event handler for updates on touch events of the given type. The
     * handler is to be called on update if at least a single touch event of the given type has occurred since last
     * update.
     * @param type - Touch event type the handler is to be associated with.
     * @param handler - Handler to be called on update.
     */
    protected pushTouchEventHandler(type: TouchEventType, handler: TouchEventHandler): void {
        if (this._touchEventHandlerByType.has(type)) {
            (this._touchEventHandlerByType.get(type) as Array<TouchEventHandler>).push(handler);
            return;
        }

        this._touchEventHandlerByType.set(type, new Array<TouchEventHandler>());

        this._previousTouchEventsByType.set(type, new Array<TouchEvent>());
        const latest = new Array<TouchEvent>();
        this._latestTouchEventsByType.set(type, latest);

        assert(this._touchEventProvider !== undefined, `expected valid touch event provider`);
        const observable = (this._touchEventProvider as TouchEventProvider).observable(type);

        this._subscriptions.push((observable as Observable<TouchEvent>).subscribe(
            (event) => { latest.push(event); this.invalidate(); }));

        (this._touchEventHandlerByType.get(type) as Array<TouchEventHandler>).push(handler);
    }

    protected invokeTouchEventHandler(type: TouchEventType): void {
        const handlers = this._touchEventHandlerByType.get(type);
        if (handlers === undefined || handlers.length === 0) {
            return;
        }
        const latest = this._latestTouchEventsByType.get(type) as Array<TouchEvent>;
        if (latest.length === 0) {
            return;
        }
        const previous = this._previousTouchEventsByType.get(type) as Array<TouchEvent>;
        handlers.forEach((handler) => handler(latest, previous));

        Object.assign(previous, latest);
        latest.length = 0;
    }

    /**
     * Utility for registering an additional pointer event handler for updates on pointer events of the given type. The
     * handler is to be called on update if at least a single touch event of the given type has occurred since last
     * update.
     * @param type - Pointer event type the handler is to be associated with.
     * @param handler - Handler to be called on update.
     */
    protected pushPointerEventHandler(type: PointerEventType, handler: PointerEventHandler): void {
        if (this._pointerEventHandlerByType.has(type)) {
            (this._pointerEventHandlerByType.get(type) as Array<PointerEventHandler>).push(handler);
            return;
        }

        this._pointerEventHandlerByType.set(type, new Array<PointerEventHandler>());

        this._previousPointerEventsByType.set(type, new Array<PointerEvent>());
        const latest = new Array<PointerEvent>();
        this._latestPointerEventsByType.set(type, latest);

        assert(this._pointerEventProvider !== undefined, `expected valid pointer event provider`);
        const observable = (this._pointerEventProvider as PointerEventProvider).observable(type);

        this._subscriptions.push((observable as Observable<PointerEvent>).subscribe(
            (event) => { latest.push(event); this.invalidate(); }));

        (this._pointerEventHandlerByType.get(type) as Array<PointerEventHandler>).push(handler);
    }

    protected invokePointerEventHandler(type: PointerEventType): void {
        const handlers = this._pointerEventHandlerByType.get(type);
        if (handlers === undefined || handlers.length === 0) {
            return;
        }
        const latest = this._latestPointerEventsByType.get(type) as Array<PointerEvent>;
        if (latest.length === 0) {
            return;
        }
        const previous = this._previousPointerEventsByType.get(type) as Array<PointerEvent>;
        handlers.forEach((handler) => handler(latest, previous));

        Object.assign(previous, latest);
        latest.length = 0;
    }

    /**
     * Utility for registering an additional keyboard event handler for updates on keyboard events of the given type. The
     * handler is to be called on update if at least a single keyboard event of the given type has occurred since last
     * update.
     * @param type - Keyboard event type the handler is to be associated with.
     * @param handler - Handler to be called on update.
     */
    protected pushKeyboardEventHandler(type: KeyboardEventType, handler: KeyboardEventHandler): void {
        if (this._keyboardEventHandlerByType.has(type)) {
            (this._keyboardEventHandlerByType.get(type) as Array<KeyboardEventHandler>).push(handler);
            return;
        }

        this._keyboardEventHandlerByType.set(type, new Array<KeyboardEventHandler>());

        this._previousKeyboardEventsByType.set(type, new Array<KeyboardEvent>());
        const latest = new Array<KeyboardEvent>();
        this._latestKeyboardEventsByType.set(type, latest);

        assert(this._keyboardEventProvider !== undefined, `expected valid keyboard event provider`);
        const observable = (this._keyboardEventProvider as KeyboardEventProvider).observable(type);

        this._subscriptions.push((observable as Observable<KeyboardEvent>).subscribe(
            (event) => { latest.push(event); this.invalidate(); }));

        (this._keyboardEventHandlerByType.get(type) as Array<KeyboardEventHandler>).push(handler);
    }

    protected invokeKeyboardEventHandler(type: KeyboardEventType): void {
        const handlers = this._keyboardEventHandlerByType.get(type);
        if (handlers === undefined || handlers.length === 0) {
            return;
        }
        const latest = this._latestKeyboardEventsByType.get(type) as Array<KeyboardEvent>;
        if (latest.length === 0) {
            return;
        }
        const previous = this._previousKeyboardEventsByType.get(type) as Array<KeyboardEvent>;
        handlers.forEach((handler) => handler(latest, previous));

        Object.assign(previous, latest);
        latest.length = 0;
    }

    // /**
    //  * Utility for registering an additional touch event handler for updates on touch events of the given type. The
    //  * handler is to be called on update if at least a single touch event of the given type has occurred since last
    //  * update.
    //  * @param type - Touch event type the handler is to be associated with.
    //  * @param handler - Handler to be called on update.
    //  */
    // protected pushEyeGazeEventHandler(type: EyeGazeEventType, handler: EyeGazeEventHandler): void {
    //     if (this._eyeGazeEventHandlerByType.has(type)) {
    //         (this._eyeGazeEventHandlerByType.get(type) as Array<EyeGazeEventHandler>).push(handler);
    //         return;
    //     }

    //     this._eyeGazeEventHandlerByType.set(type, new Array<EyeGazeEventHandler>());

    //     this._previousEyeGazeEventsByType.set(type, new Array<EyeGazeEvent>());
    //     const latest = new Array<EyeGazeEvent>();
    //     this._latestEyeGazeEventsByType.set(type, latest);

    //     assert(this._eyeGazeEventProvider !== undefined, `expected valid eye gaze event provider`);
    //     const observable = (this._eyeGazeEventProvider as EyeGazeEventProvider).observable(type);

    //     this._subscriptions.push((observable as Observable<EyeGazeEvent>).subscribe(
    //         (event) => { latest.push(event); this.invalidate(); }));

    //     (this._eyeGazeEventHandlerByType.get(type) as Array<EyeGazeEventHandler>).push(handler);
    // }

    // protected invokeEyeGazeEventHandler(type: EyeGazeEventType): void {
    //     const handlers = this._eyeGazeEventHandlerByType.get(type);
    //     if (handlers === undefined || handlers.length === 0) {
    //         return;
    //     }
    //     const latest = this._latestEyeGazeEventsByType.get(type) as Array<EyeGazeEvent>;
    //     if (latest.length === 0) {
    //         return;
    //     }
    //     const previous = this._previousEyeGazeEventsByType.get(type) as Array<EyeGazeEvent>;
    //     handlers.forEach((handler) => handler(latest, previous));

    //     Object.assign(previous, latest);
    //     latest.length = 0;
    // }

    /**
     * Disposes all registered handlers of all event types.
     */
    dispose(): void {
        this._latestMouseEventsByType.forEach((value) => value.length = 0);
        this._previousMouseEventsByType.forEach((value) => value.length = 0);
        this._latestTouchEventsByType.forEach((value) => value.length = 0);
        this._previousTouchEventsByType.forEach((value) => value.length = 0);
        this._latestPointerEventsByType.forEach((value) => value.length = 0);
        this._previousPointerEventsByType.forEach((value) => value.length = 0);
        this._latestKeyboardEventsByType.forEach((value) => value.length = 0);
        this._previousKeyboardEventsByType.forEach((value) => value.length = 0);
        // this._previousEyeGazeEventsByType.forEach((value) => value.length = 0);
        // this._latestEyeGazeEventsByType.forEach((value) => value.length = 0);

        for (const subscription of this._subscriptions) {
            subscription.unsubscribe();
        }
    }

    /**
     * Triggers (by means of a helper function) invocation of all registered handler of all event types.
     */
    update(): void {

        this.invokeMouseEventHandler(MouseEventType.Click);
        this.invokeMouseEventHandler(MouseEventType.Enter);
        this.invokeMouseEventHandler(MouseEventType.Leave);
        this.invokeMouseEventHandler(MouseEventType.Down);
        this.invokeMouseEventHandler(MouseEventType.Up);
        this.invokeMouseEventHandler(MouseEventType.Move);
        this.invokeMouseEventHandler(MouseEventType.Wheel);

        this.invokeTouchEventHandler(TouchEventType.Start);
        this.invokeTouchEventHandler(TouchEventType.End);
        this.invokeTouchEventHandler(TouchEventType.Move);
        this.invokeTouchEventHandler(TouchEventType.Cancel);

        this.invokePointerEventHandler(PointerEventType.Move);
        this.invokePointerEventHandler(PointerEventType.Down);
        this.invokePointerEventHandler(PointerEventType.Enter);
        this.invokePointerEventHandler(PointerEventType.Up);
        this.invokePointerEventHandler(PointerEventType.Leave);
        this.invokePointerEventHandler(PointerEventType.Cancel);

        this.invokeKeyboardEventHandler(KeyboardEventType.KeyDown);
        this.invokeKeyboardEventHandler(KeyboardEventType.KeyPress);
        this.invokeKeyboardEventHandler(KeyboardEventType.KeyUp);

        // this.invokeEyeGazeEventHandler(EyeGazeEventType.EyeGazeData);
        // this.invokeEyeGazeEventHandler(EyeGazeEventType.NewServerMessage);
        // this.invokeEyeGazeEventHandler(EyeGazeEventType.ConnectionStatus);
        // this.invokeEyeGazeEventHandler(EyeGazeEventType.BinaryMessageParsingError);
    }


    /**
     * Normalize mouse and touch event coordinates for various browsers.
     * @param event - Mouse, wheel, or touch event.
     * @param normalize - Whether or not to compute normalized coordinates (offsets).
     * @returns - Array of normalized x and y offsets (in case of multiple touches).
     */
    offsets(event: MouseEvent | WheelEvent | TouchEvent, normalize: boolean = true): Array<vec2> {
        const offsets = new Array<vec2>();

        /*
         * Workaround for Chrome based on solution of Benjamin Wasty: EventHandler.offsets() uses
         * event.target.getBoundingClientRect() which often triggers a reflow/layout that might take ~20ms and slow
         * down, e.g., navigation a lot. Firefox on the other hand doesn't properly support offsetX/offsetY (set to 0).
         */
        let chromeWorkaround = false;

        if (event instanceof MouseEvent) {
            const e = event as MouseEvent;

            chromeWorkaround = (e.offsetX !== 0 && e.offsetY !== 0);
            offsets.push(chromeWorkaround ?
                vec2.fromValues(e.offsetX, e.offsetY) :
                vec2.fromValues(e.clientX, e.clientY));

        } else if (event instanceof WheelEvent) {
            const e = event as WheelEvent;

            chromeWorkaround = (e.offsetX !== 0 && e.offsetY !== 0);
            offsets.push(chromeWorkaround ?
                vec2.fromValues(e.offsetX, e.offsetY) :
                vec2.fromValues(e.clientX, e.clientY));

        } else if (event instanceof TouchEvent) {
            const e = event as TouchEvent;

            for (let i = 0; i < e.touches.length; ++i) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const touch = e.touches.item(i)!;
                offsets.push(vec2.fromValues(touch.clientX, touch.clientY));
            }
        }

        if (chromeWorkaround) {
            if (normalize) {
                for (const offset of offsets) {
                    vec2.scale(offset, offset, window.devicePixelRatio);
                }
            }
            return offsets;
        }

        const target = event.target || event.currentTarget || event.srcElement;
        const rect = (target as HTMLElement).getBoundingClientRect();

        for (const offset of offsets) {
            offset[0] = Math.floor(offset[0] - rect.left);
            offset[1] = Math.floor(offset[1] - rect.top);
            if (normalize) {
                vec2.scale(offset, offset, window.devicePixelRatio);
            }
        }
        return offsets;
    }


    /**
     * Register a click event handler that is to be called on update if at least a single click event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushClickHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Click, handler);
    }

    /**
     * Register an mouse enter event handler that is to be called on update if at least a single mouse enter event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseEnterHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Enter, handler);
    }

    /**
     * Register an mouse leave event handler that is to be called on update if at least a single mouse leave event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseLeaveHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Leave, handler);
    }

    /**
     * Register an mouse down event handler that is to be called on update if at least a single mouse down event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseDownHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Down, handler);
    }

    /**
     * Register an mouse up event handler that is to be called on update if at least a single mouse up event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseUpHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Up, handler);
    }

    /**
     * Register an mouse move event handler that is to be called on update if at least a single mouse move event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseMoveHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Move, handler);
    }

    /**
     * Register an mouse wheel event handler that is to be called on update if at least a single mouse wheel event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushMouseWheelHandler(handler: MouseEventHandler): void {
        this.pushMouseEventHandler(MouseEventType.Wheel, handler);
    }

    /**
     * Register a touch start event handler that is to be called on update if at least a single touch start event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushTouchStartHandler(handler: TouchEventHandler): void {
        this.pushTouchEventHandler(TouchEventType.Start, handler);
    }

    /**
     * Register a touch end event handler that is to be called on update if at least a single touch end event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushTouchEndHandler(handler: TouchEventHandler): void {
        this.pushTouchEventHandler(TouchEventType.End, handler);
    }

    /**
     * Register a touch move event handler that is to be called on update if at least a single touch move event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushTouchMoveHandler(handler: TouchEventHandler): void {
        this.pushTouchEventHandler(TouchEventType.Move, handler);
    }

    /**
     * Register a touch cancel event handler that is to be called on update if at least a single touch cancel event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushTouchCancelHandler(handler: TouchEventHandler): void {
        this.pushTouchEventHandler(TouchEventType.Cancel, handler);
    }

    /**
     * Register a pointer up event handler that is to be called on update if at least a single touch cancel event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerUpHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Up, handler);
    }

    /**
     * Register a pointer down event handler that is to be called on update if at least a single touch cancel event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerDownHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Down, handler);
    }

    /**
     * Register a pointer enter event handler that is to be called on update if at least a single touch cancel event
     * has occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerEnterHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Enter, handler);
    }

    /**
     * Register a pointer leave event handler that is to be called on update if at least a single touch cancel event
     * has occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerLeaveHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Leave, handler);
    }

    /**
     * Register a pointer move event handler that is to be called on update if at least a single touch cancel event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerMoveHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Move, handler);
    }

    /**
     * Register a pointer cancel event handler that is to be called on update if at least a single touch cancel event
     * has occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushPointerCancelHandler(handler: PointerEventHandler): void {
        this.pushPointerEventHandler(PointerEventType.Cancel, handler);
    }

    /**
     * Register a key down event handler that is to be called on update if at least a single key down event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushKeyDownHandler(handler: KeyboardEventHandler): void {
        this.pushKeyboardEventHandler(KeyboardEventType.KeyDown, handler);
    }

    /**
     * Register a key press event handler that is to be called on update if at least a single key press event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushKeyPressHandler(handler: KeyboardEventHandler): void {
        this.pushKeyboardEventHandler(KeyboardEventType.KeyPress, handler);
    }

    /**
     * Register a key up event handler that is to be called on update if at least a single key up event has
     * occurred since last update.
     * @param handler - Handler to be called on update.
     */
    pushKeyUpHandler(handler: KeyboardEventHandler): void {
        this.pushKeyboardEventHandler(KeyboardEventType.KeyUp, handler);
    }

    // /**
    //  * Register a eye gaze data event handler that is to be called on update if at least
    //  * a single eye gaze data event has occurred since last update.
    //  * @param handler - Handler to be called on update.
    //  */
    // pushEyeGazeDataHandler(handler: EyeGazeEventHandler): void {
    //     this.pushEyeGazeEventHandler(EyeGazeEventType.EyeGazeData, handler);
    // }

    // /**
    //  * Register a eye gaze server message event handler that is to be called on update if at least
    //  * a single eye gaze server message event has occurred since last update.
    //  * @param handler - Handler to be called on update.
    //  */
    // pushEyeGazeServerMessageHandler(handler: EyeGazeEventHandler): void {
    //     this.pushEyeGazeEventHandler(EyeGazeEventType.NewServerMessage, handler);
    // }

    // /**
    //  * Register a eye gaze connection status event handler that is to be called on update if at least
    //  * a single eye gaze connection status event has occurred since last update.
    //  * @param handler - Handler to be called on update.
    //  */
    // pushEyeGazeConnectionStatusHandler(handler: EyeGazeEventHandler): void {
    //     this.pushEyeGazeEventHandler(EyeGazeEventType.ConnectionStatus, handler);
    // }

    // /**
    //  * Register a eye gaze binary message parsing error event handler that is to be called on update if at least
    //  * a single eye gaze binary message parsing error event has occurred since last update.
    //  * @param handler - Handler to be called on update.
    //  */
    // pushEyeGazeBinaryMessageParsingErrorHandler(handler: EyeGazeEventHandler): void {
    //     this.pushEyeGazeEventHandler(EyeGazeEventType.BinaryMessageParsingError, handler);
    // }


    /**
     * Forward pointer lock request to the mouse event provider (if one exists).
     */
    requestPointerLock(): void {
        if (this._mouseEventProvider) {
            this._mouseEventProvider.pointerLock = true;
        }
    }

    /**
     * Forward pointer lock release request to the mouse event provider (if one exists).
     */
    exitPointerLock(): void {
        if (this._mouseEventProvider) {
            this._mouseEventProvider.pointerLock = false;
        }
    }

}
