import type { DialChange, SwitchLogRow, SwitchRow, SwitchStore } from "../switches";
import { DEFAULT_SWITCH_ROW, isDialValue } from "../switches";
import { accept, copy, refuse } from "./copy.memory";

function withDial(row: SwitchRow, change: DialChange): SwitchRow {
  const dials = copy(row.dials);
  switch (change.dial) {
    case "placeTarget":
      if (change.value === null) delete dials.placeTargets[change.place];
      else dials.placeTargets[change.place] = change.value;
      break;
    case "computerAfterMonths":
      dials.computerAfterMonths = change.value;
      break;
    case "topUpTickets":
      dials.topUpTickets = change.value;
      break;
    default: {
      const never: never = change;
      throw new Error(`Unknown dial ${JSON.stringify(never)}.`);
    }
  }
  return { switches: row.switches, dials };
}

/** R-SERVER-030, R-SERVER-031: one row and a log that only grows. */
export function memorySwitchStore(): SwitchStore {
  let row: SwitchRow = copy(DEFAULT_SWITCH_ROW);
  const log: SwitchLogRow[] = [];

  return {
    read: () => Promise.resolve(copy(row)),
    set: (name, on, admin, reason, at) => {
      row = { switches: { ...row.switches, [name]: on }, dials: row.dials };
      log.push({ n: log.length + 1, at, admin, reason, change: { switch: name, on } });
      return Promise.resolve(copy(row));
    },
    setDial: (change, admin, reason, at) => {
      if (!isDialValue(change.value)) return Promise.resolve(refuse("bad-write", `A dial is a whole number from 0 or null, not ${String(change.value)}.`));
      row = withDial(row, change);
      log.push({ n: log.length + 1, at, admin, reason, change: copy(change) });
      return Promise.resolve(accept(row));
    },
    log: () => Promise.resolve(copy(log)),
  };
}
