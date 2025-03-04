/// <reference lib="webworker" />
import * as Comlink from "comlink";
import * as mupdfjs from "mupdf/mupdfjs";
import { PDFDocument } from "mupdf/mupdfjs";
import { OutlineItem, Bookmark } from "@/types";

export const MUPDF_LOADED = "MUPDF_LOADED";

export class MupdfWorker {
  private pdfdocument?: PDFDocument;

  constructor() {
    this.initializeMupdf();
  }

  private initializeMupdf() {
    try {
      postMessage(MUPDF_LOADED);
    } catch (error) {
      console.error("Failed to initialize MuPDF:", error);
    }
  }

  // ===> Here you can create methods <===
  // ===> that call statics and methods <===
  // ===> from mupdfjs which wraps ./node_modules/mupdf/dist/mupdf.js <===

  loadDocument(document: ArrayBuffer): boolean {
    this.pdfdocument = mupdfjs.PDFDocument.openDocument(
      document,
      "application/pdf"
    ) as PDFDocument;

    return true;
  }

  getDownloadUrl(): string {
    if (!this.pdfdocument) throw new Error("Document not loaded");

    const buffer = this.pdfdocument.saveToBuffer('garbage=deduplicate,compress=yes,permissions=8188');
    const blob = new Blob([buffer.asUint8Array()], { type: "application/pdf" });

    return URL.createObjectURL(blob);
  }

  getPageCount(): number {
    if (!this.pdfdocument) throw new Error("Document not loaded");

    return this.pdfdocument.countPages();
  }

  getBookmarks(): Bookmark[] {
    if (!this.pdfdocument) throw new Error("Document not loaded");

    const bookmarks: Bookmark[] = [];
    let outlineIterator = this.pdfdocument.outlineIterator();

    while (outlineIterator.item()) {
      const outlineItem = outlineIterator.item()!;
      const newBookmark: Bookmark = {
        name: outlineItem.title || "",
        page: outlineItem.uri
          ? parseInt(outlineItem.uri.split("#page=")[1])
          : 0,
      };
      bookmarks.push(newBookmark);
      outlineIterator.next();
    }

    return bookmarks;
  }

  writeBookmarks(bookmarks: Bookmark[]): void {
    if (!this.pdfdocument) throw new Error("Document not loaded");

    let outlineIterator = this.pdfdocument.outlineIterator();

    // delete all existing bookmarks
    while (outlineIterator.item()) {
      outlineIterator.delete();
    }

    // add new bookmarks
    for (const bookmark of bookmarks) {
      const outlineItem: OutlineItem = {
        title: bookmark.name,
        uri: `#page=${bookmark.page}&view=Fit`,
        open: false,
      };
      outlineIterator.insert(outlineItem);
    }
  }
}

Comlink.expose(new MupdfWorker());
