import { describe, expect, it } from 'vitest';

import { localizeNode } from '@/i18n/LocalizationDomBridge';

const phrases = new Map([
   ['Open PDAX → Cash in', 'Buksan ang PDAX → Cash in'],
   ['Send pesos to PDAX', 'Magpadala ng pesos sa PDAX']
]);

const textIn = (value: string) => {
   const parent = document.createElement('h3');
   const node = document.createTextNode(value);
   parent.appendChild(node);
   document.body.appendChild(parent);
   return node;
};

describe('localizeNode', () => {
   it('translates a text node', () => {
      const node = textIn('Open PDAX → Cash in');
      localizeNode(node, 'fil', phrases);
      expect(node.nodeValue).toBe('Buksan ang PDAX → Cash in');
   });

   // React reuses the text node when the next guide card renders: the new English must be translated,
   // not swapped back to the previous card's Filipino.
   it('translates new text React puts into an already-translated node', () => {
      const node = textIn('Open PDAX → Cash in');
      localizeNode(node, 'fil', phrases);
      node.nodeValue = 'Send pesos to PDAX';
      localizeNode(node, 'fil', phrases);
      expect(node.nodeValue).toBe('Magpadala ng pesos sa PDAX');
   });

   it('leaves new untranslated text alone instead of restoring the old line', () => {
      const node = textIn('Open PDAX → Cash in');
      localizeNode(node, 'fil', phrases);
      node.nodeValue = 'Paste your address';
      localizeNode(node, 'fil', phrases);
      expect(node.nodeValue).toBe('Paste your address');
   });

   it('switching back to English restores the original, but not over newer text', () => {
      const node = textIn('Open PDAX → Cash in');
      localizeNode(node, 'fil', phrases);
      localizeNode(node, 'en', phrases);
      expect(node.nodeValue).toBe('Open PDAX → Cash in');

      localizeNode(node, 'fil', phrases);
      node.nodeValue = 'Paste your address';
      localizeNode(node, 'en', phrases);
      expect(node.nodeValue).toBe('Paste your address');
   });
});
