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

import { useState, useCallback, useRef, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DynamicImage } from '@/components/dynamic-image';
import { usePinchZoom } from '@/hooks/use-pinch-zoom';
import type { DynamicImageDimensions } from '@/lib/images/dynamic-image';

const HOVER_ZOOM_SCALE = 1.5;

export interface ProductImage {
    src: string;
    alt?: string;
}

interface PDPImageZoomProps {
    images: ProductImage[];
    selectedIndex: number;
    imageAltFallback: string;
    widths: DynamicImageDimensions;
    eager: boolean;
}

/**
 * Displays a zoomable product image for the PDP. Supports both mouse hover zoom and touch pinch-zoom interactions.
 * Hover zoom is activated when the user hovers over the image with a mouse, while pinch-zoom is available for touch devices.
 * The component manages the zoom state and ensures that the appropriate zoom interaction is active based on the user's input method.
 * It also includes keyboard accessibility, allowing users to toggle hover zoom with the Enter or Space keys and reset zoom with the Escape key.
 */
export function PDPImageZoom({
    images,
    selectedIndex,
    widths,
    eager,
    imageAltFallback,
}: PDPImageZoomProps): ReactElement {
    const { t: tProduct } = useTranslation('product');
    const [hoverTransform, setHoverTransform] = useState<{ transformOrigin: string; scale: number } | null>(null);
    const mainImageFrameRef = useRef<HTMLDivElement>(null);
    const { zoomState, resetZoom } = usePinchZoom(mainImageFrameRef);

    const selectedImage = images[selectedIndex] ?? images[0];

    const handlePointerEnterAndMove = useCallback(
        (event: PointerEvent<HTMLDivElement>) => {
            if (event.pointerType !== 'mouse') {
                return;
            }
            if (zoomState.scale > 1) {
                return;
            }
            const frame = mainImageFrameRef.current;
            if (!frame) {
                return;
            }
            const { left, top, width, height } = frame.getBoundingClientRect();
            const x = Math.max(0, Math.min(100, ((event.clientX - left) / width) * 100));
            const y = Math.max(0, Math.min(100, ((event.clientY - top) / height) * 100));
            setHoverTransform({ transformOrigin: `${x}% ${y}%`, scale: HOVER_ZOOM_SCALE });
        },
        [zoomState.scale]
    );

    const handlePointerLeave = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') {
            return;
        }
        setHoverTransform(null);
    }, []);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setHoverTransform((prev) =>
                    prev ? null : { transformOrigin: 'center center', scale: HOVER_ZOOM_SCALE }
                );
            } else if (event.key === 'Escape') {
                setHoverTransform(null);
                resetZoom();
            }
        },
        [resetZoom]
    );

    const activeScale = hoverTransform ? hoverTransform.scale : zoomState.scale;
    const activeOrigin = hoverTransform ? hoverTransform.transformOrigin : 'center center';
    const activeTranslateX = hoverTransform ? 0 : zoomState.translateX;
    const activeTranslateY = hoverTransform ? 0 : zoomState.translateY;

    return (
        <div
            ref={mainImageFrameRef}
            className=" overflow-hidden touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            tabIndex={0}
            role="region"
            aria-label={tProduct('zoomImageAriaLabel')}
            onPointerEnter={handlePointerEnterAndMove}
            onPointerMove={handlePointerEnterAndMove}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}>
            <div
                className="h-full w-full transition-transform duration-200 ease-out will-change-transform"
                style={{
                    transform: `scale(${activeScale}) translate(${activeTranslateX}px, ${activeTranslateY}px)`,
                    transformOrigin: activeOrigin,
                }}>
                <DynamicImage
                    src={selectedImage.src}
                    alt={selectedImage.alt || imageAltFallback}
                    widths={widths}
                    className="w-full h-full object-cover object-center [&_img]:object-contain! [&_img]:h-full! [&_img]:max-w-full! [&_img]:mx-auto!"
                    loading={eager ? 'eager' : 'lazy'}
                    priority={eager ? 'high' : undefined}
                />
            </div>
        </div>
    );
}
