import { YukiMark } from "./YukiMark";

export function Mark({ small = false }: { small?: boolean }) {
  return <YukiMark small={small} />;
}
