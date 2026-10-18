// Invite rewards (pair:invite-rewards-never-cash): from what the invited friend goes on to
// do, after the commit that did it, a card frame and a line for the inviter,
// once for each milestone and friend, from at most `rewardFriends` friends.
import type { Content, State } from "@japacity/sim";
import { rewardFor } from "@japacity/sim";
import type { InviteMilestone } from "@japacity/store";

import type { Live } from "../authority/load";
import type { ServerDeps } from "../deps";

/** The milestones a life has reached: the prologue finished, the second chapter closed, a departure. */
export function milestonesOf(state: State, content: Content): InviteMilestone[] {
  const reached: InviteMilestone[] = [];
  if (content.scenario[state.scenario]?.prologue === true && !state.prologue.open) reached.push("prologue");
  if (state.chapter.done.length >= 2) reached.push("chapter-two");
  if (Object.values(state.route).some((route) => route.state === "departed")) reached.push("departed");
  return reached;
}

/** pair:invite-rewards-never-cash: gives each inviter of these lives what their progress earned, and nothing for what a friend had done before the link. */
export async function rewardInviters(deps: ServerDeps, lives: readonly Live[]): Promise<void> {
  for (const live of lives) {
    const reached = milestonesOf(live.state, live.content);
    if (reached.length === 0) continue;
    for (const link of await deps.stores.invite.linkedBy(live.id)) {
      const given = (await deps.stores.invite.rewards(link.from)).map((row) => ({ friend: row.friend, reached: row.reached }));
      for (const milestone of reached) {
        if (link.before.includes(milestone)) continue;
        const reward = rewardFor({ friend: live.id, reached: milestone, given }, live.content.tuning.pair);
        if (reward === null) continue;
        const stored = await deps.stores.invite.reward({ from: link.from, friend: live.id, reached: milestone, frame: reward.frame, line: reward.line, at: deps.now() });
        if (stored.ok) given.push({ friend: live.id, reached: milestone });
      }
    }
  }
}
