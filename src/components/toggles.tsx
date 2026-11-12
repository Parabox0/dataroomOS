// Switches and checks are small forms, so they work without JavaScript and every change is saved at once.
import { Submit } from "./forms";

type Hidden = Record<string, string>;

export function SwitchForm({ action, hidden, on, label }: { action: (fd: FormData) => Promise<void>; hidden: Hidden; on: boolean; label: string }) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <Submit className="switch" role="switch" aria-checked={on} aria-label={label} />
    </form>
  );
}

export function CheckForm({ action, hidden, done, label }: { action: (fd: FormData) => Promise<void>; hidden: Hidden; done: boolean; label: string }) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="status" value={done ? "todo" : "done"} />
      <Submit className="check" role="checkbox" aria-checked={done} aria-label={label} />
    </form>
  );
}
