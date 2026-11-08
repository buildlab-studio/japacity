// A home's picture on the door (prologue:front-door-three-screens): the room as the game draws it, or a model's tile where the home
// has no room to show; the postcards, the tiles and the desk's stage draw it.
import type { Home } from "./archetypes";
import { homePicture } from "./lives";
import { ModelPicture } from "./LookPicture";

/** A home's picture: the room as the game draws it, or the model on a soft tile. */
export function HomePicture({ home, className = "", size }: { home: Home | "self-contain"; className?: string; size: number }) {
  const picture = homePicture(home);
  if ("src" in picture) return <span className={`block bg-cover ${className}`} style={{ backgroundImage: `url(${picture.src})`, backgroundPosition: "center 55%" }} aria-hidden data-home-picture={home} />;
  return (
    <span className={`flex items-center justify-center bg-tint-study ${className}`} aria-hidden data-home-picture={home}>
      <ModelPicture model={picture.model} size={size} />
    </span>
  );
}

