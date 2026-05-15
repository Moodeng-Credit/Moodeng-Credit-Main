const BASE_ACCOUNT_POPUP_HOST = 'keys.coinbase.com';
const BASE_ACCOUNT_POPUP_PATH = '/connect';
const DESKTOP_POPUP_WIDTH = 520;
const DESKTOP_POPUP_HEIGHT = 820;
const SMALL_SCREEN_MARGIN = 16;
const DESKTOP_HORIZONTAL_MARGIN = 96;
const DESKTOP_VERTICAL_MARGIN = 64;
const MIN_POPUP_WIDTH = 320;
const MIN_POPUP_HEIGHT = 600;
const PATCH_FLAG = '__moodengBaseAccountPopupPatchInstalled';

type BaseAccountPopupWindow = Window &
   typeof globalThis & {
      [PATCH_FLAG]?: boolean;
   };

type BaseAccountPopupViewport = {
   innerWidth: number;
   innerHeight: number;
   screen?: Pick<Screen, 'availWidth' | 'availHeight'>;
};

const getViewport = (win: Pick<BaseAccountPopupWindow, 'innerWidth' | 'innerHeight' | 'screen'>): BaseAccountPopupViewport => ({
   innerWidth: win.innerWidth,
   innerHeight: win.innerHeight,
   screen: win.screen
});

const isBaseAccountPopupUrl = (url: Parameters<Window['open']>[0], origin: string) => {
   if (!url) return false;

   try {
      const parsedUrl = new URL(String(url), origin);
      return parsedUrl.hostname === BASE_ACCOUNT_POPUP_HOST && parsedUrl.pathname === BASE_ACCOUNT_POPUP_PATH;
   } catch {
      return false;
   }
};

const replaceOrAppendFeature = (features: string, key: 'width' | 'height', value: number) => {
   const pattern = new RegExp(`${key}\\s*=\\s*\\d+`, 'i');

   if (pattern.test(features)) {
      return features.replace(pattern, `${key}=${value}`);
   }

   return `${features}, ${key}=${value}`;
};

const getPopupSize = (viewport: BaseAccountPopupViewport) => {
   const availableWidth = Math.max(MIN_POPUP_WIDTH, viewport.screen?.availWidth ?? viewport.innerWidth);
   const availableHeight = Math.max(MIN_POPUP_HEIGHT, viewport.screen?.availHeight ?? viewport.innerHeight);
   const horizontalMargin = availableWidth < 640 ? SMALL_SCREEN_MARGIN : DESKTOP_HORIZONTAL_MARGIN;
   const verticalMargin = availableWidth < 640 || availableHeight < 760 ? SMALL_SCREEN_MARGIN : DESKTOP_VERTICAL_MARGIN;
   const width = Math.min(DESKTOP_POPUP_WIDTH, Math.max(MIN_POPUP_WIDTH, availableWidth - horizontalMargin));
   const height = Math.min(DESKTOP_POPUP_HEIGHT, Math.max(MIN_POPUP_HEIGHT, availableHeight - verticalMargin));

   return { width, height };
};

export const getBaseAccountPopupFeatures = (features: Parameters<Window['open']>[2], viewport: BaseAccountPopupViewport) => {
   const { width, height } = getPopupSize(viewport);
   const currentFeatures = features ?? '';
   const withWidth = replaceOrAppendFeature(currentFeatures, 'width', width);
   return replaceOrAppendFeature(withWidth, 'height', height);
};

export function installBaseAccountPopupSizePatch(win?: BaseAccountPopupWindow) {
   if (typeof window === 'undefined' && !win) return;

   const targetWindow = win ?? (window as BaseAccountPopupWindow);

   if (targetWindow[PATCH_FLAG]) return;

   const originalOpen = targetWindow.open.bind(targetWindow);

   targetWindow.open = ((url, target, features) => {
      const nextFeatures = isBaseAccountPopupUrl(url, targetWindow.location.origin)
         ? getBaseAccountPopupFeatures(features, getViewport(targetWindow))
         : features;
      return originalOpen(url, target, nextFeatures);
   }) as Window['open'];

   targetWindow[PATCH_FLAG] = true;
}
