import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const tiers = [
  {
    name: "SEED WORK",
    price: "Free, no account",
    label: "Hosted tools",
    items: [
      "Know Your Soil",
      "Who Tends the Garden",
      "Before You Plant",
      "PDF download of responses",
      "Waitlist prompt",
    ],
  },
  {
    name: "FREEMIUM",
    price: "$0 - account required",
    label: "Platform access",
    items: [
      "Mission framing",
      "Stakeholder mapping",
      "Statement of Work upload for metric extraction (optional)",
      "Draft program design",
      "Community engagement templates",
      "Redesign program based on community input",
      "Collection tool recommendations (view only)",
    ],
    featured: true,
    badge: "Start here",
  },
  {
    name: "STARTER",
    price: "$49/mo",
    label: "Stage 03 unlocked",
    items: [
      "Everything in Freemium, plus:",
      "Data collection builders",
      "Engagement templates",
      "Data governance documentation",
      "Launch checklist",
      "All program data in one place. No more managing multiple spreadsheets or forms.",
    ],
  },
  {
    name: "GROWTH",
    price: "$99/mo",
    label: "Stage 04 unlocked",
    items: [
      "Everything in Starter, plus:",
      "Auto-dashboards",
      "Funder-ready reports",
      "Community share-back PDF",
      "Trend flags",
      "AI policy builder",
      "Measurement log",
    ],
  },
  {
    name: "ENTERPRISE",
    price: "$199/mo",
    label: "Stage 05 + team access",
    items: [
      "Everything in Growth, plus:",
      "Matched funding opportunities",
      "Peer org database",
      "Policy input pathway",
      "Multi-user team access",
      "Consulting upgrade path",
    ],
    badgeDark: "Most complete",
  },
];

