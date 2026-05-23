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

describe('FilterSidebar validation', () => {
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

   it('warns instead of applying when no filter option is selected', () => {
      renderFilterSidebar();

      clickButton(container, 'Apply');

      expect(onFiltersChange).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Pick one Credit Limit option before applying a filter.');
      expect(container.querySelector('[aria-invalid="true"]')).toBeTruthy();
   });

   it('applies after the user picks an option below the active filter tab', () => {
      renderFilterSidebar();

      clickButton(container, '$15 - $30');
      clickButton(container, 'Apply');

      expect(onFiltersChange).toHaveBeenCalledWith(
         expect.objectContaining({
            amount: '15-30'
         })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
   });
});
