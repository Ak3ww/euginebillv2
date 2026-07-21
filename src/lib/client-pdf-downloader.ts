import jsPDF from 'jspdf';

export async function downloadWebInvoiceAsPdf(element: HTMLElement, filename: string) {
  const html2canvas = (await import('html2canvas')).default;

  // Temporarily clone element into a fixed-width A4 container (794px)
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = '794px';
  clone.style.maxWidth = '794px';
  clone.style.minWidth = '794px';
  clone.style.position = 'fixed';
  clone.style.top = '0';
  clone.style.left = '0';
  clone.style.zIndex = '-9999';
  clone.style.opacity = '1';
  clone.style.background = '#ffffff';

  document.body.appendChild(clone);

  try {
    // Wait 300ms for images and fonts in clone to settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    const canvas = await html2canvas(clone, {
      scale: 2, // 2x DPI for crisp text, badges & logos
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210; // A4 width mm
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } finally {
    if (document.body.contains(clone)) {
      document.body.removeChild(clone);
    }
  }
}