const accordionItems = [
  {
    question: "What AI model does Rootwork use?",
    content:
      "Rootwork runs on Claude Sonnet 4.6 by Anthropic. We selected it for strong reasoning, clear instruction following, and reliable handling of nuanced community-centered content. All Claude API calls are made server-side. Your browser never sends data directly to the AI.",
  },
  {
    question: "How is my data stored and protected?",
    content:
      "All data is stored in a Supabase PostgreSQL database with row-level security enabled on every table. Queries are scoped to your organization only. If a vulnerability were exploited, another organization’s data would still be isolated. Uploaded files are stored in Supabase Storage with organization-scoped access policies.",
  },
  {
    question: "Does Rootwork use my data to train AI models?",
    content:
      "No. Rootwork uses the Anthropic API under standard API terms. Your data is not used to train Claude or any other model. Community voice records are especially protected. They are stored verbatim, not rewritten, and only surfaced exactly as entered.",
  },
  {
    question: "What platforms does Rootwork run on?",
    content:
      "Rootwork is a web application that runs in modern browsers such as Chrome, Firefox, Safari, and Edge. No download is required. It is designed for desktop use, with mobile viewing support. The backend runs on Node.js and Express. The database is PostgreSQL through Supabase. The frontend is built in React.",
  },
  {
    question: "Who has access to my organization’s data?",
    content:
      "Only members of your organization can access your data. This is enforced at the database layer, not only in the interface. At Freemium, Starter, and Growth, one account is linked to your organization. At Enterprise, you can add team members with role-based permissions. Intentional Data staff do not access your data without your explicit request.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [openAccordion, setOpenAccordion] = useState(0);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <main style={{ backgroundColor: "#FAF9F7", color: "#2C2C2C" }}>
      <style>
        {`
          .landing-container {
            width: min(1120px, calc(100% - 48px));
            margin: 0 auto;
          }
          .landing-columns-3 {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 18px;
          }
          .landing-columns-4 {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
          }
          .landing-columns-2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 24px;
          }
          @media (max-width: 767px) {
            .landing-container {
              width: calc(100% - 32px);
            }
            .landing-columns-3,
            .landing-columns-4,
            .landing-columns-2 {
              grid-template-columns: 1fr;
            }
            .landing-nav {
              flex-direction: column;
              align-items: flex-start;
              gap: 14px;
            }
            .landing-hero-heading {
              font-size: 2rem !important;
              line-height: 1.25 !important;
            }
          }
        `}
      </style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "#FAF9F7",
          borderBottom: "1px solid #A8D4AA",
        }}
      >
        <div
          className="landing-container landing-nav"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 0",
          }}
        >
          <div>
            <div
              style={{
                color: "#2D6A2F",
                fontFamily: "Georgia, serif",
                fontWeight: 700,
                fontSize: "1.45rem",
                lineHeight: 1.1,
              }}
            >
              Rootwork
            </div>
            <div
              style={{
                color: "#6B7280",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: "0.82rem",
                marginTop: "2px",
              }}
            >
              by Intentional Data
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="mailto:hello@intentionaldata.org"
              style={{
                border: "1px solid #2D6A2F",
                color: "#2D6A2F",
                textDecoration: "none",
                borderRadius: "8px",
                padding: "10px 14px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                fontSize: "0.92rem",
              }}
            >
              Give feedback
            </a>
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              style={{
                border: "none",
                color: "#FFFFFF",
                backgroundColor: "#2D6A2F",
                borderRadius: "8px",
                padding: "10px 14px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                fontSize: "0.92rem",
                cursor: "pointer",
              }}
            >
              Create account
            </button>
          </div>
        </div>
      </header>

      <section style={{ backgroundColor: "#2D6A2F", padding: "80px 0" }}>
        <div
          className="landing-container"
          style={{ textAlign: "center", color: "#FFFFFF" }}
        >
          <h1
            className="landing-hero-heading"
            style={{
              margin: 0,
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "3rem",
              lineHeight: 1.2,
            }}
          >
            The organizations closest to community
            <br />
            are going without data strategy entirely.
          </h1>
          <p
            style={{
              margin: "20px auto 0",
              maxWidth: "640px",
              color: "rgba(255,255,255,0.84)",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: "1.02rem",
              lineHeight: 1.6,
            }}
          >
            Not because they do not understand its value. Because the
            infrastructure, capacity, and resources have never been built for
            them. Rootwork changes that.
          </p>
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              style={{
                border: "none",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
                color: "#2D6A2F",
                padding: "12px 16px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Create a free account
            </button>
            <a
              href="#what-is-rootwork"
              style={{
                border: "1px solid #FFFFFF",
                borderRadius: "8px",
                color: "#FFFFFF",
                padding: "12px 16px",
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section id="what-is-rootwork" style={{ backgroundColor: "#FAF9F7", padding: "80px 0" }}>
        <div className="landing-container">
          <h2
            style={{
              margin: "0 0 26px",
              textAlign: "center",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "2rem",
            }}
          >
            A platform built for the work, not around it.
          </h2>
          <div className="landing-columns-3">
            {[
              {
                title: "Community voice is the architecture.",
                body: "Rootwork does not treat community input as a checkbox. It is built into every stage. You cannot skip it. The platform waits for you.",
              },
              {
                title: "AI that supports judgment. Not replaces it.",
                body: "Claude reviews your work, surfaces gaps, and drafts outputs for your review. Every AI output is labeled as a draft. You decide what is true.",
              },
              {
                title: "Data infrastructure that lasts.",
                body: "Funder-ready reports. Community share-back documents. Measurement logs. Built artifacts you can use beyond Rootwork.",
              },
            ].map((col) => (
              <article key={col.title} style={{ backgroundColor: "#FAF9F7", paddingTop: "10px", borderTop: "3px solid #2D6A2F" }}>
                <h3
                  style={{
                    margin: "0 0 10px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.2rem",
                  }}
                >
                  {col.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "#2C2C2C",
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: "0.95rem",
                    lineHeight: 1.6,
                  }}
                >
                  {col.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#FFFFFF", padding: "80px 0" }}>
        <div className="landing-container">
          <h2
            style={{
              margin: "0 0 10px",
              textAlign: "center",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "2rem",
            }}
          >
            Start free. Grow when you&apos;re ready.
          </h2>
          <p
            style={{
              margin: "0 0 24px",
              textAlign: "center",
              color: "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            Free tools build trust. Paid tiers deliver the methodology as a
            durable system.
          </p>
          <div className="landing-columns-4">
            {tiers.map((tier) => (
              <article
                key={tier.name}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: tier.featured ? "2px solid #2D6A2F" : "1px solid #A8D4AA",
                  borderRadius: "12px",
                  padding: "28px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      color: "#2D6A2F",
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                    }}
                  >
                    {tier.name}
                  </h3>
                  {tier.badge ? (
                    <span
                      style={{
                        backgroundColor: "#F0F7F0",
                        color: "#2D6A2F",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      {tier.badge}
                    </span>
                  ) : null}
                  {tier.badgeDark ? (
                    <span
                      style={{
                        backgroundColor: "#2D6A2F",
                        color: "#FFFFFF",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        borderRadius: "999px",
                        padding: "4px 8px",
                      }}
                    >
                      {tier.badgeDark}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginBottom: "6px",
                    color: "#2D6A2F",
                    fontFamily: "Georgia, serif",
                    fontWeight: 700,
                    fontSize: "1.4rem",
                  }}
                >
                  {tier.price}
                </div>
                <div
                  style={{
                    marginBottom: "12px",
                    color: "#6B7280",
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: "0.85rem",
                  }}
                >
                  {tier.label}
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {tier.items.map((item) => (
                    <li
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        marginBottom: "8px",
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: "0.9rem",
                        lineHeight: 1.4,
                      }}
                    >
                      <span
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "999px",
                          backgroundColor: "#2D6A2F",
                          marginTop: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ backgroundColor: "#FAF9F7", padding: "80px 0" }}>
        <div className="landing-container" style={{ maxWidth: "920px" }}>
          <h2
            style={{
              margin: "0 0 10px",
              textAlign: "center",
              color: "#2D6A2F",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "2rem",
            }}
          >
            How it works under the hood.
          </h2>
          <p
            style={{
              margin: "0 0 24px",
              textAlign: "center",
              color: "#6B7280",
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}
          >
            For the technically curious.
          </p>

          {accordionItems.map((item, index) => {
            const isOpen = openAccordion === index;
            return (
              <article
                key={item.question}
                style={{
                  borderBottom: "1px solid #A8D4AA",
                  padding: "14px 0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenAccordion(isOpen ? -1 : index)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    backgroundColor: "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      color: "#2D6A2F",
                      fontFamily: "Georgia, serif",
                      fontWeight: 700,
                      fontSize: "1.1rem",
                    }}
                  >
                    {item.question}
                  </span>
                  <span
                    style={{
                      color: "#2D6A2F",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontWeight: 700,
                      fontSize: "1.2rem",
                      lineHeight: 1,
                    }}
                  >
                    {isOpen ? "-" : "+"}
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? "250px" : "0",
                    overflow: "hidden",
                    transition: "max-height 260ms ease",
                  }}
                >
                  <p
                    style={{
                      margin: isOpen ? "10px 0 2px" : "0",
                      color: "#2C2C2C",
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      lineHeight: 1.6,
                    }}
                  >
                    {item.content}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section style={{ backgroundColor: "#2D6A2F", padding: "80px 0" }}>
        <div className="landing-container" style={{ textAlign: "center", color: "#FFFFFF" }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "2rem",
            }}
          >
            This platform is built with the people who will use it.
          </h2>
          <p
            style={{
              margin: "0 auto 24px",
              maxWidth: "760px",
              color: "rgba(255,255,255,0.84)",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              lineHeight: 1.6,
            }}
          >
            Rootwork is in active development. If you work at a nonprofit,
            grassroots organization, or community-based program, your feedback
            directly shapes what gets built next.
          </p>
          <a
            href="mailto:hello@intentionaldata.org"
            style={{
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
              color: "#2D6A2F",
              textDecoration: "none",
              padding: "12px 16px",
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontWeight: 700,
            }}
          >
            Share your feedback
          </a>
        </div>
      </section>

      <footer
        style={{
          backgroundColor: "#FAF9F7",
          padding: "40px 0",
          borderTop: "1px solid #A8D4AA",
        }}
      >
        <div
          className="landing-container"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#6B7280",
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: "0.9rem",
          }}
        >
          <span>Rootwork by Intentional Data</span>
          <span>Built in Austin, TX</span>
          <a
            href="https://intentionaldata.org"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2D6A2F", textDecoration: "none", fontWeight: 700 }}
          >
            intentionaldata.org
          </a>
        </div>
      </footer>
    </main>
  );
}

export default Landing;
