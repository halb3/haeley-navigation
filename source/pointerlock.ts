
/* spellchecker: disable */

import { assert } from '@haeley/auxiliaries';

/* spellchecker: enable */


interface ElementPL extends Element {

    mozRequestPointerLock(): void;
    webkitRequestPointerLock(): void;
}

interface DocumentPL extends Document {

    // eslint-disable-next-line @typescript-eslint/ban-types
    readonly mozPointerLockElement: ElementPL | null;
    // eslint-disable-next-line @typescript-eslint/ban-types
    readonly webkitPointerLockElement: ElementPL | null;

    mozExitPointerLock(): void;
    webkitExitPointerLock(): void;
}

/**
 * Utility class providing simplified access to the clients pointer lock API.
 */
export class PointerLock {

    /**
     * Cached exit call of the clients specific pointer lock API.
     */
    protected static _exit: () => void;

    /**
     * Cached request call of the clients specific pointer API.
     */
    protected static _request: (element: Element) => void;

    /**
     * Cached element call returning the fullscreen element specific to the clients fullscreen API.
     */
    // eslint-disable-next-line @typescript-eslint/ban-types
    protected static _element: () => Element | null;


    /**
     * Query and cache the client specific pointer lock API.
     */
    protected static queryAndCacheAPI(): void {
        if (PointerLock._exit !== undefined) {
            return;
        }

        /**
         * Shadow global document declaration with an untyped one. This is done in order to use vendor specific
         * properties without a compile error.
         */
        const document: DocumentPL = window.document as DocumentPL;

        // Query the API to use.
        const exits = [
            document.exitPointerLock,
            document.mozExitPointerLock,
            document.webkitExitPointerLock,
            undefined];

        let api = 0;
        for (; api < exits.length; ++api) {
            if (exits[api] === undefined) {
                continue;
            }
            break;
        }

        switch (api) {
            case 0: // native
                PointerLock._exit = () => document.exitPointerLock();
                /* @todo - refine the request pointer lock as soon as candidate recommendation is approved. */
                PointerLock._request = (element: ElementPL) => element.requestPointerLock();
                PointerLock._element = () => document.pointerLockElement;
                break;

            case 1: // mozilla
                PointerLock._exit = () => document.mozExitPointerLock();
                PointerLock._request = (element: ElementPL) => element.mozRequestPointerLock();
                PointerLock._element = () => document.mozPointerLockElement;
                break;

            case 2: // webkit
                PointerLock._exit = () => document.webkitExitPointerLock();
                PointerLock._request = (element: ElementPL) => element.webkitRequestPointerLock();
                PointerLock._element = () => document.webkitPointerLockElement;
                break;

            default:
                assert(false, `none of the following pointer lock apis was found: native, moz, or webkit`);
        }
    }


    /**
     * Returns whether or not a pointer lock element exists, indicating if pointer lock is active or not.
     */
    static active(element?: HTMLElement): boolean {
        if (this._element === undefined) {
            return false;
        }
        return (element !== undefined && PointerLock._element() === element) || (element === undefined &&
            PointerLock._element() !== undefined && PointerLock._element() !== null);
    }

    /**
     * Requests pointer lock for a given element. If another element is already in pointer lock, it is unlocked
     * first. The function considers various platform specific pointer lock interfaces, i.e., native, moz, and webkit.
     * @param element - Element to toggle pointer lock state of.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static request(element: HTMLElement, callback?: () => void): void {
        if (element === undefined) {
            return;
        }
        PointerLock.queryAndCacheAPI();

        if (PointerLock.active() && PointerLock._element() !== element) {
            PointerLock._exit();
        }

        if (!PointerLock.active()) {
            PointerLock._request(element);
        }
    }

    /**
     * Exit pointer lock. The function considers various platform specific pointer lock interfaces, i.e., native, moz,
     * and webkit.
     */
    static exit(): void {
        if (PointerLock._exit) {
            PointerLock._exit();
        }
    }

}
