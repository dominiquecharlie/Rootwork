import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";

const listStyle = {
  margin: "0",
  paddingLeft: "22px",
  color: bodyDark,
  fontFamily: dmSans,
  fontSize: "0.95rem",
  lineHeight: 1.55,
  textAlign: "left",
};

const ACCEPT = ".pdf,.docx,.txt";

function isAllowedFile(file) {
  const name = file.name.toLowerCase();
  const okExt =
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt");
  const okMime =
    file.type === "application/pdf" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "text/plain";
  return okExt && okMime;
}

function PlayTriangleIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5z" fill="#FFFFFF" />
    </svg>
  );
}

function SOWUpload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [readInsteadOpen, setReadInsteadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  function clearFile() {
    setSelectedFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function assignFile(file) {
    setError("");
    if (!file) {
      clearFile();
      return;
    }
    if (!isAllowedFile(file)) {
      setError("Please choose a PDF, Word (.docx), or plain text file.");
      clearFile();
      return;
    }
    setSelectedFile(file);
  }

  function handleInputChange(event) {
    const file = event.target.files?.[0];
    assignFile(file || null);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    assignFile(file || null);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleChooseClick() {
    inputRef.current?.click();
  }

  async function handleUploadAndExtract() {
    if (!selectedFile) return;
    setError("");
    setIsUploading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Your session has expired. Please sign in again.");
      setIsUploading(false);
      return;
    }

    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${apiBaseUrl}/api/stage02/sow-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        const backendError =
          typeof payload?.error === "string" && payload.error.trim()
            ? payload.error
            : "Upload failed.";
        throw new Error(backendError);
      }

      try {
        sessionStorage.setItem(
          "sow_extraction_result",
          JSON.stringify(payload)
        );
      } catch {
        // ignore
      }

      navigate("/stage02/metrics-review");
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAF9F7",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "720px",
          backgroundColor: "#FAF9F7",
          border: "1px solid #A8D4AA",
          borderRadius: "12px",
          padding: "28px",
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px",
            color: green,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.9rem",
            textAlign: "center",
          }}
        >
          Upload your funder documents
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: muted,
            fontFamily: dmSans,
            fontSize: "1rem",
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          If your program is funded by a grant, contract, or government
          agency, upload the document that defines what you are required to
          measure.
        </p>

        <div style={{ marginBottom: "28px", textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              if (sectionExpanded) {
                setSectionExpanded(false);
                setReadInsteadOpen(false);
              } else {
                setSectionExpanded(true);
              }
            }}
            aria-expanded={sectionExpanded}
            style={{
              width: "100%",
              maxWidth: "560px",
              margin: "0 auto",
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "block",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "min(560px, calc(200px * 16 / 9))",
                margin: "0 auto",
                aspectRatio: "16 / 9",
                maxHeight: "200px",
                borderRadius: "8px",
                backgroundColor: green,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxSizing: "border-box",
              }}
            >
              <PlayTriangleIcon />
              <span
                style={{
                  color: "#FFFFFF",
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                Video coming soon
              </span>
            </div>
          </button>

          {sectionExpanded ? (
            <div style={{ maxWidth: "560px", margin: "16px auto 0" }}>
              <button
                type="button"
                onClick={() => setReadInsteadOpen((v) => !v)}
                style={{
                  display: "block",
                  margin: "0 auto",
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: green,
                  fontFamily: dmSans,
                  fontSize: "0.95rem",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Don&apos;t want to watch? Read this instead
              </button>

              {readInsteadOpen ? (
                <div style={{ marginTop: "20px", textAlign: "left" }}>
                  <p
                    style={{
                      margin: "0 0 10px",
                      color: green,
                      fontFamily: dmSans,
                      fontWeight: 700,
                      fontSize: "1rem",
                    }}
                  >
                    What is a funder document?
                  </p>
                  <ul style={listStyle}>
                    <li style={{ marginBottom: "8px" }}>
                      A Statement of Work (SOW) is a document your funder
                      provides that defines what your program must deliver and
                      measure
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      A grant agreement or contract often includes reporting
                      requirements: specific data points you must track and
                      submit
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      A funder reporting template shows exactly what fields your
                      funder expects you to fill in at the end of a grant
                      period
                    </li>
                    <li style={{ marginBottom: "8px" }}>
                      If you are not sure whether you have one of these, look
                      for any document from your funder that mentions
                      &quot;deliverables&quot;, &quot;metrics&quot;,
                      &quot;reporting requirements&quot;, or &quot;outcomes to
                      track&quot;
                    </li>
                    <li>
                      If you do not have a funder or do not have this type of
                      document, you can skip this step
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          style={{
            backgroundColor: "#F0F7F0",
            border: "1px solid #A8D4AA",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "24px",
            textAlign: "left",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: green,
              fontFamily: dmSans,
              fontWeight: 700,
              fontSize: "1rem",
            }}
          >
            Why this matters
          </p>
          <ul style={{ ...listStyle, margin: 0 }}>
            <li style={{ marginBottom: "10px" }}>
              Your funder has already defined what success looks like. Community
              members should know that before you ask for their input.
            </li>
            <li style={{ marginBottom: "10px" }}>
              Surfacing funder requirements now prevents surprises later when
              building your data collection tools.
            </li>
            <li>
              Claude will extract the metrics and reporting requirements so you
              can see exactly what your funder expects.
            </li>
          </ul>
        </div>

        <div style={{ textAlign: "left", marginBottom: "28px" }}>
          <p
            style={{
              margin: "0 0 8px",
              color: bodyDark,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            How your document is used
          </p>
          <ul style={listStyle}>
            <li>Your document is stored securely in your Rootwork workspace</li>
            <li>Only your organization can access it</li>
            <li>
              Claude reads it once to extract funder-defined metrics and
              reporting requirements
            </li>
            <li>After that, Claude has no access to the document</li>
            <li>
              What travels through Rootwork is the extracted information, not
              the file itself
            </li>
            <li>You can delete your document at any time</li>
          </ul>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            position: "relative",
            border: "2px dashed #A8D4AA",
            borderRadius: "12px",
            backgroundColor: "#F0F7F0",
            padding: "40px 24px",
            marginBottom: "12px",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: green,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          >
            Drag and drop your document here
          </p>
          <p
            style={{
              margin: "0 0 16px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.9rem",
            }}
          >
            Supported formats: PDF, Word (.docx), plain text
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleInputChange}
            style={{
              position: "absolute",
              width: "1px",
              height: "1px",
              padding: 0,
              margin: "-1px",
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          />
          <button
            type="button"
            onClick={handleChooseClick}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Choose file
          </button>
        </div>

        {selectedFile ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "999px",
                backgroundColor: "#ECFDF3",
                color: "#166534",
                fontFamily: dmSans,
                fontSize: "0.85rem",
                fontWeight: 600,
                maxWidth: "100%",
              }}
            >
              <span
                style={{
                  maxWidth: "420px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selectedFile.name}
              </span>
              <button
                type="button"
                onClick={clearFile}
                aria-label="Remove file"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#166534",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: "24px" }} />
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/stage02/templates")}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              cursor: "pointer",
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={handleUploadAndExtract}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              cursor:
                !selectedFile || isUploading ? "not-allowed" : "pointer",
              opacity: !selectedFile || isUploading ? 0.65 : 1,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {isUploading ? "Uploading..." : "Upload and extract metrics"}
          </button>
        </div>

        {error ? (
          <p
            style={{
              marginTop: "16px",
              textAlign: "center",
              color: "#B42318",
              fontFamily: dmSans,
              fontSize: "0.95rem",
            }}
          >
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default SOWUpload;
