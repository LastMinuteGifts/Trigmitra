/**
 * PDF se text nikalo (browser me hi). pdfjs-dist sirf tab load hoti hai jab
 * student PDF upload kare — isliye main bundle heavy nahi hota.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // Worker public/ se aata hai (scripts/copy-pdf-worker.mjs build/dev se pehle copy karta hai).
  // .mjs nahi use kar sakte kyunki host usse text/plain bhejta hai.
  pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`

  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise

  try {
    const parts: string[] = []
    let length = 0
    const maxPages = Math.min(doc.numPages, 30)
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      parts.push(pageText)
      length += pageText.length
      page.cleanup()
      if (length > 20000) break
    }
    return parts.join('\n').replace(/[ \t]+/g, ' ').trim()
  } finally {
    await task.destroy()
  }
}
