
/* spellchecker: disable */

import { Camera, vec2 } from 'haeley-math';
import { log, LogLevel, Invalidate } from 'haeley-auxiliaries';

import { PointerLock } from './pointerlock';
import { EventProvider, EventHandler } from './eventhandler';

import { TurntableModifier } from './turntablemodifier';
import { TrackballModifier } from './trackballmodifier';

import { FirstPersonModifier } from './firstpersonmodifier';
// import { FlightModifier } from './flightmodifier';

import { PanModifier } from './panmodifier';
import { PinchZoomModifier } from './pinchzoommodifier';

import { WheelZoomModifier } from './wheelzoommodifier';

/* spellchecker: enable */


/**
 * This navigation is merely a design template/recipe for more refined, specialized navigation and provides some basic,
 * commonly used camera modifier such as turntable, first-person, as well as trackball. This implementation is also
 * unfinished and will be continued as soon as possible (e.g., first-person navigation is not usable for now).
 * @todo - Refine and comment this class to be usable at least as common/most-basic navigation auxiliary.
 */
export class Navigation {

    /**
     * The navigation's invalidation callback. This should usually be setup by the owning renderer and invoke the
     * same callback the renderer has been given by the canvas. This invalidation is required, when continuous
     * rendering is not present, events might cause need for new rendering requests.
     */
    protected _invalidate: Invalidate;

    /** @see {@link camera} */
    protected _camera: Camera;

    /**
     * Currently active metaphor.
     */
    protected _navigationMetaphor: NavigationMetaphor;

    /**
     * Identifies the active camera modifier.
     */
    protected _mode: NavigationModes | undefined;

    /**
     * Specifies, whether or not rotation mode should be invoked on any move event, regardless of buttons.
     */
    protected _alwaysRotateOnMove = false;

    /**
     * First person camera modifier.
     */
    protected _firstPerson: FirstPersonModifier | undefined;

    /**
     * Trackball camera modifier.
     */
    protected _trackball: TrackballModifier | undefined;

    /**
     * Turntable camera modifier.
     */
    protected _turntable: TurntableModifier | undefined;

    /**
     * Pan camera modifier.
     */
    protected _pan: PanModifier;

    /**
     * Pinch camera modifier.
     */
    protected _pinch: PinchZoomModifier;

    /**
     * Wheel zoom modifier.
     */
    protected _wheelZoom: WheelZoomModifier;

    /**
     * Even handler used to forward/map events to specific camera modifiers.
     */
    protected _eventHandler: EventHandler;

    /**
     * This keeps track of all events that are currently interacting with the canvas.
     * It maps from pointer id to the current position.
     */
    protected _activeEvents: Map<number, PointerEvent>;

    /**
     * Keep track of the latest interaction in order to allow a cool down before the next
     * interaction is allowed.
     */
    protected _lastInteractionTime: number;

