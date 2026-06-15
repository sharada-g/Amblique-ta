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
import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface PinchZoomState {
    scale: number;
    translateX: number;
    translateY: number;
}

const INITIAL_ZOOM_STATE: PinchZoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/**
 * Two-finger pinch-to-zoom for touch devices
 */
export function usePinchZoom(containerRef: RefObject<HTMLElement | null>) {
    const [zoomState, setZoomState] = useState<PinchZoomState>(INITIAL_ZOOM_STATE);

    const resetZoom = useCallback(() => {
        setZoomState(INITIAL_ZOOM_STATE);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        let pointerCache: PointerEvent[] = [];
        let initialDistance = -1;
        let initialScale = 1;
        let initialMidX = 0;
        let initialMidY = 0;

        const calculateDistance = (ev1: PointerEvent, ev2: PointerEvent) =>
            Math.sqrt(Math.pow(ev2.clientX - ev1.clientX, 2) + Math.pow(ev2.clientY - ev1.clientY, 2));

        const getMidpoint = (ev1: PointerEvent, ev2: PointerEvent) => ({
            x: (ev1.clientX + ev2.clientX) / 2,
            y: (ev1.clientY + ev2.clientY) / 2,
        });

        const onPointerDown = (event: PointerEvent) => {
            event.preventDefault();
            pointerCache.push(event);

            if (pointerCache.length === 2) {
                const rect = container.getBoundingClientRect();
                initialDistance = calculateDistance(pointerCache[0], pointerCache[1]);
                initialScale = 1;
                const mid = getMidpoint(pointerCache[0], pointerCache[1]);
                initialMidX = mid.x - rect.left;
                initialMidY = mid.y - rect.top;
            }
        };

        const onPointerUp = (event: PointerEvent) => {
            pointerCache = pointerCache.filter((pointer) => pointer.pointerId !== event.pointerId);
            if (pointerCache.length < 2) {
                initialDistance = -1;
                resetZoom();
            }
        };

        const onPointerMove = (event: PointerEvent) => {
            const index = pointerCache.findIndex((pointer) => pointer.pointerId === event.pointerId);
            if (index !== -1) {
                pointerCache[index] = event;
            }

            if (pointerCache.length === 2 && initialDistance > 0) {
                const currentDistance = calculateDistance(pointerCache[0], pointerCache[1]);
                const newScale = Math.max(
                    MIN_SCALE,
                    Math.min(MAX_SCALE, initialScale * (currentDistance / initialDistance))
                );

                const rect = container.getBoundingClientRect();
                const { width: containerWidth, height: containerHeight } = rect;

                // Current midpoint in container-local pixels.
                const currentMid = getMidpoint(pointerCache[0], pointerCache[1]);
                const currentMidX = currentMid.x - rect.left;
                const currentMidY = currentMid.y - rect.top;

                // Anchor and destination relative to element centre (transform-origin is centre for pinch).
                const dx = initialMidX - containerWidth / 2;
                const dy = initialMidY - containerHeight / 2;
                const desiredX = currentMidX - containerWidth / 2;
                const desiredY = currentMidY - containerHeight / 2;

                // Solve newScale * (dx + tx) = desiredX → tx = desiredX / newScale - dx.
                const newTranslateX = desiredX / newScale - dx;
                const newTranslateY = desiredY / newScale - dy;

                // Clamp so the image edge never retreats past the container edge.
                const maxTx = (containerWidth * (newScale - 1)) / (2 * newScale);
                const maxTy = (containerHeight * (newScale - 1)) / (2 * newScale);
                const clampedTx = Math.max(-maxTx, Math.min(maxTx, newTranslateX));
                const clampedTy = Math.max(-maxTy, Math.min(maxTy, newTranslateY));

                setZoomState({ scale: newScale, translateX: clampedTx, translateY: clampedTy });
            }
        };

        container.addEventListener('pointerdown', onPointerDown, { passive: false });
        container.addEventListener('pointermove', onPointerMove, { passive: false });
        container.addEventListener('pointerup', onPointerUp);
        container.addEventListener('pointercancel', onPointerUp);

        return () => {
            container.removeEventListener('pointerdown', onPointerDown);
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerup', onPointerUp);
            container.removeEventListener('pointercancel', onPointerUp);
        };
    }, [containerRef, resetZoom]);

    return { zoomState, resetZoom };
}
