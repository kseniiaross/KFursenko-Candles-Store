import React, { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type {
  QuizAnswers,
  Mood,
  Space,
  Intensity,
  Note,
  Season,
  Occasion,
} from "../api/recommendation";

import "../styles/RecommendationQuiz.css";

const MOODS: Mood[] = [
  "Cozy evening",
  "Fresh morning",
  "Romantic",
  "Focus",
  "Party",
];

const SPACES: Space[] = [
  "Living room",
  "Bedroom",
  "Bathroom",
  "Kitchen",
  "Office",
];

const INTENSITY: Intensity[] = ["Soft", "Medium", "Strong"];

const NOTES: Note[] = [
  "Vanilla",
  "Citrus",
  "Woody",
  "Spicy",
  "Floral",
  "Fresh",
  "Gourmand",
];

const SEASONS: Season[] = ["Spring", "Summer", "Autumn", "Winter"];
const OCCASIONS: Occasion[] = ["Everyday", "Gift", "Self-care", "Dinner", "Weekend"];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const TOTAL_STEPS = 6;

const RecommendationQuiz: React.FC = () => {
  const navigate = useNavigate();

  const headingId = useId();
  const subtitleId = useId();
  const stepHeadingId = useId();
  const notesHintId = useId();
  const nameHintId = useId();

  const [step, setStep] = useState<Step>(1);

  const [form, setForm] = useState<QuizAnswers>({
    name: "",
    mood: "Cozy evening",
    space: "Living room",
    intensity: "Medium",
    notes: ["Vanilla"],
    season: "Autumn",
    occasion: "Everyday",
  });

  const canNext = useMemo(() => {
    if (step === 1) {
      return form.name.trim().length > 0;
    }

    if (step === 4) {
      return (
        Array.isArray(form.notes) &&
        form.notes.length >= 1 &&
        form.notes.length <= 3
      );
    }

    return true;
  }, [form.name, form.notes, step]);

  const progressLabel = useMemo(() => {
    return `Step ${step} of ${TOTAL_STEPS}`;
  }, [step]);

  const next = (): void => {
    if (!canNext) return;
    setStep((current) => (current < TOTAL_STEPS ? ((current + 1) as Step) : current));
  };

  const back = (): void => {
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const finish = (): void => {
    const payload: QuizAnswers = {
      ...form,
      name: form.name.trim() || "Guest",
      notes: form.notes.slice(0, 3),
    };

    navigate("/recommendation-result", { state: payload });
  };

  const toggleNote = (note: Note): void => {
    setForm((prev) => {
      const exists = prev.notes.includes(note);

      if (exists) {
        return {
          ...prev,
          notes: prev.notes.filter((item) => item !== note),
        };
      }

      if (prev.notes.length >= 3) {
        return prev;
      }

      return {
        ...prev,
        notes: [...prev.notes, note],
      };
    });
  };

  return (
    <main
      className="rq"
      aria-labelledby={headingId}
      aria-describedby={subtitleId}
    >
      <div className="rq__layout">
        <header className="rq__header">
          <p className="rq__eyebrow">Personal scent quiz</p>

          <h1 id={headingId} className="rq__title">
            Find the candle that feels like you
          </h1>

          <p id={subtitleId} className="rq__subtitle">
            Answer a few quick questions and we’ll guide you to a candle profile
            that matches your mood, space, and scent preferences — so choosing feels
            effortless and personal.
          </p>
        </header>

        <section
          className="rq__card"
          aria-labelledby={stepHeadingId}
          aria-label="Scent recommendation quiz"
        >
          <div className="rq__progressWrap">
            <div
              className="rq__progress"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={TOTAL_STEPS}
              aria-valuenow={step}
              aria-label={progressLabel}
            >
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
                const itemStep = index + 1;
                const isActive = step >= itemStep;

                return (
                  <span
                    key={itemStep}
                    className={`rq__dot ${isActive ? "rq__dot--active" : ""}`}
                    aria-hidden="true"
                  />
                );
              })}
            </div>

            <p className="rq__progressText">{progressLabel}</p>
          </div>

          {step === 1 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                Let’s make this feel personal
              </h2>

              <p className="rq__stepText">
                Your name helps us make the final recommendation feel curated just
                for you.
              </p>

              <div className="rq__field">
                <label className="rq__label" htmlFor="rq_name">
                  Name
                </label>

                <input
                  id="rq_name"
                  className="rq__input"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g., Kseniia"
                  autoComplete="given-name"
                  aria-invalid={!canNext}
                  aria-describedby={!canNext ? nameHintId : undefined}
                />
              </div>

              {!canNext ? (
                <p id={nameHintId} className="rq__hint rq__hint--error" role="alert">
                  Please enter your name to continue.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                What mood are you shopping for?
              </h2>

              <p className="rq__stepText">
                This helps shape the emotional tone of your candle recommendation.
              </p>

              <div className="rq__grid" role="list" aria-label="Mood options">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    className={`rq__pill ${form.mood === mood ? "rq__pill--active" : ""}`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        mood,
                      }))
                    }
                    aria-pressed={form.mood === mood}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                Where will you enjoy it most?
              </h2>

              <p className="rq__stepText">
                The right scent can feel very different in a bedroom, bathroom, or
                living room.
              </p>

              <div className="rq__grid" role="list" aria-label="Space options">
                {SPACES.map((space) => (
                  <button
                    key={space}
                    type="button"
                    className={`rq__pill ${form.space === space ? "rq__pill--active" : ""}`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        space,
                      }))
                    }
                    aria-pressed={form.space === space}
                  >
                    {space}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                Choose the notes you naturally gravitate toward
              </h2>

              <p className="rq__stepText">
                Pick up to 3 notes. This is the strongest signal in your scent match.
              </p>

              <div className="rq__grid" role="list" aria-label="Scent note options">
                {NOTES.map((note) => {
                  const isSelected = form.notes.includes(note);

                  return (
                    <button
                      key={note}
                      type="button"
                      className={`rq__pill ${isSelected ? "rq__pill--active" : ""}`}
                      onClick={() => toggleNote(note)}
                      aria-pressed={isSelected}
                    >
                      {note}
                    </button>
                  );
                })}
              </div>

              <p id={notesHintId} className="rq__hint">
                Selected: {form.notes.length} / 3
              </p>

              {!canNext ? (
                <p className="rq__hint rq__hint--error" role="alert">
                  Select at least 1 note to continue.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                How noticeable should the scent feel?
              </h2>

              <p className="rq__stepText">
                Choose the intensity that best fits your space and everyday comfort.
              </p>

              <div className="rq__grid" role="list" aria-label="Intensity options">
                {INTENSITY.map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    className={`rq__pill ${
                      form.intensity === intensity ? "rq__pill--active" : ""
                    }`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        intensity,
                      }))
                    }
                    aria-pressed={form.intensity === intensity}
                  >
                    {intensity}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 6 ? (
            <div className="rq__step">
              <h2 id={stepHeadingId} className="rq__stepTitle">
                Final details for the perfect match
              </h2>

              <p className="rq__stepText">
                Season and occasion help us refine the final recommendation into
                something that feels ready to buy.
              </p>

              <div className="rq__split">
                <section className="rq__group" aria-labelledby="rq-season-title">
                  <h3 id="rq-season-title" className="rq__miniTitle">
                    Season
                  </h3>

                  <div className="rq__grid" role="list" aria-label="Season options">
                    {SEASONS.map((season) => (
                      <button
                        key={season}
                        type="button"
                        className={`rq__pill ${
                          form.season === season ? "rq__pill--active" : ""
                        }`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            season,
                          }))
                        }
                        aria-pressed={form.season === season}
                      >
                        {season}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rq__group" aria-labelledby="rq-occasion-title">
                  <h3 id="rq-occasion-title" className="rq__miniTitle">
                    Occasion
                  </h3>

                  <div className="rq__grid" role="list" aria-label="Occasion options">
                    {OCCASIONS.map((occasion) => (
                      <button
                        key={occasion}
                        type="button"
                        className={`rq__pill ${
                          form.occasion === occasion ? "rq__pill--active" : ""
                        }`}
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            occasion,
                          }))
                        }
                        aria-pressed={form.occasion === occasion}
                      >
                        {occasion}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          <div className="rq__actions">
            <button
              type="button"
              className="rq__btn rq__btn--secondary"
              onClick={back}
              disabled={step === 1}
            >
              Back
            </button>

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                className="rq__btn rq__btn--primary"
                onClick={next}
                disabled={!canNext}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="rq__btn rq__btn--primary"
                onClick={finish}
              >
                See my candle match
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default RecommendationQuiz;