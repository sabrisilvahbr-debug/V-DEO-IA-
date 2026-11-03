import type { Metadata } from "next";
import { StudioWorkspace } from "@/components/studio/studio-workspace";

export const metadata: Metadata = { title: "Editor" };

export default function EditorPage() {
  return (
    <>
      <h1 className="sr-only">Editor do estúdio</h1>
      <StudioWorkspace />
    </>
  );
}
