import { useMupdf } from "@/hooks/useMupdf.hook";
import { Bookmark } from "@/types";
import { useEffect, useState } from "react";

export default function BookmarkEditor({}) {
  const [file, setFile] = useState<File | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [originalBookmarks, setOriginalBookmarks] = useState<Bookmark[]>([]);
  const [newBookmark, setNewBookmark] = useState<Bookmark>({
    name: "",
    page: 1,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [customBookmarksUrl, setCustomBookmarksUrl] = useState<string | null>(
    null
  );
  const [customBookmarksLoaded, setCustomBookmarksLoaded] =
    useState<boolean>(false);
  const [bookmarksLoadError, setBookmarksLoadError] = useState<string | null>(
    null
  );

  const {
    isWorkerInitialized,
    loadDocument,
    getDownloadUrl,
    getBookmarks,
    writeBookmarks,
  } = useMupdf();

  // Function to export bookmarks as JSON
  const exportBookmarksAsJson = () => {
    try {
      const bookmarksJson = JSON.stringify(bookmarks, null, 2);
      const blob = new Blob([bookmarksJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = file
        ? `${file.name.replace(/\.[^.]+$/, "")}_bookmarks.json`
        : "bookmarks.json";
      link.click();

      URL.revokeObjectURL(url);
      console.log("Bookmarks exported successfully");
      return bookmarksJson;
    } catch (error) {
      console.error("Error exporting bookmarks:", error);
      return null;
    }
  };

  // Expose the export function to the global scope
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).exportBookmarks = exportBookmarksAsJson;
    }

    // Clean up on unmount
    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).exportBookmarks;
      }
    };
  }, [bookmarks]);

  // Check URL parameters for custom bookmarks source
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookmarksUrl = params.get("bookmarks");
    if (bookmarksUrl) {
      setCustomBookmarksUrl(bookmarksUrl);
      // Immediately try to load the bookmarks
      fetchCustomBookmarks(bookmarksUrl);
    }
  }, []);

  const handleReset = () => {
    setBookmarks([...originalBookmarks]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSaveFile = async () => {
    try {
      await writeBookmarks(bookmarks);

      let title = file?.name || "document";
      title = title.trim().split(" ").join("_"); // replace spaces with underscores
      title = title.replace(/\.[^.]+$/, ""); // remove file extension

      const blobUrl = await getDownloadUrl();

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${title}_with_bookmarks.pdf`;
      link.click();
    } catch (error) {
      console.error("Error saving file:", error);
    }
  };

  const handleSort = () => {
    const sortedBookmarks = [...bookmarks].sort((a, b) => a.page - b.page);
    setBookmarks(sortedBookmarks);
  };

  const handleDelete = (index: number) => {
    const updatedBookmarks = [...bookmarks];
    updatedBookmarks.splice(index, 1);
    setBookmarks(updatedBookmarks);
  };

  const handleAddBookmark = () => {
    if (newBookmark.name.trim() === "" || newBookmark.page < 1) {
      return; // Don't add invalid bookmarks
    }

    setBookmarks([...bookmarks, { ...newBookmark }]);
    setNewBookmark({ name: "", page: 1 }); // Reset form
    setShowAddForm(false); // Hide form after adding
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "page") {
      // Make sure page is a positive integer
      const pageValue = parseInt(value, 10);
      if (!isNaN(pageValue) && pageValue > 0) {
        setNewBookmark({ ...newBookmark, [name]: pageValue });
      }
    } else {
      setNewBookmark({ ...newBookmark, [name]: value });
    }
  };

  // Fetch custom bookmarks immediately, not waiting for PDF file
  const fetchCustomBookmarks = async (url: string) => {
    if (!url) return;

    try {
      setBookmarksLoadError(null);
      let response;

      // Check if the bookmarks param is a full URL or just a filename
      if (url.startsWith("http://") || url.startsWith("https://")) {
        // It's a full URL - use the original approach (may have CORS issues with external domains)
        console.log("Loading bookmarks from external URL:", url);
        response = await fetch(url);
      } else {
        // It's just a filename - load from the same origin to avoid CORS
        // Assume the file is in the public directory of the host
        const hostUrl = window.location.origin;
        const fileUrl = `${hostUrl}/${url}`;
        console.log("Loading bookmarks from same origin:", fileUrl);
        response = await fetch(fileUrl);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch custom bookmarks: ${response.status}`);
      }

      const customBookmarks = await response.json();

      // Validate the structure of the fetched bookmarks
      if (
        Array.isArray(customBookmarks) &&
        customBookmarks.every(
          (bookmark) =>
            typeof bookmark.name === "string" &&
            typeof bookmark.page === "number"
        )
      ) {
        setBookmarks(customBookmarks);
        setOriginalBookmarks(JSON.parse(JSON.stringify(customBookmarks)));
        setCustomBookmarksLoaded(true);
        console.log("Custom bookmarks loaded successfully");
      } else {
        const error = "Invalid bookmark format from custom URL";
        console.error(error);
        setBookmarksLoadError(error);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error loading custom bookmarks:", error);
      setBookmarksLoadError(errorMessage);
    }
  };

  useEffect(() => {
    if (!isWorkerInitialized || !file) return;

    const init = async () => {
      try {
        const response = await fetch(URL.createObjectURL(file));
        const arrayBuffer = await response.arrayBuffer();
        await loadDocument(arrayBuffer);

        // If custom bookmarks weren't loaded successfully, load the PDF's original bookmarks
        if (!customBookmarksLoaded) {
          const loadedBookmarks = await getBookmarks();
          setBookmarks(loadedBookmarks);
          setOriginalBookmarks(JSON.parse(JSON.stringify(loadedBookmarks)));
        }

        console.log("Document loaded successfully");
      } catch (error) {
        console.error("Error initializing document:", error);
      }
    };
    init();
  }, [isWorkerInitialized, file, customBookmarksLoaded]);

  return (
    <div className="container mt-4">
      {!file ? (
        <div className="text-center">
          <h4 className="mb-3">PDF Bookmark Editor</h4>
          <div className="btn-group m-1" role="group">
            <label className="btn btn-secondary">
              Load File
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {customBookmarksUrl && (
            <div className="mt-3">
              {bookmarksLoadError ? (
                <div className="alert alert-danger" role="alert">
                  Error loading bookmarks from: {customBookmarksUrl}
                  <br />
                  {bookmarksLoadError}
                </div>
              ) : customBookmarksLoaded ? (
                <div className="alert alert-success" role="alert">
                  Custom bookmarks successfully loaded from:{" "}
                  {customBookmarksUrl}
                  <br />
                  Bookmarks will be applied after loading a PDF file.
                </div>
              ) : (
                <div className="alert alert-info" role="alert">
                  Loading bookmarks from: {customBookmarksUrl}...
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="d-flex justify-content-center mb-3 flex-wrap">
            <div className="btn-group m-1" role="group">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? "Cancel" : "Add"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSort}
              >
                Sort
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
            <div className="btn-group m-1" role="group">
              <label className="btn btn-secondary">
                Load File
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveFile}
              >
                Save File
              </button>
            </div>
          </div>

          {customBookmarksUrl && (
            <div
              className={`alert ${
                bookmarksLoadError ? "alert-danger" : "alert-info"
              }`}
              role="alert"
            >
              {bookmarksLoadError ? (
                <>
                  Error loading bookmarks from {customBookmarksUrl}:{" "}
                  {bookmarksLoadError}
                </>
              ) : (
                <>Using custom bookmarks from: {customBookmarksUrl}</>
              )}
            </div>
          )}

          {showAddForm && (
            <div className="card mb-3">
              <div className="card-body">
                <h5 className="card-title">Add New Bookmark</h5>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label htmlFor="bookmarkName" className="form-label">
                      Bookmark Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="bookmarkName"
                      name="name"
                      value={newBookmark.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-md-6">
                    <label htmlFor="bookmarkPage" className="form-label">
                      Page Number
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      id="bookmarkPage"
                      name="page"
                      min="1"
                      value={newBookmark.page}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-12">
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleAddBookmark}
                    >
                      Add Bookmark
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th scope="col">Bookmark Name</th>
                      <th scope="col">Page</th>
                      <th scope="col"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookmarks === null ? (
                      <tr>
                        <td colSpan={3} className="text-center">
                          Loading bookmarks...
                        </td>
                      </tr>
                    ) : bookmarks.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center">
                          No bookmarks found
                        </td>
                      </tr>
                    ) : (
                      bookmarks.map((bookmark, index) => (
                        <tr key={index}>
                          <td>{bookmark.name}</td>
                          <td>{bookmark.page}</td>
                          <td className="text-center">
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(index)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
