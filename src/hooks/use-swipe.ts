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
import { useEffect, useRef, type RefObject } from 'react';

type SwipeDirection = 'left' | 'right';

/**
 * Detect horizontal swipe gestures on a container via Pointer Events. The consumer updates state
 * directly inside the pointer handler through `onSwipe`, avoiding the cascading re-renders of the
 * setState-inside-effect anti-pattern.
 *
 * @param containerRef - Element to monitor for pointer events.
 * @param onSwipe - Invoked with the swipe direction once a gesture clears the threshold.
 * @param threshold - Minimum horizontal distance in pixels for a valid swipe (default 50).
 */
export function useSwipe(
    containerRef: RefObject<HTMLElement | null>,
    onSwipe: (direction: SwipeDirection) => void,
    threshold = 50
): void {
    const onSwipeRef = useRef(onSwipe);
    useEffect(() => {
        onSwipeRef.current = onSwipe;
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        let startX = 0;
        let endX = 0;
        let startY = 0;
        let endY = 0;
        let isTracking = false;

        const onPointerDown = (event: PointerEvent) => {
            if (!event.isPrimary || event.pointerType !== 'touch') {
                return;
            }
            isTracking = true;
            startX = event.clientX;
            endX = event.clientX;
            startY = event.clientY;
            endY = event.clientY;
        };

        const onPointerMove = (event: PointerEvent) => {
            if (!isTracking || !event.isPrimary) {
                return;
            }
            endX = event.clientX;
            endY = event.clientY;
        };

        const onPointerUp = (event: PointerEvent) => {
            if (!isTracking || !event.isPrimary) {
                return;
            }
            isTracking = false;

            const deltaX = startX - endX;
            const deltaY = startY - endY;
            const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

            if (Math.abs(deltaX) > threshold && isHorizontalSwipe) {
                onSwipeRef.current(deltaX > 0 ? 'left' : 'right');
            }
        };

        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);
        container.addEventListener('pointercancel', onPointerUp);

        return () => {
            container.removeEventListener('pointerdown', onPointerDown);
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerup', onPointerUp);
            container.removeEventListener('pointercancel', onPointerUp);
        };
    }, [containerRef, threshold]);
}