    constructor(
        invalidate: Invalidate,
        eventProvider: EventProvider) {

        this._invalidate = invalidate;

        /* Create event handler that listens to mouse events. */
        this._eventHandler = new EventHandler(invalidate, eventProvider);

        /* Listen to pointer events. */
        this._eventHandler.pushPointerDownHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerDown(latests, previous));
        this._eventHandler.pushPointerUpHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerUp(latests, previous));
        this._eventHandler.pushPointerEnterHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerEnter(latests, previous));
        this._eventHandler.pushPointerLeaveHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerLeave(latests, previous));
        this._eventHandler.pushPointerMoveHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerMove(latests, previous));
        this._eventHandler.pushPointerCancelHandler((latests: Array<PointerEvent>, previous: Array<PointerEvent>) =>
            this.onPointerCancel(latests, previous));

        this._eventHandler.pushMouseWheelHandler((latests: Array<WheelEvent>, previous: Array<WheelEvent>) =>
            this.onWheel(latests, previous));

        /* Listen to keyboard events. */
        this._eventHandler.pushKeyDownHandler((latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>) =>
            this.onKeyDown(latests, previous));
        this._eventHandler.pushKeyUpHandler((latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>) =>
            this.onKeyUp(latests, previous));
        this._eventHandler.pushKeyPressHandler((latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>) =>
            this.onKeyPress(latests, previous));

        /* Explicitly use the setter here to create the appropriate modifier. */
        this.navigationMetaphor = NavigationMetaphor.Turntable;

        this._pan = new PanModifier();
        this._pinch = new PinchZoomModifier();
        this._wheelZoom = new WheelZoomModifier();

        this._activeEvents = new Map();
    }


    /**
     * Resolves the event to camera modifier mapping by returning the responsible camera modifier.
     * @param event - Event to retrieve navigation mode for.
     */
    protected mode(): NavigationModes | undefined {

        const events = Array.from(this._activeEvents.values());
        const primaryEvent = this.getPrimaryEvent(events);

        if (primaryEvent === undefined) {
            log(LogLevel.Warning, 'No primary pointer event detected in Navigation::mode.');
            return;
        }

        const isMouseEvent = primaryEvent.pointerType === 'mouse';
        const isTouchEvent = primaryEvent.pointerType === 'touch' || primaryEvent.pointerType === 'pen';

        const isPrimaryButtonDown = primaryEvent.buttons & 1;
        const isShiftKeyDown = primaryEvent.shiftKey;

        // const touchEvent = event as TouchEvent;
        // let isTouchEvent = false;
        // if (touchEvent !== undefined) {
        //     isTouchEvent = touchEvent.touches !== undefined && touchEvent.touches.length > 0;
        // }

        const isPointerLockedRotate = PointerLock.active() && this._alwaysRotateOnMove;
        const numPointers = this._activeEvents.size;

        const isMouseRotate = isMouseEvent && isPrimaryButtonDown && numPointers === 1;
        const isTouchRotate = isTouchEvent && numPointers === 1;

        const isMousePan = isMouseEvent && isPrimaryButtonDown && isShiftKeyDown && numPointers === 1;
        const isMultiTouch = isTouchEvent && numPointers === 2;

        if (isPointerLockedRotate) {
            return NavigationModes.Rotate;
        }

        if (isMousePan) {
            return NavigationModes.Pan;
        } else if (isMultiTouch) {
            return NavigationModes.MultiTouch;
        } else if (isMouseRotate || isTouchRotate) {
            return NavigationModes.Rotate;
        }
        return undefined;
    }

    protected resolveMultiTouch(): NavigationModes | undefined {
        if (this._activeEvents.size < 2) {
            log(LogLevel.Warning,
                'MultiTouch resolution was canceled because less than two touches were detected.');
            return undefined;
        }

        const events = Array.from(this._activeEvents.values());
        const direction1 = vec2.fromValues(events[0].movementX, events[0].movementY);
        const direction2 = vec2.fromValues(events[1].movementX, events[1].movementY);

        if (vec2.length(direction1) === 0 || vec2.length(direction2) === 0) {
            return NavigationModes.Zoom;
        }

        vec2.normalize(direction1, direction1);
        vec2.normalize(direction2, direction2);
        const cosAngle = vec2.dot(direction1, direction2);

        const panThreshold = 0.2;
        if (cosAngle > panThreshold) {
            return NavigationModes.Pan;
        }
        return NavigationModes.Zoom;
    }

    protected rotate(start: boolean): void {
        if (this._activeEvents.size !== 1) {
            log(LogLevel.Info,
                'Rotate event was canceled because less or more than two pointers were detected.');
            return;
        }
        const events = Array.from(this._activeEvents.values());
        const point = this._eventHandler.offsets(events[0])[0];

        switch (this._navigationMetaphor) {

            // case NavigationMetaphor.FirstPerson:
            //     {
            //         const firstPerson = this._firstPerson as FirstPersonModifier;
            //         let movement: vec2 | undefined;
            //         if (PointerLock.active() && event instanceof MouseEvent) {
            //             movement = vec2.fromValues((event as MouseEvent).movementX, (event as MouseEvent).movementY);
            //         }
            //         start ? firstPerson.initiate(point) : firstPerson.process(point, movement);
            //     }
            //     break;

            case NavigationMetaphor.Trackball:
                {
                    const trackball = this._trackball as TrackballModifier;
                    start ? trackball.initiate(point) : trackball.process(point);
                }
                break;

            case NavigationMetaphor.Turntable:
                {
                    const turntable = this._turntable as TurntableModifier;
                    start ? turntable.initiate(point) : turntable.process(point);
                }
                break;

            default:
                break;
        }
    }

    protected pan(start: boolean): void {
        const events = Array.from(this._activeEvents.values());
        const event = this.getPrimaryEvent(events);

        if (event === undefined) {
            log(LogLevel.Warning,
                'Pan event was canceled because no primary event was detected.');
            return;
        }

        const point = this._eventHandler.offsets(event)[0];

        const pan = this._pan as PanModifier;
        start ? pan.initiate(point) : pan.process(point);
    }

    protected pinch(start: boolean): void {
        if (this._activeEvents.size !== 2) {
            log(LogLevel.Info,
                'Pinch event was canceled because less or more than two pointers were detected.');
            return;
        }
        const events = Array.from(this._activeEvents.values());
        const point1 = this._eventHandler.offsets(events[0])[0];
        const point2 = this._eventHandler.offsets(events[1])[0];

        const pinch = this._pinch as PinchZoomModifier;
        start ? pinch.initiate(point1, point2) : pinch.process(point1, point2);
    }

    protected getPrimaryEvent(events: Array<PointerEvent>): PointerEvent | undefined {
        for (const event of events) {
            if (event.isPrimary) {
                return event;
            }
        }

        return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onPointerDown(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void {
        for (const event of latests) {
            this._activeEvents.set(event.pointerId, event);
        }

        this._mode = this.mode();
        switch (this._mode) {
            case NavigationModes.Rotate:
                this.rotate(true);
                break;

            case NavigationModes.Pan:
                this.pan(true);
                break;

            case NavigationModes.Zoom:
                this.pinch(true);
                break;

            default:
                break;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onPointerUp(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void {
        for (const pointer of latests) {
            this._activeEvents.delete(pointer.pointerId);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    protected onPointerEnter(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void { }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onPointerLeave(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void {
        for (const pointer of latests) {
            this._activeEvents.delete(pointer.pointerId);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onPointerCancel(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void {
        for (const pointer of latests) {
            this._activeEvents.delete(pointer.pointerId);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onPointerMove(latests: Array<PointerEvent>, previous: Array<PointerEvent>): void {

        for (const event of latests) {
            this._activeEvents.set(event.pointerId, event);
        }

        if (this._mode === undefined) {
            return;
        }

        const events = Array.from(this._activeEvents.values());
        const primaryEvent = this.getPrimaryEvent(events);

        /**
         * Update the mode for every movement when using a mouse. This is necessary since mouse events do not trigger
         * 'pointerup' events, so we need to figure out when the primary button is released manually
         */
        if (primaryEvent && primaryEvent.pointerType === 'mouse') {
            this._mode = this.mode();
        }

        /**
         * Handle the case where this is the first movement of a multi-touch gesture. We need to find out which
         * kind of gesture is executed.
         */
        let modeUpdated = false;
        if (this._mode === NavigationModes.MultiTouch) {
            this._mode = this.resolveMultiTouch();
            modeUpdated = true;
        }

        switch (this._mode) {
            case NavigationModes.Rotate:
                this.rotate(modeUpdated);
                break;

            case NavigationModes.Pan:
                this.pan(modeUpdated);
                break;

            case NavigationModes.Zoom:
                this.pinch(modeUpdated);
                break;

            default:
                break;
        }

        this._lastInteractionTime = performance.now();
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected onWheel(latests: Array<WheelEvent>, previous: Array<WheelEvent>): void {
        const event = latests[0];
        this._wheelZoom.process(event.deltaY);
    }

    protected onKeyDown(latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>): void {
        // I don't know what to do here, yet, cause I get errors until here
    }

    protected onKeyUp(latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>): void {
        // I don't know what to do here, yet, cause I get errors until here
    }

    protected onKeyPress(latests: Array<KeyboardEvent>, previous: Array<KeyboardEvent>): void {
        // I don't know what to do here, yet, cause I get errors until here
    }


    /**
     * Update should invoke navigation specific event processing. When using, e.g., an event handler, the event handlers
     * update method should be called in order to have navigation specific event processing invoked.
     */
    update(): void {
        this._eventHandler.update();
    }

    /**
     * The camera that is to be modified in response to various events.
     */
    set camera(camera: Camera) {
        this._camera = camera;

        if (this._firstPerson) {
            this._firstPerson.camera = camera;
        }
        if (this._trackball) {
            this._trackball.camera = camera;
        }
        if (this._turntable) {
            this._turntable.camera = camera;
        }
        if (this._pan) {
            this._pan.camera = camera;
        }
        if (this._pinch) {
            this._pinch.camera = camera;
        }
        if (this._wheelZoom) {
            this._wheelZoom.camera = camera;
        }
    }

    /**
     * Configure this navigation's metaphor.
     */
    set navigationMetaphor(metaphor: NavigationMetaphor) {
        if (this._navigationMetaphor === metaphor) {
            return;
        }

        this._firstPerson = undefined;
        this._trackball = undefined;
        this._turntable = undefined;

        this._eventHandler.exitPointerLock(); /* Might be requested (and active) from FirstPerson or Flight. */
        this._alwaysRotateOnMove = false;

        this._navigationMetaphor = metaphor;
        switch (this._navigationMetaphor) {

            // case NavigationMetaphor.FirstPerson:

            //     this._eventHandler.requestPointerLock();
            //     this._alwaysRotateOnMove = true;

            //     this._firstPerson = new FirstPersonModifier();
            //     this._firstPerson.camera = this._camera;
            //     break;

            case NavigationMetaphor.Trackball:
                this._trackball = new TrackballModifier();
                this._trackball.camera = this._camera;
                break;

            case NavigationMetaphor.Turntable:
                this._turntable = new TurntableModifier();
                this._turntable.camera = this._camera;
                break;

            default:
                break;
        }
        this._invalidate(true);
    }

    get navigationMetaphor(): NavigationMetaphor {
        return this._navigationMetaphor;
    }

}


/**
 * Navigation modes used for identification of the current navigation intend, which is derived based on the event
 * types or gestures, regardless of the active navigation metaphor and its constraints.
 */
export enum NavigationModes {
    Move,
    Pan,
    /**
     * MultiTouch is used when interaction with two fingers was initiated but it is not clear yet what
     * interaction the user intends
     */
    MultiTouch,
    Rotate,
    Zoom,
    ZoomStep,
}

/**
 * Navigation metaphors supported by the default navigation implementation.
 */
export enum NavigationMetaphor {
    // FirstPerson = 'firstperson',
    // Flight = 'flight',
    Trackball = 'trackball',
    Turntable = 'turntable',
}
