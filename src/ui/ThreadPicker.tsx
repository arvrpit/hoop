// The thread picker (spec 8.2, in RGB): a colour card of ready-made floss colours, R/G/B sliders
// whose tracks show the colours they'd make, hex, a row of darker/lighter shades, material and
// strands, and a live preview. Adding puts the new thread on the needle; editing recolours every
// stitch made with it (live while you edit, one undo step when saved).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { hexToRgb255, hslToRgb255, rgb255ToHex, rgb255ToHsl, shadeRow, type RGB255 } from '../model/color';
import { colorName, flossCard, newThreadId, uniqueName } from '../model/threadColors';
import type { Thread, ThreadMaterial } from '../model/types';
import { session, useSession } from '../state/session';
import { useUi, type PickerState } from '../state/ui';
import { threadMaterials } from '../tuning';
import { ThreadPreview } from './ThreadPreview';

const materials: ThreadMaterial[] = ['floss', 'perle', 'silk', 'wool'];

interface Draft {
  rgb: RGB255;
  base: RGB255; // the colour the shades row is made from (picking a shade doesn't move it)
  baseName: string;
  material: ThreadMaterial;
  strands: number;
  name: string;
  nameTouched: boolean; // typed by hand: stop renaming it after the colour
}

export function ThreadPicker() {
  const picker = useUi((s) => s.picker);
  if (!picker) return null;
  const key = picker.mode === 'edit' ? picker.threadId : 'add';
  return <Picker key={key} picker={picker} />;
}

