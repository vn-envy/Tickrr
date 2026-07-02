import { Composition } from "remotion";
import { Tickrr, FPS, TOTAL_FRAMES } from "./Tickrr";

/**
 * Tickrr feature reel — a ~98s, VO-ready promo built on the real terminal.
 * 1920x1080 @ 30fps. No baked audio: pacing leaves headroom to overlay voice-over.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Tickrr"
      component={Tickrr}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
