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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useSwipe } from './use-swipe';

type PointerInit = {
    pointerType?: string;
    isPrimary?: boolean;
    clientX?: number;
    clientY?: number;
};

const dispatchPointer = (target: EventTarget, type: string, init: PointerInit = {}) => {
    const event = new Event(type, { bubbles: true }) as Event & PointerInit;
    Object.assign(event, {
        pointerType: init.pointerType ?? 'touch',
        isPrimary: init.isPrimary ?? true,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
    });
    target.dispatchEvent(event);
};

const setupSwipeOnElement = (threshold?: number) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const onSwipe = vi.fn();
    const { unmount } = renderHook(() => {
        const ref = useRef<HTMLElement>(element);
        useSwipe(ref, onSwipe, threshold);
    });
    return { element, onSwipe, unmount };
};

describe('useSwipe', () => {
    let cleanup: Array<() => void> = [];

    beforeEach(() => {
        cleanup = [];
    });

    afterEach(() => {
        cleanup.forEach((fn) => fn());
        document.body.innerHTML = '';
    });

    it('fires "left" when a horizontal touch swipe exceeds the threshold moving leftward', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(40);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { clientX: 200, clientY: 100 });
        dispatchPointer(element, 'pointermove', { clientX: 100, clientY: 105 });
        dispatchPointer(element, 'pointerup', { clientX: 100, clientY: 105 });

        expect(onSwipe).toHaveBeenCalledTimes(1);
        expect(onSwipe).toHaveBeenCalledWith('left');
    });

    it('fires "right" when a horizontal touch swipe exceeds the threshold moving rightward', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(40);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { clientX: 50, clientY: 100 });
        dispatchPointer(element, 'pointermove', { clientX: 200, clientY: 100 });
        dispatchPointer(element, 'pointerup', { clientX: 200, clientY: 100 });

        expect(onSwipe).toHaveBeenCalledWith('right');
    });

    it('does not fire when the gesture is shorter than the threshold', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(50);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { clientX: 100, clientY: 100 });
        dispatchPointer(element, 'pointermove', { clientX: 120, clientY: 100 });
        dispatchPointer(element, 'pointerup', { clientX: 120, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores mouse and pen pointers (touch-only)', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(40);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { pointerType: 'mouse', clientX: 200, clientY: 100 });
        dispatchPointer(element, 'pointermove', { pointerType: 'mouse', clientX: 50, clientY: 100 });
        dispatchPointer(element, 'pointerup', { pointerType: 'mouse', clientX: 50, clientY: 100 });

        dispatchPointer(element, 'pointerdown', { pointerType: 'pen', clientX: 200, clientY: 100 });
        dispatchPointer(element, 'pointermove', { pointerType: 'pen', clientX: 50, clientY: 100 });
        dispatchPointer(element, 'pointerup', { pointerType: 'pen', clientX: 50, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores gestures where vertical movement dominates (allows vertical scroll)', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(40);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { clientX: 100, clientY: 50 });
        dispatchPointer(element, 'pointermove', { clientX: 160, clientY: 250 });
        dispatchPointer(element, 'pointerup', { clientX: 160, clientY: 250 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('ignores non-primary pointers (multi-touch secondary fingers)', () => {
        const { element, onSwipe, unmount } = setupSwipeOnElement(40);
        cleanup.push(unmount);

        dispatchPointer(element, 'pointerdown', { isPrimary: false, clientX: 200, clientY: 100 });
        dispatchPointer(element, 'pointermove', { isPrimary: false, clientX: 50, clientY: 100 });
        dispatchPointer(element, 'pointerup', { isPrimary: false, clientX: 50, clientY: 100 });

        expect(onSwipe).not.toHaveBeenCalled();
    });

    it('removes pointer listeners on unmount', () => {
        const element = document.createElement('div');
        document.body.appendChild(element);
        const removeSpy = vi.spyOn(element, 'removeEventListener');
        const onSwipe = vi.fn();

        const { unmount } = renderHook(() => {
            const ref = useRef<HTMLElement>(element);
            useSwipe(ref, onSwipe);
        });

        unmount();

        const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
        expect(removedTypes).toEqual(
            expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])
        );
    });
});
