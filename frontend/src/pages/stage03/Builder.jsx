import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import RootsLoader from "../../components/RootsLoader";
import { supabase } from "../../lib/supabaseClient";

const dmSans = '"DM Sans", system-ui, sans-serif';
const georgia = "Georgia, serif";
const green = "#2D6A2F";
const muted = "#6B7280";
const bodyDark = "#2C2C2C";

const TOOL_TYPE_LABELS = {
  survey: "Survey",
  interview: "Interview",
  observation: "Observation",
  administrative: "Administrative",
};

const WHO_OPTIONS = [
  { value: "program_participants", label: "Program participants" },
  { value: "staff_members", label: "Staff members" },
  { value: "both", label: "Both" },
  { value: "other", label: "Other" },
];

const QUESTION_TYPE_OPTIONS = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "yes_no", label: "Yes/No" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
];

const QUESTION_TYPE_BADGES = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  yes_no: "Yes/No",
  number: "Number",
  date: "Date",
};

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function DraftLabel() {
  return (
    <span
      style={{
        display: "inline-block",
        marginBottom: "12px",
        padding: "6px 12px",
        borderRadius: "8px",
        backgroundColor: "#ECFDF3",
        color: "#166534",
        fontFamily: dmSans,
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
    >
      AI draft: review and edit before use
    </span>
  );
}

function toolTypeBadgeStyle(type) {
  const t = (type || "").toLowerCase().trim();
  if (t === "survey") return { backgroundColor: "#DBEAFE", color: "#1D4ED8" };
  if (t === "interview") return { backgroundColor: "#EDE9FE", color: "#5B21B6" };
  if (t === "observation")
    return { backgroundColor: "#FEF3C7", color: "#B45309" };
  if (t === "administrative")
    return { backgroundColor: "#F3F4F6", color: "#4B5563" };
  return { backgroundColor: "#F3F4F6", color: "#6B7280" };
}

function qTypeBadgeStyle() {
  return { backgroundColor: "#F0F7F0", color: green };
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #A8D4AA",
  fontFamily: dmSans,
  fontSize: "0.95rem",
  color: bodyDark,
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  color: green,
  fontFamily: georgia,
  fontWeight: 700,
  fontSize: "0.95rem",
  textAlign: "left",
};

const mintBorder = "#A8D4AA";

function getBuilderInstrumentLabel(toolType, surveyPurpose) {
  const tt = (toolType || "").toLowerCase().trim();
  const sp = (surveyPurpose || "").toLowerCase().trim();
  if (tt === "survey") {
    if (sp === "pre_intake") return "Pre-Program Intake Survey";
    if (sp === "post_exit") return "Post-Program Exit Survey";
    if (sp === "satisfaction") return "Satisfaction Survey";
    return "Survey";
  }
  if (tt === "observation") return "Staff Observation Log";
  if (tt === "administrative") return "Administrative Tracking Record";
  return (
    TOOL_TYPE_LABELS[tt] ||
    (tt ? tt.charAt(0).toUpperCase() + tt.slice(1) : "Tool")
  );
}

function getSuggestLoadingSubtext(toolType) {
  const tt = (toolType || "").toLowerCase().trim();
  if (tt === "observation") {
    return "Claude is preparing observation prompts based on your program context.";
  }
  if (tt === "administrative") {
    return "Claude is preparing demographic and tracking fields based on your program context.";
  }
  return "Claude is preparing suggested questions and consent language based on your program context.";
}

const SURVEY_PURPOSE_CARDS = [
  {
    value: "pre_intake",
    title: "Pre-program intake",
    description:
      "Capture baseline information about participants at the start of their time with your program. Use this to understand who you are serving and where they are starting from.",
  },
  {
    value: "post_exit",
    title: "Post-program exit",
    description:
      "Measure change at the end of participation. Use this alongside an intake survey to see what shifted during the program.",
  },
  {
    value: "satisfaction",
    title: "Satisfaction and experience",
    description:
      "Capture how participants experienced your program. Use this to improve delivery and document what is working.",
  },
];

function Builder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialFromUrl = useMemo(() => {
    const name =
      searchParams.get("tool_name") || searchParams.get("name") || "";
    const typeRaw =
      searchParams.get("tool_type") ||
      searchParams.get("type") ||
      "survey";
    const decodedName = name
      ? decodeURIComponent(name.replace(/\+/g, " "))
      : "";
    let t = (typeRaw || "").toLowerCase().trim();
    const pipe = t.indexOf("|");
    if (pipe >= 0) t = t.slice(0, pipe).trim();
    const allowedTypes = new Set([
      "survey",
      "interview",
      "observation",
      "administrative",
    ]);
    let tool_type;
    if (allowedTypes.has(t)) {
      tool_type = t;
    } else if (t.startsWith("administr") || t.includes("administrative")) {
      tool_type = "administrative";
    } else if (t.startsWith("observ") || t.includes("observation")) {
      tool_type = "observation";
    } else if (t.includes("interview")) {
      tool_type = "interview";
    } else {
      tool_type = "survey";
    }
    const spRaw = (searchParams.get("survey_purpose") || "").toLowerCase().trim();
    const survey_purpose = [
      "pre_intake",
      "post_exit",
      "satisfaction",
    ].includes(spRaw)
      ? spRaw
      : "";
    return {
      tool_name: decodedName.trim() || "Untitled tool",
      tool_type,
      survey_purpose,
    };
  }, [searchParams.toString()]);

  const [toolName, setToolName] = useState(initialFromUrl.tool_name);
  const [toolType, setToolType] = useState(initialFromUrl.tool_type);
  const [whoCompletes, setWhoCompletes] = useState("program_participants");
  const [questions, setQuestions] = useState([]);
  const [collectionToolId, setCollectionToolId] = useState(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState("short_text");
  const [qRequired, setQRequired] = useState(true);
  const [qOptions, setQOptions] = useState([]);
  const [newOptionText, setNewOptionText] = useState("");

  const [consentLanguage, setConsentLanguage] = useState("");

  const [toolNotes, setToolNotes] = useState("");
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [hydrationComplete, setHydrationComplete] = useState(
    !((searchParams.get("tool_id") || "").trim())
  );
  const [surveyPurpose, setSurveyPurpose] = useState(
    initialFromUrl.survey_purpose || ""
  );

  const [govConsent, setGovConsent] = useState(false);
  const [govShare, setGovShare] = useState(false);
  const [govData, setGovData] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const tid = (searchParams.get("tool_id") || "").trim();
    setToolName(initialFromUrl.tool_name);
    setToolType(initialFromUrl.tool_type);
    setSurveyPurpose(initialFromUrl.survey_purpose || "");
    if (!tid) {
      setQuestions([]);
      setCollectionToolId(null);
    }
  }, [
    searchParams.toString(),
    initialFromUrl.tool_name,
    initialFromUrl.tool_type,
    initialFromUrl.survey_purpose,
  ]);

  const toolIdFromUrl = searchParams.get("tool_id")?.trim() || "";

  useEffect(() => {
    if (!toolIdFromUrl) {
      setQuestions([]);
      setHydrationComplete(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token || cancelled) {
          if (!cancelled) setHydrationComplete(true);
          return;
        }
        const base =
          import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
        const response = await fetch(`${base}/api/stage03/tools`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || cancelled) return;
        const tools = Array.isArray(body?.tools) ? body.tools : [];
        const tool = tools.find((t) => t.id === toolIdFromUrl);
        if (!tool || cancelled) return;
        const cfg =
          tool.configuration && typeof tool.configuration === "object"
            ? tool.configuration
            : {};
        const rawQs = Array.isArray(cfg.questions) ? cfg.questions : [];
        const mapped = rawQs
          .map((q) => {
            const id =
              typeof q.id === "string" && q.id.trim()
                ? q.id.trim()
                : newId();
            const text = typeof q.text === "string" ? q.text : "";
            let type = (q.type || "short_text").toLowerCase().trim();
            if (!QUESTION_TYPE_OPTIONS.some((o) => o.value === type)) {
              type = "short_text";
            }
            const row = {
              id,
              text,
              type,
              required: Boolean(q.required),
            };
            if (type === "multiple_choice" && Array.isArray(q.options)) {
              row.options = q.options
                .map((o) => String(o ?? "").trim())
                .filter(Boolean);
            }
            if (q.source === "ai" || q.source === "user") {
              row.source = q.source;
            }
            if (typeof q.rationale === "string" && q.rationale.trim()) {
              row.rationale = q.rationale.trim();
            }
            return row;
          })
          .filter((q) => q.text.trim().length > 0);
        const gc = cfg.governance_checks || {};
        const wt = (tool.tool_type || "survey").toLowerCase().trim();
        const tool_type = [
          "survey",
          "interview",
          "observation",
          "administrative",
        ].includes(wt)
          ? wt
          : "survey";
        if (cancelled) return;
        setCollectionToolId(tool.id);
        setToolName(
          typeof tool.tool_name === "string" && tool.tool_name.trim()
            ? tool.tool_name.trim()
            : "Untitled tool"
        );
        setToolType(tool_type);
        if (
          typeof cfg.who_completes === "string" &&
          WHO_OPTIONS.some((o) => o.value === cfg.who_completes)
        ) {
          setWhoCompletes(cfg.who_completes);
        }
        setQuestions(mapped);
        setConsentLanguage(
          typeof tool.consent_language === "string"
            ? tool.consent_language
            : ""
        );
        setGovConsent(Boolean(gc.consent_reviewed));
        setGovShare(Boolean(gc.shareback_plan));
        setGovData(Boolean(gc.data_storage));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrationComplete(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toolIdFromUrl]);

  const builderInstrumentLabel = useMemo(
    () => getBuilderInstrumentLabel(toolType, surveyPurpose),
    [toolType, surveyPurpose]
  );

  const typeTitle =
    TOOL_TYPE_LABELS[toolType] ||
    (toolType ? toolType.charAt(0).toUpperCase() + toolType.slice(1) : "Tool");

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  useEffect(() => {
    console.log("useEffect fired", {
      hydrationComplete,
      questionsLength: questions.length,
      toolType,
      surveyPurpose,
    });
    if (!hydrationComplete) return;
    if (questions.length > 0) return;
    if (toolType === "survey" && !surveyPurpose) return;

    let cancelled = false;
    setIsLoadingSuggestions(true);
    setSuggestError("");

    async function fetchSuggestions() {
      try {
        const token = await getToken();
        if (!token || cancelled) {
          setIsLoadingSuggestions(false);
          return;
        }
        console.log("about to fetch");
        const response = await fetch(
          `${apiBaseUrl}/api/stage03/suggest-questions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tool_name: toolName.trim(),
              tool_type: toolType,
              who_completes: whoCompletes,
              ...(toolType === "survey"
                ? { survey_purpose: surveyPurpose }
                : {}),
            }),
          }
        );
        if (cancelled) {
          setIsLoadingSuggestions(false);
          return;
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const msg =
            typeof err?.error === "string" && err.error.trim()
              ? err.error.trim()
              : "Could not generate suggestions.";
          setSuggestError(msg);
          setIsLoadingSuggestions(false);
          return;
        }
        const data = await response.json();
        if (cancelled) {
          setIsLoadingSuggestions(false);
          return;
        }
        const rawQs = Array.isArray(data?.questions) ? data.questions : [];
        const incoming = rawQs
          .map((q) => {
            const text = typeof q.text === "string" ? q.text.trim() : "";
            if (!text) return null;
            let type = (q.type || "short_text").toLowerCase().trim();
            if (!QUESTION_TYPE_OPTIONS.some((o) => o.value === type)) {
              type = "short_text";
            }
            const row = {
              id: newId(),
              text,
              type,
              required: Boolean(q.required),
              source: "ai",
            };
            if (type === "multiple_choice" && Array.isArray(q.options)) {
              const opts = q.options
                .map((o) => String(o ?? "").trim())
                .filter(Boolean);
              row.options = opts.length > 0 ? opts : ["Yes", "No"];
            }
            if (typeof q.rationale === "string" && q.rationale.trim()) {
              row.rationale = q.rationale.trim();
            }
            return row;
          })
          .filter(Boolean);
        setQuestions(incoming);
        setConsentLanguage(
          typeof data.consent_text === "string" ? data.consent_text : ""
        );
        setToolNotes(
          typeof data.tool_notes === "string" ? data.tool_notes.trim() : ""
        );
      } catch (e) {
        console.log("suggest-questions fetch error", e);
        if (!cancelled) {
          setSuggestError(
            e.message || "Could not generate suggestions."
          );
        }
      } finally {
        if (!cancelled) setIsLoadingSuggestions(false);
      }
    }

    fetchSuggestions();

    return () => {
      cancelled = true;
      setIsLoadingSuggestions(false);
    };
  }, [
    hydrationComplete,
    questions.length,
    toolName,
    toolType,
    whoCompletes,
    surveyPurpose,
    apiBaseUrl,
  ]);

  function openAddQuestionForm() {
    setEditingQuestionId(null);
    setQText("");
    setQType("short_text");
    setQRequired(true);
    setQOptions([]);
    setNewOptionText("");
    setShowQuestionForm(true);
  }

  function openEditQuestion(q) {
    setEditingQuestionId(q.id);
    setQText(q.text);
    setQType(q.type);
    setQRequired(Boolean(q.required));
    setQOptions(Array.isArray(q.options) ? [...q.options] : []);
    setNewOptionText("");
    setShowQuestionForm(true);
  }

  function cancelQuestionForm() {
    setShowQuestionForm(false);
    setEditingQuestionId(null);
    setQText("");
    setQOptions([]);
    setNewOptionText("");
  }

  function saveQuestionFromForm() {
    const text = qText.trim();
    if (!text) return;
    const base = {
      id: editingQuestionId || newId(),
      text,
      type: qType,
      required: qRequired,
    };
    if (qType === "multiple_choice") {
      base.options = qOptions.length > 0 ? [...qOptions] : [];
    }
    if (editingQuestionId) {
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== editingQuestionId) return q;
          const next = { ...base };
          if (q.source === "user") next.source = "user";
          return next;
        })
      );
    } else {
      setQuestions((prev) => [...prev, { ...base, source: "user" }]);
    }
    cancelQuestionForm();
  }

  function moveQuestion(id, delta) {
    setQuestions((prev) => {
      const i = prev.findIndex((q) => q.id === id);
      if (i < 0) return prev;
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function deleteQuestion(id) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function toggleRequired(id) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, required: !q.required } : q
      )
    );
  }

  function addMcOption() {
    const t = newOptionText.trim();
    if (!t) return;
    setQOptions((o) => [...o, t]);
    setNewOptionText("");
  }

  const payloadBody = useCallback(() => {
    return {
      tool_id: collectionToolId || undefined,
      tool_name: toolName.trim(),
      tool_type: toolType,
      who_completes: whoCompletes,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        required: q.required,
        ...(q.source === "ai" || q.source === "user" ? { source: q.source } : {}),
        ...(typeof q.rationale === "string" && q.rationale.trim()
          ? { rationale: q.rationale.trim() }
          : {}),
        ...(q.type === "multiple_choice" && Array.isArray(q.options)
          ? { options: q.options }
          : {}),
      })),
      consent_language: consentLanguage,
      governance_checks: {
        consent_reviewed: govConsent,
        shareback_plan: govShare,
        data_storage: govData,
      },
    };
  }, [
    collectionToolId,
    toolName,
    toolType,
    whoCompletes,
    questions,
    consentLanguage,
    govConsent,
    govShare,
    govData,
  ]);

  async function handleSaveDraft() {
    setSaveError("");
    setSaving(true);
    const token = await getToken();
    if (!token) {
      setSaveError("Your session has expired. Please sign in again.");
      setSaving(false);
      return;
    }
    if (!toolName.trim()) {
      setSaveError("Tool name is required.");
      setSaving(false);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage03/save-tool`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadBody()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not save draft."
        );
      }
      if (body?.tool?.id) {
        setCollectionToolId(body.tool.id);
      }
    } catch (e) {
      setSaveError(e.message || "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  const governanceReady = govConsent && govShare && govData;
  const launchDisabled =
    !governanceReady || !collectionToolId || launching || saving;

  async function handleLaunch() {
    setLaunchError("");
    if (!collectionToolId) {
      setLaunchError("Save a draft first so this tool has an id.");
      return;
    }
    if (!governanceReady) {
      setLaunchError("Confirm all governance items before launch.");
      return;
    }
    if (!consentLanguage.trim()) {
      setLaunchError("Add consent language before launch.");
      return;
    }
    setLaunching(true);
    const token = await getToken();
    if (!token) {
      setLaunchError("Your session has expired. Please sign in again.");
      setLaunching(false);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/stage03/launch-tool`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool_id: collectionToolId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.error === "string" && body.error.trim()
            ? body.error
            : "Could not launch tool."
        );
      }
      if (!body?.success) {
        throw new Error("Could not launch tool.");
      }
      navigate("/stage03/tools");
    } catch (e) {
      setLaunchError(e.message || "Could not launch tool.");
    } finally {
      setLaunching(false);
    }
  }

  const badgeStyle = toolTypeBadgeStyle(toolType);

  const showSurveyPurposeStep =
    hydrationComplete &&
    questions.length === 0 &&
    toolType === "survey" &&
    !surveyPurpose;

  if (showSurveyPurposeStep) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "720px",
            border: `1px solid ${mintBorder}`,
            borderRadius: "12px",
            padding: "28px",
            boxSizing: "border-box",
            backgroundColor: "#FAF9F7",
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.75rem",
              lineHeight: 1.25,
              textAlign: "center",
            }}
          >
            Choose how you will use this survey
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              color: bodyDark,
              fontFamily: dmSans,
              fontSize: "1rem",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Pick one purpose before we draft questions and consent language.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {SURVEY_PURPOSE_CARDS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSurveyPurpose(option.value)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    borderRadius: "10px",
                    border: `1px solid ${mintBorder}`,
                    backgroundColor: "#FFFFFF",
                    padding: "20px",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: green,
                      fontFamily: georgia,
                      fontWeight: 700,
                      fontSize: "1.1rem",
                      lineHeight: 1.3,
                    }}
                  >
                    {option.title}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      color: bodyDark,
                      fontFamily: dmSans,
                      fontSize: "0.95rem",
                      lineHeight: 1.5,
                    }}
                  >
                    {option.description}
                  </p>
                </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (isLoadingSuggestions) {
    return (
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: "#FAF9F7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "680px",
            textAlign: "center",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            backgroundColor: "#FAF9F7",
            padding: "32px 28px",
            boxSizing: "border-box",
          }}
        >
          <h1
            style={{
              margin: "0 0 14px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.65rem",
              lineHeight: 1.3,
            }}
          >
            Building your {builderInstrumentLabel}...
          </h1>
          <p
            style={{
              margin: "0 0 22px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.98rem",
              lineHeight: 1.55,
            }}
          >
            {getSuggestLoadingSubtext(toolType)}
          </p>
          <RootsLoader />
        </section>
      </main>
    );
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
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          boxSizing: "border-box",
        }}
      >
        {suggestError ? (
          <p
            style={{
              margin: "0 0 16px",
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor: "#FEF2F2",
              color: "#B91C1C",
              fontFamily: dmSans,
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            {suggestError}
          </p>
        ) : null}
        <header style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              margin: "0 0 10px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.75rem",
            }}
          >
            Build your {builderInstrumentLabel}
          </h1>
        </header>

        <section
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #A8D4AA",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxSizing: "border-box",
            textAlign: "left",
          }}
        >
          <h2
            style={{
              margin: "0 0 18px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.15rem",
            }}
          >
            Tool settings
          </h2>
          <label style={{ display: "block", marginBottom: "18px" }}>
            <span style={labelStyle}>Tool name</span>
            <input
              type="text"
              required
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              style={inputStyle}
            />
          </label>
          <div style={{ marginBottom: "18px" }}>
            <span style={labelStyle}>Tool type</span>
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontFamily: dmSans,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  ...badgeStyle,
                }}
              >
                {typeTitle}
              </span>
            </div>
          </div>
          <label style={{ display: "block", marginBottom: 0 }}>
            <span style={labelStyle}>Who will complete this?</span>
            <select
              value={whoCompletes}
              onChange={(e) => setWhoCompletes(e.target.value)}
              style={inputStyle}
            >
              {WHO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section style={{ marginBottom: "24px", textAlign: "left" }}>
          <h2
            style={{
              margin: "0 0 16px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.25rem",
              textAlign: "center",
            }}
          >
            Questions
          </h2>

          {toolNotes.trim() ? (
            <div
              style={{
                marginBottom: "18px",
                padding: "14px 16px",
                borderRadius: "10px",
                backgroundColor: "#ECFDF3",
                border: "1px solid #BBF7D0",
                textAlign: "left",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontFamily: georgia,
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "#166534",
                }}
              >
                Guidance for administering this tool:
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  lineHeight: 1.55,
                  color: bodyDark,
                  whiteSpace: "pre-wrap",
                }}
              >
                {toolNotes}
              </p>
            </div>
          ) : null}

          {questions.length > 0 ? (
            <div style={{ marginBottom: "18px", textAlign: "center" }}>
              <button
                type="button"
                onClick={() => {
                  setQuestions([]);
                  setConsentLanguage("");
                }}
                style={{
                  cursor: "pointer",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: `2px solid ${green}`,
                  backgroundColor: "#FFFFFF",
                  color: green,
                  fontFamily: dmSans,
                  fontWeight: 600,
                }}
              >
                Regenerate suggested questions
              </button>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            {questions.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: muted,
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  textAlign: "center",
                }}
              >
                No questions yet. Use Add question below.
              </p>
            ) : (
              questions.map((q, index) => (
                <article
                  key={q.id}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      paddingTop: "4px",
                    }}
                  >
                    <button
                      type="button"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveQuestion(q.id, -1)}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "6px",
                        backgroundColor: "#FFFFFF",
                        color: index === 0 ? "#D1D5DB" : muted,
                        cursor: index === 0 ? "not-allowed" : "pointer",
                        fontFamily: dmSans,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        padding: "4px 6px",
                      }}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      title="Move down"
                      disabled={index >= questions.length - 1}
                      onClick={() => moveQuestion(q.id, 1)}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "6px",
                        backgroundColor: "#FFFFFF",
                        color:
                          index >= questions.length - 1 ? "#D1D5DB" : muted,
                        cursor:
                          index >= questions.length - 1
                            ? "not-allowed"
                            : "pointer",
                        fontFamily: dmSans,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        padding: "4px 6px",
                      }}
                    >
                      Down
                    </button>
                  </div>
                  <div
                    style={{
                      minWidth: "28px",
                      color: muted,
                      fontFamily: dmSans,
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      paddingTop: "2px",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      {q.source === "ai" ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontFamily: dmSans,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            backgroundColor: "#ECFDF3",
                            color: "#166534",
                          }}
                        >
                          AI suggested
                        </span>
                      ) : q.source === "user" ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontFamily: dmSans,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            backgroundColor: "#F3F4F6",
                            color: "#6B7280",
                          }}
                        >
                          Added by you
                        </span>
                      ) : null}
                    </div>
                    <p
                      style={{
                        margin: "0 0 8px",
                        color: bodyDark,
                        fontFamily: georgia,
                        fontSize: "1rem",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {q.text}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontFamily: dmSans,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          ...qTypeBadgeStyle(),
                        }}
                      >
                        {QUESTION_TYPE_BADGES[q.type] || q.type}
                      </span>
                      <span
                        style={{
                          fontFamily: dmSans,
                          fontSize: "0.78rem",
                          color: muted,
                        }}
                      >
                        Required: {q.required ? "yes" : "no"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "12px",
                        alignItems: "center",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRequired(q.id)}
                        style={{
                          border: "none",
                          background: "none",
                          padding: 0,
                          color: green,
                          fontFamily: dmSans,
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Toggle required
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditQuestion(q)}
                        style={{
                          border: "none",
                          background: "none",
                          padding: 0,
                          color: green,
                          fontFamily: dmSans,
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteQuestion(q.id)}
                        style={{
                          border: "none",
                          background: "none",
                          padding: 0,
                          color: "#B91C1C",
                          fontFamily: dmSans,
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          {!showQuestionForm ? (
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={openAddQuestionForm}
                style={{
                  cursor: "pointer",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: `2px solid ${green}`,
                  backgroundColor: "#FFFFFF",
                  color: green,
                  fontFamily: dmSans,
                  fontWeight: 600,
                }}
              >
                Add question
              </button>
            </div>
          ) : (
            <div
              style={{
                marginTop: "8px",
                padding: "18px",
                borderRadius: "10px",
                border: "1px solid #A8D4AA",
                backgroundColor: "#FAF9F7",
              }}
            >
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={labelStyle}>Question text</span>
                <textarea
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", minHeight: "72px" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "14px" }}>
                <span style={labelStyle}>Question type</span>
                <select
                  value={qType}
                  onChange={(e) => {
                    setQType(e.target.value);
                    if (e.target.value !== "multiple_choice") {
                      setQOptions([]);
                    }
                  }}
                  style={inputStyle}
                >
                  {QUESTION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {qType === "multiple_choice" ? (
                <div style={{ marginBottom: "14px" }}>
                  <span style={labelStyle}>Answer options</span>
                  {qOptions.length > 0 ? (
                    <ul
                      style={{
                        margin: "0 0 10px",
                        paddingLeft: "20px",
                        fontFamily: dmSans,
                        fontSize: "0.9rem",
                        color: bodyDark,
                      }}
                    >
                      {qOptions.map((opt, i) => (
                        <li key={`${i}-${opt}`}>{opt}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      placeholder="Option text"
                      style={{ ...inputStyle, flex: "1 1 160px" }}
                    />
                    <button
                      type="button"
                      onClick={addMcOption}
                      style={{
                        cursor: "pointer",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: `1px solid ${green}`,
                        backgroundColor: "#FFFFFF",
                        color: green,
                        fontFamily: dmSans,
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      Add option
                    </button>
                  </div>
                </div>
              ) : null}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "16px",
                  fontFamily: dmSans,
                  fontSize: "0.92rem",
                  color: bodyDark,
                }}
              >
                <input
                  type="checkbox"
                  checked={qRequired}
                  onChange={(e) => setQRequired(e.target.checked)}
                />
                Required?
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button
                  type="button"
                  onClick={saveQuestionFromForm}
                  style={{
                    cursor: "pointer",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: green,
                    color: "#FFFFFF",
                    fontFamily: dmSans,
                    fontWeight: 600,
                  }}
                >
                  Save question
                </button>
                <button
                  type="button"
                  onClick={cancelQuestionForm}
                  style={{
                    cursor: "pointer",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: `1px solid ${muted}`,
                    backgroundColor: "#FFFFFF",
                    color: muted,
                    fontFamily: dmSans,
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <section
          style={{
            marginBottom: "24px",
            textAlign: "left",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "22px",
          }}
        >
          <h2
            style={{
              margin: "0 0 12px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.2rem",
              textAlign: "center",
            }}
          >
            Consent language
          </h2>
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <DraftLabel />
          </div>
          <textarea
            value={consentLanguage}
            onChange={(e) => setConsentLanguage(e.target.value)}
            rows={8}
            placeholder="Consent language will appear here after suggestions load. You can edit it directly."
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: "160px",
              marginBottom: "10px",
            }}
          />
          <p
            style={{
              margin: 0,
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.82rem",
              lineHeight: 1.5,
            }}
          >
            This consent language must be reviewed and adapted by staff before
            use.
          </p>
        </section>

        <section
          style={{
            marginBottom: "28px",
            textAlign: "left",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "22px",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.2rem",
              textAlign: "center",
            }}
          >
            Before you launch
          </h2>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "12px",
              fontFamily: dmSans,
              fontSize: "0.92rem",
              color: bodyDark,
              lineHeight: 1.45,
            }}
          >
            <input
              type="checkbox"
              checked={govConsent}
              onChange={(e) => setGovConsent(e.target.checked)}
              style={{ marginTop: "4px" }}
            />
            Consent language has been reviewed and adapted by staff
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "12px",
              fontFamily: dmSans,
              fontSize: "0.92rem",
              color: bodyDark,
              lineHeight: 1.45,
            }}
          >
            <input
              type="checkbox"
              checked={govShare}
              onChange={(e) => setGovShare(e.target.checked)}
              style={{ marginTop: "4px" }}
            />
            We have a plan for sharing findings back with community members
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              marginBottom: "4px",
              fontFamily: dmSans,
              fontSize: "0.92rem",
              color: bodyDark,
              lineHeight: 1.45,
            }}
          >
            <input
              type="checkbox"
              checked={govData}
              onChange={(e) => setGovData(e.target.checked)}
              style={{ marginTop: "4px" }}
            />
            We know which staff members can access responses in Rootwork, and
            have a plan for how data will be handled if it is exported or shared
            outside the platform
          </label>
        </section>

        {!collectionToolId ? (
          <p
            style={{
              textAlign: "center",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              marginBottom: "12px",
            }}
          >
            Save a draft at least once before launch.
          </p>
        ) : (
          <p
            style={{
              textAlign: "center",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.85rem",
              marginBottom: "12px",
            }}
          >
            After you check all three governance boxes, click Save draft so
            launch can read them from the server.
          </p>
        )}

        {saveError ? (
          <p
            style={{
              color: "#B91C1C",
              fontFamily: dmSans,
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {saveError}
          </p>
        ) : null}
        {launchError ? (
          <p
            style={{
              color: "#B91C1C",
              fontFamily: dmSans,
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {launchError}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            justifyContent: "center",
            marginBottom: "24px",
          }}
        >
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveDraft}
            style={{
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.75 : 1,
              padding: "12px 22px",
              borderRadius: "8px",
              border: `2px solid ${green}`,
              backgroundColor: "#FFFFFF",
              color: green,
              fontFamily: dmSans,
              fontWeight: 600,
            }}
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={launchDisabled}
            onClick={handleLaunch}
            style={{
              cursor: launchDisabled ? "not-allowed" : "pointer",
              opacity: launchDisabled ? 0.55 : 1,
              padding: "12px 22px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: green,
              color: "#FFFFFF",
              fontFamily: dmSans,
              fontWeight: 600,
            }}
          >
            Launch tool
          </button>
        </div>

        <p style={{ textAlign: "center", margin: 0 }}>
          <Link
            to="/stage03/tools"
            style={{
              color: green,
              fontFamily: dmSans,
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Back to your collection tools
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Builder;
