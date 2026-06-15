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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@/components/link';
import type { ShopperSearch } from '@/scapi';
import { createProductUrl, getImagesForColor } from '@/lib/product/product-utils';
import { useDynamicImageContext } from '@/providers/dynamic-image';
import { ProductImage } from './product-image';
import ImageNavArrows from '@/components/image-nav-arrows';
import { useTranslation } from 'react-i18next';
import { useSwipe } from '@/hooks/use-swipe';
import { useIsMounted } from '@/hooks/use-is-mounted';

interface ProductImageContainerProps {
    product: ShopperSearch.schemas['ProductSearchHit'];
    selectedColorValue?: string | null;
    className?: string;
    handleProductClick?: (product: ShopperSearch.schemas['ProductSearchHit']) => void;
    /** Image aspect ratio (width/height). If provided, calculates height based on viewport width. Defaults to 1 (square) */
    imgAspectRatio?: number;
    /** Show prev/next navigation arrows when multiple images are available */
    showNavigationArrows?: boolean;
}

const ProductImageContainer = ({
    product,
    selectedColorValue = null,
    className,
    handleProductClick,
    imgAspectRatio = 1,
    showNavigationArrows = false,
}: ProductImageContainerProps) => {
    const { t } = useTranslation('product');
    const isMounted = useIsMounted();
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Get all images for the selected color variant
    const allImages = useMemo(
        () => getImagesForColor(product, selectedColorValue, 'medium'),
        [product, selectedColorValue]
    );

    // Reset to the primary image whenever the image set changes (e.g. different swatch/product).
    useEffect(() => {
        setSelectedImageIndex(0);
    }, [allImages]);

    const hasMultipleImages = allImages.length > 1;
    const isCycling = isMounted && hasMultipleImages;

    const primaryImage = allImages[0] ?? product.image;
    const primaryImageUrl = primaryImage?.disBaseLink || primaryImage?.link;
    const imageAltFallback = product.productName || t('imageAlt') || 'Product Image';

    // Report the primary image URL to the dynamic image context, if available
    const imageContext = useDynamicImageContext();
    useEffect(() => {
        if (primaryImageUrl) {
            imageContext?.addSource(primaryImageUrl);
        }
    }, [imageContext, primaryImageUrl]);

    const goToPrev = useCallback(() => {
        setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    }, [allImages.length]);
    const goToNext = useCallback(() => {
        setSelectedImageIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    }, [allImages.length]);

    useSwipe(
        containerRef,
        useCallback(
            (direction: 'left' | 'right') => {
                if (direction === 'left') {
                    goToNext();
                } else {
                    goToPrev();
                }
            },
            [goToNext, goToPrev]
        ),
        40
    );

    const handleClick = useCallback(() => {
        handleProductClick?.(product);
    }, [handleProductClick, product]);

    // When a non-square aspect ratio is requested, apply it via the native CSS
    // `aspect-ratio` property. The legacy padding-bottom percentage trick is not
    // used here because it conflicts with the native property and collapses the
    // image height to zero.
    const heightStyle = imgAspectRatio !== 1 ? { aspectRatio: `${imgAspectRatio}` } : {};

    const imageClassName = 'w-full h-full object-cover transition-all duration-200 group-hover:scale-105';

    return (
        <div
            ref={containerRef}
            className={`${showNavigationArrows ? 'group/image ' : ''}${isCycling ? 'z-[2] touch-pan-y ' : ''}relative overflow-hidden bg-secondary/20 flex flex-col ${
                imgAspectRatio === 1 ? 'aspect-square' : ''
            } ${className || ''}`}
            style={heightStyle}>
            {/* Product Image */}
            <Link
                to={createProductUrl(product.productId, selectedColorValue)}
                onClick={handleClick}
                className="relative block w-full h-full flex-1"
                aria-label={t('viewProductAriaLabel', { productName: imageAltFallback }) || imageAltFallback}>
                {/* Primary image: rendered server-side and client-side so SSR shows only this image. */}
                <ProductImage
                    src={primaryImageUrl || ''}
                    alt={primaryImage?.alt || imageAltFallback}
                    loading="eager"
                    className={`${imageClassName} ${
                        isCycling
                            ? `absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 ${selectedImageIndex !== 0 ? 'opacity-0' : 'opacity-100'}`
                            : ''
                    }`}
                    widths={imageContext?.widths}
                />

                {/* Additional images: client-only progressive enhancement, lazily loaded. */}
                {isCycling &&
                    allImages.slice(1).map((image, index) => {
                        const actualIndex = index + 1;
                        const imageUrl = image?.disBaseLink || image?.link;
                        return (
                            <ProductImage
                                key={imageUrl || actualIndex}
                                src={imageUrl || ''}
                                alt={image?.alt || imageAltFallback}
                                loading="lazy"
                                className={`${imageClassName} absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 ${
                                    selectedImageIndex === actualIndex ? 'opacity-100' : 'opacity-0'
                                }`}
                                widths={imageContext?.widths}
                            />
                        );
                    })}

                {/* Desktop hover zones: left half steps back, right half steps forward. */}
                {isCycling && (
                    <>
                        <div
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 z-10 hidden w-1/2 cursor-w-resize md:block"
                            onMouseEnter={goToPrev}
                        />
                        <div
                            aria-hidden="true"
                            className="absolute inset-y-0 right-0 z-10 hidden w-1/2 cursor-e-resize md:block"
                            onMouseEnter={goToNext}
                        />
                    </>
                )}

                {/* Decorative position dots, anchored to the bottom of the image. */}
                {isCycling && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
                        {allImages.map((image, index) => (
                            <span
                                key={image?.disBaseLink || image?.link || index}
                                className={`h-1.5 w-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                                    selectedImageIndex === index ? 'scale-125 bg-foreground' : 'bg-foreground/40'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </Link>

            {/* Position announcement for assistive tech, covering both swipe and keyboard navigation. */}
            {isCycling && (
                <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {t('imagePosition', { current: selectedImageIndex + 1, total: allImages.length })}
                </span>
            )}

            {/* Navigation Arrows - visible on hover */}
            {showNavigationArrows && allImages.length > 1 && (
                <ImageNavArrows
                    imageCount={allImages.length}
                    onIndexChange={setSelectedImageIndex}
                    className="opacity-0 group-hover/image:opacity-100 transition-opacity"
                />
            )}
        </div>
    );
};

export { ProductImageContainer };
