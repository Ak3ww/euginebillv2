import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Convert any CSS color expression (including modern lab, oklch, oklab, lch, color, color-mix)
 * to exact sRGB integers rgb(r, g, b) or rgba(r, g, b, a) using Canvas 2D 8-bit pixel buffer.
 * This guarantees html2canvas never sees any unsupported color function.
 */
function parseColorToRgb(colorExpr: string): string {
  if (!colorExpr || typeof colorExpr !== 'string') return colorExpr;
  const trimmed = colorExpr.trim();
  if (trimmed === 'transparent') return 'rgba(0, 0, 0, 0)';
  if (trimmed === 'none' || trimmed === 'inherit' || trimmed === 'initial') return trimmed;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'rgb(0, 0, 0)';

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);

    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const a = data[3];

    if (a === 255) {
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const alpha = Number((a / 255).toFixed(2));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  } catch {
    return 'rgb(0, 0, 0)';
  }
}

/**
 * Replace all occurrences of lab(...), oklch(...), oklab(...), lch(...), color(...), color-mix(...)
 * with exact rgb(...)/rgba(...) strings evaluated via 8-bit canvas pixel data.
 */
export function sanitizeCssString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  if (!/(?:lab|oklch|oklab|lch|color|color-mix)\(/i.test(str)) {
    return str;
  }
  let current = str;
  let iterations = 0;
  while (/(?:lab|oklch|oklab|lch|color|color-mix)\(/i.test(current) && iterations < 10) {
    iterations++;
    current = current.replace(/(?:lab|oklch|oklab|lch|color|color-mix)\((?:[^()]*|\([^()]*\))*\)/gi, (match) => {
      return parseColorToRgb(match);
    });
  }
  return current;
}

/**
 * Convert all <img> elements inside an element to base64 data URIs.
 * This prevents html2canvas from tainting the canvas due to CORS restrictions.
 */
async function convertImagesToBase64(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      if (!img.src || img.src.startsWith('data:')) return;
      try {
        const res = await fetch(img.src, { mode: 'cors' });
        const blob = await res.blob();
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              img.src = reader.result as string;
            }
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(blob);
        });
      } catch {
        // Silently skip images that fail CORS
      }
    })
  );
}

/**
 * Convert all <svg> elements to <img> with data URI src.
 * html2canvas has poor SVG support, so rasterizing them ensures
 * QR codes and icons render correctly in the PDF.
 */
function convertSvgsToImages(element: HTMLElement) {
  const svgs = Array.from(element.querySelectorAll('svg'));
  svgs.forEach((svg) => {
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const encoded = encodeURIComponent(svgString);
      const dataUri = `data:image/svg+xml;charset=utf-8,${encoded}`;
      
      const img = document.createElement('img');
      img.src = dataUri;
      const rect = svg.getBoundingClientRect();
      const w = svg.getAttribute('width') || (rect.width ? `${rect.width}` : '100');
      const h = svg.getAttribute('height') || (rect.height ? `${rect.height}` : '100');
      img.style.width = w.endsWith('px') || w.endsWith('%') ? w : `${w}px`;
      img.style.height = h.endsWith('px') || h.endsWith('%') ? h : `${h}px`;
      img.style.display = 'inline-block';
      
      svg.parentNode?.replaceChild(img, svg);
    } catch {
      // Skip SVGs that fail serialization
    }
  });
}

/**
 * Wait for all images in the element to finish loading.
 */
async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
}

/**
 * Download the visible invoice element as a 1:1 pixel-perfect PDF.
 */
