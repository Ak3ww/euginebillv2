import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function downloadVisibleInvoiceAsPdf(element: HTMLElement, filename: string) {
  // Capture directly from visible DOM on screen for 100.0% exact visual fidelity
  const canvas = await html2canvas(element, {
    scale: 2, // 2x High Resolution for crisp text, badges & borders
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: document.documentElement.offsetWidth || 1200,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = 210; // A4 width mm
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
