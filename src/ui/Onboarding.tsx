// "How it works": four steps with pictures of a real piece (a tree on a tote bag), shown on the
// first visit and from "How it works" on the product screen. Esc, ×, Skip or the backdrop close it.
import { useEffect, useRef, useState } from 'react';
import { useUi } from '../state/ui';

const img = (name: string) => `${import.meta.env.BASE_URL}onboarding/${name}.jpg`;

const steps = [
  {
    title: 'Place the hoop',
    body: 'Choose a T-shirt, tote bag or notebook, pick a hoop size, and drag the hoop to where the embroidery should go.',
    src: img('1-place'),
    alt: 'A tote bag with an embroidery hoop placed on its front',
  },
  {
    title: 'Sketch your design',
    body: 'Draw inside the hoop with the pen, or add an image. It is a guide to stitch over, like a washable transfer pen.',
    src: img('2-sketch'),
    alt: 'A tree sketched in blue pen inside the hoop on the tote bag',
  },
  {
    title: 'Stitch it',
    body: 'Pick a stitch and a thread, then click from hole to hole. Add colours to the thread rack and switch between them as you go.',
    src: img('3-stitch'),
    alt: 'The tree stitched in the hoop: a brown trunk, green satin leaves and red French knots',
  },
  {
    title: 'See the finished piece',
    body: 'When you are done, Save & render takes the hoop off, washes out the sketch and shows your embroidery on the product. It is kept in Your pieces.',
    src: img('4-finished'),
    alt: 'The finished tote bag with the embroidered tree',
  },
];

export function Onboarding() {
  const open = useUi((s) => s.onboarding);
  if (!open) return null;
  return <Steps />;
}

function Steps() {
  const [i, setI] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const close = () => useUi.getState().setOnboarding(false);
  const last = i === steps.length - 1;
  const step = steps[i]!;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    return () => before?.focus?.();
  }, []);

  return (
    <div
      className="hoop-onboarding-backdrop"
      data-modal
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="hoop-onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoop-onboarding-title"
        aria-describedby="hoop-onboarding-body"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowRight' && !last) setI(i + 1);
          if (e.key === 'ArrowLeft' && i > 0) setI(i - 1);
        }}
      >
        <figure>
          {steps.map((s, k) => (
            <img
              key={s.src}
              src={s.src}
              alt={k === i ? s.alt : ''}
              aria-hidden={k !== i}
              data-current={k === i || undefined}
              loading={k === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
          ))}
          <button type="button" className="close" aria-label="Close" onClick={close}>
            ×
          </button>
        </figure>
        <div className="body">
          <p className="kicker">
            How it works · {i + 1} of {steps.length}
          </p>
          <h2 id="hoop-onboarding-title">{step.title}</h2>
          <p id="hoop-onboarding-body">{step.body}</p>
          <div className="foot">
            <div className="dots" role="group" aria-label="Steps">
              {steps.map((s, k) => (
                <button
                  key={s.title}
                  type="button"
                  aria-label={`Step ${k + 1}: ${s.title}`}
                  aria-current={k === i ? 'step' : undefined}
                  onClick={() => setI(k)}
                />
              ))}
            </div>
            {i > 0 ? (
              <button type="button" className="ghost" onClick={() => setI(i - 1)}>
                Back
              </button>
            ) : (
              <button type="button" className="ghost" onClick={close}>
                Skip
              </button>
            )}
            <button
              ref={primary}
              type="button"
              className="primary"
              onClick={() => (last ? close() : setI(i + 1))}
            >
              {last ? 'Start' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
