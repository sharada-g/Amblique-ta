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
import { describe, test, expect, vi, type Mock } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { type ShopperSearch } from '@/scapi';
import { useDynamicImageContext } from '@/providers/dynamic-image';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { ProductImageContainer } from './index';

vi.mock('@/hooks/use-is-mounted', () => ({
    useIsMounted: vi.fn().mockReturnValue(true),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (key === 'imagePosition' && opts) {
                return `Image ${opts.current} of ${opts.total}`;
            }
            return key;
        },
    }),
}));

vi.mock('@/components/link', () => ({
    Link: ({ children, to, ...props }: any) => (
        <a href={to} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/lib/product/product-utils', async (importOriginal) => {
    const original = await importOriginal<object>();
    return {
        ...original,
        getImagesForColor: vi.fn(() => [
            {
                link: 'https://example.com/default1.jpg',
                disBaseLink: 'https://example.com/default1.jpg',
                alt: 'Default Image 1',
            },
            {
                link: 'https://example.com/default2.jpg',
                disBaseLink: 'https://example.com/default2.jpg',
                alt: 'Default Image 2',
            },
        ]),
    };
});

vi.mock('@/providers/dynamic-image', () => ({
    useDynamicImageContext: vi.fn().mockReturnValue(null),
}));

vi.mock('./product-image', () => ({
    ProductImage: ({ src, alt, loading, className }: any) => (
        <img src={src} alt={alt} loading={loading} className={className} data-testid="product-image" />
    ),
}));

const mockProduct: ShopperSearch.schemas['ProductSearchHit'] = {
    productId: 'test-product',
    productName: 'Test Product',
    price: 99.99,
    variationAttributes: [
        {
            id: 'color',
            values: [
                { value: 'navy', name: 'Navy' },
                { value: 'red', name: 'Red' },
                { value: 'blue', name: 'Blue' },
                { value: 'black', name: 'Black' },
            ],
        },
    ],
};

describe('ProductImageContainer Dynamic Image Context Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useDynamicImageContext as Mock).mockReturnValue(null);
    });

    test('calls addSource with product image URL when context is available', async () => {
        const mockAddSource = vi.fn();
        (useDynamicImageContext as Mock).mockReturnValue({
            addSource: mockAddSource,
            hasSource: vi.fn(),
        });

        const { getImagesForColor } = await import('@/lib/product/product-utils');
        render(<ProductImageContainer product={mockProduct} />);

        expect(mockAddSource).toHaveBeenCalledWith('https://example.com/default1.jpg');
        expect(getImagesForColor).toHaveBeenCalledWith(mockProduct, null, 'medium');
    });

    test('does not fail when no context is available', async () => {
        const { getImagesForColor } = await import('@/lib/product/product-utils');
        render(<ProductImageContainer product={mockProduct} />);
        expect(getImagesForColor).toHaveBeenCalledWith(mockProduct, null, 'medium');
    });

    test('does not call addSource when currentImageUrl is undefined', async () => {
        const mockAddSource = vi.fn();
        (useDynamicImageContext as Mock).mockReturnValue({
            addSource: mockAddSource,
            hasSource: vi.fn(),
        });

        const { getImagesForColor } = await import('@/lib/product/product-utils');
        vi.mocked(getImagesForColor).mockReturnValueOnce([]);

        render(<ProductImageContainer product={mockProduct} />);

        expect(mockAddSource).not.toHaveBeenCalled();
    });

    test('falls back to product.image when getImagesForColor returns empty array', async () => {
        const mockAddSource = vi.fn();
        (useDynamicImageContext as Mock).mockReturnValue({
            addSource: mockAddSource,
            hasSource: vi.fn(),
        });

        const { getImagesForColor } = await import('@/lib/product/product-utils');
        vi.mocked(getImagesForColor).mockReturnValueOnce([]);

        const productWithFallbackImage = {
            ...mockProduct,
            image: {
                link: 'https://example.com/fallback.jpg',
                disBaseLink: 'https://example.com/fallback-dis.jpg',
                alt: 'Fallback Image',
            },
        };

        render(<ProductImageContainer product={productWithFallbackImage} />);

        expect(getImagesForColor).toHaveBeenCalled();
        expect(mockAddSource).toHaveBeenCalledWith('https://example.com/fallback-dis.jpg');
    });
});