export async function downloadVisibleInvoiceAsPdf(element: HTMLElement, filename: string) {
  // 1. Create offscreen container with fixed A4-proportional width (794px = 210mm at 96dpi)
  const FIXED_WIDTH = 794;
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${FIXED_WIDTH}px;
    z-index: -9999;
    background: #ffffff;
    overflow: visible;
  `;
  document.body.appendChild(container);

  // 2. Deep-clone the element into the offscreen container
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.cssText = `
    width: ${FIXED_WIDTH}px !important;
    max-width: ${FIXED_WIDTH}px !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background-color: #ffffff !important;
  `;
  container.appendChild(clone);

  // 3. Copy all computed styles from original to clone & sanitize colors
  copyComputedStyles(element, clone);

  // 4. Convert images and SVGs
  await convertImagesToBase64(clone);
  convertSvgsToImages(clone);
  await waitForImages(clone);

  // 5. Small delay for reflow
  await new Promise((resolve) => setTimeout(resolve, 150));

  try {
    // 6. Capture with html2canvas (inlining & sanitizing stylesheets for 1:1 fidelity)
    const canvas = await html2canvas(clone, {
      scale: 2, // 2x high-resolution capture for ultra-crisp output
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: FIXED_WIDTH,
      windowWidth: FIXED_WIDTH,
      onclone: async (clonedDoc) => {
        // Fetch and inline all external stylesheets so fonts, Tailwind utility classes,
        // gradients, and layout rules are 100% preserved while removing any lab/oklch colors
        const linkSheets = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
        await Promise.all(
          linkSheets.map(async (link) => {
            const href = (link as HTMLLinkElement).href;
            if (!href) return;
            try {
              const res = await fetch(href);
              const cssText = await res.text();
              const sanitizedCss = sanitizeCssString(cssText);
              const styleEl = clonedDoc.createElement('style');
              styleEl.textContent = sanitizedCss;
              link.parentNode?.replaceChild(styleEl, link);
            } catch {
              // Silently ignore failed stylesheet fetches
            }
          })
        );

        // Sanitize all existing <style> elements
        const existingStyles = Array.from(clonedDoc.querySelectorAll('style'));
        existingStyles.forEach((styleEl) => {
          if (styleEl.textContent) {
            styleEl.textContent = sanitizeCssString(styleEl.textContent);
          }
        });

        // Sanitize all inline styles across all nodes
        const allNodes = Array.from(clonedDoc.querySelectorAll('*'));
        allNodes.forEach((node) => {
          const htmlNode = node as HTMLElement;
          if (htmlNode.style && htmlNode.style.cssText) {
            if (/(?:lab|oklch|oklab|lch|color|color-mix)\(/i.test(htmlNode.style.cssText)) {
              htmlNode.style.cssText = sanitizeCssString(htmlNode.style.cssText);
            }
          }
        });
      },
    });

    // 7. Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const imgWidth = A4_WIDTH_MM;
    const imgHeight = (canvas.height * A4_WIDTH_MM) / canvas.width;

    if (imgHeight <= A4_HEIGHT_MM) {
      // Single page
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page: slice the canvas into A4-height chunks
      const pageHeightPx = (A4_HEIGHT_MM / A4_WIDTH_MM) * canvas.width;
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = page * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const pageImgHeight = (srcH * A4_WIDTH_MM) / canvas.width;
        pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, pageImgHeight);
      }
    }

    pdf.save(filename);
  } finally {
    // 8. Clean up offscreen container
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Recursively copy computed styles from source to target elements.
 * Automatically sanitizes unsupported color formats.
 */
function copyComputedStyles(source: Element, target: Element) {
  const sourceStyles = window.getComputedStyle(source);
  const targetEl = target as HTMLElement;
  
  const props = [
    'backgroundColor', 'backgroundImage', 'background',
    'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
    'lineHeight', 'letterSpacing', 'textTransform', 'textDecoration',
    'padding', 'margin', 'border', 'borderRadius',
    'display', 'flexDirection', 'alignItems', 'justifyContent', 'gap',
    'gridTemplateColumns', 'gridColumn', 'gridRow',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'overflow', 'opacity', 'boxShadow',
    'borderTop', 'borderBottom', 'borderLeft', 'borderRight',
    'borderColor', 'borderWidth', 'borderStyle',
    'textAlign', 'verticalAlign', 'whiteSpace',
    'position', 'top', 'right', 'bottom', 'left',
    'transform', 'transformOrigin',
    'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
    'tableLayout', 'borderCollapse', 'borderSpacing',
  ];

  props.forEach((prop) => {
    try {
      const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      let value = sourceStyles.getPropertyValue(cssProp);
      if (value) {
        value = sanitizeCssString(value);
        targetEl.style.setProperty(cssProp, value);
      }
    } catch {
      // Skip properties that can't be read/set
    }
  });

  // Recurse into children
  const sourceChildren = source.children;
  const targetChildren = target.children;
  const len = Math.min(sourceChildren.length, targetChildren.length);
  for (let i = 0; i < len; i++) {
    copyComputedStyles(sourceChildren[i], targetChildren[i]);
  }
}
