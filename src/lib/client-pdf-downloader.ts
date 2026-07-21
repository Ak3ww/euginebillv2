import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
      img.style.width = svg.getAttribute('width') ? `${svg.getAttribute('width')}px` : `${svg.getBoundingClientRect().width}px`;
      img.style.height = svg.getAttribute('height') ? `${svg.getAttribute('height')}px` : `${svg.getBoundingClientRect().height}px`;
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
 * Download the visible invoice element as a pixel-perfect PDF.
 * 
 * Strategy:
 * 1. Deep-clone the target element into an offscreen container
 * 2. Force a fixed width (794px = A4 at 96dpi) so output is consistent across devices
 * 3. Convert images to base64 and SVGs to rasterized images
 * 4. Capture with html2canvas at 2x scale for crisp output
 * 5. Fit into A4 PDF pages (with multi-page support for long invoices)
 */
export async function downloadVisibleInvoiceAsPdf(element: HTMLElement, filename: string) {
  // 1. Create offscreen container with fixed A4-proportional width
  const FIXED_WIDTH = 794; // A4 at 96dpi
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
  clone.style.width = `${FIXED_WIDTH}px`;
  clone.style.maxWidth = `${FIXED_WIDTH}px`;
  clone.style.margin = '0';
  clone.style.padding = '';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  container.appendChild(clone);

  // 3. Copy all computed styles from original to clone (deep)
  // This ensures Tailwind's computed values are baked into the clone
  copyComputedStyles(element, clone);

  // 4. Convert images and SVGs
  await convertImagesToBase64(clone);
  convertSvgsToImages(clone);
  await waitForImages(clone);

  // 5. Small delay for layout reflow
  await new Promise((resolve) => setTimeout(resolve, 100));

  try {
    // 6. Capture with html2canvas
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: FIXED_WIDTH,
      windowWidth: FIXED_WIDTH,
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
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page: slice the canvas into A4-height chunks
      const pageHeightPx = (A4_HEIGHT_MM / A4_WIDTH_MM) * canvas.width;
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = page * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);

        // Create a sub-canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.92);
        const pageImgHeight = (srcH * A4_WIDTH_MM) / canvas.width;
        pdf.addImage(pageImgData, 'JPEG', 0, 0, imgWidth, pageImgHeight);
      }
    }

    pdf.save(filename);
  } finally {
    // 8. Clean up offscreen container
    document.body.removeChild(container);
  }
}

/**
 * Recursively copy computed styles from source to target elements.
 * This is critical because html2canvas on a cloned element won't 
 * have access to the original's stylesheet-computed styles.
 */
function copyComputedStyles(source: Element, target: Element) {
  const sourceStyles = window.getComputedStyle(source);
  const targetEl = target as HTMLElement;
  
  // Copy key visual properties
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
      const value = sourceStyles.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      );
      if (value) {
        targetEl.style.setProperty(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
          value
        );
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
