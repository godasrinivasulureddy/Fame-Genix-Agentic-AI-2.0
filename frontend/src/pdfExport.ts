import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

/**
 * Capture an assessment container and export it cleanly across multiple A4 pages.
 * Features:
 * - Uses 100% dark background (#141413) across ALL pages with zero white gaps.
 * - Prevents breaking through cards/blocks using clean block-by-block layout.
 * - Fits cleanly with generous margins and optimal A4 scaling.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  filename: string = 'FAME-GENIX-Clinical-Assessment.pdf',
  onProgress?: (status: string) => void
) {
  try {
    if (onProgress) onProgress('Preparing high-fidelity clinical canvas…');

    // Settle fonts and animations
    await new Promise((r) => setTimeout(r, 200));

    // A4 dimensions in mm
    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
    const marginMm = 8;
    const printableWidthMm = pdfPageWidth - marginMm * 2; // 194 mm
    const printableHeightMm = pdfPageHeight - marginMm * 2; // 281 mm

    // Render the DOM node to high-resolution canvas
    const canvas = await html2canvas(element, {
      scale: 2, // 2x crisp Retina resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#141413',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc: Document) => {
        const clonedEl = clonedDoc.querySelector('[data-pdf-export-root]') as HTMLElement;
        if (clonedEl) {
          clonedEl.style.maxHeight = 'none';
          clonedEl.style.overflow = 'visible';
          clonedEl.style.height = 'auto';
          clonedEl.style.backgroundColor = '#141413';
        }
        // Hide interactive buttons that shouldn't appear in printable PDF
        const toHide = clonedDoc.querySelectorAll('[data-pdf-ignore]');
        toHide.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      },
    });

    if (onProgress) onProgress('Formatting clinical pages…');

    // Create jsPDF instance
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pxPerMm = canvas.width / printableWidthMm;
    const printableHeightPx = Math.floor(printableHeightMm * pxPerMm);
    const totalHeightPx = canvas.height;

    // Scan all cards/sections marked with data-pdf-block
    // Also include sub-elements inside large blocks to find safe cutting points
    const blockElements = Array.from(
      element.querySelectorAll('[data-pdf-block], [data-pdf-sub-block]')
    ) as HTMLElement[];
    const elementRect = element.getBoundingClientRect();

    // Map each block's bounding box relative to element top
    interface BlockBoundary {
      topPx: number;
      bottomPx: number;
      heightPx: number;
    }

    const boundaries: BlockBoundary[] = blockElements.map((block) => {
      const bRect = block.getBoundingClientRect();
      const topRel = bRect.top - elementRect.top;
      const botRel = bRect.bottom - elementRect.top;
      return {
        topPx: Math.floor((topRel / element.scrollHeight) * totalHeightPx),
        bottomPx: Math.floor((botRel / element.scrollHeight) * totalHeightPx),
        heightPx: Math.floor((bRect.height / element.scrollHeight) * totalHeightPx),
      };
    });

    let currentSrcY = 0;
    let pageIndex = 0;

    while (currentSrcY < totalHeightPx) {
      if (pageIndex > 0) {
        pdf.addPage('a4', 'p');
      }

      // Fill entire page with consistent deep dark clinical background (#141413)
      pdf.setFillColor(20, 20, 19);
      pdf.rect(0, 0, pdfPageWidth, pdfPageHeight, 'F');

      let targetSliceHeightPx = printableHeightPx;
      const idealEndPx = currentSrcY + printableHeightPx;

      if (idealEndPx < totalHeightPx) {
        // Find if idealEndPx cuts through any block
        // A block is cut if: block.topPx < idealEndPx AND block.bottomPx > idealEndPx
        let breakPoint = idealEndPx;

        // Check blocks in descending order
        for (const b of boundaries) {
          if (b.topPx > currentSrcY + 100 && b.topPx < idealEndPx && b.bottomPx > idealEndPx) {
            // Cut BEFORE this block so the entire block moves to the next page!
            breakPoint = Math.min(breakPoint, b.topPx - 10);
          }
        }

        // If we found a clean break point, use it
        if (breakPoint > currentSrcY + 150) {
          targetSliceHeightPx = breakPoint - currentSrcY;
        } else {
          // If cutting before made the page too small, look for the highest bottom boundary before idealEndPx
          let bestBottom = -1;
          for (const b of boundaries) {
            if (b.bottomPx > currentSrcY + 150 && b.bottomPx <= idealEndPx) {
              if (b.bottomPx > bestBottom) {
                bestBottom = b.bottomPx;
              }
            }
          }
          if (bestBottom !== -1) {
            targetSliceHeightPx = bestBottom - currentSrcY;
          }
        }
      } else {
        targetSliceHeightPx = totalHeightPx - currentSrcY;
      }

      // Create a temporary canvas for this specific page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = targetSliceHeightPx;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        // Fill page canvas with dark background
        ctx.fillStyle = '#141413';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // Draw image slice from source canvas
        ctx.drawImage(
          canvas,
          0,
          currentSrcY,
          canvas.width,
          targetSliceHeightPx,
          0,
          0,
          canvas.width,
          targetSliceHeightPx
        );

        const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = targetSliceHeightPx / pxPerMm;

        // Render onto PDF centered with margin
        pdf.addImage(
          sliceImgData,
          'JPEG',
          marginMm,
          marginMm,
          printableWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
      }

      // Add clinical footer with page number and timestamp
      pdf.setFontSize(8);
      pdf.setTextColor(169, 169, 159);
      pdf.text(
        `FAME-GENIX 2.0 Autonomous Healthcare System · Confidential Medical Record · Page ${pageIndex + 1}`,
        marginMm,
        pdfPageHeight - 4
      );

      currentSrcY += targetSliceHeightPx;
      pageIndex++;
    }

    pdf.save(filename);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  }
}