describe('ProductImageContainer Image Cycler', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        (useDynamicImageContext as Mock).mockReturnValue(null);
        (useIsMounted as Mock).mockReturnValue(true);
        const { getImagesForColor } = await import('@/lib/product/product-utils');
        vi.mocked(getImagesForColor).mockReturnValue([
            { link: 'https://example.com/img1.jpg', disBaseLink: 'https://example.com/img1.jpg', alt: 'Image 1' },
            { link: 'https://example.com/img2.jpg', disBaseLink: 'https://example.com/img2.jpg', alt: 'Image 2' },
            { link: 'https://example.com/img3.jpg', disBaseLink: 'https://example.com/img3.jpg', alt: 'Image 3' },
        ]);
    });

    test('renders only the primary image (eager) before client mount — SSR contract', async () => {
        (useIsMounted as Mock).mockReturnValue(false);

        const { getAllByTestId } = render(<ProductImageContainer product={mockProduct} />);
        const images = getAllByTestId('product-image');

        expect(images).toHaveLength(1);
        expect(images[0]).toHaveAttribute('src', 'https://example.com/img1.jpg');
        expect(images[0]).toHaveAttribute('loading', 'eager');
    });

    test('after mount renders all images with primary eager and additional lazy', () => {
        const { getAllByTestId } = render(<ProductImageContainer product={mockProduct} />);
        const images = getAllByTestId('product-image');

        expect(images).toHaveLength(3);
        expect(images[0]).toHaveAttribute('loading', 'eager');
        expect(images[1]).toHaveAttribute('loading', 'lazy');
        expect(images[2]).toHaveAttribute('loading', 'lazy');
    });

    test('renders decorative aria-hidden dots, one per image', () => {
        const { container } = render(<ProductImageContainer product={mockProduct} />);
        const dotsWrapper = container.querySelector('[aria-hidden="true"].pointer-events-none');

        expect(dotsWrapper).not.toBeNull();
        expect(dotsWrapper?.children).toHaveLength(3);
    });

    test('hovering left/right zones cycles the active image (and active dot updates)', () => {
        const { container } = render(<ProductImageContainer product={mockProduct} />);
        const rightZone = container.querySelector('.cursor-e-resize') as HTMLElement;
        const leftZone = container.querySelector('.cursor-w-resize') as HTMLElement;
        const dotsWrapper = container.querySelector('[aria-hidden="true"].pointer-events-none');
        const activeDotIndex = () =>
            Array.from(dotsWrapper?.children ?? []).findIndex((el) =>
                (el as HTMLElement).className.includes('bg-foreground') &&
                !(el as HTMLElement).className.includes('bg-foreground/40')
            );

        expect(activeDotIndex()).toBe(0);

        act(() => {
            fireEvent.mouseEnter(rightZone);
        });
        expect(activeDotIndex()).toBe(1);

        act(() => {
            fireEvent.mouseEnter(leftZone);
        });
        expect(activeDotIndex()).toBe(0);
    });

    test('single-image products skip the cycler enhancements (no dots, no hover zones)', async () => {
        const { getImagesForColor } = await import('@/lib/product/product-utils');
        vi.mocked(getImagesForColor).mockReturnValue([
            { link: 'https://example.com/only.jpg', disBaseLink: 'https://example.com/only.jpg', alt: 'Only' },
        ]);

        const { container, getAllByTestId } = render(<ProductImageContainer product={mockProduct} />);

        expect(getAllByTestId('product-image')).toHaveLength(1);
        expect(container.querySelector('.cursor-e-resize')).toBeNull();
        expect(container.querySelector('.cursor-w-resize')).toBeNull();
        expect(container.querySelector('[aria-hidden="true"].pointer-events-none')).toBeNull();
        expect(container.querySelector('[role="status"]')).toBeNull();
    });

    test('renders a localized position announcement for assistive tech', () => {
        const { getByRole } = render(<ProductImageContainer product={mockProduct} />);
        const liveRegion = getByRole('status');

        expect(liveRegion).toHaveTextContent('Image 1 of 3');
    });

    test('resets to the primary image when the image set changes (e.g. swatch change)', async () => {
        const { container, rerender } = render(<ProductImageContainer product={mockProduct} selectedColorValue="navy" />);
        const rightZone = container.querySelector('.cursor-e-resize') as HTMLElement;
        const dotsWrapper = () => container.querySelector('[aria-hidden="true"].pointer-events-none');
        const activeDotIndex = () =>
            Array.from(dotsWrapper()?.children ?? []).findIndex((el) =>
                (el as HTMLElement).className.includes('bg-foreground') &&
                !(el as HTMLElement).className.includes('bg-foreground/40')
            );

        act(() => {
            fireEvent.mouseEnter(rightZone);
            fireEvent.mouseEnter(rightZone);
        });
        expect(activeDotIndex()).toBe(2);

        const { getImagesForColor } = await import('@/lib/product/product-utils');
        vi.mocked(getImagesForColor).mockReturnValue([
            { link: 'https://example.com/red1.jpg', disBaseLink: 'https://example.com/red1.jpg', alt: 'Red 1' },
            { link: 'https://example.com/red2.jpg', disBaseLink: 'https://example.com/red2.jpg', alt: 'Red 2' },
        ]);

        rerender(<ProductImageContainer product={mockProduct} selectedColorValue="red" />);
        expect(activeDotIndex()).toBe(0);
    });
});
