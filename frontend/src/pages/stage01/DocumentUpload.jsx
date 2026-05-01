import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const bodyTextStyle = {
  margin: "0 0 10px",
  color: "#2C2C2C",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.95rem",
  lineHeight: 1.55,
  textAlign: "left",
};

const listStyle = {
  margin: "0 0 16px",
  paddingLeft: "22px",
  color: "#2C2C2C",
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: "0.95rem",
  lineHeight: 1.55,
  textAlign: "left",
};

const ACCEPT = ".pdf,.docx,.txt";

function isAllowedFile(file) {
  const name = file.name.toLowerCase();
  const okExt = name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt");
  const okMime =
    file.type === "application/pdf" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "text/plain";
  return okExt && okMime;
}

function DocumentUpload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [stakeholderGap, setStakeholderGap] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStakeholderGap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;

      const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

      try {
        const response = await fetch(`${apiBaseUrl}/api/stage01/stakeholder-gap`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok || cancelled) return;

        const payload = await response.json();
        const gapPayload = {
          power_gaps: Array.isArray(payload?.power_gaps) ? payload.power_gaps : [],
          missing_stakeholder_types: Array.isArray(payload?.missing_stakeholder_types)
            ? payload.missing_stakeholder_types
            : [],
          questions_to_consider: Array.isArray(payload?.questions_to_consider)
            ? payload.questions_to_consider
            : [],
        };

        if (cancelled) return;
        setStakeholderGap(gapPayload);
        try {
          sessionStorage.setItem(
            "stakeholder_gap_analysis",
            JSON.stringify(gapPayload)
          );
        } catch {
          // ignore quota or privacy mode
        }
      } catch {
        // gap insights are optional; page still works
      }
    }

    loadStakeholderGap();
    return () => {
      cancelled = true;
    };
  }, []);

  function goToProgramDesign() {
    try {
      sessionStorage.removeItem("stakeholder_gap_analysis");
    } catch {
      // ignore
    }
    navigate("/stage01/program-design");
  }

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

  async function handleUploadAndContinue() {
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
      const response = await fetch(`${apiBaseUrl}/api/stage01/document-upload`, {
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

      const extracted =
        payload.extracted != null && typeof payload.extracted === "object"
          ? payload.extracted
          : payload.document?.extracted_data != null &&
              typeof payload.document.extracted_data === "object" &&
              payload.document.extracted_data.extracted != null &&
              typeof payload.document.extracted_data.extracted === "object"
            ? payload.document.extracted_data.extracted
            : null;

      if (extracted) {
        sessionStorage.setItem(
          "extracted_program_data",
          JSON.stringify(extracted)
        );
      }

      goToProgramDesign();
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
          textAlign: "center",
        }}
      >
        {stakeholderGap &&
        ((stakeholderGap.power_gaps || []).length > 0 ||
          (stakeholderGap.missing_stakeholder_types || []).length > 0 ||
          (stakeholderGap.questions_to_consider || []).length > 0) ? (
          <div
            style={{
              marginBottom: "22px",
              border: "1px solid #A8D4AA",
              borderRadius: "10px",
              backgroundColor: "#F0F7F0",
              padding: "16px",
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                marginBottom: "10px",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: "#ECFDF3",
                color: "#166534",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.76rem",
                fontWeight: 600,
              }}
            >
              From your stakeholder map. Verify before acting.
            </span>
            {(stakeholderGap.power_gaps || []).length > 0 ? (
              <>
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                  }}
                >
                  Power gaps noticed
                </h2>
                <ul
                  style={{
                    margin: "0 0 14px",
                    color: "#2C2C2C",
                    paddingLeft: "20px",
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: "0.92rem",
                  }}
                >
                  {(stakeholderGap.power_gaps || []).map((item, idx) => (
                    <li key={`power-${idx}`} style={{ marginBottom: "6px" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {(stakeholderGap.missing_stakeholder_types || []).length > 0 ? (
              <>
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                  }}
                >
                  Stakeholder types not yet mapped
                </h2>
                <ul
                  style={{
                    margin: "0 0 14px",
                    color: "#2C2C2C",
                    paddingLeft: "20px",
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: "0.92rem",
                  }}
                >
                  {(stakeholderGap.missing_stakeholder_types || []).map((item, idx) => (
                    <li key={`missing-${idx}`} style={{ marginBottom: "6px" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {(stakeholderGap.questions_to_consider || []).length > 0 ? (
              <>
                <h2
                  style={{
                    margin: "0 0 8px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                  }}
                >
                  Questions to sit with
                </h2>
                <ul
                  style={{
                    margin: 0,
                    color: "#2C2C2C",
                    paddingLeft: "20px",
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: "0.92rem",
                    fontStyle: "italic",
                  }}
                >
                  {(stakeholderGap.questions_to_consider || []).map((item, idx) => (
                    <li key={`question-${idx}`} style={{ marginBottom: "6px" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <h1
          style={{
            margin: "0 0 10px",
            color: "#2D6A2F",
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            fontSize: "1.9rem",
          }}
        >
          Share what you already have
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            color: "#6B7280",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "1rem",
            lineHeight: 1.55,
          }}
        >
          If you have existing documents about your program, uploading them saves
          you time. Claude will read them to pre-fill parts of your program
          design.
        </p>

        <div style={{ textAlign: "left", marginBottom: "24px" }}>
          <p style={{ ...bodyTextStyle, fontWeight: 600, marginBottom: "8px" }}>
            Examples of helpful documents:
          </p>
          <ul style={listStyle}>
            <li>A grant application or funding proposal</li>
            <li>A Statement of Work provided by your funder</li>
            <li>A program description or one-pager</li>
            <li>A logic model or theory of change document</li>
            <li>A previous evaluation or progress report</li>
          </ul>
        </div>

        <div style={{ textAlign: "left", marginBottom: "28px" }}>
          <p style={{ ...bodyTextStyle, fontWeight: 600, marginBottom: "8px" }}>
            How your document is used:
          </p>
          <ul style={listStyle}>
            <li>Your document is stored securely in your Rootwork workspace</li>
            <li>Only your organization can access it</li>
            <li>
              Claude reads it once to pull out information about your program
              model and funding requirements
            </li>
            <li>After that, Claude has no access to the document</li>
            <li>
              What travels through Rootwork is the extracted information, not
              the file itself
            </li>
            <li>You can delete your document at any time from your workspace</li>
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
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#2D6A2F",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: "1.05rem",
            }}
          >
            Drag and drop your document here
          </p>
          <p
            style={{
              margin: "0 0 16px",
              color: "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
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
              border: "2px solid #2D6A2F",
              backgroundColor: "#FFFFFF",
              color: "#2D6A2F",
              cursor: "pointer",
              fontFamily: '"DM Sans", system-ui, sans-serif',
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
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "24px",
              padding: "6px 12px",
              borderRadius: "999px",
              backgroundColor: "#ECFDF3",
              color: "#166534",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            <span style={{ maxWidth: "420px", overflow: "hidden", textOverflow: "ellipsis" }}>
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
            onClick={goToProgramDesign}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "2px solid #2D6A2F",
              backgroundColor: "#FFFFFF",
              color: "#2D6A2F",
              cursor: "pointer",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Skip for now, go to program design
          </button>
          <button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={handleUploadAndContinue}
            style={{
              flex: "1 1 220px",
              maxWidth: "320px",
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#2D6A2F",
              color: "#FFFFFF",
              cursor:
                !selectedFile || isUploading ? "not-allowed" : "pointer",
              opacity: !selectedFile || isUploading ? 0.65 : 1,
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {isUploading ? "Uploading..." : "Upload and continue"}
          </button>
        </div>

        {error ? (
          <p
            style={{
              marginTop: "16px",
              color: "#B42318",
              fontFamily: '"DM Sans", system-ui, sans-serif',
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

export default DocumentUpload;
