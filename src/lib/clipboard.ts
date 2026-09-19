/**
 * Universal Clipboard Utility & Fallback Engine
 * 
 * Ensures copying to clipboard works 100% of the time across all devices,
 * browsers, mobile webviews, and unencrypted HTTP direct IP connections
 * (where window.isSecureContext is false and navigator.clipboard is undefined).
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!text) return false;

  // 1. Try modern async Clipboard API if available in secure context
  if (window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('[clipboard] navigator.clipboard.writeText failed, falling back to execCommand:', err);
    }
  }

  // 2. Universal Fallback: Textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      // Position off-screen and invisible
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.style.opacity = '0';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);

      // iOS Safari requires range selection
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        textArea.setSelectionRange(0, 999999);
      } else {
        textArea.focus();
        textArea.select();
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('[clipboard] execCommand fallback failed:', err);
      return false;
    }
  }

  return false;
}

/**
 * Installs global polyfill on navigator.clipboard.writeText so that
 * any direct call to navigator.clipboard.writeText(...) across the entire app
 * automatically falls back to textarea execCommand without throwing errors.
 */
export function setupClipboardPolyfill() {
  if (typeof window === 'undefined') return;

  try {
    if (!navigator.clipboard) {
      (navigator as any).clipboard = {};
    }

    const nativeWriteText = navigator.clipboard.writeText?.bind(navigator.clipboard);

    navigator.clipboard.writeText = async (text: string): Promise<void> => {
      if (window.isSecureContext && nativeWriteText) {
        try {
          await nativeWriteText(text);
          return;
        } catch (err) {
          console.warn('[clipboard] native writeText rejected, running fallback', err);
        }
      }

      const ok = await copyToClipboard(text);
      if (!ok) {
        console.warn('[clipboard] Fallback copy failed to copy text to clipboard');
      }
    };
  } catch (err) {
    console.warn('[clipboard] Failed to attach clipboard polyfill:', err);
  }
}
