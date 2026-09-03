import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import RootsLoader from "../../components/RootsLoader";
import Stage03PrerequisiteGate from "../../components/Stage03PrerequisiteGate";
import Stage03TierUpgradePrompt from "../../components/Stage03TierUpgradePrompt";
import {
  isPrerequisiteGateKind,
  parseStage03GateResponse,
} from "../../lib/stage03GateResponse";
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

const DISPLAY_IF_OPERATOR_OPTIONS = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "answered", label: "was answered" },
  { value: "not_answered", label: "was not answered" },
];

const DISPLAY_IF_OPS = new Set([
  "equals",
  "not_equals",
  "answered",
  "not_answered",
]);

const DEFAULT_TOOL_LANGUAGES = ["en", "es"];

const LANGUAGE_LABELS = {
  en: "English",
  es: "Spanish",
};

function languageLabel(code) {
  return LANGUAGE_LABELS[code] || code;
}

function normalizeToolLanguages(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_TOOL_LANGUAGES];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const code = item.trim().toLowerCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  if (!seen.has("en")) out.unshift("en");
  return out.length > 0 ? out : [...DEFAULT_TOOL_LANGUAGES];
}

function emptyLangMap(languages) {
  const m = {};
  for (const lang of languages) m[lang] = "";
  return m;
}

function readLocalizedMap(raw) {
  if (typeof raw === "string") {
    const en = raw.trim();
    return en ? { en } : {};
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out = {};
    for (const [lang, val] of Object.entries(raw)) {
      if (typeof lang !== "string") continue;
      const key = lang.trim();
      if (!key || typeof val !== "string") continue;
      const trimmed = val.trim();
      if (trimmed) out[key] = trimmed;
    }
    return out;
  }
  return {};
}

function localizedEn(raw) {
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && typeof raw.en === "string") {
    return raw.en.trim();
  }
  return "";
}

function questionTextEn(q) {
  return localizedEn(q?.text);
}

function optionLabelEn(opt) {
  if (typeof opt === "string") return opt.trim();
  return localizedEn(opt?.label);
}

function optionIdOf(opt) {
  if (opt && typeof opt === "object" && typeof opt.id === "string") {
    return opt.id.trim();
  }
  return "";
}

function hasSpanishTranslation(q) {
  const text = q?.text;
  if (
    text &&
    typeof text === "object" &&
    typeof text.es === "string" &&
    text.es.trim()
  ) {
    return true;
  }
  if (Array.isArray(q?.options)) {
    for (const opt of q.options) {
      const es = opt && typeof opt === "object" ? opt.label?.es : null;
      if (typeof es === "string" && es.trim()) return true;
    }
  }
  return false;
}

function normalizeClientOption(o) {
  if (typeof o === "string") {
    const en = o.trim();
    if (!en) return null;
    return { label: { en } };
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const label = readLocalizedMap(o.label);
  if (!localizedEn(label)) return null;
  const row = { label };
  if (typeof o.id === "string" && o.id.trim()) {
    row.id = o.id.trim();
  }
  return row;
}

function remapDisplayIfValue(value, refQuestion) {
  if (!value || !refQuestion || refQuestion.type !== "multiple_choice") {
    return value;
  }
  const opts = Array.isArray(refQuestion.options) ? refQuestion.options : [];
  if (opts.some((o) => optionIdOf(o) === value)) return value;
  for (const o of opts) {
    const id = optionIdOf(o);
    if (id && optionLabelEn(o) === value) return id;
  }
  return value;
}

function normalizeClientQuestion(q, fallbackId) {
  const id =
    typeof q?.id === "string" && q.id.trim()
      ? q.id.trim()
      : fallbackId || newId();
  const text = readLocalizedMap(
    q?.text != null ? q.text : q?.questionText
  );
  if (!localizedEn(text)) return null;
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
    row.options = q.options.map(normalizeClientOption).filter(Boolean);
  }
  if (q.source === "ai" || q.source === "user") {
    row.source = q.source;
  }
  if (typeof q.rationale === "string" && q.rationale.trim()) {
    row.rationale = q.rationale.trim();
  }
  if (q.display_if && typeof q.display_if === "object" && !Array.isArray(q.display_if)) {
    row.display_if = q.display_if;
  }
  return row;
}

function normalizeClientQuestions(rawQs) {
  const mapped = (Array.isArray(rawQs) ? rawQs : [])
    .map((q) => normalizeClientQuestion(q))
    .filter(Boolean);
  return mapped.map((q) => {
    const raw = q.display_if;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      if ("display_if" in q) {
        const { display_if: _drop, ...rest } = q;
        return rest;
      }
      return q;
    }
    const question_id =
      typeof raw.question_id === "string" ? raw.question_id.trim() : "";
    const operator =
      typeof raw.operator === "string" ? raw.operator.trim() : "";
    if (!question_id || !DISPLAY_IF_OPS.has(operator)) {
      const { display_if: _drop, ...rest } = q;
      return rest;
    }
    const display_if = { question_id, operator };
    if (operator === "equals" || operator === "not_equals") {
      let value = typeof raw.value === "string" ? raw.value.trim() : "";
      if (!value) {
        const { display_if: _drop, ...rest } = q;
        return rest;
      }
      const ref = mapped.find((x) => x.id === question_id);
      display_if.value = remapDisplayIfValue(value, ref);
    }
    return { ...q, display_if };
  });
}

// Structural read for move/delete/type guards (question id only).
function readDisplayIf(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const question_id =
    typeof raw.question_id === "string" ? raw.question_id.trim() : "";
  const operator =
    typeof raw.operator === "string" ? raw.operator.trim() : "";
  if (!question_id || !DISPLAY_IF_OPS.has(operator)) return null;
  if (operator === "equals" || operator === "not_equals") {
    const value = typeof raw.value === "string" ? raw.value.trim() : "";
    if (!value) return null;
    return { question_id, operator, value };
  }
  return { question_id, operator };
}

// Strict parse for payloads: equals/not_equals value must be an option id on
// the referenced question when questions are provided.
function parseDisplayIf(raw, questions) {
  const base = readDisplayIf(raw);
  if (!base) return null;
  if (
    (base.operator === "equals" || base.operator === "not_equals") &&
    Array.isArray(questions)
  ) {
    const ref = questions.find((q) => q.id === base.question_id);
    if (!ref || ref.type !== "multiple_choice") return null;
    const opts = Array.isArray(ref.options) ? ref.options : [];
    if (!opts.some((o) => optionIdOf(o) === base.value)) return null;
  }
  return base;
}

