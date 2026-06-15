/**
 * Copyright 2026 Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { usePinchZoom } from './use-pinch-zoom';

type PointerInit = {
    pointerId?: number;
    clientX?: number;
    clientY?: number;
    pointerType?: string;
    isPrimary?: boolean;
};

const dispatchPointer = (target: EventTarget, type: string, init: PointerInit = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as Event & PointerInit;
    Object.assign(event, {
        pointerId: init.pointerId ?? 1,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
        pointerType: init.pointerType ?? 'touch',
        isPrimary: init.isPrimary ?? true,
    });
    target.dispatchEvent(event);
    return event;
};

/**
 * Mounts the hook against a real DOM element with a deterministic bounding box so the midpoint /
 * translate math can be asserted against known pixel values (jsdom returns a zero-rect otherwise).
 */
const setupPinchOnElement = (rect: { width: number; height: number; left?: number; top?: number }) => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    const { left = 0, top = 0, width, height } = rect;
    element.getBoundingClientRect = vi.fn(
        () =>
            ({
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height,
                x: left,
                y: top,
                toJSON: () => ({}),
            }) as DOMRect
    );

    const { result, unmount } = renderHook(() => {
        const ref = useRef<HTMLElement>(element);
        return usePinchZoom(ref);
    });

    return { element, result, unmount };
};

/**
 * Drives a full two-finger gesture: both fingers land, then each finger moves to its end position.
 * The hook updates one cached pointer per `pointermove`, so the final state reflects both endpoints.
 */
const pinch = (
    element: EventTarget,
    start: { a: [number, number]; b: [number, number] },
    end: { a: [number, number]; b: [number, number] }
) => {
    act(() => {
        dispatchPointer(element, 'pointerdown', { pointerId: 1, clientX: start.a[0], clientY: start.a[1] });
        dispatchPointer(element, 'pointerdown', { pointerId: 2, clientX: start.b[0], clientY: start.b[1] });
    });
    act(() => {
        dispatchPointer(element, 'pointermove', { pointerId: 1, clientX: end.a[0], clientY: end.a[1] });
        dispatchPointer(element, 'pointermove', { pointerId: 2, clientX: end.b[0], clientY: end.b[1] });
    });
};

describe('usePinchZoom', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('starts at the identity transform', () => {
        const { result } = setupPinchOnElement({ width: 200, height: 200 });
        expect(result.current.zoomState).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    });

    it('scales by the ratio of finger spread, with no translate for a centred pinch', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        // Centred at (100,100): start spread 40px → end spread 80px ⇒ scale ×2. Midpoint never leaves
        // centre, so transform-origin handles it and translate stays at 0.
        pinch(element, { a: [80, 100], b: [120, 100] }, { a: [60, 100], b: [140, 100] });

        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);
        expect(result.current.zoomState.translateX).toBeCloseTo(0, 5);
        expect(result.current.zoomState.translateY).toBeCloseTo(0, 5);
    });

    it('clamps scale to the MAX_SCALE ceiling (4)', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        // start spread 20px → end spread 100px ⇒ raw scale ×5, clamped to 4.
        pinch(element, { a: [90, 100], b: [110, 100] }, { a: [70, 100], b: [170, 100] });

        expect(result.current.zoomState.scale).toBe(4);
        // Midpoint drifts right (90→120), desiredX=20 ⇒ tx = 20 / 4 = 5, within maxTx(75).
        expect(result.current.zoomState.translateX).toBeCloseTo(5, 5);
        expect(result.current.zoomState.translateY).toBeCloseTo(0, 5);
    });

    it('clamps scale to the MIN_SCALE floor (1) when pinching inward', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        // start spread 120px → end spread 10px ⇒ raw scale < 1, clamped to 1.
        pinch(element, { a: [40, 100], b: [160, 100] }, { a: [95, 100], b: [105, 100] });

        expect(result.current.zoomState.scale).toBe(1);
        // At scale 1 the pannable range is 0, so translate must collapse to 0.
        expect(result.current.zoomState.translateX).toBeCloseTo(0, 5);
        expect(result.current.zoomState.translateY).toBeCloseTo(0, 5);
    });

    it('clamps translate so the image edge never retreats past the container edge', () => {
        const { element, result } = setupPinchOnElement({ width: 100, height: 100 });

        // Centred start (spread 20) → end keeps spread 40 (scale ×2) but shoves the midpoint far right
        // to (120,50). Raw tx = (120-50)/2 = 35 exceeds maxTx = 100*(2-1)/(2*2) = 25 ⇒ clamps to 25.
        pinch(element, { a: [40, 50], b: [60, 50] }, { a: [100, 50], b: [140, 50] });

        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);
        expect(result.current.zoomState.translateX).toBeCloseTo(25, 5);
        expect(result.current.zoomState.translateY).toBeCloseTo(0, 5);
    });

    it('clamps vertical translate independently using container height', () => {
        const { element, result } = setupPinchOnElement({ width: 100, height: 100 });

        // Same spread math as above but along the Y axis: midpoint shoved down to (50,120).
        pinch(element, { a: [50, 40], b: [50, 60] }, { a: [50, 100], b: [50, 140] });

        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);
        expect(result.current.zoomState.translateX).toBeCloseTo(0, 5);
        expect(result.current.zoomState.translateY).toBeCloseTo(25, 5);
    });

    it('does not change scale for a single-finger gesture', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        act(() => {
            dispatchPointer(element, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
            dispatchPointer(element, 'pointermove', { pointerId: 1, clientX: 150, clientY: 50 });
        });

        expect(result.current.zoomState).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    });

    it('resets the transform when a finger lifts and fewer than two remain', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        pinch(element, { a: [80, 100], b: [120, 100] }, { a: [60, 100], b: [140, 100] });
        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);

        act(() => {
            dispatchPointer(element, 'pointerup', { pointerId: 2, clientX: 140, clientY: 100 });
        });

        expect(result.current.zoomState).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    });

    it('resets the transform on pointercancel', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        pinch(element, { a: [80, 100], b: [120, 100] }, { a: [60, 100], b: [140, 100] });
        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);

        act(() => {
            dispatchPointer(element, 'pointercancel', { pointerId: 1, clientX: 60, clientY: 100 });
        });

        expect(result.current.zoomState).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    });

    it('exposes a resetZoom callback that restores the identity transform', () => {
        const { element, result } = setupPinchOnElement({ width: 200, height: 200 });

        pinch(element, { a: [80, 100], b: [120, 100] }, { a: [60, 100], b: [140, 100] });
        expect(result.current.zoomState.scale).toBeCloseTo(2, 5);

        act(() => {
            result.current.resetZoom();
        });

        expect(result.current.zoomState).toEqual({ scale: 1, translateX: 0, translateY: 0 });
    });

    it('calls preventDefault on pointerdown to suppress the native pinch gesture', () => {
        const { element } = setupPinchOnElement({ width: 200, height: 200 });

        let event!: Event;
        act(() => {
            event = dispatchPointer(element, 'pointerdown', { pointerId: 1, clientX: 80, clientY: 100 });
        });

        expect(event.defaultPrevented).toBe(true);
    });

    it('removes all pointer listeners on unmount', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        const removeSpy = vi.spyOn(element, 'removeEventListener');

        const { unmount } = renderHook(() => {
            const ref = useRef<HTMLElement>(element);
            return usePinchZoom(ref);
        });

        unmount();

        const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
        expect(removedTypes).toEqual(
            expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        );
    });
});
