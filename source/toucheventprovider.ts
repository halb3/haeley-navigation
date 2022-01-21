
/* spellchecker: disable */

import { Observable, ReplaySubject } from 'rxjs';

import { assert } from 'haeley-auxiliaries';
import { bitInBitfield } from 'haeley-math';

/* spellchecker: enable */


export class TouchEventProvider {

    /**
     * HTML canvas element within the HTML5 document to register event listeners to.
     */
    protected _element: HTMLCanvasElement;

    /**
     * Time frame for events to be buffered (windowTime in rxjs per ReplaySubject).
     */
    protected _timeframe: number | undefined;

    protected _startListener: { (event: TouchEvent): void };
    protected _startSubject: ReplaySubject<TouchEvent>;

    protected _endListener: { (event: TouchEvent): void };
    protected _endSubject: ReplaySubject<TouchEvent>;

    protected _moveListener: { (event: TouchEvent): void };
    protected _moveSubject: ReplaySubject<TouchEvent>;

    protected _cancelListener: { (event: TouchEvent): void };
    protected _cancelSubject: ReplaySubject<TouchEvent>;

    /**
     * This mask saves for which types of events, event.preventDefault should be called.
     * This is useful to disallow some kinds of standard events like scrolling or clicking on links.
     */
    protected _preventDefaultMask: TouchEventType;


    constructor(element: HTMLCanvasElement, timeframe?: number) {
        assert(element !== undefined, `expected valid canvas element on initialization, given ${element}`);
        this._element = element;
        this._timeframe = timeframe;
    }

    /**
     * Checks whether or not to prevent the default handling of the given event. This depends on the internal
     * `preventDefaultMask` which can be modified using `preventDefault` function @see{@link prevenDefault}.
     * @param type - Internal event type of the incoming event.
     * @param event - Actual event to prevent default handling on (if masked).
     */
    protected preventDefaultOnEvent(type: TouchEventType, event: TouchEvent): void {
        if (bitInBitfield(this._preventDefaultMask, type)) {
            event.preventDefault();
        }
    }

    /**
     * Prevent default event handling on specific event type (using prevenDefault on the event).
     * @param types - Event types to prevent default handling on.
     */
    preventDefault(...types: TouchEventType[]): void {
        for (const type of types) {
            if (!bitInBitfield(this._preventDefaultMask, type)) {
                this._preventDefaultMask |= type;
            }
        }
    }

    /**
     * Allow default event handling on specific event type (not calling preventDefault on the event).
     * @param types - Event types to allow default handling on.
     */
    allowDefault(...types: TouchEventType[]): void {
        for (const type of types) {
            if (bitInBitfield(this._preventDefaultMask, type)) {
                this._preventDefaultMask &= ~type;
            }
        }
    }


    observable(type: TouchEventType): Observable<TouchEvent> {
        // eslint-disable-next-line default-case
        switch (type) {
            case TouchEventType.Start:
                return this.start$;
            case TouchEventType.End:
                return this.end$;
            case TouchEventType.Move:
                return this.move$;
            case TouchEventType.Cancel:
                return this.cancel$;
        }

        assert(false, 'Encountered unknown touch event.');
        return new Observable<TouchEvent>();
    }

    get start$(): Observable<TouchEvent> {
        if (this._startSubject === undefined) {
            this._startSubject = new ReplaySubject<TouchEvent>(undefined, this._timeframe);
            this._startListener = (event: TouchEvent) => {
                this.preventDefaultOnEvent(TouchEventType.Start, event);
                this._startSubject.next(event);
            };
            this._element.addEventListener('touchstart', this._startListener);
        }
        return this._startSubject.asObservable();
    }

    get end$(): Observable<TouchEvent> {
        if (this._endSubject === undefined) {
            this._endSubject = new ReplaySubject<TouchEvent>(undefined, this._timeframe);
            this._endListener = (event: TouchEvent) => {
                this.preventDefaultOnEvent(TouchEventType.End, event);
                this._endSubject.next(event);
            };
            this._element.addEventListener('touchend', this._endListener);
        }
        return this._endSubject.asObservable();
    }

    get move$(): Observable<TouchEvent> {
        if (this._moveSubject === undefined) {
            this._moveSubject = new ReplaySubject<TouchEvent>(undefined, this._timeframe);
            this._moveListener = (event: TouchEvent) => {
                this.preventDefaultOnEvent(TouchEventType.Move, event);
                this._moveSubject.next(event);
            };
            this._element.addEventListener('touchmove', this._moveListener);
        }
        return this._moveSubject.asObservable();
    }

    get cancel$(): Observable<TouchEvent> {
        if (this._cancelSubject === undefined) {
            this._cancelSubject = new ReplaySubject<TouchEvent>(undefined, this._timeframe);
            this._cancelListener = (event: TouchEvent) => {
                this.preventDefaultOnEvent(TouchEventType.Cancel, event);
                this._cancelSubject.next(event);
            };
            this._element.addEventListener('touchcancel', this._cancelListener);
        }
        return this._cancelSubject.asObservable();
    }
}


export enum TouchEventType {
    Start = 1 << 0,
    End = 1 << 1,
    Move = 1 << 2,
    Cancel = 1 << 3,
}
