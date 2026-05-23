import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FilterSidebar from '@/components/filters/FilterSidebar';

import type { LoanFilters } from '@/utils/loanFilters';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const emptyFilters: LoanFilters = {};

function clickButton(container: HTMLElement, text: string) {
   const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === text);
   expect(button).toBeTruthy();

   act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
   });
}

describe('FilterSidebar live filtering', () => {
   let container: HTMLDivElement;
   let root: Root;
   let onFiltersChange: ReturnType<typeof vi.fn>;
   let onCustomAmountChange: ReturnType<typeof vi.fn>;
   let onClose: ReturnType<typeof vi.fn>;

   beforeEach(() => {
      onFiltersChange = vi.fn();
      onCustomAmountChange = vi.fn();
      onClose = vi.fn();
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
   });

   afterEach(() => {
      act(() => {
         root.unmount();
      });
      container.remove();
   });

   const renderFilterSidebar = (filters: LoanFilters = emptyFilters) => {
      act(() => {
         root.render(
            createElement(FilterSidebar, {
               filters,
               onFiltersChange,
               customAmount: '',
               onCustomAmountChange,
               onClose
            })
         );
      });
   };

   it('shows a non-blurring sheet without an apply button', () => {
      renderFilterSidebar();

      expect(container.textContent).not.toContain('Apply');
      expect(container.querySelector('[aria-label="Close filters"]')?.getAttribute('class')).not.toContain('backdrop-blur');
      expect(container.querySelector('[aria-label="Close filters"]')?.getAttribute('class')).not.toContain('bg-black');
   });

   it('publishes filter changes immediately when the user picks an option', () => {
      renderFilterSidebar();

      clickButton(container, '$15 - $30');

      expect(onFiltersChange).toHaveBeenCalledWith(
         expect.objectContaining({
            amount: '15-30'
         })
      );
      expect(onClose).not.toHaveBeenCalled();
   });

   it('keeps the sheet open while the user combines filters across tabs', () => {
      renderFilterSidebar();

      clickButton(container, '$15 - $30');
      clickButton(container, 'Payback %');
      clickButton(container, '10% to 20%');

      expect(onFiltersChange).toHaveBeenLastCalledWith(
         expect.objectContaining({
            amount: '15-30',
            rate: '15'
         })
      );
      expect(onClose).not.toHaveBeenCalled();
   });
});
