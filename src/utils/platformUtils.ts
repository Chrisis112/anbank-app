// utils/platformUtils.ts
/**
 * Platform and device detection utilities for cross-platform Phantom integration
 */

export interface PlatformInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  browserName: string;
  isPhantomMobile: boolean;
  isPhantomBrowser: boolean;
}

export const detectPlatform = (): PlatformInfo => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      isDesktop: false,
      browserName: 'unknown',
      isPhantomMobile: false,
      isPhantomBrowser: false,
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isIOS = /ipad|iphone|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isDesktop = !isMobile;

  // Detect browser
  let browserName = 'unknown';
  if (userAgent.includes('chrome')) browserName = 'chrome';
  else if (userAgent.includes('firefox')) browserName = 'firefox';
  else if (userAgent.includes('safari')) browserName = 'safari';
  else if (userAgent.includes('edge')) browserName = 'edge';

  // Phantom detection
  const phantomWindow = window as any;
  const isPhantomBrowser = !!(phantomWindow.solana?.isPhantom);
  const isPhantomMobile = !!(phantomWindow.phantom?.solana);

  return {
    isMobile,
    isIOS,
    isAndroid,
    isDesktop,
    browserName,
    isPhantomMobile,
    isPhantomBrowser,
  };
};

export const getPhantomDownloadLink = (platform: PlatformInfo): string => {
  if (platform.isIOS) {
    return 'https://apps.apple.com/app/phantom-solana-wallet/1598432977';
  } else if (platform.isAndroid) {
    return 'https://play.google.com/store/apps/details?id=app.phantom';
  } else {
    return 'https://phantom.app/download';
  }
};

export const isPhantomAvailable = (platform: PlatformInfo): boolean => {
  return platform.isPhantomBrowser || platform.isPhantomMobile;
};