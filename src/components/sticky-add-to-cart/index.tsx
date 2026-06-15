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
import { type ReactElement, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useProductView } from '@/providers/product-view';
import { useVariationAttributes } from '@/hooks/product/use-variation-attributes';
import { useIsMounted } from '@/hooks/use-is-mounted';

/**
 * Mobile-only sticky Add to Cart bar. Slides in from the bottom once the native ATC button scrolls
 * out of view, mirroring its selected variant and reusing its cart handler. Renders nothing during
 * SSR / first paint to avoid a hydration mismatch (the server can't know scroll position).
 */
export default function StickyAddToCart(): ReactElement | null {
    const { t } = useTranslation('product');
    const isMounted = useIsMounted();
    const [isVisible, setIsVisible] = useState(false);

    const { product, canAddToCart, isAddingToOrUpdatingCart, handleAddToCart, nativeAddToCartRef } = useProductView();
    const variationAttributes = useVariationAttributes({ product });

    useEffect(() => {
        const nativeButton = nativeAddToCartRef.current;
        if (!isMounted || !nativeButton) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(!entry.isIntersecting);
            },
            { threshold: 0, rootMargin: '0px' }
        );

        observer.observe(nativeButton);
        return () => observer.disconnect();
    }, [isMounted, nativeAddToCartRef]);

    if (!isMounted) {
        return null;
    }

    const variantSummary = variationAttributes
        .filter((attribute) => attribute.selectedValue.name)
        .map((attribute) => `${attribute.name}: ${attribute.selectedValue.name}`)
        .join(' · ');

    const stickyContent = (
        <div
            className={`fixed inset-x-0 bottom-0 z-50 w-full border-t border-border bg-background p-4 transition-transform duration-300 ease-in-out will-change-transform md:hidden ${
                isVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
            inert={!isVisible}>
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-foreground">{product.name}</span>
                    {variantSummary && <span className="truncate text-sm text-muted-foreground">{variantSummary}</span>}
                </div>
                <Button
                    onClick={() => void handleAddToCart()}
                    disabled={!canAddToCart || isAddingToOrUpdatingCart}
                    className="whitespace-nowrap"
                    size="lg">
                    {!canAddToCart ? t('selectOptions') : isAddingToOrUpdatingCart ? t('addingToCart') : t('addToCart')}
                </Button>
            </div>
        </div>
    );

    return createPortal(stickyContent, document.body);
}
