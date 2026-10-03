// Browser titles for pages that stand on their own (customer pages, sign-in): the tab, bookmark and
// share sheet name the shop when it has a name, and the product otherwise.
import { useEffect } from 'react';
import { PRODUCT, otherName } from './artwork';

/** The shop's name for a title, or the product's full name when the shop has none or is the product's own. */
export const titleName = (name) => otherName(name) || PRODUCT;

/** Sets document.title while the page is open and puts the previous title back when it closes. */
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return undefined;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