function Picker({ picker }: { picker: PickerState }) {
  const threads = useSession((s) => s.threads);
  const active = useSession((s) => s.thread);
  const editing = picker.mode === 'edit' ? threads.find((t) => t.id === picker.threadId) : undefined;
  const others = threads.filter((t) => t.id !== editing?.id).map((t) => t.name);
  const [d, setD] = useState<Draft>(() => initialDraft(editing, active, threads));
  const [hexText, setHexText] = useState(rgb255ToHex(d.rgb));
  const dialog = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const close = () => useUi.getState().closePicker();

  const thread: Thread = useMemo(
    () => ({
      id: editing?.id ?? 'draft',
      name: d.name,
      color: rgb255ToHsl(d.rgb),
      material: d.material,
      strands: d.strands,
    }),
    [d, editing?.id],
  );

  // Editing: the stitches in the hoop recolour live; Cancel puts them back.
  useEffect(() => {
    if (!editing) return;
    session.previewThreads(threads.map((t) => (t.id === editing.id ? thread : t)));
  }, [thread, editing, threads]);
  useEffect(() => () => session.previewThreads(null), []);

  useEffect(() => {
    if (picker.mode === 'edit' && picker.focus === 'name') nameInput.current?.select();
    else dialog.current?.focus();
  }, [picker]);

  /** A new colour (card, sliders, hex): the shades are made from it. */
  const setRgb = (rgb: RGB255, name?: string) => {
    const baseName = name ?? colorName(rgb);
    setHexText(rgb255ToHex(rgb));
    setD((x) => ({
      ...x,
      rgb,
      base: rgb,
      baseName,
      name: x.nameTouched ? x.name : uniqueName(baseName, others),
    }));
  };

  /** One of the shades: the row stays as it is, and this swatch is the one chosen. */
  const pickShade = (i: number) => {
    const rgb = shadeRow(d.base)[i]!;
    setHexText(rgb255ToHex(rgb));
    setD((x) => ({
      ...x,
      rgb,
      name: x.nameTouched ? x.name : uniqueName(shadeName(i, x.baseName), others),
    }));
  };

  const submit = () => {
    const name = d.name.trim() || uniqueName(colorName(d.rgb), others);
    if (editing) {
      const patch = { name, color: rgb255ToHsl(d.rgb), material: d.material, strands: d.strands };
      const same =
        editing.name === name &&
        rgb255ToHex(hslToRgb255(editing.color)) === rgb255ToHex(d.rgb) &&
        editing.material === d.material &&
        editing.strands === d.strands;
      if (!same) session.updateThread(editing.id, patch);
    } else {
      session.addThread({ ...thread, id: newThreadId(), name });
      useUi.getState().showToast(`${name} is on the needle`);
    }
    close();
  };

  const count = editing ? session.stitchCountFor(editing.id) : 0;
  const hex = rgb255ToHex(d.rgb);
  const shades = shadeRow(d.base).map(rgb255ToHex);
  const shade = shades[2] === hex ? 2 : shades.indexOf(hex); // −1: a colour off the row

  return (
    <div
      className="hoop-picker-backdrop"
      data-modal
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        className="hoop-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoop-picker-title"
        tabIndex={-1}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') close();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <header>
            <h2 id="hoop-picker-title">{editing ? 'Edit thread' : 'New thread'}</h2>
            <button type="button" className="icon" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="preview-row">
            <ThreadPreview thread={thread} />
            <label className="name">
              <span>Name</span>
              <input
                ref={nameInput}
                value={d.name}
                maxLength={40}
                onChange={(e) => setD((x) => ({ ...x, name: e.target.value, nameTouched: true }))}
              />
            </label>
          </div>

          <section aria-labelledby="hoop-picker-card">
            <h3 id="hoop-picker-card">Colour card</h3>
            <div className="card" role="radiogroup" aria-labelledby="hoop-picker-card">
              {flossCard.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={rgb255ToHex(d.base) === c.hex}
                  aria-label={c.name}
                  title={c.name}
                  style={{ background: c.hex }}
                  onClick={() => setRgb(hexToRgb255(c.hex)!, c.name)}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="hoop-picker-rgb" className="rgb">
            <h3 id="hoop-picker-rgb">Colour</h3>
            {(['Red', 'Green', 'Blue'] as const).map((label, ch) => {
              const lo = [...d.rgb] as RGB255;
              const hi = [...d.rgb] as RGB255;
              lo[ch] = 0;
              hi[ch] = 255;
              const track = `linear-gradient(to right, ${rgb255ToHex(lo)}, ${rgb255ToHex(hi)})`;
              const set = (v: number) => {
                const next = [...d.rgb] as RGB255;
                next[ch] = Math.min(255, Math.max(0, Math.round(v) || 0));
                setRgb(next);
              };
              return (
                <div className="channel" key={label}>
                  <span aria-hidden>{label[0]}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={d.rgb[ch]}
                    aria-label={label}
                    style={{ '--track': track } as CSSProperties}
                    onChange={(e) => set(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={d.rgb[ch]}
                    aria-label={`${label} value`}
                    onChange={(e) => set(Number(e.target.value))}
                  />
                </div>
              );
            })}
            <div className="channel hex">
              <span aria-hidden>#</span>
              <input
                aria-label="Hex colour"
                value={hexText}
                spellCheck={false}
                maxLength={7}
                onChange={(e) => {
                  setHexText(e.target.value);
                  const rgb = hexToRgb255(e.target.value);
                  if (rgb) setRgb(rgb);
                }}
                onBlur={() => setHexText(hex)}
              />
            </div>
          </section>

          <section aria-labelledby="hoop-picker-shades">
            <h3 id="hoop-picker-shades">Shades</h3>
            <div className="shades" role="radiogroup" aria-labelledby="hoop-picker-shades">
              {shades.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-label={['Much darker', 'Darker', 'Base colour', 'Lighter', 'Much lighter'][i]}
                  aria-checked={i === shade}
                  style={{ background: c }}
                  onClick={() => pickShade(i)}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="hoop-picker-material">
            <h3 id="hoop-picker-material">Material</h3>
            <div className="seg" role="radiogroup" aria-labelledby="hoop-picker-material">
              {materials.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={d.material === m}
                  onClick={() => setD((x) => ({ ...x, material: m }))}
                >
                  {threadMaterials[m].label}
                </button>
              ))}
            </div>
          </section>

          <section className="strands">
            <h3 id="hoop-picker-strands">Strands</h3>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={d.strands}
              aria-labelledby="hoop-picker-strands"
              onChange={(e) => setD((x) => ({ ...x, strands: Number(e.target.value) }))}
            />
            <output>{d.strands}</output>
          </section>

          {editing && count > 0 && (
            <p className="note">
              Recolours the {count} {count === 1 ? 'stitch' : 'stitches'} made with it. You can undo this.
            </p>
          )}

          <footer>
            <button type="button" className="ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="primary">
              {editing ? 'Save' : 'Thread needle'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function initialDraft(editing: Thread | undefined, active: Thread | null, threads: Thread[]): Draft {
  if (editing) {
    const rgb = hslToRgb255(editing.color);
    return {
      rgb,
      base: rgb,
      baseName: colorName(rgb),
      material: editing.material,
      strands: editing.strands,
      name: editing.name,
      // A name that came from its colour keeps following the colour.
      nameTouched: !editing.name.startsWith(colorName(rgb)),
    };
  }
  const taken = new Set(threads.map((t) => rgb255ToHex(hslToRgb255(t.color))));
  const pick = flossCard.find((c) => !taken.has(c.hex)) ?? flossCard[0]!;
  return {
    rgb: hexToRgb255(pick.hex)!,
    base: hexToRgb255(pick.hex)!,
    baseName: pick.name,
    material: active?.material ?? 'floss',
    strands: active?.strands ?? threadMaterials.floss.defaultStrands,
    name: uniqueName(
      pick.name,
      threads.map((t) => t.name),
    ),
    nameTouched: false,
  };
}

/** "Light leaf green", "Deep navy"…: a shade is named after the colour it came from. */
function shadeName(i: number, base: string): string {
  const prefix = ['Deep', 'Dark', '', 'Light', 'Pale'][i];
  return prefix ? `${prefix} ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
}
