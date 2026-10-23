// world:reach-and-read: under the start screen the live city behind is inert: its pins take no Tab and no tap; the sheet over it does.
import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Gate } from "./Gate";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

test("[world:reach-and-read] given the start screen over the live city, then the city behind is inert and the sheet is not", () => {
  render(
    <Gate mark="start" scene={<button type="button" data-pin>Ojuelegba</button>}>
      <button type="button" data-play>
        Play
      </button>
    </Gate>,
  );
  expect(document.querySelector("[data-pin]")?.closest("[inert]")).not.toBeNull();
  expect(document.querySelector("[data-play]")?.closest("[inert]")).toBeNull();
});
