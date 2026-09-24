/**
 * Utility for opening the native Gmail app or default mail client directly on mobile devices (Android & iOS)
 * with graceful fallback to web Gmail / webmail on desktop browsers.
 */

export function openEmailApp(email?: string): void {
  const targetEmail = (email || '').trim().toLowerCase();
  const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || navigator.vendor || (window as any).opera || '') : '';
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isMobile = isAndroid || isIOS;

  const isYahoo = targetEmail.endsWith('@yahoo.com') || targetEmail.endsWith('@ymail.com');
  const isOutlook = targetEmail.endsWith('@outlook.com') || targetEmail.endsWith('@hotmail.com') || targetEmail.endsWith('@live.com');
  const isICloud = targetEmail.endsWith('@icloud.com') || targetEmail.endsWith('@me.com');

  if (isAndroid) {
    let appIntent = 'intent://#Intent;package=com.google.android.gm;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end';
    let webFallback = 'https://mail.google.com';

    if (isYahoo) {
      appIntent = 'intent://#Intent;package=com.yahoo.mobile.client.android.mail;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end';
      webFallback = 'https://mail.yahoo.com';
    } else if (isOutlook) {
      appIntent = 'intent://#Intent;package=com.microsoft.office.outlook;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;end';
      webFallback = 'https://outlook.live.com';
    }

    let hasNavigated = false;
    const cleanup = () => {
      hasNavigated = true;
      clearTimeout(fallbackTimer);
      window.removeEventListener('pagehide', cleanup);
      window.removeEventListener('blur', cleanup);
      document.removeEventListener('visibilitychange', handleVisibility);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cleanup();
      }
    };

    const fallbackTimer = setTimeout(() => {
      if (!hasNavigated && document.visibilityState === 'visible') {
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }
    }, 1200);

    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('blur', cleanup, { once: true });
    document.addEventListener('visibilitychange', handleVisibility, { once: true });

    try {
      window.location.href = appIntent;
    } catch {
      window.location.href = 'googlegmail://';
    }
    return;
  }

  if (isIOS) {
    let iosScheme = 'googlegmail://';
    let webFallback = 'https://mail.google.com';

    if (isYahoo) {
      iosScheme = 'ymail://';
      webFallback = 'https://mail.yahoo.com';
    } else if (isOutlook) {
      iosScheme = 'ms-outlook://';
      webFallback = 'https://outlook.live.com';
    } else if (isICloud) {
      iosScheme = 'message://';
      webFallback = 'https://www.icloud.com/mail';
    }

    let hasNavigated = false;
    const cleanup = () => {
      hasNavigated = true;
      clearTimeout(fallbackTimer);
      window.removeEventListener('pagehide', cleanup);
      window.removeEventListener('blur', cleanup);
      document.removeEventListener('visibilitychange', handleVisibility);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cleanup();
      }
    };

    const fallbackTimer = setTimeout(() => {
      if (!hasNavigated && document.visibilityState === 'visible') {
        window.open(webFallback, '_blank', 'noopener,noreferrer');
      }
    }, 1200);

    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('blur', cleanup, { once: true });
    document.addEventListener('visibilitychange', handleVisibility, { once: true });

    window.location.href = iosScheme;
    return;
  }

  // Desktop or fallback browser
  if (isYahoo) {
    window.open('https://mail.yahoo.com', '_blank', 'noopener,noreferrer');
  } else if (isOutlook) {
    window.open('https://outlook.live.com', '_blank', 'noopener,noreferrer');
  } else if (isICloud) {
    window.open('https://www.icloud.com/mail', '_blank', 'noopener,noreferrer');
  } else {
    window.open('https://mail.google.com', '_blank', 'noopener,noreferrer');
  }
}

export function openGmailApp(email?: string): void {
  openEmailApp(email);
}