function getDependentsOnQuestion(questions, targetId) {
  return questions.filter((q) => {
    const di = readDisplayIf(q.display_if);
    return di && di.question_id === targetId;
  });
}

function dependentQuestionNames(dependents) {
  return dependents
    .map((q) => questionTextEn(q) || q.id)
    .join("; ");
}

function simulateQuestionSwap(questions, i, j) {
  const next = [...questions];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function getMoveBlockReason(questions, id, delta) {
  const i = questions.findIndex((q) => q.id === id);
  if (i < 0) return null;
  const j = i + delta;
  if (j < 0 || j >= questions.length) return null;

  const next = simulateQuestionSwap(questions, i, j);
  const movedIdx = j;
  const movedId = questions[i].id;

  const dep = readDisplayIf(questions[i].display_if);
  if (dep) {
    const refIdx = next.findIndex((q) => q.id === dep.question_id);
    if (refIdx >= 0 && refIdx >= movedIdx) {
      const ref = next[refIdx];
      const refName = questionTextEn(ref) || ref.id;
      return `Cannot move this question before "${refName}", which it depends on.`;
    }
  }

  const dependents = getDependentsOnQuestion(questions, movedId);
  const blocked = dependents.filter((d) => {
    const depIdx = next.findIndex((q) => q.id === d.id);
    return depIdx >= 0 && depIdx <= movedIdx;
  });
  if (blocked.length > 0) {
    return `Cannot move this question after questions that depend on it: ${dependentQuestionNames(blocked)}`;
  }

  return null;
}

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

const LAUNCH_CHECKLIST_ITEMS = [
  {
    key: "pilot_confirmed",
    confirmLabel: "Pilot confirmed",
    detailLabel: "Who did you pilot this with?",
    detailPlaceholder: "Name the people or group who tried this before launch.",
  },
  {
    key: "staff_trained",
    confirmLabel: "Staff trained",
    detailLabel: "Who will administer this, and how were they prepared?",
    detailPlaceholder: "Name who will run it and how they were prepared.",
  },
  {
    key: "community_informed",
    confirmLabel: "Community informed",
    detailLabel:
      "How did you tell the community what you are collecting and why?",
    detailPlaceholder: "Describe how you informed the community.",
  },
];

function emptyLaunchChecklist() {
  return {
    pilot_confirmed: { confirmed: false, detail: "" },
    staff_trained: { confirmed: false, detail: "" },
    community_informed: { confirmed: false, detail: "" },
  };
}

function readLaunchChecklistFromConfig(cfg) {
  const raw =
    cfg &&
    typeof cfg === "object" &&
    cfg.launch_checklist &&
    typeof cfg.launch_checklist === "object" &&
    !Array.isArray(cfg.launch_checklist)
      ? cfg.launch_checklist
      : {};
  const next = emptyLaunchChecklist();
  for (const key of Object.keys(next)) {
    const item =
      raw[key] && typeof raw[key] === "object" && !Array.isArray(raw[key])
        ? raw[key]
        : {};
    next[key] = {
      confirmed: Boolean(item.confirmed),
      detail: typeof item.detail === "string" ? item.detail : "",
    };
  }
  return next;
}

function isLaunchChecklistItemComplete(item) {
  if (!item || typeof item !== "object") return false;
  return Boolean(item.confirmed) && String(item.detail || "").trim().length > 0;
}

function isLaunchChecklistComplete(checklist) {
  if (!checklist || typeof checklist !== "object") return false;
  return LAUNCH_CHECKLIST_ITEMS.every((item) =>
    isLaunchChecklistItemComplete(checklist[item.key])
  );
}

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
  const [toolLanguages, setToolLanguages] = useState(DEFAULT_TOOL_LANGUAGES);
  const [qTextByLang, setQTextByLang] = useState(() =>
    emptyLangMap(DEFAULT_TOOL_LANGUAGES)
  );
  const [qType, setQType] = useState("short_text");
  const [qRequired, setQRequired] = useState(true);
  const [qOptions, setQOptions] = useState([]);
  const [newOptionByLang, setNewOptionByLang] = useState(() =>
    emptyLangMap(DEFAULT_TOOL_LANGUAGES)
  );
  const [showConditionSection, setShowConditionSection] = useState(false);
  const [qCondRefId, setQCondRefId] = useState("");
  const [qCondOp, setQCondOp] = useState("equals");
  const [qCondValue, setQCondValue] = useState("");
  const [qTextError, setQTextError] = useState("");
  const [formBlockMessage, setFormBlockMessage] = useState("");
  const [questionErrors, setQuestionErrors] = useState({});
  const [deleteBlockMessage, setDeleteBlockMessage] = useState("");

  const [consentByLang, setConsentByLang] = useState(() =>
    emptyLangMap(DEFAULT_TOOL_LANGUAGES)
  );

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
  const [launchChecklist, setLaunchChecklist] = useState(() =>
    emptyLaunchChecklist()
  );
  const [checklistErrors, setChecklistErrors] = useState({});

  const [saveError, setSaveError] = useState("");
  const [launchError, setLaunchError] = useState("");
  const [prerequisiteGate, setPrerequisiteGate] = useState(null);
  const [tierNotice, setTierNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [responseRows, setResponseRows] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [responsesError, setResponsesError] = useState("");
  const [deletingResponseId, setDeletingResponseId] = useState("");

  useEffect(() => {
    const tid = (searchParams.get("tool_id") || "").trim();
    setToolName(initialFromUrl.tool_name);
    setToolType(initialFromUrl.tool_type);
    setSurveyPurpose(initialFromUrl.survey_purpose || "");
    if (!tid) {
      setQuestions([]);
      setCollectionToolId(null);
      setLaunchChecklist(emptyLaunchChecklist());
      setChecklistErrors({});
    }
  }, [
    searchParams.toString(),
    initialFromUrl.tool_name,
    initialFromUrl.tool_type,
    initialFromUrl.survey_purpose,
  ]);

  const toolIdFromUrl = searchParams.get("tool_id")?.trim() || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: membership } = await supabase
          .from("org_members")
          .select("org_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (!membership?.org_id || cancelled) return;
        const { data: org } = await supabase
          .from("organizations")
          .select("languages_served")
          .eq("id", membership.org_id)
          .maybeSingle();
        if (cancelled || !org) return;
        setToolLanguages(normalizeToolLanguages(org.languages_served));
      } catch {
        /* keep default languages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (!response.ok) {
          if (!cancelled) {
            const parsed = parseStage03GateResponse(response, body);
            if (isPrerequisiteGateKind(parsed.kind)) {
              setPrerequisiteGate(parsed);
            }
          }
          return;
        }
        if (cancelled) return;
        const tools = Array.isArray(body?.tools) ? body.tools : [];
        const tool = tools.find((t) => t.id === toolIdFromUrl);
        if (!tool || cancelled) return;
        const cfg =
          tool.configuration && typeof tool.configuration === "object"
            ? tool.configuration
            : {};
        const mapped = normalizeClientQuestions(cfg.questions);
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
        setConsentByLang(() => {
          const next = emptyLangMap(DEFAULT_TOOL_LANGUAGES);
          let parsed = {};
          if (typeof tool.consent_language === "string") {
            const t = tool.consent_language.trim();
            if (t.startsWith("{")) {
              try {
                parsed = JSON.parse(t);
              } catch {
                parsed = { en: t };
              }
            } else if (t) {
              parsed = { en: t };
            }
          } else if (
            tool.consent_language &&
            typeof tool.consent_language === "object"
          ) {
            parsed = tool.consent_language;
          }
          for (const [lang, val] of Object.entries(parsed)) {
            if (typeof val === "string") next[lang] = val;
          }
          return next;
        });
        setGovConsent(Boolean(gc.consent_reviewed));
        setGovShare(Boolean(gc.shareback_plan));
        setGovData(Boolean(gc.data_storage));
        setLaunchChecklist(readLaunchChecklistFromConfig(cfg));
        setChecklistErrors({});
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
          const parsed = parseStage03GateResponse(response, err);
          if (isPrerequisiteGateKind(parsed.kind)) {
            setPrerequisiteGate(parsed);
          } else if (parsed.kind === "tier") {
            setTierNotice(parsed.message);
          } else {
            setSuggestError(parsed.message);
          }
          setIsLoadingSuggestions(false);
          return;
        }
        const data = await response.json();
        if (cancelled) {
          setIsLoadingSuggestions(false);
          return;
        }
        const withIds = normalizeClientQuestions(data?.questions).map((q) => ({
          ...q,
          id: newId(),
          source: "ai",
        }));
        setQuestions(withIds);
        setConsentByLang(() => {
          const next = emptyLangMap(DEFAULT_TOOL_LANGUAGES);
          if (typeof data.consent_language === "object" && data.consent_language) {
            for (const [lang, val] of Object.entries(data.consent_language)) {
              if (typeof val === "string") next[lang] = val;
            }
          } else if (typeof data.consent_text === "string" && data.consent_text.trim()) {
            next.en = data.consent_text.trim();
          }
          return next;
        });
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
    setQTextByLang(emptyLangMap(toolLanguages));
    setQType("short_text");
    setQRequired(true);
    setQOptions([]);
    setNewOptionByLang(emptyLangMap(toolLanguages));
    setShowConditionSection(false);
    setQCondRefId("");
    setQCondOp("equals");
    setQCondValue("");
    setQTextError("");
    setFormBlockMessage("");
    setShowQuestionForm(true);
  }

  function openEditQuestion(q) {
    setEditingQuestionId(q.id);
    const textMap = emptyLangMap(toolLanguages);
    const existingText = readLocalizedMap(q.text);
    for (const lang of toolLanguages) {
      if (typeof existingText[lang] === "string") {
        textMap[lang] = existingText[lang];
      }
    }
    setQTextByLang(textMap);
    setQType(q.type);
    setQRequired(Boolean(q.required));
    setQOptions(
      Array.isArray(q.options)
        ? q.options.map((o) => {
            const normalized = normalizeClientOption(o);
            if (!normalized) return { label: emptyLangMap(toolLanguages) };
            const label = emptyLangMap(toolLanguages);
            for (const lang of toolLanguages) {
              if (typeof normalized.label[lang] === "string") {
                label[lang] = normalized.label[lang];
              }
            }
            return normalized.id
              ? { id: normalized.id, label }
              : { label };
          })
        : []
    );
    setNewOptionByLang(emptyLangMap(toolLanguages));
    const di = readDisplayIf(q.display_if);
    if (di) {
      setShowConditionSection(true);
      setQCondRefId(di.question_id);
      setQCondOp(di.operator);
      setQCondValue(typeof di.value === "string" ? di.value : "");
    } else {
      setShowConditionSection(false);
      setQCondRefId("");
      setQCondOp("equals");
      setQCondValue("");
    }
    setQTextError("");
    setFormBlockMessage("");
    setShowQuestionForm(true);
  }

  function cancelQuestionForm() {
    setShowQuestionForm(false);
    setEditingQuestionId(null);
    setQTextByLang(emptyLangMap(toolLanguages));
    setQOptions([]);
    setNewOptionByLang(emptyLangMap(toolLanguages));
    setShowConditionSection(false);
    setQCondRefId("");
    setQCondOp("equals");
    setQCondValue("");
    setQTextError("");
    setFormBlockMessage("");
  }

  function saveQuestionFromForm() {
    const enText = (qTextByLang.en || "").trim();
    if (!enText) {
      setQTextError("English question text cannot be empty.");
      return;
    }
    setQTextError("");
    setFormBlockMessage("");

    if (editingQuestionId) {
      const editIdx = questions.findIndex((q) => q.id === editingQuestionId);
      const original = editIdx >= 0 ? questions[editIdx] : null;
      if (original) {
        const later = questions.slice(editIdx + 1);
        if (
          original.type === "multiple_choice" &&
          qType !== "multiple_choice"
        ) {
          const blocked = later.filter((q) => {
            const di = readDisplayIf(q.display_if);
            return (
              di &&
              di.question_id === editingQuestionId &&
              (di.operator === "equals" || di.operator === "not_equals")
            );
          });
          if (blocked.length > 0) {
            setFormBlockMessage(
              `Cannot change type. These questions use answer conditions on this question: ${dependentQuestionNames(blocked)}`
            );
            return;
          }
        }
        if (original.type === "multiple_choice" && qType === "multiple_choice") {
          const oldIds = (Array.isArray(original.options) ? original.options : [])
            .map(optionIdOf)
            .filter(Boolean);
          const newIds = new Set(qOptions.map(optionIdOf).filter(Boolean));
          const removedIds = oldIds.filter((id) => !newIds.has(id));
          if (removedIds.length > 0) {
            const blocked = [];
            const seen = new Set();
            for (const q of later) {
              const di = readDisplayIf(q.display_if);
              if (
                di &&
                di.question_id === editingQuestionId &&
                removedIds.includes(di.value) &&
                !seen.has(q.id)
              ) {
                seen.add(q.id);
                blocked.push(q);
              }
            }
            if (blocked.length > 0) {
              setFormBlockMessage(
                `Cannot remove these options. These questions depend on them: ${dependentQuestionNames(blocked)}`
              );
              return;
            }
          }
        }
      }
    }

    const text = {};
    for (const lang of toolLanguages) {
      const v = (qTextByLang[lang] || "").trim();
      if (v) text[lang] = v;
    }
    if (!text.en) {
      setQTextError("English question text cannot be empty.");
      return;
    }

    const base = {
      id: editingQuestionId || newId(),
      text,
      type: qType,
      required: qRequired,
    };
    if (qType === "multiple_choice") {
      base.options = qOptions
        .map((opt) => {
          const label = {};
          const rawLabel =
            opt && typeof opt === "object" ? opt.label || {} : {};
          for (const lang of toolLanguages) {
            const v = (rawLabel[lang] || "").trim();
            if (v) label[lang] = v;
          }
          if (!label.en) return null;
          const row = { label };
          if (typeof opt?.id === "string" && opt.id.trim()) {
            row.id = opt.id.trim();
          }
          return row;
        })
        .filter(Boolean);
    }
    if (qCondRefId.trim()) {
      const display_if = {
        question_id: qCondRefId.trim(),
        operator: qCondOp,
      };
      if (qCondOp === "equals" || qCondOp === "not_equals") {
        const value = qCondValue.trim();
        if (value) display_if.value = value;
      }
      base.display_if = display_if;
    }
    if (editingQuestionId) {
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== editingQuestionId) return q;
          const next = { ...base };
          if (q.source === "user") next.source = "user";
          if (typeof q.rationale === "string" && q.rationale.trim()) {
            next.rationale = q.rationale;
          }
          return next;
        })
      );
    } else {
      setQuestions((prev) => [...prev, { ...base, source: "user" }]);
    }
    cancelQuestionForm();
  }

  function moveQuestion(id, delta) {
    const reason = getMoveBlockReason(questions, id, delta);
    if (reason) {
      setDeleteBlockMessage(reason);
      return;
    }
    setDeleteBlockMessage("");
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
    const dependents = getDependentsOnQuestion(questions, id);
    if (dependents.length > 0) {
      setDeleteBlockMessage(
        `Cannot delete this question. These questions depend on it: ${dependentQuestionNames(dependents)}`
      );
      return;
    }
    setDeleteBlockMessage("");
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
    const en = (newOptionByLang.en || "").trim();
    if (!en) return;
    const label = {};
    for (const lang of toolLanguages) {
      const v = (newOptionByLang[lang] || "").trim();
      if (v) label[lang] = v;
    }
    if (!label.en) return;
    setQOptions((o) => [...o, { label }]);
    setNewOptionByLang(emptyLangMap(toolLanguages));
  }

  function updateOptionLabel(index, lang, value) {
    setQOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== index) return opt;
        return {
          ...opt,
          label: {
            ...(opt.label || {}),
            [lang]: value,
          },
        };
      })
    );
  }

  function removeMcOption(index) {
    setQOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const payloadBody = useCallback(() => {
    return {
      tool_id: collectionToolId || undefined,
      tool_name: toolName.trim(),
      tool_type: toolType,
      who_completes: whoCompletes,
      questions: questions.map((q) => {
        const row = {
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
        };
        const display_if = parseDisplayIf(q.display_if, questions);
        if (display_if) {
          row.display_if = display_if;
        }
        return row;
      }),
      consent_language: (() => {
        const map = {};
        for (const lang of toolLanguages) {
          const v = (consentByLang[lang] || "").trim();
          if (v) map[lang] = v;
        }
        if (!map.en && (consentByLang.en || "").trim()) {
          map.en = consentByLang.en.trim();
        }
        return map;
      })(),
      governance_checks: {
        consent_reviewed: govConsent,
        shareback_plan: govShare,
        data_storage: govData,
      },
      launch_checklist: {
        pilot_confirmed: {
          confirmed: Boolean(launchChecklist.pilot_confirmed?.confirmed),
          detail:
            typeof launchChecklist.pilot_confirmed?.detail === "string"
              ? launchChecklist.pilot_confirmed.detail
              : "",
        },
        staff_trained: {
          confirmed: Boolean(launchChecklist.staff_trained?.confirmed),
          detail:
            typeof launchChecklist.staff_trained?.detail === "string"
              ? launchChecklist.staff_trained.detail
              : "",
        },
        community_informed: {
          confirmed: Boolean(launchChecklist.community_informed?.confirmed),
          detail:
            typeof launchChecklist.community_informed?.detail === "string"
              ? launchChecklist.community_informed.detail
              : "",
        },
      },
    };
  }, [
    collectionToolId,
    toolName,
    toolType,
    whoCompletes,
    questions,
    consentByLang,
    toolLanguages,
    govConsent,
    govShare,
    govData,
    launchChecklist,
  ]);

  async function downloadAuthorizedFile(path) {
    const token = await getToken();
    if (!token) {
      setSaveError("Your session has expired. Please sign in again.");
      return;
    }
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body?.error === "string" && body.error.trim()
          ? body.error
          : "Download failed."
      );
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : "download";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadInstrument(lang) {
    if (!collectionToolId) return;
    setSaveError("");
    try {
      await downloadAuthorizedFile(
        `/api/stage03/tools/${encodeURIComponent(collectionToolId)}/download-instrument?lang=${encodeURIComponent(lang)}`
      );
    } catch (e) {
      setSaveError(e.message || "Could not download instrument.");
    }
  }

  async function handleDownloadResponses() {
    if (!collectionToolId) return;
    setSaveError("");
    try {
      await downloadAuthorizedFile(
        `/api/stage03/tools/${encodeURIComponent(collectionToolId)}/download-responses`
      );
    } catch (e) {
      setSaveError(e.message || "Could not download responses.");
    }
  }

  async function loadResponseRows(toolId) {
    const id = typeof toolId === "string" ? toolId.trim() : "";
    if (!id) {
      setResponseRows([]);
      return;
    }
    setResponsesLoading(true);
    setResponsesError("");
    try {
      const token = await getToken();
      if (!token) {
        setResponsesError("Your session has expired. Please sign in again.");
        setResponseRows([]);
        return;
      }
      const response = await fetch(
        `${apiBaseUrl}/api/stage03/tools/${encodeURIComponent(id)}/responses`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const parsed = parseStage03GateResponse(response, body);
        setResponsesError(parsed.message || "Could not load responses.");
        setResponseRows([]);
        return;
      }
      const list = Array.isArray(body?.responses) ? body.responses : [];
      setResponseRows(
        list.filter(
          (r) => r && typeof r === "object" && typeof r.id === "string"
        )
      );
    } catch {
      setResponsesError("Could not load responses.");
      setResponseRows([]);
    } finally {
      setResponsesLoading(false);
    }
  }

  async function handleDeleteResponse(responseId) {
    if (!collectionToolId || !responseId || deletingResponseId) return;
    const confirmed = window.confirm(
      "Delete this response permanently? This cannot be undone."
    );
    if (!confirmed) return;
    setDeletingResponseId(responseId);
    setResponsesError("");
    try {
      const token = await getToken();
      if (!token) {
        setResponsesError("Your session has expired. Please sign in again.");
        return;
      }
      const response = await fetch(
        `${apiBaseUrl}/api/stage03/tools/${encodeURIComponent(collectionToolId)}/responses/${encodeURIComponent(responseId)}/delete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const parsed = parseStage03GateResponse(response, body);
        setResponsesError(parsed.message || "Could not delete response.");
        return;
      }
      setResponseRows((prev) => prev.filter((r) => r.id !== responseId));
    } catch {
      setResponsesError("Could not delete response.");
    } finally {
      setDeletingResponseId("");
    }
  }

  useEffect(() => {
    if (!collectionToolId) {
      setResponseRows([]);
      setResponsesError("");
      return;
    }
    loadResponseRows(collectionToolId);
    // Intentionally keyed only on tool id; refresh after delete is local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionToolId]);

  async function handleSaveDraft() {
    setSaveError("");
    setTierNotice("");
    setQuestionErrors({});
    setDeleteBlockMessage("");
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
    if (showQuestionForm && !(qTextByLang.en || "").trim()) {
      setQTextError("English question text cannot be empty.");
      setSaving(false);
      return;
    }
    const blankMap = {};
    for (const q of questions) {
      if (!questionTextEn(q)) {
        blankMap[q.id] = "Question text cannot be empty.";
      }
    }
    if (Object.keys(blankMap).length > 0) {
      setQuestionErrors(blankMap);
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
        const errs = Array.isArray(body?.errors) ? body.errors : [];
        if (errs.length > 0) {
          const map = {};
          for (const e of errs) {
            if (typeof e?.question_id === "string" && e.question_id.trim()) {
              map[e.question_id.trim()] =
                typeof e.error === "string" && e.error.trim()
                  ? e.error.trim()
                  : "Invalid question.";
            }
          }
          if (Object.keys(map).length > 0) {
            setQuestionErrors(map);
            setSaving(false);
            return;
          }
        }
        const parsed = parseStage03GateResponse(response, body);
        if (parsed.kind === "tier") {
          setTierNotice(parsed.message);
          setSaving(false);
          return;
        }
        setSaveError(parsed.message);
        setSaving(false);
        return;
      }
      setQuestionErrors({});
      if (body?.tool?.id) {
        setCollectionToolId(body.tool.id);
      }
      const savedCfg =
        body?.tool?.configuration &&
        typeof body.tool.configuration === "object"
          ? body.tool.configuration
          : null;
      if (savedCfg && Array.isArray(savedCfg.questions)) {
        setQuestions(normalizeClientQuestions(savedCfg.questions));
      }
    } catch (e) {
      setSaveError(e.message || "Could not save draft.");
    } finally {
      setSaving(false);
    }
  }

  const governanceReady = govConsent && govShare && govData;
  const checklistReady = isLaunchChecklistComplete(launchChecklist);
  const launchDisabled =
    !governanceReady ||
    !checklistReady ||
    !collectionToolId ||
    launching ||
    saving;

  async function handleLaunch() {
    setLaunchError("");
    setTierNotice("");
    setChecklistErrors({});
    if (!collectionToolId) {
      setLaunchError("Save a draft first so this tool has an id.");
      return;
    }
    if (!governanceReady) {
      setLaunchError("Confirm all governance items before launch.");
      return;
    }
    if (!checklistReady) {
      const map = {};
      for (const item of LAUNCH_CHECKLIST_ITEMS) {
        if (!isLaunchChecklistItemComplete(launchChecklist[item.key])) {
          map[item.key] =
            "Confirm this item and add a short answer. Whitespace alone is not enough.";
        }
      }
      setChecklistErrors(map);
      setLaunchError("Complete the launch checklist before launch.");
      return;
    }
    if (!(consentByLang.en || "").trim()) {
      setLaunchError("Add English consent language before launch.");
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
      // Persist checklist (and the rest of the draft) before the launch gate
      // reads configuration from the database.
      const saveResponse = await fetch(`${apiBaseUrl}/api/stage03/save-tool`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadBody()),
      });
      const saveBody = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) {
        const parsed = parseStage03GateResponse(saveResponse, saveBody);
        if (parsed.kind === "tier") {
          setTierNotice(parsed.message);
        } else {
          setLaunchError(parsed.message);
        }
        setLaunching(false);
        return;
      }
      if (saveBody?.tool?.id) {
        setCollectionToolId(saveBody.tool.id);
      }

      const response = await fetch(`${apiBaseUrl}/api/stage03/launch-tool`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: saveBody?.tool?.id || collectionToolId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errs = Array.isArray(body?.errors) ? body.errors : [];
        if (errs.length > 0) {
          const map = {};
          for (const e of errs) {
            if (typeof e?.item === "string" && e.item.trim()) {
              map[e.item.trim()] =
                typeof e.error === "string" && e.error.trim()
                  ? e.error.trim()
                  : "Incomplete.";
            }
          }
          if (Object.keys(map).length > 0) {
            setChecklistErrors(map);
          }
        }
        const parsed = parseStage03GateResponse(response, body);
        if (parsed.kind === "tier") {
          setTierNotice(parsed.message);
        } else {
          setLaunchError(parsed.message);
        }
        setLaunching(false);
        return;
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

  const priorQuestionsForForm = (() => {
    if (editingQuestionId) {
      const idx = questions.findIndex((q) => q.id === editingQuestionId);
      return idx >= 0 ? questions.slice(0, idx) : questions;
    }
    return questions;
  })();
  const condRefQuestion = priorQuestionsForForm.find(
    (q) => q.id === qCondRefId
  );
  const condValueOptions =
    condRefQuestion &&
    condRefQuestion.type === "multiple_choice" &&
    Array.isArray(condRefQuestion.options)
      ? condRefQuestion.options
          .map((opt, i) => {
            const id = optionIdOf(opt);
            if (!id) return null;
            return {
              id,
              label: optionLabelEn(opt) || `Option ${i + 1}`,
            };
          })
          .filter(Boolean)
      : [];
  const condOptionsNeedSave =
    condRefQuestion &&
    condRefQuestion.type === "multiple_choice" &&
    Array.isArray(condRefQuestion.options) &&
    condRefQuestion.options.length > 0 &&
    condValueOptions.length === 0;

  const showSurveyPurposeStep =
    hydrationComplete &&
    questions.length === 0 &&
    toolType === "survey" &&
    !surveyPurpose &&
    !prerequisiteGate;

  if (prerequisiteGate) {
    return (
      <Stage03PrerequisiteGate
        kind={prerequisiteGate.kind}
        message={prerequisiteGate.message}
      />
    );
  }

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
        {tierNotice ? <Stage03TierUpgradePrompt message={tierNotice} /> : null}
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
                  setConsentByLang(emptyLangMap(toolLanguages));
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
              questions.map((q, index) => {
                const moveUpBlock = getMoveBlockReason(questions, q.id, -1);
                const moveDownBlock = getMoveBlockReason(questions, q.id, 1);
                const moveBlockReason = moveUpBlock || moveDownBlock;
                return (
                <article
                  key={q.id}
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                    backgroundColor: "#FFFFFF",
                    border: questionErrors[q.id]
                      ? "1px solid #FECACA"
                      : "1px solid #E5E7EB",
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
                      maxWidth: "88px",
                    }}
                  >
                    <button
                      type="button"
                      title={moveUpBlock || "Move up"}
                      disabled={index === 0 || Boolean(moveUpBlock)}
                      onClick={() => moveQuestion(q.id, -1)}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "6px",
                        backgroundColor: "#FFFFFF",
                        color:
                          index === 0 || moveUpBlock ? "#D1D5DB" : muted,
                        cursor:
                          index === 0 || moveUpBlock
                            ? "not-allowed"
                            : "pointer",
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
                      title={moveDownBlock || "Move down"}
                      disabled={
                        index >= questions.length - 1 || Boolean(moveDownBlock)
                      }
                      onClick={() => moveQuestion(q.id, 1)}
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: "6px",
                        backgroundColor: "#FFFFFF",
                        color:
                          index >= questions.length - 1 || moveDownBlock
                            ? "#D1D5DB"
                            : muted,
                        cursor:
                          index >= questions.length - 1 || moveDownBlock
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
                    {moveBlockReason ? (
                      <p
                        style={{
                          margin: 0,
                          color: "#B91C1C",
                          fontFamily: dmSans,
                          fontSize: "0.62rem",
                          lineHeight: 1.35,
                        }}
                      >
                        {moveBlockReason}
                      </p>
                    ) : null}
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
                      {q.display_if ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontFamily: dmSans,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            backgroundColor: "#FEF3C7",
                            color: "#92400E",
                          }}
                        >
                          Conditional
                        </span>
                      ) : null}
                      {hasSpanishTranslation(q) ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: "999px",
                            fontFamily: dmSans,
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            backgroundColor: "#E0F2FE",
                            color: "#075985",
                          }}
                          title="Includes Spanish translation"
                        >
                          ES
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
                      {questionTextEn(q)}
                    </p>
                    {questionErrors[q.id] ? (
                      <p
                        style={{
                          margin: "0 0 8px",
                          color: "#B91C1C",
                          fontFamily: dmSans,
                          fontSize: "0.82rem",
                          lineHeight: 1.4,
                        }}
                      >
                        {questionErrors[q.id]}
                      </p>
                    ) : null}
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
                );
              })
            )}
          </div>

          {deleteBlockMessage ? (
            <p
              style={{
                margin: "0 0 12px",
                color: "#B91C1C",
                fontFamily: dmSans,
                fontSize: "0.88rem",
                lineHeight: 1.45,
                textAlign: "center",
              }}
            >
              {deleteBlockMessage}
            </p>
          ) : null}

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
              <div style={{ marginBottom: "14px" }}>
                <span style={labelStyle}>Question text</span>
                {toolLanguages.map((lang) => {
                  const isEn = lang === "en";
                  return (
                    <label
                      key={lang}
                      style={{ display: "block", marginBottom: "10px" }}
                    >
                      <span
                        style={{
                          display: "block",
                          marginBottom: "4px",
                          color: muted,
                          fontFamily: dmSans,
                          fontSize: "0.82rem",
                          fontWeight: 600,
                        }}
                      >
                        {languageLabel(lang)}
                        {isEn ? " (required)" : " (optional)"}
                      </span>
                      <textarea
                        required={isEn}
                        value={qTextByLang[lang] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setQTextByLang((prev) => ({
                            ...prev,
                            [lang]: value,
                          }));
                          if (isEn && qTextError) setQTextError("");
                        }}
                        rows={3}
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          minHeight: "72px",
                          borderColor:
                            isEn && qTextError ? "#F87171" : "#A8D4AA",
                        }}
                      />
                      {!isEn && lang === "es" ? (
                        <span
                          style={{
                            display: "block",
                            marginTop: "4px",
                            color: muted,
                            fontFamily: dmSans,
                            fontSize: "0.78rem",
                            lineHeight: 1.4,
                          }}
                        >
                          Optional. Leave blank and this question appears in
                          English on a Spanish form.
                        </span>
                      ) : !isEn ? (
                        <span
                          style={{
                            display: "block",
                            marginTop: "4px",
                            color: muted,
                            fontFamily: dmSans,
                            fontSize: "0.78rem",
                            lineHeight: 1.4,
                          }}
                        >
                          Optional. Leave blank and this question appears in
                          English when the form is shown in{" "}
                          {languageLabel(lang)}.
                        </span>
                      ) : null}
                    </label>
                  );
                })}
                {qTextError ? (
                  <span
                    style={{
                      display: "block",
                      marginTop: "6px",
                      color: "#B91C1C",
                      fontFamily: dmSans,
                      fontSize: "0.82rem",
                    }}
                  >
                    {qTextError}
                  </span>
                ) : null}
              </div>
              {formBlockMessage ? (
                <p
                  style={{
                    margin: "0 0 14px",
                    color: "#B91C1C",
                    fontFamily: dmSans,
                    fontSize: "0.82rem",
                    lineHeight: 1.45,
                  }}
                >
                  {formBlockMessage}
                </p>
              ) : null}
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
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      {qOptions.map((opt, i) => (
                        <div
                          key={optionIdOf(opt) || `new-opt-${i}`}
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #E5E7EB",
                            backgroundColor: "#FFFFFF",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: dmSans,
                                fontSize: "0.8rem",
                                fontWeight: 600,
                                color: muted,
                              }}
                            >
                              Option {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMcOption(i)}
                              style={{
                                border: "none",
                                background: "none",
                                padding: 0,
                                color: "#B91C1C",
                                fontFamily: dmSans,
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          {toolLanguages.map((lang) => (
                            <label
                              key={`${i}-${lang}`}
                              style={{
                                display: "block",
                                marginBottom: "8px",
                              }}
                            >
                              <span
                                style={{
                                  display: "block",
                                  marginBottom: "4px",
                                  color: muted,
                                  fontFamily: dmSans,
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                }}
                              >
                                {languageLabel(lang)}
                                {lang === "en" ? " (required)" : " (optional)"}
                              </span>
                              <input
                                type="text"
                                value={(opt.label && opt.label[lang]) || ""}
                                onChange={(e) =>
                                  updateOptionLabel(i, lang, e.target.value)
                                }
                                placeholder={
                                  lang === "en"
                                    ? "English label"
                                    : `${languageLabel(lang)} label`
                                }
                                style={inputStyle}
                              />
                              {lang === "es" ? (
                                <span
                                  style={{
                                    display: "block",
                                    marginTop: "4px",
                                    color: muted,
                                    fontFamily: dmSans,
                                    fontSize: "0.72rem",
                                    lineHeight: 1.35,
                                  }}
                                >
                                  Optional. Leave blank and this option appears
                                  in English on a Spanish form.
                                </span>
                              ) : null}
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {toolLanguages.map((lang) => (
                      <input
                        key={`new-${lang}`}
                        type="text"
                        value={newOptionByLang[lang] || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewOptionByLang((prev) => ({
                            ...prev,
                            [lang]: value,
                          }));
                        }}
                        placeholder={
                          lang === "en"
                            ? "New option (English, required)"
                            : `New option (${languageLabel(lang)}, optional)`
                        }
                        style={inputStyle}
                      />
                    ))}
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
                        alignSelf: "flex-start",
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
              <div
                style={{
                  marginBottom: "16px",
                  borderTop: "1px solid #E5E7EB",
                  paddingTop: "14px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowConditionSection((open) => !open)}
                  style={{
                    border: "none",
                    background: "none",
                    padding: 0,
                    color: green,
                    fontFamily: dmSans,
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Show this question only if
                </button>
                {showConditionSection ? (
                  priorQuestionsForForm.length === 0 ? (
                    <p
                      style={{
                        margin: "12px 0 0",
                        color: muted,
                        fontFamily: dmSans,
                        fontSize: "0.88rem",
                      }}
                    >
                      The first question always shows.
                    </p>
                  ) : (
                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <label style={{ display: "block" }}>
                        <span style={labelStyle}>Earlier question</span>
                        <select
                          value={qCondRefId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setQCondRefId(next);
                            setQCondValue("");
                            if (!next) setQCondOp("equals");
                          }}
                          style={inputStyle}
                        >
                          <option value="">No condition</option>
                          {priorQuestionsForForm.map((pq) => {
                            const label = questionTextEn(pq);
                            return (
                              <option key={pq.id} value={pq.id}>
                                {label.length > 80
                                  ? `${label.slice(0, 80)}...`
                                  : label}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                      {qCondRefId ? (
                        <>
                          <label style={{ display: "block" }}>
                            <span style={labelStyle}>Condition</span>
                            <select
                              value={qCondOp}
                              onChange={(e) => {
                                setQCondOp(e.target.value);
                                if (
                                  e.target.value !== "equals" &&
                                  e.target.value !== "not_equals"
                                ) {
                                  setQCondValue("");
                                }
                              }}
                              style={inputStyle}
                            >
                              {DISPLAY_IF_OPERATOR_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {qCondOp === "equals" ||
                          qCondOp === "not_equals" ? (
                            <label style={{ display: "block" }}>
                              <span style={labelStyle}>Value</span>
                              {condOptionsNeedSave ? (
                                <p
                                  style={{
                                    margin: "0 0 8px",
                                    color: muted,
                                    fontFamily: dmSans,
                                    fontSize: "0.82rem",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  Save your draft first so option ids are
                                  assigned. Then you can set this condition.
                                </p>
                              ) : null}
                              <select
                                value={qCondValue}
                                onChange={(e) => setQCondValue(e.target.value)}
                                style={inputStyle}
                                disabled={condValueOptions.length === 0}
                              >
                                <option value="">Select an option</option>
                                {condValueOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  )
                ) : null}
              </div>
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
          {toolLanguages.map((lang) => {
            const isEn = lang === "en";
            return (
              <label
                key={`consent-${lang}`}
                style={{ display: "block", marginBottom: "12px" }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    color: muted,
                    fontFamily: dmSans,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  {languageLabel(lang)}
                  {isEn ? " (required)" : " (optional)"}
                </span>
                <textarea
                  value={consentByLang[lang] || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setConsentByLang((prev) => ({
                      ...prev,
                      [lang]: value,
                    }));
                  }}
                  rows={6}
                  placeholder={
                    isEn
                      ? "English consent language. Required before launch."
                      : `${languageLabel(lang)} consent. Leave blank only if you must; respondents in this language will see English consent.`
                  }
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: "120px",
                  }}
                />
                {!isEn && lang === "es" ? (
                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: muted,
                      fontFamily: dmSans,
                      fontSize: "0.78rem",
                      lineHeight: 1.4,
                    }}
                  >
                    Optional but important. If blank, Spanish respondents see
                    English consent on the form and on paper.
                  </span>
                ) : null}
              </label>
            );
          })}
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
              margin: "0 0 8px",
              color: green,
              fontFamily: georgia,
              fontWeight: 700,
              fontSize: "1.2rem",
              textAlign: "center",
            }}
          >
            Launch checklist
          </h2>
          <p
            style={{
              margin: "0 0 18px",
              color: muted,
              fontFamily: dmSans,
              fontSize: "0.88rem",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            Each item needs a confirmation and a short answer. A checked box
            without detail does not count.
          </p>
          {LAUNCH_CHECKLIST_ITEMS.map((item) => {
            const entry = launchChecklist[item.key] || {
              confirmed: false,
              detail: "",
            };
            const err = checklistErrors[item.key];
            return (
              <div
                key={item.key}
                style={{
                  marginBottom: "18px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    marginBottom: "10px",
                    fontFamily: dmSans,
                    fontSize: "0.92rem",
                    color: bodyDark,
                    lineHeight: 1.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(entry.confirmed)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setLaunchChecklist((prev) => ({
                        ...prev,
                        [item.key]: {
                          confirmed: checked,
                          detail:
                            typeof prev[item.key]?.detail === "string"
                              ? prev[item.key].detail
                              : "",
                        },
                      }));
                      setChecklistErrors((prev) => {
                        const next = { ...prev };
                        delete next[item.key];
                        return next;
                      });
                    }}
                    style={{ marginTop: "4px" }}
                  />
                  {item.confirmLabel}
                </label>
                <label
                  htmlFor={`launch-checklist-${item.key}`}
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontFamily: dmSans,
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: bodyDark,
                  }}
                >
                  {item.detailLabel}
                </label>
                <textarea
                  id={`launch-checklist-${item.key}`}
                  value={typeof entry.detail === "string" ? entry.detail : ""}
                  onChange={(e) => {
                    const detail = e.target.value;
                    setLaunchChecklist((prev) => ({
                      ...prev,
                      [item.key]: {
                        confirmed: Boolean(prev[item.key]?.confirmed),
                        detail,
                      },
                    }));
                    setChecklistErrors((prev) => {
                      const next = { ...prev };
                      delete next[item.key];
                      return next;
                    });
                  }}
                  rows={3}
                  placeholder={item.detailPlaceholder}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: err ? "1px solid #B91C1C" : `1px solid ${mintBorder}`,
                    fontFamily: dmSans,
                    fontSize: "0.92rem",
                    color: bodyDark,
                    backgroundColor: "#FAF9F7",
                    resize: "vertical",
                  }}
                />
                {err ? (
                  <p
                    role="alert"
                    style={{
                      margin: "6px 0 0",
                      color: "#B91C1C",
                      fontFamily: dmSans,
                      fontSize: "0.85rem",
                    }}
                  >
                    {err}
                  </p>
                ) : null}
              </div>
            );
          })}
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
          {collectionToolId ? (
            <button
              type="button"
              onClick={() => handleDownloadInstrument("en")}
              style={{
                cursor: "pointer",
                padding: "12px 22px",
                borderRadius: "8px",
                border: `2px solid ${green}`,
                backgroundColor: "#FFFFFF",
                color: green,
                fontFamily: dmSans,
                fontWeight: 600,
              }}
            >
              Download instrument (EN)
            </button>
          ) : null}
          {collectionToolId ? (
            <button
              type="button"
              onClick={() => handleDownloadInstrument("es")}
              style={{
                cursor: "pointer",
                padding: "12px 22px",
                borderRadius: "8px",
                border: `2px solid ${green}`,
                backgroundColor: "#FFFFFF",
                color: green,
                fontFamily: dmSans,
                fontWeight: 600,
              }}
            >
              Download instrument (ES)
            </button>
          ) : null}
          {collectionToolId ? (
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                onClick={handleDownloadResponses}
                style={{
                  cursor: "pointer",
                  padding: "12px 22px",
                  borderRadius: "8px",
                  border: `2px solid ${green}`,
                  backgroundColor: "#FFFFFF",
                  color: green,
                  fontFamily: dmSans,
                  fontWeight: 600,
                }}
              >
                Download responses (CSV)
              </button>
              <p
                style={{
                  margin: "8px 0 0",
                  color: muted,
                  fontFamily: dmSans,
                  fontSize: "0.78rem",
                  lineHeight: 1.4,
                  maxWidth: "320px",
                }}
              >
                Empty cell means the question was hidden by branching.
                [no answer] means it was shown and left blank.
              </p>
            </div>
          ) : null}
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

        {collectionToolId ? (
          <section
            style={{
              maxWidth: "720px",
              margin: "0 auto 32px",
              padding: "20px",
              borderRadius: "8px",
              border: `1px solid ${mintBorder}`,
              backgroundColor: "#FFFFFF",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: georgia,
                  fontSize: "1.25rem",
                  color: green,
                }}
              >
                Responses
              </h2>
              <button
                type="button"
                onClick={() => loadResponseRows(collectionToolId)}
                disabled={responsesLoading}
                style={{
                  cursor: responsesLoading ? "not-allowed" : "pointer",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${mintBorder}`,
                  backgroundColor: "#FAF9F7",
                  color: bodyDark,
                  fontFamily: dmSans,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                {responsesLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <p
              style={{
                margin: "0 0 14px",
                color: muted,
                fontFamily: dmSans,
                fontSize: "0.9rem",
                lineHeight: 1.45,
              }}
            >
              Org-assisted delete only. Removal codes belong to respondents and
              are never shown here. On anonymous forms, staff may not be able to
              match a request to a row without the resident&apos;s code.
            </p>
            {responsesError ? (
              <p
                role="alert"
                style={{
                  margin: "0 0 12px",
                  color: "#B91C1C",
                  fontFamily: dmSans,
                }}
              >
                {responsesError}
              </p>
            ) : null}
            {!responsesLoading && responseRows.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: muted,
                  fontFamily: dmSans,
                }}
              >
                No responses yet.
              </p>
            ) : null}
            {responseRows.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {responseRows.map((row) => {
                  const submittedLabel =
                    typeof row.submitted_at === "string" && row.submitted_at
                      ? new Date(row.submitted_at).toLocaleString()
                      : "Unknown time";
                  const langLabel =
                    typeof row.language === "string" && row.language.trim()
                      ? row.language.trim()
                      : "unknown";
                  return (
                    <li
                      key={row.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "12px 0",
                        borderTop: `1px solid ${mintBorder}`,
                      }}
                    >
                      <div style={{ fontFamily: dmSans, color: bodyDark }}>
                        <div style={{ fontWeight: 600 }}>{submittedLabel}</div>
                        <div style={{ color: muted, fontSize: "0.9rem" }}>
                          Language: {langLabel}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteResponse(row.id)}
                        disabled={deletingResponseId === row.id}
                        style={{
                          cursor:
                            deletingResponseId === row.id
                              ? "not-allowed"
                              : "pointer",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #B91C1C",
                          backgroundColor: "#FFFFFF",
                          color: "#B91C1C",
                          fontFamily: dmSans,
                          fontWeight: 600,
                          fontSize: "0.9rem",
                        }}
                      >
                        {deletingResponseId === row.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}

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
