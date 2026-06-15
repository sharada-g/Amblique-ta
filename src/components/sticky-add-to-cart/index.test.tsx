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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import StickyAddToCart from './index';

const useIsMountedMock = vi.fn();
const useProductViewMock = vi.fn();
const useVariationAttributesMock = vi.fn();

vi.mock('@/hooks/use-is-mounted', () => ({
    useIsMounted: () => useIsMountedMock(),
}));

vi.mock('@/providers/product-view', () => ({
    useProductView: () => useProductViewMock(),
}));

vi.mock('@/hooks/product/use-variation-attributes', () => ({
    useVariationAttributes: () => useVariationAttributesMock(),
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) =>
            ({
                addToCart: 'Add to Cart',
                addingToCart: 'Adding to Cart...',
                selectOptions: 'Select options',
            })[key] ?? key,
    }),
}));

let intersectionCallback: IntersectionObserverCallback = () => {};
const observeMock = vi.fn();
const disconnectMock = vi.fn();

class MockIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
    }
    observe = observeMock;
    disconnect = disconnectMock;
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = '0px';
    thresholds = [];
}

describe('StickyAddToCart', () => {
    const nativeButton = document.createElement('button');
    const handleAddToCart = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useIsMountedMock.mockReturnValue(true);
        useVariationAttributesMock.mockReturnValue([
            { name: 'Colour', selectedValue: { name: 'Cobalt' } },
            { name: 'Size', selectedValue: { name: 'M' } },
        ]);
        useProductViewMock.mockReturnValue({
            product: { name: 'Checked Silk Tie' },
            canAddToCart: true,
            isAddingToOrUpdatingCart: false,
            handleAddToCart,
            nativeAddToCartRef: { current: nativeButton },
        });
        vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    });

    test('renders nothing before mounted', () => {
        useIsMountedMock.mockReturnValue(false);
        render(<StickyAddToCart />);
        expect(screen.queryByText('Checked Silk Tie')).not.toBeInTheDocument();
    });

    test('renders in portal with product and selected variant summary', () => {
        render(<StickyAddToCart />);
        expect(screen.getByText('Checked Silk Tie')).toBeInTheDocument();
        expect(screen.getByText('Colour: Cobalt · Size: M')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument();
    });

    test('observes native add-to-cart button and toggles visibility from intersection state', () => {
        render(<StickyAddToCart />);
        expect(observeMock).toHaveBeenCalledWith(nativeButton);

        const sticky = screen.getByText('Checked Silk Tie').closest('div.fixed');
        expect(sticky).toHaveClass('translate-y-full');
        expect(sticky).toHaveAttribute('inert');

        act(() => {
            intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
        });
        expect(sticky).toHaveClass('translate-y-0');
        expect(sticky).not.toHaveAttribute('inert');
    });

    test('triggers add-to-cart action from sticky button', async () => {
        const user = userEvent.setup();
        render(<StickyAddToCart />);
        await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
        expect(handleAddToCart).toHaveBeenCalledTimes(1);
    });
});
