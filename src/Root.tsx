import { Composition, registerRoot, type CalculateMetadataFunction } from "remotion";
import { EpisodeZ } from "./episode/schema";
import { RENDER_FPS, SUB, resolveEpisode, type Timeline } from "./episode/resolve";
import { Video } from "./engine/Video";

type Props = { episode: unknown; timeline?: Timeline };

// 台本を読んで、尺と画面の大きさを決める。描画には解決済みのタイムラインを渡す
const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
  const timeline = resolveEpisode(EpisodeZ.parse(props.episode));
  return { durationInFrames: Math.max(1, timeline.frames * SUB), fps: RENDER_FPS, width: timeline.width, height: timeline.height, props: { ...props, timeline } };
};

const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={({ timeline }: Props) => (timeline ? <Video timeline={timeline} /> : null)}
    defaultProps={{ episode: null } as Props}
    calculateMetadata={calculateMetadata}
    durationInFrames={1}
    fps={RENDER_FPS}
    width={1920}
    height={1080}
  />
);

registerRoot(Root);
