import "@/App.css";
import BookmarkEditor from "@/components/BookmarkEditor";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import { useEffect } from "react";

// Add this function to detect the dark mode preference
const useDarkMode = () => {
  useEffect(() => {
    // Check if the user prefers dark mode
    const prefersDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // Apply the theme to the document
    document.documentElement.setAttribute(
      "data-bs-theme",
      prefersDarkMode ? "dark" : "light"
    );

    // Add event listener to update the theme if the user changes their preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute(
        "data-bs-theme",
        e.matches ? "dark" : "light"
      );
    };

    mediaQuery.addEventListener("change", handleChange);

    // Clean up the event listener when the component unmounts
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);
};

function App() {
  useDarkMode();
  return <BookmarkEditor />;
}

export default App;
